// Seeds content_db with a real, curated DSA sheet (Striver/NeetCode-style).
// Idempotent: wipes topics+problems and re-inserts. Run: `npm run seed` (from content service)
// or `node services/content/src/seed.js` from the repo root.
import { connectMongo, makeRedis, env, logger } from '@dsa/common';
import { Topic } from './models/Topic.js';
import { Problem } from './models/Problem.js';

const log = logger('seed');

const SHEET = [
  {
    title: 'Arrays & Hashing',
    slug: 'arrays-hashing',
    description: 'Foundations: traversal, hashing, prefix sums, two-pointer warmups.',
    problems: [
      { title: 'Two Sum', difficulty: 'Easy', youtubeUrl: 'https://www.youtube.com/watch?v=KLlXCFG5TnA', leetcodeUrl: 'https://leetcode.com/problems/two-sum/', articleUrl: 'https://www.geeksforgeeks.org/two-sum/' },
      { title: 'Contains Duplicate', difficulty: 'Easy', youtubeUrl: 'https://www.youtube.com/watch?v=3OamzN90kPg', leetcodeUrl: 'https://leetcode.com/problems/contains-duplicate/', articleUrl: 'https://www.geeksforgeeks.org/check-if-array-contains-duplicates/' },
      { title: 'Group Anagrams', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=vzdNOK2oB2E', leetcodeUrl: 'https://leetcode.com/problems/group-anagrams/', articleUrl: 'https://www.geeksforgeeks.org/given-a-sequence-of-words-print-all-anagrams-together/' },
      { title: 'Product of Array Except Self', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=bNvIQI2wAjk', leetcodeUrl: 'https://leetcode.com/problems/product-of-array-except-self/', articleUrl: 'https://www.geeksforgeeks.org/a-product-array-puzzle/' },
    ],
  },
  {
    title: 'Two Pointers',
    slug: 'two-pointers',
    description: 'Opposite-end and fast/slow pointer patterns.',
    problems: [
      { title: 'Valid Palindrome', difficulty: 'Easy', youtubeUrl: 'https://www.youtube.com/watch?v=jJXJ16kPFWg', leetcodeUrl: 'https://leetcode.com/problems/valid-palindrome/', articleUrl: 'https://www.geeksforgeeks.org/c-program-check-given-string-palindrome/' },
      { title: 'Two Sum II - Input Array Is Sorted', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=cQ1Oz4ckceM', leetcodeUrl: 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/', articleUrl: 'https://www.geeksforgeeks.org/two-pointers-technique/' },
      { title: '3Sum', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=jzZsG8n2R9A', leetcodeUrl: 'https://leetcode.com/problems/3sum/', articleUrl: 'https://www.geeksforgeeks.org/find-a-triplet-that-sum-to-a-given-value/' },
      { title: 'Container With Most Water', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=UuiTKBwPgAo', leetcodeUrl: 'https://leetcode.com/problems/container-with-most-water/', articleUrl: 'https://www.geeksforgeeks.org/container-with-most-water/' },
    ],
  },
  {
    title: 'Sliding Window',
    slug: 'sliding-window',
    description: 'Fixed and variable-size window techniques.',
    problems: [
      { title: 'Best Time to Buy and Sell Stock', difficulty: 'Easy', youtubeUrl: 'https://www.youtube.com/watch?v=1pkOgXD63yU', leetcodeUrl: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/', articleUrl: 'https://www.geeksforgeeks.org/stock-buy-sell/' },
      { title: 'Longest Substring Without Repeating Characters', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=wiGpQwVHdE0', leetcodeUrl: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/', articleUrl: 'https://www.geeksforgeeks.org/length-of-the-longest-substring-without-repeating-characters/' },
      { title: 'Longest Repeating Character Replacement', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=gqXU1UyA8pk', leetcodeUrl: 'https://leetcode.com/problems/longest-repeating-character-replacement/', articleUrl: 'https://www.geeksforgeeks.org/longest-substring-with-at-most-k-distinct-characters/' },
      { title: 'Minimum Window Substring', difficulty: 'Hard', youtubeUrl: 'https://www.youtube.com/watch?v=jSto0O4AJbM', leetcodeUrl: 'https://leetcode.com/problems/minimum-window-substring/', articleUrl: 'https://www.geeksforgeeks.org/find-the-smallest-window-in-a-string-containing-all-characters-of-another-string/' },
    ],
  },
  {
    title: 'Stack',
    slug: 'stack',
    description: 'Monotonic stacks, parentheses, expression evaluation.',
    problems: [
      { title: 'Valid Parentheses', difficulty: 'Easy', youtubeUrl: 'https://www.youtube.com/watch?v=WTzjTskDFMg', leetcodeUrl: 'https://leetcode.com/problems/valid-parentheses/', articleUrl: 'https://www.geeksforgeeks.org/check-for-balanced-parentheses-in-an-expression/' },
      { title: 'Min Stack', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=qkLl7nAwDPo', leetcodeUrl: 'https://leetcode.com/problems/min-stack/', articleUrl: 'https://www.geeksforgeeks.org/design-a-stack-that-supports-getmin-in-o1-time-and-o1-extra-space/' },
      { title: 'Daily Temperatures', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=cTBiBSnjO3c', leetcodeUrl: 'https://leetcode.com/problems/daily-temperatures/', articleUrl: 'https://www.geeksforgeeks.org/next-greater-element/' },
      { title: 'Largest Rectangle in Histogram', difficulty: 'Hard', youtubeUrl: 'https://www.youtube.com/watch?v=zx5Sw9130L0', leetcodeUrl: 'https://leetcode.com/problems/largest-rectangle-in-histogram/', articleUrl: 'https://www.geeksforgeeks.org/largest-rectangle-under-histogram/' },
    ],
  },
  {
    title: 'Binary Search',
    slug: 'binary-search',
    description: 'Search on sorted arrays and on the answer space.',
    problems: [
      { title: 'Binary Search', difficulty: 'Easy', youtubeUrl: 'https://www.youtube.com/watch?v=s4DPM8ct1pI', leetcodeUrl: 'https://leetcode.com/problems/binary-search/', articleUrl: 'https://www.geeksforgeeks.org/binary-search/' },
      { title: 'Search a 2D Matrix', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=Ber2pi2C0j0', leetcodeUrl: 'https://leetcode.com/problems/search-a-2d-matrix/', articleUrl: 'https://www.geeksforgeeks.org/search-element-sorted-matrix/' },
      { title: 'Find Minimum in Rotated Sorted Array', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=nIVW4P8b1VA', leetcodeUrl: 'https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/', articleUrl: 'https://www.geeksforgeeks.org/find-minimum-element-in-a-sorted-and-rotated-array/' },
      { title: 'Median of Two Sorted Arrays', difficulty: 'Hard', youtubeUrl: 'https://www.youtube.com/watch?v=q6IEA26hvXc', leetcodeUrl: 'https://leetcode.com/problems/median-of-two-sorted-arrays/', articleUrl: 'https://www.geeksforgeeks.org/median-of-two-sorted-arrays-of-different-sizes/' },
    ],
  },
  {
    title: 'Linked List',
    slug: 'linked-list',
    description: 'Reversal, cycle detection, merge patterns.',
    problems: [
      { title: 'Reverse Linked List', difficulty: 'Easy', youtubeUrl: 'https://www.youtube.com/watch?v=G0_I-ZF0S38', leetcodeUrl: 'https://leetcode.com/problems/reverse-linked-list/', articleUrl: 'https://www.geeksforgeeks.org/reverse-a-linked-list/' },
      { title: 'Merge Two Sorted Lists', difficulty: 'Easy', youtubeUrl: 'https://www.youtube.com/watch?v=XIdigk956u0', leetcodeUrl: 'https://leetcode.com/problems/merge-two-sorted-lists/', articleUrl: 'https://www.geeksforgeeks.org/merge-two-sorted-linked-lists/' },
      { title: 'Linked List Cycle', difficulty: 'Easy', youtubeUrl: 'https://www.youtube.com/watch?v=gBTe7lFR3vc', leetcodeUrl: 'https://leetcode.com/problems/linked-list-cycle/', articleUrl: 'https://www.geeksforgeeks.org/detect-loop-in-a-linked-list/' },
      { title: 'LRU Cache', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=7ABFKPK2hD4', leetcodeUrl: 'https://leetcode.com/problems/lru-cache/', articleUrl: 'https://www.geeksforgeeks.org/lru-cache-implementation/' },
    ],
  },
  {
    title: 'Trees',
    slug: 'trees',
    description: 'Traversals, BST properties, recursion on trees.',
    problems: [
      { title: 'Invert Binary Tree', difficulty: 'Easy', youtubeUrl: 'https://www.youtube.com/watch?v=OnSn2XEQ4MY', leetcodeUrl: 'https://leetcode.com/problems/invert-binary-tree/', articleUrl: 'https://www.geeksforgeeks.org/write-an-efficient-c-function-to-convert-a-tree-into-its-mirror-tree/' },
      { title: 'Maximum Depth of Binary Tree', difficulty: 'Easy', youtubeUrl: 'https://www.youtube.com/watch?v=hTM3phVI6YQ', leetcodeUrl: 'https://leetcode.com/problems/maximum-depth-of-binary-tree/', articleUrl: 'https://www.geeksforgeeks.org/write-a-c-program-to-find-the-maximum-depth-or-height-of-a-tree/' },
      { title: 'Binary Tree Level Order Traversal', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=6ZnyEApgFYg', leetcodeUrl: 'https://leetcode.com/problems/binary-tree-level-order-traversal/', articleUrl: 'https://www.geeksforgeeks.org/level-order-tree-traversal/' },
      { title: 'Validate Binary Search Tree', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=s6ATEkipzow', leetcodeUrl: 'https://leetcode.com/problems/validate-binary-search-tree/', articleUrl: 'https://www.geeksforgeeks.org/a-program-to-check-if-a-binary-tree-is-bst-or-not/' },
    ],
  },
  {
    title: 'Graphs',
    slug: 'graphs',
    description: 'BFS/DFS, connected components, topological sort.',
    problems: [
      { title: 'Number of Islands', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=pV2kpPD66nE', leetcodeUrl: 'https://leetcode.com/problems/number-of-islands/', articleUrl: 'https://www.geeksforgeeks.org/find-number-of-islands/' },
      { title: 'Clone Graph', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=mQeF6bN8hMk', leetcodeUrl: 'https://leetcode.com/problems/clone-graph/', articleUrl: 'https://www.geeksforgeeks.org/clone-an-undirected-graph/' },
      { title: 'Course Schedule', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=EgI5nU9etnU', leetcodeUrl: 'https://leetcode.com/problems/course-schedule/', articleUrl: 'https://www.geeksforgeeks.org/topological-sorting/' },
      { title: 'Word Ladder', difficulty: 'Hard', youtubeUrl: 'https://www.youtube.com/watch?v=h9iTnkgv05E', leetcodeUrl: 'https://leetcode.com/problems/word-ladder/', articleUrl: 'https://www.geeksforgeeks.org/word-ladder-length-of-shortest-chain-to-reach-a-target-word/' },
    ],
  },
  {
    title: 'Dynamic Programming',
    slug: 'dynamic-programming',
    description: '1-D and 2-D DP, memoization vs tabulation.',
    problems: [
      { title: 'Climbing Stairs', difficulty: 'Easy', youtubeUrl: 'https://www.youtube.com/watch?v=Y0lT9Fck7qI', leetcodeUrl: 'https://leetcode.com/problems/climbing-stairs/', articleUrl: 'https://www.geeksforgeeks.org/count-ways-reach-nth-stair/' },
      { title: 'House Robber', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=73r3KWiEvyk', leetcodeUrl: 'https://leetcode.com/problems/house-robber/', articleUrl: 'https://www.geeksforgeeks.org/find-maximum-possible-stolen-value-houses/' },
      { title: 'Coin Change', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=H9bfqozjoqs', leetcodeUrl: 'https://leetcode.com/problems/coin-change/', articleUrl: 'https://www.geeksforgeeks.org/coin-change-dp-7/' },
      { title: 'Longest Common Subsequence', difficulty: 'Medium', youtubeUrl: 'https://www.youtube.com/watch?v=Ua0GhsJSlWM', leetcodeUrl: 'https://leetcode.com/problems/longest-common-subsequence/', articleUrl: 'https://www.geeksforgeeks.org/longest-common-subsequence-dp-4/' },
      { title: 'Edit Distance', difficulty: 'Hard', youtubeUrl: 'https://www.youtube.com/watch?v=XYi2-LPrwm4', leetcodeUrl: 'https://leetcode.com/problems/edit-distance/', articleUrl: 'https://www.geeksforgeeks.org/edit-distance-dp-5/' },
    ],
  },
];

async function run() {
  await connectMongo(env('MONGO_URL'), 'content_db', 'seed');
  await Topic.deleteMany({});
  await Problem.deleteMany({});

  let topicCount = 0;
  let problemCount = 0;
  for (let t = 0; t < SHEET.length; t++) {
    const def = SHEET[t];
    const topic = await Topic.create({
      title: def.title,
      slug: def.slug,
      description: def.description,
      order: t,
    });
    topicCount++;
    for (let p = 0; p < def.problems.length; p++) {
      await Problem.create({ ...def.problems[p], topicId: topic._id, order: p });
      problemCount++;
    }
  }

  // Bust the sheet cache so the new content is visible immediately.
  try {
    const redis = makeRedis(env('REDIS_URL'), 'seed');
    await redis.del('sheet:v1');
    redis.disconnect();
  } catch {
    /* redis optional for seed */
  }

  log.info('seed complete', { topics: topicCount, problems: problemCount });
  process.exit(0);
}

run().catch((e) => {
  log.error('seed failed', { err: e.message });
  process.exit(1);
});
