import express from 'express';
import { Queue } from 'bullmq';
import { connectMongo, makeRedis, internalAuth, errorHandler, logger, env } from '@dsa/common';
import { progressRouter } from './routes/progress.js';

const log = logger('progress');
const app = express();
app.use(express.json());

// BullMQ queue backed by Redis — progress.updated events fan out to notification-service.
const connection = makeRedis(env('REDIS_URL'), 'progress');
const queue = new Queue('progress-events', { connection });

app.get('/health', (_req, res) => res.json({ ok: true, service: 'progress' }));
app.use(internalAuth);
app.use('/progress', progressRouter(queue));
app.use(errorHandler('progress'));

const port = env('SERVICE_PORT', '4003');
await connectMongo(env('MONGO_URL'), 'progress_db', 'progress');
app.listen(port, () => log.info(`progress-service listening on :${port}`));
