import mongoose from 'mongoose';

// ─── Signup email-verification layer (isolated) ───
// Holds a not-yet-created account while the user verifies their email with an OTP.
// No real User exists until the code is confirmed, so unverified accounts never pollute
// the users collection. A TTL index auto-purges abandoned signups at otpExpiresAt.
//
// If signup email-verification is ever dropped, this whole file + its two routes can be
// removed without touching the rest of auth.
const pendingSignupSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    name: { type: String, trim: true, default: '' },
    passwordHash: { type: String, required: true },
    otpHash: { type: String, required: true },
    otpExpiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'pending_signups' }
);

// Mongo removes the doc once the wall clock passes otpExpiresAt.
pendingSignupSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingSignup = mongoose.model('PendingSignup', pendingSignupSchema);
