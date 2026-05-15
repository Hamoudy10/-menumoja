import logger from '../utils/logger';
import { AppError } from '../utils/errors';

const RESEND_API_BASE = 'https://api.resend.com';

interface EmailPayload {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
}

async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new AppError(500, 'EMAIL_CONFIG_ERROR', 'Resend API key not configured', 'Ufunguo wa Resend haujasanidiwa');
  }

  try {
    const response = await fetch(`${RESEND_API_BASE}/emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: payload.from,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.reply_to,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Resend API error', { status: response.status, body: errorBody });

      if (response.status === 422) {
        throw AppError.validation('Invalid email payload', 'Maelezo batili ya barua pepe');
      }
      if (response.status === 429) {
        throw new AppError(429, 'EMAIL_RATE_LIMIT', 'Email rate limit exceeded', 'Kikomo cha barua pepe kimezidiwa');
      }

      throw new AppError(502, 'EMAIL_SEND_FAILED', 'Failed to send email', 'Imeshindwa kutuma barua pepe');
    }

    logger.info('Email sent successfully', { to: Array.isArray(payload.to) ? payload.to.join(',') : payload.to, subject: payload.subject });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Email send error', { error });
    throw new AppError(502, 'EMAIL_SEND_FAILED', 'Failed to send email', 'Imeshindwa kutuma barua pepe');
  }
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM || 'MenuMoja <noreply@menumoja.co.ke>';
}

function generateWelcomeHtml(name: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f7f7f7; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #E8542E 0%, #D14B28 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to MenuMoja!</h1>
    </div>
    <div style="padding: 30px;">
      <p style="font-size: 16px; color: #333; line-height: 1.6;">Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p style="font-size: 16px; color: #333; line-height: 1.6;">Thank you for joining MenuMoja! We're excited to help you manage your restaurant digitally.</p>
      <p style="font-size: 16px; color: #333; line-height: 1.6;">Here's what you can do:</p>
      <ul style="font-size: 15px; color: #555; line-height: 1.8;">
        <li>Create and manage your digital menu</li>
        <li>Accept orders online and via USSD</li>
        <li>Receive payments via M-Pesa</li>
        <li>Track your sales and analytics</li>
      </ul>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'https://menumoja.co.ke'}/dashboard" style="background: #E8542E; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Get Started</a>
      </div>
      <p style="font-size: 14px; color: #888; margin-top: 30px;">If you have any questions, reply to this email or contact support@menumoja.co.ke</p>
    </div>
    <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #999;">
      <p>MenuMoja &copy; ${new Date().getFullYear()} | Nairobi, Kenya</p>
    </div>
  </div>
</body>
</html>`;
}

function generateOrderReceiptHtml(order: Record<string, any>): string {
  const items = order.items || [];
  const itemRows = items.map((item: any) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(item.name)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">KSh ${Number(item.price).toLocaleString()}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">KSh ${(item.quantity * item.price).toLocaleString()}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f7f7f7; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #E8542E 0%, #D14B28 100%); padding: 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Order Receipt</h1>
      <p style="color: #ffd0c0; margin: 5px 0 0;">Order #${escapeHtml(order.orderNumber)}</p>
    </div>
    <div style="padding: 25px;">
      <p style="font-size: 16px; color: #333; line-height: 1.6;">Thank you for your order from <strong>${escapeHtml(order.restaurantName || 'Restaurant')}</strong>!</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f8f8f8;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold; border-top: 2px solid #ddd;">Total:</td>
            <td style="padding: 10px; text-align: right; font-weight: bold; border-top: 2px solid #ddd;">KSh ${Number(order.totalAmount).toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 6px;">
        <p style="margin: 0 0 5px; color: #555;"><strong>Order Type:</strong> ${escapeHtml(order.orderType || 'Delivery')}</p>
        ${order.paymentMethod ? `<p style="margin: 0; color: #555;"><strong>Payment:</strong> ${escapeHtml(order.paymentMethod)}</p>` : ''}
      </div>
    </div>
    <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #999;">
      <p>MenuMoja &copy; ${new Date().getFullYear()} | Nairobi, Kenya</p>
    </div>
  </div>
</body>
</html>`;
}

function generatePaymentConfirmationHtml(payment: Record<string, any>): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f7f7f7; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #27AE60 0%, #1E8449 100%); padding: 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Payment Confirmed!</h1>
    </div>
    <div style="padding: 25px;">
      <p style="font-size: 16px; color: #333; line-height: 1.6;">Your payment has been received successfully.</p>
      <div style="margin: 20px 0; padding: 15px; background: #f0faf0; border-radius: 6px; border-left: 4px solid #27AE60;">
        <p style="margin: 0 0 5px;"><strong>Amount:</strong> KSh ${Number(payment.amount).toLocaleString()}</p>
        ${payment.mpesaReceiptNumber ? `<p style="margin: 0 0 5px;"><strong>M-Pesa Receipt:</strong> ${escapeHtml(payment.mpesaReceiptNumber)}</p>` : ''}
        ${payment.orderNumber ? `<p style="margin: 0;"><strong>Order:</strong> #${escapeHtml(payment.orderNumber)}</p>` : ''}
      </div>
      <p style="font-size: 14px; color: #888;">If you have any questions, please contact the restaurant directly.</p>
    </div>
    <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #999;">
      <p>MenuMoja &copy; ${new Date().getFullYear()} | Nairobi, Kenya</p>
    </div>
  </div>
</body>
</html>`;
}

function generatePasswordResetHtml(otp: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f7f7f7; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #E8542E; padding: 25px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Password Reset</h1>
    </div>
    <div style="padding: 25px;">
      <p style="font-size: 16px; color: #333; line-height: 1.6;">You requested a password reset. Use the code below to reset your password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <div style="display: inline-block; background: #f5f5f5; padding: 16px 40px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #E8542E; font-family: 'Courier New', monospace;">${otp}</div>
      </div>
      <p style="font-size: 14px; color: #888;">This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
    </div>
    <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #999;">
      <p>MenuMoja &copy; ${new Date().getFullYear()} | Nairobi, Kenya</p>
    </div>
  </div>
</body>
</html>`;
}

function generateSubscriptionWarningHtml(daysLeft: number): string {
  const isUrgent = daysLeft <= 3;
  const bgColor = isUrgent ? '#E74C3C' : '#F39C12';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f7f7f7; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: ${bgColor}; padding: 25px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Subscription ${isUrgent ? 'Expiring Soon!' : 'Reminder'}</h1>
    </div>
    <div style="padding: 25px;">
      <p style="font-size: 16px; color: #333; line-height: 1.6;">Your MenuMoja subscription will expire in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.</p>
      ${isUrgent ? '<p style="font-size: 16px; color: #E74C3C; line-height: 1.6;">Please renew your subscription to avoid service interruption.</p>' : '<p style="font-size: 16px; color: #333; line-height: 1.6;">Please renew your subscription to continue enjoying all MenuMoja features.</p>'}
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'https://menumoja.co.ke'}/billing" style="background: ${bgColor}; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Renew Now</a>
      </div>
    </div>
    <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #999;">
      <p>MenuMoja &copy; ${new Date().getFullYear()} | Nairobi, Kenya</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  await sendEmail({
    from: getFromAddress(),
    to: email,
    subject: 'Welcome to MenuMoja! 🎉',
    html: generateWelcomeHtml(name),
    text: `Welcome to MenuMoja, ${name}! Thank you for joining. Visit ${process.env.FRONTEND_URL || 'https://menumoja.co.ke'} to get started.`,
  });
}

export async function sendOrderReceipt(email: string, order: Record<string, any>): Promise<void> {
  await sendEmail({
    from: getFromAddress(),
    to: email,
    subject: `Order Receipt - #${order.orderNumber || 'N/A'}`,
    html: generateOrderReceiptHtml(order),
    text: `Order #${order.orderNumber} confirmed. Total: KSh ${Number(order.totalAmount).toLocaleString()}.`,
  });
}

export async function sendPaymentConfirmation(email: string, payment: Record<string, any>): Promise<void> {
  await sendEmail({
    from: getFromAddress(),
    to: email,
    subject: 'Payment Confirmed ✅',
    html: generatePaymentConfirmationHtml(payment),
    text: `Payment of KSh ${Number(payment.amount).toLocaleString()} confirmed.${payment.mpesaReceiptNumber ? ` Receipt: ${payment.mpesaReceiptNumber}` : ''}`,
  });
}

export async function sendPasswordReset(email: string, otp: string): Promise<void> {
  await sendEmail({
    from: getFromAddress(),
    to: email,
    subject: 'Password Reset Code',
    html: generatePasswordResetHtml(otp),
    text: `Your password reset code is: ${otp}. It expires in 10 minutes.`,
  });
}

export async function sendSubscriptionWarning(email: string, daysLeft: number): Promise<void> {
  const subject = daysLeft <= 3
    ? 'URGENT: Your MenuMoja subscription expires soon!'
    : `Reminder: MenuMoja subscription expires in ${daysLeft} days`;

  await sendEmail({
    from: getFromAddress(),
    to: email,
    subject,
    html: generateSubscriptionWarningHtml(daysLeft),
    text: `Your MenuMoja subscription expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Renew at ${process.env.FRONTEND_URL || 'https://menumoja.co.ke'}/billing`,
  });
}

export default {
  sendWelcomeEmail,
  sendOrderReceipt,
  sendPaymentConfirmation,
  sendPasswordReset,
  sendSubscriptionWarning,
};
