import mongoose from 'mongoose';

// A single problem under a topic, with difficulty + the three learning-resource links.
const problemSchema = new mongoose.Schema(
  {
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },
    title: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true, index: true },
    order: { type: Number, default: 0 },
    // Learning resources (assignment requirement). Empty string = not provided.
    youtubeUrl: { type: String, default: '' },
    leetcodeUrl: { type: String, default: '' }, // LeetCode / Codeforces practice link
    articleUrl: { type: String, default: '' },
  },
  { timestamps: true, collection: 'problems' }
);

// Fast ordered fetch of a topic's problems.
problemSchema.index({ topicId: 1, order: 1 });

export const Problem = mongoose.model('Problem', problemSchema);
