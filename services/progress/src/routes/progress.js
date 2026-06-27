import { Router } from 'express';
import { z } from 'zod';
import { asyncH, requireUser, requireRole } from '@dsa/common';
import { UserProgress } from '../models/UserProgress.js';

export function progressRouter(queue) {
  const router = Router();
  router.use(requireUser); // all progress is per-user and requires a session

  // Fire-and-forget event to notification-service. NEVER blocks the user's request —
  // if the queue is down the checkbox still saves; the notification just doesn't fire.
  const emit = (payload) => {
    if (!queue) return;
    queue.add('progress.updated', payload, { removeOnComplete: true, removeOnFail: 100 }).catch(() => {});
  };

  // ─── GET /progress — the caller's completed problem IDs (for resume-on-login) ───
  router.get(
    '/',
    asyncH(async (req, res) => {
      const rows = await UserProgress.find({ userId: req.userId }).select('problemId completedAt').lean();
      res.json({
        completed: rows.map((r) => r.problemId),
        count: rows.length,
      });
    })
  );

  const toggleSchema = z.object({ completed: z.boolean() });

  // ─── PUT /progress/:problemId — mark/unmark a problem complete (idempotent upsert) ───
  router.put(
    '/:problemId',
    asyncH(async (req, res) => {
      const { completed } = toggleSchema.parse(req.body);
      const { problemId } = req.params;

      if (completed) {
        await UserProgress.updateOne(
          { userId: req.userId, problemId },
          { $set: { completed: true, completedAt: new Date() } },
          { upsert: true }
        );
      } else {
        await UserProgress.deleteOne({ userId: req.userId, problemId });
      }

      const count = await UserProgress.countDocuments({ userId: req.userId });
      emit({
        userId: req.userId,
        problemId,
        action: completed ? 'completed' : 'uncompleted',
        count, // running total — lets notification-service detect milestones
        at: new Date().toISOString(),
      });
      res.json({ problemId, completed, count });
    })
  );

  // ─── GET /progress/summary — total completed (for the progress bar) ───
  router.get(
    '/summary',
    asyncH(async (req, res) => {
      const count = await UserProgress.countDocuments({ userId: req.userId });
      res.json({ count });
    })
  );

  // ─── GET /progress/activity?days=14 — daily solve counts for the activity chart ───
  router.get(
    '/activity',
    asyncH(async (req, res) => {
      const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 90);
      const since = new Date(Date.now() - (days - 1) * 86400000);
      since.setHours(0, 0, 0, 0);
      const rows = await UserProgress.aggregate([
        { $match: { userId: req.userId, completedAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } },
      ]);
      const counts = new Map(rows.map((r) => [r._id, r.count]));
      // Fill every day in the window (zeros included) so the chart has a continuous series.
      const series = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(since.getTime() + i * 86400000);
        const key = d.toISOString().slice(0, 10);
        series.push({ date: key, count: counts.get(key) || 0 });
      }
      res.json({ days, series });
    })
  );

  // ─── GET /progress/leaderboard — top users by problems solved (for Rankings) ───
  // Returns [{ userId, count }]; names are resolved by the caller (auth) for display.
  router.get(
    '/leaderboard',
    asyncH(async (_req, res) => {
      const rows = await UserProgress.aggregate([
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]);
      res.json({ leaderboard: rows.map((r) => ({ userId: r._id, count: r.count })) });
    })
  );

  // ─── GET /progress/all-counts — solved count per user, ALL users (admin overview) ───
  router.get(
    '/all-counts',
    requireRole('admin'),
    asyncH(async (_req, res) => {
      const rows = await UserProgress.aggregate([{ $group: { _id: '$userId', count: { $sum: 1 } } }]);
      const total = rows.reduce((n, r) => n + r.count, 0);
      res.json({ total, counts: rows.map((r) => ({ userId: r._id, count: r.count })) });
    })
  );

  // ─── DELETE /progress/internal/user/:userId — cascade on account deletion ───
  // Called service-to-service by auth (internal key required). Removes all of a user's progress.
  router.delete(
    '/internal/user/:userId',
    asyncH(async (req, res) => {
      const r = await UserProgress.deleteMany({ userId: req.params.userId });
      res.json({ ok: true, deleted: r.deletedCount });
    })
  );

  return router;
}
