import axios from 'axios';
import logger from '../utils/logger';

/**
 * KRA eTIMS adapter (Electronic Tax Invoice Management System).
 *
 * ⚠️ COMPLIANCE WARNING — read before using:
 * - This adapter is an ARCHITECTURE and PAYLOAD SKELETON. The official KRA
 *   eTIMS API contract (endpoints, auth flow, payload field names, version)
 *   MUST be verified against KRA's current developer documentation and
 *   tested in the KRA SANDBOX before any production submission.
 * - MenuMoja NEVER marks a receipt "compliant" from local success. A receipt
 *   is only ever reported as "SUBMITTED to KRA" (or REJECTED/FAILED), and
 *   only the KRA-returned invoice number counts as evidence.
 * - Without ETIMS_* credentials the adapter is a safe no-op (submissions
 *   stay PENDING and are surfaced for the owner to act on).
 */

export interface EtimsConfig {
  environment: 'sandbox' | 'production';
  baseUrl: string;
  username: string;
  password: string;
  branchId: string; // bhfId
  deviceSerialNo: string; // dvcSrlNo
  deviceId: string; // sdcId / dvcId
}

// Default endpoints per environment — VERIFY against current KRA docs.
const SANDBOX_BASE = process.env.ETIMS_SANDBOX_URL || 'https://seller-portal.etims.kra.go.ke/etims/api';
const PRODUCTION_BASE = process.env.ETIMS_BASE_URL || 'https://etims.kra.go.ke/etims/api';

export function getEtimsConfig(): EtimsConfig | null {
  const environment = (process.env.ETIMS_ENV || 'sandbox') === 'production' ? 'production' : 'sandbox';
  const username = process.env.ETIMS_USERNAME;
  const password = process.env.ETIMS_PASSWORD;
  const branchId = process.env.ETIMS_BRANCH_ID || '00';
  const deviceSerialNo = process.env.ETIMS_DEVICE_SERIAL || '';
  const deviceId = process.env.ETIMS_DEVICE_ID || '';

  if (!username || !password) return null;
  return {
    environment,
    baseUrl: environment === 'production' ? PRODUCTION_BASE : SANDBOX_BASE,
    username,
    password,
    branchId,
    deviceSerialNo,
    deviceId,
  };
}

export function isEtimsConfigured(): boolean {
  return getEtimsConfig() !== null;
}

let authToken: string | null = null;
let authExpiresAt = 0;

/**
 * Authenticates and caches the token. The exact endpoint and payload shape
 * must be verified against KRA's current documentation.
 */
export async function authenticate(): Promise<string> {
  const config = getEtimsConfig();
  if (!config) throw new Error('eTIMS is not configured');

  if (authToken && Date.now() < authExpiresAt) return authToken;

  // VERIFY: endpoint + payload per current KRA eTIMS API docs.
  const response = await axios.post(`${config.baseUrl}/token`, {
    username: config.username,
    password: config.password,
  }, { timeout: 15000 });

  const token = response.data?.data?.token || response.data?.token || response.data?.access_token;
  if (!token) {
    throw new Error('eTIMS authentication response did not include a token — verify the API contract');
  }

  authToken = token;
  authExpiresAt = Date.now() + 50 * 60 * 1000; // refresh before expiry
  return token;
}

export interface EtimsReceiptInput {
  receipt: any;
  restaurant: {
    kraPin: string | null;
    name: string;
    address: string;
    phone: string;
  };
}

/**
 * Builds an A1-style self-issued receipt payload.
 * Field names follow the eTIMS business-document conventions commonly
 * documented for A1 — VERIFY every field against the current KRA schema
 * during sandbox certification.
 */
export function buildA1Payload(input: EtimsReceiptInput): Record<string, any> {
  const { receipt, restaurant } = input;
  const items = (receipt.items || []).map((i: any) => ({
    itemSeq: 1,
    itemCd: i.itemName?.slice(0, 20) || 'ITEM',
    itemNm: i.itemName || 'Item',
    qty: i.quantity || 1,
    prc: Number(i.itemPrice || 0),
    splyAmt: Number(i.subtotal || i.itemPrice * i.quantity || 0),
    totDcAmt: 0,
    taxblAmt: Number(i.subtotal || 0),
    taxTyCd: 'B', // VAT at standard rate — verify
    taxAmt: Math.round((Number(i.subtotal || 0) * 16) / 116 * 100) / 100,
  }));

  return {
    tin: restaurant.kraPin,
    bhfId: process.env.ETIMS_BRANCH_ID || '00',
    dvcSrlNo: process.env.ETIMS_DEVICE_SERIAL || '',
    dvcId: process.env.ETIMS_DEVICE_ID || '',
    sdcId: process.env.ETIMS_DEVICE_ID || '',
    mrcNo: '',
    sarNo: '',
    orgDcNo: '',
    rcptTyCd: '01', // normal receipt — verify
    pmtTyCd: receipt.paymentMethod === 'MPESA' ? '02' : receipt.paymentMethod === 'CARD' ? '03' : '01', // verify codes
    salesTyCd: '01',
    rcptPbctDate: new Date(receipt.issueDate || new Date()).toISOString().slice(0, 10),
    rcptTotalAmt: Number(receipt.amount || 0),
    cfmAmt: Number(receipt.amount || 0),
    vatAmt: Number(receipt.vatAmount || 0),
    totDcAmt: 0,
    taxblAmt: Number(receipt.amount || 0) - Number(receipt.vatAmount || 0),
    itemList: items,
  };
}

/**
 * Submits a receipt to KRA eTIMS. Returns a normalized result. NEVER throws
 * on business errors — the caller decides retry policy.
 * VERIFY: endpoint path + request/response envelope per current KRA docs.
 */
export async function submitReceipt(payload: Record<string, any>): Promise<{
  ok: boolean;
  retryable: boolean;
  responseCode: string | null;
  message: string | null;
  invoiceNumber: string | null;
}> {
  const config = getEtimsConfig();
  if (!config) {
    return { ok: false, retryable: true, responseCode: null, message: 'eTIMS not configured', invoiceNumber: null };
  }

  try {
    const token = await authenticate();
    const response = await axios.post(`${config.baseUrl}/saveReceipt`, payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 20000,
    });

    const result = response.data?.data || response.data || {};
    const resultCode = String(result.resultCd ?? result.statusCode ?? '');
    const message = String(result.resultMsg ?? result.message ?? '');

    if (resultCode === '0000' || result.invoiceNumber || result.rcptNo) {
      return {
        ok: true,
        retryable: false,
        responseCode: resultCode,
        message,
        invoiceNumber: String(result.invoiceNumber || result.rcptNo || ''),
      };
    }

    // Business rejection (e.g. invalid TIN, payload validation) — retrying won't help
    return { ok: false, retryable: false, responseCode: resultCode, message: message || 'Rejected by eTIMS', invoiceNumber: null };
  } catch (error: any) {
    const isTimeout = error?.code === 'ECONNABORTED' || error?.response?.status >= 500;
    logger.warn('eTIMS submission failed', {
      error: error.message,
      retryable: isTimeout || !error?.response,
    });
    return {
      ok: false,
      retryable: isTimeout || !error?.response,
      responseCode: String(error?.response?.status || 'NETWORK'),
      message: error.message,
      invoiceNumber: null,
    };
  }
}

export default { getEtimsConfig, isEtimsConfigured, authenticate, buildA1Payload, submitReceipt };
