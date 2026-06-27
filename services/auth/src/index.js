import express from 'express';
import { connectMongo, internalAuth, errorHandler, logger, env } from '@dsa/common';
import { authRouter } from './routes/auth.js';

const log = logger('auth');
const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'auth' }));

// Every request must arrive via the gateway (internal key). The gateway injects x-user-id
// for authenticated sessions; public routes simply don't require it.
app.use(internalAuth);
app.use('/auth', authRouter);

app.use(errorHandler('auth'));

const port = env('SERVICE_PORT', '4001');
await connectMongo(env('MONGO_URL'), 'auth_db', 'auth');
app.listen(port, () => log.info(`auth-service listening on :${port}`));
