import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.MAIL_USERNAME || '',
    pass: process.env.MAIL_PASSWORD || '',
  },
});

export async function sendOtpEmail({ to, code }) {
  if (!to || !code) throw new Error('Email and code are required');

  const html = `
    <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px; background: #fff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 56px; height: 56px; border-radius: 16px; background: #840037; display: inline-flex; align-items: center; justify-content: center;">
          <span style="font-size: 28px; color: #fff;">🔐</span>
        </div>
      </div>
      <h2 style="text-align: center; color: #191c1d; font-size: 20px; margin: 0 0 8px;">Your Verification Code</h2>
      <p style="text-align: center; color: #574145; font-size: 14px; margin: 0 0 24px;">
        Enter this code to verify your identity
      </p>
      <div style="text-align: center; background: #f8f4f5; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #840037;">${code}</span>
      </div>
      <p style="text-align: center; color: #888; font-size: 12px; margin: 0;">
        This code expires in 5 minutes. If you didn't request this, please ignore this email.
      </p>
    </div>
  `;

  const fromAddress = (process.env.MAIL_FROM_ADDRESS || 'orders@myhappyhour.co.ke').replace(/"/g, '');

  await transporter.sendMail({
    from: `"Happy Hour" <${fromAddress}>`,
    to,
    subject: `Your verification code: ${code}`,
    html,
    text: `Your verification code is: ${code}. It expires in 5 minutes.`,
  });
}
