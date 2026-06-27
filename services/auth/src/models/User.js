import mongoose from 'mongoose';

const notifPrefsSchema = new mongoose.Schema(
  {
    dailyReminder: { type: Boolean, default: true },
    weeklySummary: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    // Kept for backward-compat / display; firstName+lastName are the editable fields.
    name: { type: String, trim: true, default: '' },
    firstName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, default: '', maxlength: 280 },
    avatarUrl: { type: String, default: '' }, // /api/auth/avatar/<id> once uploaded

    // Null for accounts created purely via Google OAuth (no local password).
    passwordHash: { type: String, default: null },
    role: { type: String, enum: ['student', 'admin'], default: 'student', index: true },

    notifPrefs: { type: notifPrefsSchema, default: () => ({}) },

    // Email-based 2FA. When enabled, login requires a one-time code emailed to the user.
    twoFactorEnabled: { type: Boolean, default: false },
    // Transient one-time code (hashed) used for login OTP and enable/disable verification.
    otpHash: { type: String, default: null, select: false },
    otpExpiresAt: { type: Date, default: null, select: false },
    otpPurpose: { type: String, default: null, select: false }, // login | enable | disable

    googleId: { type: String, default: null, index: true, sparse: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'users' }
);

export const User = mongoose.model('User', userSchema);
