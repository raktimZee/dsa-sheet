import { ApiError } from './errors.js';

// Identity is injected by the gateway (see internalAuth). These helpers read it.
export const currentUser = (req) => ({ id: req.userId, role: req.userRole });

// Require an authenticated user (gateway only forwards x-user-id for valid sessions).
export const requireUser = (req, _res, next) => {
  if (!req.userId) return next(new ApiError(401, 'login required', 'no_user'));
  next();
};

// RBAC guard — e.g. requireRole('admin') for content CRUD / seeding endpoints.
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.userId) return next(new ApiError(401, 'login required', 'no_user'));
  if (!roles.includes(req.userRole)) {
    return next(new ApiError(403, 'forbidden', 'role'));
  }
  next();
};
