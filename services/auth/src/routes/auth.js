import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { asyncH, ApiError, requireUser, requireRole } from '@dsa/common';
import { User } from '../models/User.js';
import { PendingSignup } from '../models/PendingSignup.js';
import { sendOtpEmail } from '../mailer.js';
import { generateOtp, hashOtp, setOtpOn, verifyOtpOn, clearOtpOn, OTP_TTL_MS } from '../otp.js';

export const authRouter = Router();

// Avatars are stored on a mounted volume (persists across restarts) and served back via
// GET /auth/avatar/:id. Small files only.
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => cb(null, !!ALLOWED[file.mimetype]),
});

const PROGRESS_URL = process.env.PROGRESS_URL || 'http://progress:4003';
const NOTIFICATION_URL = process.env.NOTIFICATION_URL || 'http://notification:4004';
// Service-to-service call carrying the internal key + acting-as user id.
const internalFetch = (url, userId, opts = {}) =>
  fetch(url, {
    ...opts,
    headers: { 'x-internal-key': process.env.INTERNAL_KEY, 'x-user-id': userId, ...(opts.headers || {}) },
  });

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '7d';
const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

const signToken = (u) =>
  jwt.sign({ sub: u._id.toString(), role: u.role, email: u.email, name: u.name }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });

const publicUser = (u) => ({
  id: u._id.toString(),
  email: u.email,
  name: u.name,
  firstName: u.firstName,
  lastName: u.lastName,
  bio: u.bio,
  avatarUrl: u.avatarUrl,
  role: u.role,
  twoFactorEnabled: u.twoFactorEnabled,
  notifPrefs: u.notifPrefs || { dailyReminder: true, weeklySummary: false },
  memberSince: u.createdAt,
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'password must be at least 8 chars'),
  name: z.string().trim().max(80).optional(),
});

// ─── Register (signup email-verification layer) ─────────────────────────────
// Step 1: validate + stash a pending signup, email a code. No real account yet.
// Step 2 (/register/verify): confirm the code, then create the account + auto-login.
// (Self-contained: remove these two handlers + PendingSignup to make signup instant.)
authRouter.post(
  '/register',
  asyncH(async (req, res) => {
    const { email, password, name } = registerSchema.parse(req.body);
    const lower = email.toLowerCase();
    const exists = await User.findOne({ email: lower });
    if (exists) throw new ApiError(409, 'email already registered', 'email_taken');

    const passwordHash = await bcrypt.hash(password, 10);
    const code = generateOtp();
    // Upsert the pending signup so re-submitting just refreshes the code.
    await PendingSignup.findOneAndUpdate(
      { email: lower },
      {
        email: lower,
        name: name || '',
        passwordHash,
        otpHash: await hashOtp(code),
        otpCode: code,
        otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        otpSentAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Email must go out before we claim a code was sent — otherwise the user is stuck.
    try {
      await sendOtpEmail(lower, code, 'signup');
    } catch {
      throw new ApiError(502, 'could not send verification email — try again', 'email_failed');
    }
    res.status(202).json({ otpRequired: true, email: lower });
  })
);

const registerVerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().trim().min(1, 'code is required'),
});

authRouter.post(
  '/register/verify',
  asyncH(async (req, res) => {
    const { email, otp } = registerVerifySchema.parse(req.body);
    const lower = email.toLowerCase();
    const pending = await PendingSignup.findOne({ email: lower });
    if (!pending) throw new ApiError(400, 'no pending signup — start again', 'no_pending');
    if (pending.otpExpiresAt.getTime() < Date.now()) {
      await PendingSignup.deleteOne({ _id: pending._id });
      throw new ApiError(400, 'code expired — start again', 'otp_expired');
    }
    const ok = await bcrypt.compare(otp, pending.otpHash);
    if (!ok) throw new ApiError(401, 'invalid verification code', 'bad_otp');

    // Guard against a race where the email got registered in the meantime.
    if (await User.findOne({ email: lower })) {
      await PendingSignup.deleteOne({ _id: pending._id });
      throw new ApiError(409, 'email already registered', 'email_taken');
    }

    // First account on a fresh DB becomes admin (lets us seed content right away).
    const isFirst = (await User.estimatedDocumentCount()) === 0;
    const [firstName = '', ...rest] = (pending.name || '').trim().split(/\s+/);
    const user = await User.create({
      email: lower,
      name: pending.name || '',
      firstName,
      lastName: rest.join(' '),
      passwordHash: pending.passwordHash,
      role: isFirst ? 'admin' : 'student',
      lastLoginAt: new Date(),
    });
    await PendingSignup.deleteOne({ _id: pending._id });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

const resendSchema = z.object({ email: z.string().email() });

// ─── Resend the signup code ───
// Reuses the SAME code if the current one was emailed < 20s ago and is still valid;
// otherwise issues a fresh code. Stops rapid resends from burning a new code each time.
const RESEND_REUSE_MS = 20 * 1000;
authRouter.post(
  '/register/resend',
  asyncH(async (req, res) => {
    const { email } = resendSchema.parse(req.body);
    const lower = email.toLowerCase();
    const pending = await PendingSignup.findOne({ email: lower });
    if (!pending) throw new ApiError(400, 'no pending signup — start again', 'no_pending');

    const now = Date.now();
    const recent = pending.otpSentAt && now - pending.otpSentAt.getTime() < RESEND_REUSE_MS;
    const valid = pending.otpExpiresAt && pending.otpExpiresAt.getTime() > now && pending.otpCode;

    let code;
    const reused = !!(recent && valid);
    if (reused) {
      code = pending.otpCode; // same code within the 20s window
    } else {
      code = generateOtp();
      pending.otpHash = await hashOtp(code);
      pending.otpCode = code;
      pending.otpExpiresAt = new Date(now + OTP_TTL_MS);
      pending.otpSentAt = new Date(now);
    }
    await pending.save();

    try {
      await sendOtpEmail(lower, code, 'signup');
    } catch {
      throw new ApiError(502, 'could not resend the code — try again', 'email_failed');
    }
    res.json({ otpRequired: true, email: lower, reused });
  })
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  otp: z.string().trim().optional(),
});

// ─── Login (password, then an emailed OTP if 2FA is enabled) ───
authRouter.post(
  '/login',
  asyncH(async (req, res) => {
    const { email, password, otp } = loginSchema.parse(req.body);
    // OTP fields are select:false — pull them explicitly for the 2FA check.
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+otpHash +otpExpiresAt +otpPurpose'
    );
    // Distinct messages so the user knows whether to sign up vs. fix their password.
    // (Trades a little anti-enumeration hardening for clearer UX.)
    if (!user) throw new ApiError(404, 'No account found with this email. Please sign up.', 'no_account');
    if (!user.passwordHash)
      throw new ApiError(400, 'This account uses Google sign-in — use "Continue with Google".', 'use_google');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new ApiError(401, 'Incorrect password. Please try again.', 'bad_password');

    if (user.twoFactorEnabled) {
      if (!otp) {
        // First leg: password is correct — email a code and prompt for it. Don't issue a
        // token, and don't claim a code was sent unless the email actually went out.
        const code = generateOtp();
        await setOtpOn(user, code, 'login');
        try {
          await sendOtpEmail(user.email, code, 'login');
        } catch {
          throw new ApiError(502, 'could not send your code — try again', 'email_failed');
        }
        await user.save();
        return res.json({ twoFactorRequired: true });
      }
      // Second leg: verify the emailed code.
      const valid = await verifyOtpOn(user, otp, 'login');
      if (!valid) throw new ApiError(401, 'invalid or expired code', 'bad_otp');
      clearOtpOn(user);
    }

    user.lastLoginAt = new Date();
    await user.save();
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

// ─── Google OAuth (optional — only active if GOOGLE_CLIENT_ID is set) ───
authRouter.post(
  '/google',
  asyncH(async (req, res) => {
    if (!googleClient) throw new ApiError(501, 'Google login not configured', 'no_google');
    const { credential } = req.body || {};
    if (!credential) throw new ApiError(400, 'missing credential', 'bad_request');

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p?.email) throw new ApiError(401, 'google verification failed', 'bad_google');

    let user = await User.findOne({ email: p.email.toLowerCase() });
    if (!user) {
      const isFirst = (await User.estimatedDocumentCount()) === 0;
      user = await User.create({
        email: p.email,
        name: p.name || '',
        googleId: p.sub,
        role: isFirst ? 'admin' : 'student',
      });
    } else if (!user.googleId) {
      user.googleId = p.sub;
    }
    user.lastLoginAt = new Date();
    await user.save();
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

// ─── Current user ───
authRouter.get(
  '/me',
  requireUser,
  asyncH(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) throw new ApiError(404, 'user not found', 'no_user');
    res.json({ user: publicUser(user) });
  })
);

// ─── Admin: all users + summary (for the admin overview dashboard) ───
authRouter.get(
  '/admin/users',
  requireRole('admin'),
  asyncH(async (_req, res) => {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    const admins = users.filter((u) => u.role === 'admin').length;
    res.json({
      total: users.length,
      admins,
      students: users.length - admins,
      twoFactor: users.filter((u) => u.twoFactorEnabled).length,
      google: users.filter((u) => u.googleId).length,
      users: users.map((u) => ({
        id: u._id.toString(),
        email: u.email,
        name: u.name || [u.firstName, u.lastName].filter(Boolean).join(' '),
        role: u.role,
        twoFactorEnabled: !!u.twoFactorEnabled,
        viaGoogle: !!u.googleId,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      })),
    });
  })
);

// Emails a fresh code for an enable/disable action and stashes its hash on the user.
const sendActionCode = async (user, purpose) => {
  const code = generateOtp();
  await setOtpOn(user, code, purpose);
  try {
    await sendOtpEmail(user.email, code, purpose);
  } catch {
    throw new ApiError(502, 'could not send the verification email — try again', 'email_failed');
  }
  await user.save();
};

// ─── 2FA: email a code to begin enabling ───
authRouter.post(
  '/2fa/setup',
  requireUser,
  asyncH(async (req, res) => {
    const user = await User.findById(req.userId).select('+otpHash +otpExpiresAt +otpPurpose');
    if (!user) throw new ApiError(404, 'user not found', 'no_user');
    if (user.twoFactorEnabled) throw new ApiError(409, '2FA already enabled', 'already_2fa');
    await sendActionCode(user, 'enable');
    res.json({ sent: true, email: user.email });
  })
);

// ─── 2FA: verify the emailed code and turn it on ───
authRouter.post(
  '/2fa/enable',
  requireUser,
  asyncH(async (req, res) => {
    const { token } = req.body || {};
    const user = await User.findById(req.userId).select('+otpHash +otpExpiresAt +otpPurpose');
    if (!user) throw new ApiError(404, 'user not found', 'no_user');
    if (user.twoFactorEnabled) throw new ApiError(409, '2FA already enabled', 'already_2fa');
    const valid = await verifyOtpOn(user, token, 'enable');
    if (!valid) throw new ApiError(401, 'invalid or expired code', 'bad_otp');
    user.twoFactorEnabled = true;
    clearOtpOn(user);
    await user.save();
    res.json({ ok: true, twoFactorEnabled: true });
  })
);

// ─── 2FA: email a code to begin disabling ───
authRouter.post(
  '/2fa/disable/setup',
  requireUser,
  asyncH(async (req, res) => {
    const user = await User.findById(req.userId).select('+otpHash +otpExpiresAt +otpPurpose');
    if (!user) throw new ApiError(404, 'user not found', 'no_user');
    if (!user.twoFactorEnabled) throw new ApiError(400, '2FA not enabled', 'no_2fa');
    await sendActionCode(user, 'disable');
    res.json({ sent: true, email: user.email });
  })
);

// ─── 2FA: verify the emailed code and turn it off ───
authRouter.post(
  '/2fa/disable',
  requireUser,
  asyncH(async (req, res) => {
    const { token } = req.body || {};
    const user = await User.findById(req.userId).select('+otpHash +otpExpiresAt +otpPurpose');
    if (!user?.twoFactorEnabled) throw new ApiError(400, '2FA not enabled', 'no_2fa');
    const valid = await verifyOtpOn(user, token, 'disable');
    if (!valid) throw new ApiError(401, 'invalid or expired code', 'bad_otp');
    user.twoFactorEnabled = false;
    clearOtpOn(user);
    await user.save();
    res.json({ ok: true, twoFactorEnabled: false });
  })
);

// ─── Update profile (name, email, bio) ───
const profileSchema = z.object({
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  email: z.string().email().optional(),
  bio: z.string().trim().max(280).optional(),
});

authRouter.patch(
  '/profile',
  requireUser,
  asyncH(async (req, res) => {
    const data = profileSchema.parse(req.body);
    const user = await User.findById(req.userId);
    if (!user) throw new ApiError(404, 'user not found', 'no_user');

    if (data.email && data.email.toLowerCase() !== user.email) {
      const taken = await User.findOne({ email: data.email.toLowerCase() });
      if (taken) throw new ApiError(409, 'email already in use', 'email_taken');
      user.email = data.email.toLowerCase();
    }
    if (data.firstName !== undefined) user.firstName = data.firstName;
    if (data.lastName !== undefined) user.lastName = data.lastName;
    if (data.bio !== undefined) user.bio = data.bio;
    user.name = `${user.firstName} ${user.lastName}`.trim();
    await user.save();
    res.json({ user: publicUser(user) });
  })
);

// ─── Change password (requires the current one) ───
const changePwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'new password must be at least 8 chars'),
});

authRouter.post(
  '/change-password',
  requireUser,
  asyncH(async (req, res) => {
    const { currentPassword, newPassword } = changePwSchema.parse(req.body);
    const user = await User.findById(req.userId);
    if (!user) throw new ApiError(404, 'user not found', 'no_user');
    if (!user.passwordHash) throw new ApiError(400, 'account has no password (social login)', 'no_password');

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new ApiError(401, 'current password is incorrect', 'bad_password');

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ ok: true });
  })
);

// ─── Update notification preferences ───
const notifSchema = z.object({
  dailyReminder: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
});

authRouter.put(
  '/notifications',
  requireUser,
  asyncH(async (req, res) => {
    const data = notifSchema.parse(req.body);
    const user = await User.findById(req.userId);
    if (!user) throw new ApiError(404, 'user not found', 'no_user');
    user.notifPrefs = { ...user.notifPrefs?.toObject?.() ?? user.notifPrefs, ...data };
    await user.save();
    res.json({ notifPrefs: user.notifPrefs });
  })
);

// ─── Avatar: upload (multipart 'avatar') ───
authRouter.post(
  '/avatar',
  requireUser,
  upload.single('avatar'),
  asyncH(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'no image (allowed: png/jpg/webp/gif, <=2MB)', 'bad_file');
    const ext = ALLOWED[req.file.mimetype];
    const filename = `${req.userId}${ext}`;
    // Remove any prior avatar with a different extension.
    for (const e of Object.values(ALLOWED)) {
      const p = path.join(UPLOAD_DIR, `${req.userId}${e}`);
      if (e !== ext && fs.existsSync(p)) fs.unlinkSync(p);
    }
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
    const user = await User.findById(req.userId);
    user.avatarUrl = `/api/auth/avatar/${req.userId}?v=${Date.now()}`;
    await user.save();
    res.json({ avatarUrl: user.avatarUrl });
  })
);

// ─── Avatar: serve (public via gateway; image is non-sensitive) ───
authRouter.get(
  '/avatar/:id',
  asyncH(async (req, res) => {
    for (const e of Object.values(ALLOWED)) {
      const p = path.join(UPLOAD_DIR, `${req.params.id}${e}`);
      if (fs.existsSync(p)) {
        res.set('Cache-Control', 'public, max-age=86400');
        return res.sendFile(p);
      }
    }
    throw new ApiError(404, 'no avatar', 'no_avatar');
  })
);

// ─── Leaderboard (Rankings): combine progress counts with user names ───
authRouter.get(
  '/leaderboard',
  requireUser,
  asyncH(async (req, res) => {
    let rows = [];
    try {
      const r = await internalFetch(`${PROGRESS_URL}/progress/leaderboard`, req.userId);
      if (r.ok) rows = (await r.json()).leaderboard || [];
    } catch {
      /* empty leaderboard if progress unavailable */
    }
    const users = await User.find({ _id: { $in: rows.map((x) => x.userId) } })
      .select('firstName lastName name avatarUrl')
      .lean();
    const byId = new Map(users.map((u) => [u._id.toString(), u]));
    const leaderboard = rows.map((x, i) => {
      const u = byId.get(x.userId) || {};
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || 'Anonymous';
      return {
        rank: i + 1,
        name,
        avatarUrl: u.avatarUrl || '',
        solved: x.count,
        isMe: x.userId === req.userId,
      };
    });
    res.json({ leaderboard });
  })
);

// ─── Export all my data (profile + progress) as a downloadable JSON ───
authRouter.get(
  '/export',
  requireUser,
  asyncH(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) throw new ApiError(404, 'user not found', 'no_user');
    let progress = { completed: [], count: 0 };
    try {
      const r = await internalFetch(`${PROGRESS_URL}/progress`, req.userId);
      if (r.ok) progress = await r.json();
    } catch {
      /* progress optional in export */
    }
    res.set('Content-Disposition', 'attachment; filename="algosheet-data.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      profile: publicUser(user),
      progress,
    });
  })
);

// ─── Delete my account (cascades progress; best-effort notifications) ───
authRouter.delete(
  '/account',
  requireUser,
  asyncH(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) throw new ApiError(404, 'user not found', 'no_user');

    // Cascade: remove this user's progress + notifications in the owning services.
    await Promise.allSettled([
      internalFetch(`${PROGRESS_URL}/progress/internal/user/${req.userId}`, req.userId, { method: 'DELETE' }),
      internalFetch(`${NOTIFICATION_URL}/notifications/internal/user/${req.userId}`, req.userId, { method: 'DELETE' }),
    ]);
    // Remove avatar file if present.
    for (const e of Object.values(ALLOWED)) {
      const p = path.join(UPLOAD_DIR, `${req.userId}${e}`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await User.findByIdAndDelete(req.userId);
    res.json({ ok: true });
  })
);
