import mongoose from 'mongoose';

// A chapter/topic in the sheet (e.g. "Arrays", "Dynamic Programming").
const topicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 0, index: true }, // display order in the sheet
  },
  { timestamps: true, collection: 'topics' }
);

export const Topic = mongoose.model('Topic', topicSchema);
