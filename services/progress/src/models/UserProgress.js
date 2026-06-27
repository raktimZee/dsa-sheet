import mongoose from 'mongoose';

// One row per (user, problem). We store userId/problemId as strings — they are owned by the
// auth and content services respectively, so we deliberately avoid cross-service ObjectId refs.
const userProgressSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    problemId: { type: String, required: true },
    completed: { type: Boolean, default: true },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'user_progress' }
);

// A user marks each problem at most once — upsert target + fast "my progress" lookups.
userProgressSchema.index({ userId: 1, problemId: 1 }, { unique: true });

export const UserProgress = mongoose.model('UserProgress', userProgressSchema);
