// One-time-code helpers shared by the login / 2FA / signup flows.
// Codes are 6 digits, stored only as a bcrypt hash with an expiry + a purpose tag so a
// login code can't be replayed to (say) disable 2FA.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Cryptographically-random 6-digit string (zero-padded).
export const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

export const hashOtp = (code) => bcrypt.hash(code, 10);

// Writes a freshly-issued code's hash/expiry/purpose onto a doc (does not save).
export async function setOtpOn(doc, code, purpose) {
  doc.otpHash = await hashOtp(code);
  doc.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  doc.otpPurpose = purpose;
}

// Validates a submitted code against a doc for a given purpose. Returns true only if a
// non-expired code of the matching purpose verifies.
export async function verifyOtpOn(doc, code, purpose) {
  if (!doc?.otpHash || !doc?.otpExpiresAt || !doc?.otpPurpose) return false;
  if (doc.otpPurpose !== purpose) return false;
  if (doc.otpExpiresAt.getTime() < Date.now()) return false;
  if (!code) return false;
  return bcrypt.compare(String(code).trim(), doc.otpHash);
}

// Clears OTP fields after a successful verification (does not save).
export function clearOtpOn(doc) {
  doc.otpHash = null;
  doc.otpExpiresAt = null;
  doc.otpPurpose = null;
}
