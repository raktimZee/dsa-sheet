import { ApiError } from './errors.js';

// Services are NOT publicly exposed — only nginx -> gateway is. The gateway authenticates
// the JWT once, then calls services over the internal docker network with a shared secret.
// This middleware rejects anything that didn't come through the gateway.
export const internalAuth = (req, _res, next) => {
  const key = req.header('x-internal-key');
  if (!key || key !== process.env.INTERNAL_KEY) {
    return next(new ApiError(401, 'unauthorized (internal)', 'internal_auth'));
  }
  // Gateway forwards the authenticated identity it extracted from the JWT.
  req.userId = req.header('x-user-id') || null;
  req.userRole = req.header('x-user-role') || 'student';
  next();
};
