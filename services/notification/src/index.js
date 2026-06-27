import express from 'express';
import { Worker } from 'bullmq';
import { connectMongo, makeRedis, internalAuth, errorHandler, logger, env } from '@dsa/common';
import { Notification } from './models/Notification.js';
import { notificationsRouter } from './routes/notifications.js';

const log = logger('notification');

const MILESTONES = new Set([1, 5, 10, 25, 50, 100]);

await connectMongo(env('MONGO_URL'), 'notif_db', 'notification');
const connection = makeRedis(env('REDIS_URL'), 'notification');

// ─── Consumer: turn progress events into stored notifications ───
// Fully decoupled: if this service is down, BullMQ keeps the jobs in Redis and we process
// them when it comes back — the user's progress never blocks on it.
const worker = new Worker(
  'progress-events',
  async (job) => {
    const { userId, action, count } = job.data || {};
    if (!userId) return;

    if (action === 'completed') {
      await Notification.create({
        userId,
        type: 'progress',
        message: `Nice! You solved a problem. ${count} done so far.`,
      });
      if (MILESTONES.has(count)) {
        await Notification.create({
          userId,
          type: 'milestone',
          message: `🎉 Milestone reached: ${count} problems completed!`,
        });
      }
    }
    // 'uncompleted' events are intentionally not notified.
  },
  { connection, concurrency: 5 }
);

worker.on('completed', (job) => log.info('processed event', { jobId: job.id }));
worker.on('failed', (job, err) => log.error('event failed', { jobId: job?.id, err: err?.message }));
log.info('notification worker started, consuming progress-events');

// ─── HTTP API: surface notifications to the user (via the gateway) ───
const app = express();
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, service: 'notification' }));
app.use(internalAuth);
app.use('/notifications', notificationsRouter);
app.use(errorHandler('notification'));

const port = env('SERVICE_PORT', '4004');
app.listen(port, () => log.info(`notification-service HTTP listening on :${port}`));
