import { Router } from 'express';
import { z } from 'zod';
import { asyncH, ApiError, requireUser, requireRole } from '@dsa/common';
import { Topic } from '../models/Topic.js';
import { Problem } from '../models/Problem.js';

const SHEET_KEY = 'sheet:v1';
const SHEET_TTL = 300; // seconds — content rarely changes; invalidated on every admin write

export function contentRouter(redis) {
  const router = Router();

  const invalidate = () => redis.del(SHEET_KEY).catch(() => {});

  // Build the full ordered sheet: topics, each with its problems nested.
  const buildSheet = async () => {
    const topics = await Topic.find().sort({ order: 1, title: 1 }).lean();
    const problems = await Problem.find().sort({ order: 1, title: 1 }).lean();
    const byTopic = new Map();
    for (const p of problems) {
      const key = p.topicId.toString();
      if (!byTopic.has(key)) byTopic.set(key, []);
      byTopic.get(key).push({
        id: p._id.toString(),
        title: p.title,
        difficulty: p.difficulty,
        youtubeUrl: p.youtubeUrl,
        leetcodeUrl: p.leetcodeUrl,
        articleUrl: p.articleUrl,
      });
    }
    return topics.map((t) => ({
      id: t._id.toString(),
      title: t.title,
      slug: t.slug,
      description: t.description,
      problems: byTopic.get(t._id.toString()) || [],
    }));
  };

  // ─── GET /content/sheet — the whole DSA sheet (Redis-cached) ───
  router.get(
    '/sheet',
    requireUser,
    asyncH(async (_req, res) => {
      const cached = await redis.get(SHEET_KEY).catch(() => null);
      if (cached) return res.json({ topics: JSON.parse(cached), cached: true });
      const topics = await buildSheet();
      redis.set(SHEET_KEY, JSON.stringify(topics), 'EX', SHEET_TTL).catch(() => {});
      res.json({ topics, cached: false });
    })
  );

  // ─── Admin: topics ───
  const topicSchema = z.object({
    title: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    description: z.string().optional(),
    order: z.number().int().optional(),
  });

  router.post(
    '/topics',
    requireRole('admin'),
    asyncH(async (req, res) => {
      const data = topicSchema.parse(req.body);
      const topic = await Topic.create(data);
      await invalidate();
      res.status(201).json({ topic });
    })
  );

  router.patch(
    '/topics/:id',
    requireRole('admin'),
    asyncH(async (req, res) => {
      const topic = await Topic.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!topic) throw new ApiError(404, 'topic not found', 'no_topic');
      await invalidate();
      res.json({ topic });
    })
  );

  router.delete(
    '/topics/:id',
    requireRole('admin'),
    asyncH(async (req, res) => {
      await Problem.deleteMany({ topicId: req.params.id }); // cascade
      await Topic.findByIdAndDelete(req.params.id);
      await invalidate();
      res.json({ ok: true });
    })
  );

  // ─── Admin: problems ───
  const problemSchema = z.object({
    topicId: z.string().min(1),
    title: z.string().trim().min(1),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']),
    order: z.number().int().optional(),
    youtubeUrl: z.string().url().optional().or(z.literal('')),
    leetcodeUrl: z.string().url().optional().or(z.literal('')),
    articleUrl: z.string().url().optional().or(z.literal('')),
  });

  router.post(
    '/problems',
    requireRole('admin'),
    asyncH(async (req, res) => {
      const data = problemSchema.parse(req.body);
      const exists = await Topic.exists({ _id: data.topicId });
      if (!exists) throw new ApiError(400, 'topic does not exist', 'bad_topic');
      const problem = await Problem.create(data);
      await invalidate();
      res.status(201).json({ problem });
    })
  );

  router.patch(
    '/problems/:id',
    requireRole('admin'),
    asyncH(async (req, res) => {
      const problem = await Problem.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!problem) throw new ApiError(404, 'problem not found', 'no_problem');
      await invalidate();
      res.json({ problem });
    })
  );

  router.delete(
    '/problems/:id',
    requireRole('admin'),
    asyncH(async (req, res) => {
      await Problem.findByIdAndDelete(req.params.id);
      await invalidate();
      res.json({ ok: true });
    })
  );

  return router;
}
