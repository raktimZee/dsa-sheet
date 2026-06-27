// Email sender for OTP / verification codes (Gmail SMTP via an app password).
// All 2FA + signup verification flows go through here. Sender identity is configured
// via env: MAIL_USER (the gmail address), MAIL_APP_PASSWORD (16-char app password),
// MAIL_FROM_NAME (display name shown to the recipient).
import nodemailer from 'nodemailer';
import { logger } from '@dsa/common';

const log = logger('auth:mailer');

const MAIL_USER = process.env.MAIL_USER || '';
// Gmail app passwords are shown as "xxxx xxxx xxxx xxxx" — strip spaces defensively so a
// pasted variant still authenticates.
const MAIL_APP_PASSWORD = (process.env.MAIL_APP_PASSWORD || '').replace(/\s/g, '');
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'Assignment Apna College';

const mailConfigured = !!(MAIL_USER && MAIL_APP_PASSWORD);

// One reusable transporter (created lazily). Gmail over implicit TLS on 465.
let transporter = null;
const getTransport = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: MAIL_USER, pass: MAIL_APP_PASSWORD },
    });
  }
  return transporter;
};

const PURPOSE_COPY = {
  login: 'sign in to your account',
  enable: 'enable two-factor authentication',
  disable: 'disable two-factor authentication',
  signup: 'verify your email and create your account',
};

// Plain, on-brand email matching the app's "Terminal Dark" theme:
// dark surface, terminal-green accent, monospace code. Kept deliberately minimal.
const otpHtml = (code, purpose) => {
  const reason = PURPOSE_COPY[purpose] || 'continue';
  const mono = '"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  return `
  <div style="background:#0D1117;padding:32px 16px;font-family:${mono}">
    <div style="max-width:440px;margin:0 auto;background:#161B22;border:1px solid #30363D;border-radius:6px;padding:28px">
      <p style="margin:0 0 24px;font-size:16px;font-weight:700;color:#3FB950">&gt; AlgoSheet</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#E6EDF3">Your code to ${reason}:</p>
      <div style="font-size:30px;font-weight:700;letter-spacing:8px;color:#3FB950;background:#0D1117;border:1px solid #30363D;border-radius:6px;text-align:center;padding:16px;margin:0 0 20px">${code}</div>
      <p style="margin:0 0 4px;font-size:13px;color:#8B949E">Expires in 10 minutes.</p>
      <p style="margin:0;font-size:13px;color:#8B949E">Didn't request this? Ignore this email.</p>
    </div>
  </div>`;
};

// Sends a one-time code. Throws on failure so callers can avoid issuing a token /
// marking 2FA enabled when the email never went out.
export async function sendOtpEmail(to, code, purpose) {
  if (!mailConfigured) {
    throw new Error('email is not configured (set MAIL_USER and MAIL_APP_PASSWORD)');
  }
  const reason = PURPOSE_COPY[purpose] || 'verification';
  try {
    await getTransport().sendMail({
      from: `"${MAIL_FROM_NAME}" <${MAIL_USER}>`,
      to,
      subject: `Your AlgoSheet code: ${code}`,
      text: `Your one-time code to ${reason} is ${code}. It expires in 10 minutes.`,
      html: otpHtml(code, purpose),
    });
    log.info('otp email sent', { to, purpose });
  } catch (err) {
    log.error('otp email failed', { to, purpose, err: err?.message });
    throw err;
  }
}

export { mailConfigured };
