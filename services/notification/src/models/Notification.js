import mongoose from 'mongoose';

// In-app notifications produced by consuming progress events. Stored in notif_db.
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ['progress', 'milestone'], default: 'progress' },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'notifications' }
);

export const Notification = mongoose.model('Notification', notificationSchema);
