import { Router } from 'express';
import { asyncH, requireUser } from '@dsa/common';
import { Notification } from '../models/Notification.js';

export const notificationsRouter = Router();

// ─── GET /notifications — the caller's notifications (newest first) + unread count ───
notificationsRouter.get(
  '/',
  requireUser,
  asyncH(async (req, res) => {
    const [items, unread] = await Promise.all([
      Notification.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50).lean(),
      Notification.countDocuments({ userId: req.userId, read: false }),
    ]);
    res.json({
      unread,
      notifications: items.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt,
      })),
    });
  })
);

// ─── POST /notifications/read-all — mark all of the caller's as read ───
notificationsRouter.post(
  '/read-all',
  requireUser,
  asyncH(async (req, res) => {
    const r = await Notification.updateMany({ userId: req.userId, read: false }, { $set: { read: true } });
    res.json({ ok: true, marked: r.modifiedCount });
  })
);

// ─── DELETE /notifications/internal/user/:userId — cascade on account deletion ───
notificationsRouter.delete(
  '/internal/user/:userId',
  asyncH(async (req, res) => {
    const r = await Notification.deleteMany({ userId: req.params.userId });
    res.json({ ok: true, deleted: r.deletedCount });
  })
);
