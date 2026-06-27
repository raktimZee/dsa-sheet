// Seeds (or refreshes) the admin account used for the admin portal. Idempotent — upserts by email.
// Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD, defaulting to admin@admin.com / admin.
// Run: node services/auth/src/seed-admin.js   (or: docker compose exec auth node services/auth/src/seed-admin.js)
import bcrypt from 'bcryptjs';
import { connectMongo, env, logger } from '@dsa/common';
import { User } from './models/User.js';

const log = logger('seed-admin');

async function run() {
  await connectMongo(env('MONGO_URL'), 'auth_db', 'seed-admin');

  const email = (process.env.ADMIN_EMAIL || 'admin@admin.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.findOneAndUpdate(
    { email },
    {
      // Always (re)assert admin role + password so the login is predictable.
      $set: { passwordHash, role: 'admin', twoFactorEnabled: false },
      $setOnInsert: { email, name: 'Admin', firstName: 'Admin', lastName: '' },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  log.info('admin ready', { email, role: user.role });
  process.exit(0);
}

run().catch((e) => {
  log.error('seed-admin failed', { err: e.message });
  process.exit(1);
});
