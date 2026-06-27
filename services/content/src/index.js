import express from 'express';
import { connectMongo, makeRedis, internalAuth, errorHandler, logger, env } from '@dsa/common';
import { contentRouter } from './routes/content.js';

const log = logger('content');
const app = express();
app.use(express.json());

const redis = makeRedis(env('REDIS_URL'), 'content');

app.get('/health', (_req, res) => res.json({ ok: true, service: 'content' }));
app.use(internalAuth);
app.use('/content', contentRouter(redis));
app.use(errorHandler('content'));

const port = env('SERVICE_PORT', '4002');
await connectMongo(env('MONGO_URL'), 'content_db', 'content');
app.listen(port, () => log.info(`content-service listening on :${port}`));
