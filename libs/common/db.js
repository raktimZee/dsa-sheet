import mongoose from 'mongoose';
import { logger } from './logger.js';

// Connect to a logical database. We run ONE Mongo deployment but a DB per service
// (auth_db, content_db, progress_db, notif_db) — clean ownership, no cross-service writes,
// and a trivial migration path to separate clusters later.
export async function connectMongo(baseUrl, dbName, svc = 'db') {
  const log = logger(svc);
  mongoose.set('strictQuery', true);
  const url = `${baseUrl.replace(/\/$/, '')}/${dbName}`;
  let attempt = 0;
  // Containers race on startup — retry so a service doesn't die before Mongo is ready.
  while (true) {
    try {
      await mongoose.connect(url, { serverSelectionTimeoutMS: 4000 });
      log.info('mongo connected', { dbName });
      return mongoose.connection;
    } catch (err) {
      attempt += 1;
      if (attempt >= 10) throw err;
      log.warn('mongo connect retry', { attempt, err: err.message });
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
