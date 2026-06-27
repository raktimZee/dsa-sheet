// Uniform error handling across services.
export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || 'error';
  }
}

// Wrap async route handlers so thrown errors reach the error middleware.
export const asyncH = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Express error middleware (must be registered last).
export const errorHandler = (svc) => (err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(`[${svc}]`, err);
  res.status(status).json({ error: err.message || 'Internal error', code: err.code || 'error' });
};
