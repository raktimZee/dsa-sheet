import { Router } from 'express';
import { asyncH, requireUser } from '@dsa/common';
import { Topic } from '../models/Topic.js';
import { Problem } from '../models/Problem.js';

const SHEET_KEY = 'sheet:v1';
const SHEET_TTL = 300; // seconds — content rarely changes; seeded via the seed script

export function contentRouter(redis) {
  const router = Router();

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

  return router;
}
