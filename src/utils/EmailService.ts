import { Booking } from '../types';
import { generateReceipt } from './ReceiptGenerator';

interface EmailParams {
  booking: Booking;
  paidAmount: number;
  collectorName: string;
}

/**
 * YouthCamping Automated Email Service
 * Sends payment confirmations with PDF receipts attached.
 */
export const sendPaymentEmail = async ({ booking, paidAmount, collectorName }: EmailParams) => {
  // 1. Validations
  if (!booking.email || booking.email.trim() === '') {
    console.warn(`Skipping email: No email address for ${booking.name}`);
    return { success: false, error: 'No email' };
  }

  if (paidAmount <= 0) {
    console.log('Skipping email: Payment amount is 0');
    return { success: false, error: 'No payment' };
  }

  try {
    // 2. Generate Receipt PDF in Base64 for attachment
    const pdfBase64 = generateReceipt(booking, collectorName, 'base64');
    
    if (!pdfBase64) {
      throw new Error('Failed to generate PDF for attachment');
    }

    const emailTemplate = `
      <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #0b3c5d; margin: 0;">YouthCamping</h1>
          <p style="font-size: 0.8rem; color: #f97316; font-weight: bold; margin-top: 5px;">LIVE THE ADVENTURE</p>
        </div>

        <p>Dear <strong>${booking.name}</strong>,</p>
        <p>Warm greetings from <strong>Youthcamping</strong>.</p>
        <p>We are pleased to confirm that we have successfully received your payment of <strong>₹${paidAmount.toLocaleString()}</strong>.</p>
        <p>For your reference, this payment has been collected by <strong>${collectorName}</strong>. Please find your payment receipt attached with this email for your records.</p>
        
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0b3c5d;">Payment Summary:</h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Amount Paid:</strong> ₹${paidAmount.toLocaleString()}</li>
            <li><strong>Remaining Balance:</strong> ₹${(booking.remaining_amount || 0).toLocaleString()}</li>
            <li><strong>Payment Date:</strong> ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</li>
          </ul>
        </div>

        <p>We sincerely appreciate your trust in Youthcamping. We look forward to providing you with a seamless and memorable experience.</p>
        
        <p style="margin-top: 30px;">Warm regards,<br><strong>Team Youthcamping</strong></p>
      </div>
    `;

    // 3. Send via Resend API
    // NOTE: In production, the API Key should be set in .env (VITE_RESEND_API_KEY)
    const RESEND_API_KEY = (import.meta as any).env.VITE_RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.log('--- MOCK EMAIL SEND (No API Key) ---');
      console.log('To:', booking.email);
      console.log('Subject: Payment Confirmation & Receipt | Youthcamping');
      console.log('Attachment: Receipt PDF Generated');
      return { success: true, mock: true };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Youthcamping <noreply@youthcamping.in>',
        to: [booking.email],
        subject: 'Payment Confirmation & Receipt | Youthcamping',
        html: emailTemplate,
        attachments: [
          {
            content: pdfBase64,
            filename: `Receipt_${booking.name.replace(/\s/g, '_')}.pdf`,
          }
        ]
      })
    });

    const result = await response.json();
    return { success: response.ok, data: result };

  } catch (error) {
    console.error('Email Service Error:', error);
    return { success: false, error };
  }
};
