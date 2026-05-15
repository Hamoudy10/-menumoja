import logger from '../utils/logger';
import { AppError } from '../utils/errors';
import * as mpesa from '../integrations/mpesa';
import { sendSMS } from '../integrations/africasTalking';

interface OrderService {
  getOrderById: (orderId: string) => Promise<OrderRecord | null>;
  updateOrderPayment: (orderId: string, paymentData: { paymentId: string; status: string; mpesaReceipt?: string }) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  getCustomerPhone: (orderId: string) => Promise<string>;
  getRestaurantName: (orderId: string) => Promise<string>;
  getOwnerPhone: (orderId: string) => Promise<string>;
}

interface PaymentService {
  createPayment: (data: {
    orderId: string;
    amount: number;
    phone: string;
    method: string;
    checkoutRequestId: string;
    status: string;
  }) => Promise<PaymentRecord>;
  updatePayment: (checkoutRequestId: string, data: Record<string, any>) => Promise<void>;
  getPaymentByCheckoutRequestId: (checkoutRequestId: string) => Promise<PaymentRecord | null>;
  getPendingPaymentsOlderThan: (minutes: number) => Promise<Array<PaymentRecord>>;
}

interface SocketService {
  emitToOrder: (orderId: string, event: string, data: any) => void;
  emitToRestaurant: (restaurantId: string, event: string, data: any) => void;
}

interface OrderRecord {
  id: string;
  orderNumber: string;
  amount: number;
  customerPhone: string;
  customerEmail?: string;
  restaurantId: string;
  status: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  totalAmount: number;
  restaurantName?: string;
  paymentId?: string;
}

interface PaymentRecord {
  id: string;
  orderId: string;
  amount: number;
  phone: string;
  method: string;
  status: string;
  checkoutRequestId: string;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
}

const PENDING_PAYMENT_QUERY_INTERVAL_MINUTES = 2;

export async function initiatePayment(
  orderId: string,
  orders: OrderService,
  payments: PaymentService
): Promise<{
  checkoutRequestId: string;
  MerchantRequestID: string;
  ResponseDescription: string;
}> {
  const order = await orders.getOrderById(orderId);
  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found', 'Agizo halikupatikana');
  }

  if (order.status === 'paid' || order.status === 'completed') {
    throw AppError.validation('Order is already paid', 'Agizo tayari limelipwa');
  }

  if (order.status === 'cancelled') {
    throw AppError.validation('Order is cancelled', 'Agizo limeghairiwa');
  }

  if (!order.customerPhone) {
    throw AppError.validation('Customer phone is required for M-Pesa payment', 'Nambari ya simu ya mteja inahitajika kwa malipo ya M-Pesa');
  }

  if (order.amount < 1) {
    throw AppError.validation('Invalid payment amount', 'Kiasi batili cha malipo');
  }

  const shortCode = process.env.MPESA_SHORTCODE || '174379';

  const result = await mpesa.stkPush(
    order.customerPhone,
    order.amount,
    order.orderNumber,
    shortCode
  );

  await payments.createPayment({
    orderId: order.id,
    amount: order.amount,
    phone: order.customerPhone,
    method: 'mpesa',
    checkoutRequestId: result.checkoutRequestId,
    status: 'pending',
  });

  logger.info('M-Pesa payment initiated', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    checkoutRequestId: result.checkoutRequestId,
    amount: order.amount,
  });

  return result;
}

export async function handleCallback(
  body: any,
  orders: OrderService,
  payments: PaymentService,
  sockets: SocketService
): Promise<{ success: boolean; message: string }> {
  const callbackData = body?.Body?.stkCallback;
  if (!callbackData) {
    throw new AppError(400, 'INVALID_CALLBACK', 'Invalid M-Pesa callback', 'Maelezo batili ya M-Pesa');
  }

  const checkoutRequestId = callbackData.CheckoutRequestID;

  const idempotencyStatus = await mpesa.checkIdempotency(checkoutRequestId);
  if (idempotencyStatus === 'completed') {
    logger.warn('Duplicate M-Pesa callback received', { checkoutRequestId });
    return { success: true, message: 'Already processed' };
  }

  const validCallback = mpesa.validateCallback(body);

  const payment = await payments.getPaymentByCheckoutRequestId(checkoutRequestId);
  if (!payment) {
    logger.error('Payment not found for callback', { checkoutRequestId });
    await mpesa.markIdempotencyComplete(checkoutRequestId);
    return { success: false, message: 'Payment not found' };
  }

  if (!validCallback.success) {
    const resultCode = callbackData.ResultCode;
    const resultDesc = callbackData.ResultDesc;

    logger.warn('M-Pesa payment failed', {
      checkoutRequestId,
      resultCode,
      resultDesc,
      orderId: payment.orderId,
    });

    await payments.updatePayment(checkoutRequestId, {
      status: 'failed',
      resultCode,
      resultDesc,
    });

    await orders.updateOrderStatus(payment.orderId, 'payment_failed');
    await mpesa.markIdempotencyComplete(checkoutRequestId);

    try {
      const customerPhone = await orders.getCustomerPhone(payment.orderId);
      await sendSMS(customerPhone, `Payment failed for order. ${resultDesc || 'Please try again.'}`);
    } catch (smsError) {
      logger.error('Failed to send payment failure SMS', { error: smsError });
    }

    return { success: false, message: resultDesc || 'Payment failed' };
  }

  await payments.updatePayment(checkoutRequestId, {
    status: 'completed',
    mpesaReceiptNumber: validCallback.mpesaReceiptNumber,
    amount: validCallback.amount,
    transactionDate: validCallback.transactionDate,
  });

  await orders.updateOrderPayment(payment.orderId, {
    paymentId: payment.id,
    status: 'paid',
    mpesaReceipt: validCallback.mpesaReceiptNumber,
  });

  await mpesa.markIdempotencyComplete(checkoutRequestId);

  const order = await orders.getOrderById(payment.orderId);
  if (order) {
    sockets.emitToOrder(order.orderNumber, 'payment:completed', {
      status: 'paid',
      mpesaReceiptNumber: validCallback.mpesaReceiptNumber,
      amount: validCallback.amount,
    });

    sockets.emitToRestaurant(order.restaurantId, 'order:paid', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentMethod: 'M-Pesa',
    });

    try {
      const restaurantName = await orders.getRestaurantName(payment.orderId);
      const customerPhone = validCallback.phone || order.customerPhone;

      const itemSummary = (order.items || [])
        .map((i: any) => `${i.name} x${i.quantity}`)
        .join(', ');

      await sendSMS(
        customerPhone,
        `Payment of KSh ${Number(validCallback.amount || order.amount).toLocaleString()} received! Receipt: ${validCallback.mpesaReceiptNumber}. Order #${order.orderNumber}. ${restaurantName}`
      );

      const ownerPhone = await orders.getOwnerPhone(payment.orderId);
      if (ownerPhone) {
        await sendSMS(
          ownerPhone,
          `New payment: KSh ${Number(validCallback.amount || order.amount).toLocaleString()} via M-Pesa. Receipt: ${validCallback.mpesaReceiptNumber}. Order #${order.orderNumber}`
        );
      }
    } catch (smsError) {
      logger.error('Failed to send payment SMS notifications', { error: smsError });
    }
  }

  logger.info('M-Pesa payment completed', {
    checkoutRequestId,
    mpesaReceiptNumber: validCallback.mpesaReceiptNumber,
    amount: validCallback.amount,
    orderId: payment.orderId,
  });

  return { success: true, message: 'Payment processed successfully' };
}

export async function queryPendingPayments(
  payments: PaymentService,
  orders: OrderService
): Promise<void> {
  try {
    const pendingPayments = await payments.getPendingPaymentsOlderThan(PENDING_PAYMENT_QUERY_INTERVAL_MINUTES);

    if (!pendingPayments.length) return;

    logger.info(`Checking ${pendingPayments.length} pending M-Pesa payments`);

    for (const payment of pendingPayments) {
      try {
        const result = await mpesa.queryStatus(payment.checkoutRequestId);

        if (result.ResultCode === 0) {
          const mpesaReceiptNumber = result.ReceiptNumber;
          const amount = result.Amount;

          await payments.updatePayment(payment.checkoutRequestId, {
            status: 'completed',
            mpesaReceiptNumber,
            amount,
          });

          await orders.updateOrderPayment(payment.orderId, {
            paymentId: payment.id,
            status: 'paid',
            mpesaReceipt: mpesaReceiptNumber,
          });

          await mpesa.markIdempotencyComplete(payment.checkoutRequestId);

          logger.info('Pending payment resolved as completed', {
            checkoutRequestId: payment.checkoutRequestId,
            mpesaReceiptNumber,
            amount,
          });
        } else if (result.ResultCode !== 1) {
          await payments.updatePayment(payment.checkoutRequestId, {
            status: 'failed',
            resultCode: result.ResultCode,
            resultDesc: result.ResultDesc,
          });

          await handlePaymentFailure(payment.orderId, orders);

          logger.warn('Pending payment resolved as failed', {
            checkoutRequestId: payment.checkoutRequestId,
            resultCode: result.ResultCode,
            resultDesc: result.ResultDesc,
          });
        }
      } catch (error) {
        logger.error('Failed to query pending payment', {
          checkoutRequestId: payment.checkoutRequestId,
          error,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to query pending payments', { error });
  }
}

export async function handlePaymentFailure(
  orderId: string,
  orders: OrderService
): Promise<void> {
  try {
    await orders.updateOrderStatus(orderId, 'payment_failed');

    const customerPhone = await orders.getCustomerPhone(orderId);
    if (customerPhone) {
      await sendSMS(
        customerPhone,
        'Your payment was not successful. Please try ordering again or use a different payment method. Malipo yako hayakufanikiwa. Tafadhali jaribu kuagiza tena.'
      );
    }

    logger.info('Payment failure handled', { orderId });
  } catch (error) {
    logger.error('Failed to handle payment failure', { error, orderId });
  }
}

export async function initiateRefund(
  orderId: string,
  amount: number,
  phone: string,
  orders: OrderService,
  payments: PaymentService
): Promise<{ ConversationID: string }> {
  const order = await orders.getOrderById(orderId);
  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found', 'Agizo halikupatikana');
  }

  if (order.status !== 'paid') {
    throw AppError.validation('Order is not paid', 'Agizo halijalipwa');
  }

  const result = await mpesa.initiateB2CPayment(
    phone,
    amount,
    `Refund for order ${order.orderNumber}`,
    'Refund'
  );

  await payments.updatePayment(order.paymentId || '', {
    status: 'refunded',
    refundConversationId: result.ConversationID,
  });

  await orders.updateOrderStatus(orderId, 'refunded');

  logger.info('Refund initiated', { orderId, amount, conversationId: result.ConversationID });

  return { ConversationID: result.ConversationID };
}

export default {
  initiatePayment,
  handleCallback,
  queryPendingPayments,
  handlePaymentFailure,
  initiateRefund,
};
