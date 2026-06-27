import express from 'express';
import jwt from 'jsonwebtoken';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { makeRedis, logger, env } from '@dsa/common';

const log = logger('gateway');
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true); // behind nginx — use X-Forwarded-For for client IP

const JWT_SECRET = env('JWT_SECRET');
const INTERNAL_KEY = env('INTERNAL_KEY');
const PORT = env('SERVICE_PORT', '4000');

const TARGETS = {
  auth: env('AUTH_URL', 'http://auth:4001'),
  content: env('CONTENT_URL', 'http://content:4002'),
  progress: env('PROGRESS_URL', 'http://progress:4003'),
  notification: env('NOTIFICATION_URL', 'http://notification:4004'),
};

// ─── Distributed rate limiting (shared across gateway replicas via Redis) ───
const redis = makeRedis(env('REDIS_URL'), 'gateway');
const limiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl',
  points: 120, // requests
  duration: 60, // per minute, per IP
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'gateway' }));

app.use(async (req, res, next) => {
  try {
    await limiter.consume(req.ip || 'unknown');
    next();
  } catch (rej) {
    // rate-limiter-flexible rejects with RateLimiterRes when the limit is hit, but with a
    // real Error if Redis itself is down — don't 429 all traffic on a Redis blip.
    if (rej instanceof Error) return res.status(503).json({ error: 'service unavailable', code: 'rl_backend' });
    res.status(429).json({ error: 'too many requests', code: 'rate_limited' });
  }
});

// ─── Optional JWT auth: verify if present, but don't block public routes here ───
// (Each service decides what requires a user via requireUser / requireRole.)
app.use((req, _res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  req.authUser = null;
  if (token) {
    try {
      const p = jwt.verify(token, JWT_SECRET);
      req.authUser = { id: p.sub, role: p.role, email: p.email };
    } catch {
      /* invalid/expired token -> treated as anonymous */
    }
  }
  next();
});

// Inject trusted identity headers onto the upstream request. We ALWAYS overwrite/strip
// these so a client can never spoof x-user-id or x-internal-key through nginx.
const injectHeaders = (proxyReq, req) => {
  proxyReq.setHeader('x-internal-key', INTERNAL_KEY);
  if (req.authUser) {
    proxyReq.setHeader('x-user-id', req.authUser.id);
    proxyReq.setHeader('x-user-role', req.authUser.role || 'student');
  } else {
    proxyReq.removeHeader('x-user-id');
    proxyReq.removeHeader('x-user-role');
  }
};

// Mount at the app level (no Express sub-path) and select with pathFilter, so the proxy
// always sees the FULL original URL — no mount-path stripping ambiguity. pathRewrite then
// drops just the `/api` segment: /api/auth/login -> /auth/login (matches the service router).
const mkProxy = (prefix, target) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter: (path) => path === prefix || path.startsWith(prefix + '/'),
    pathRewrite: { '^/api': '' },
    on: {
      proxyReq: injectHeaders,
      error: (err, _req, res) => {
        log.error('upstream error', { target, err: err.message });
        if (!res.headersSent) res.status(502).json({ error: 'upstream unavailable', code: 'bad_gateway' });
      },
    },
  });

// We do NOT parse the body here — the proxy streams it raw to the services.
app.use(mkProxy('/api/auth', TARGETS.auth));
app.use(mkProxy('/api/content', TARGETS.content));
app.use(mkProxy('/api/progress', TARGETS.progress));
app.use(mkProxy('/api/notifications', TARGETS.notification));

app.use((_req, res) => res.status(404).json({ error: 'not found', code: 'not_found' }));

app.listen(PORT, () => log.info(`gateway listening on :${PORT}`, { targets: TARGETS }));
