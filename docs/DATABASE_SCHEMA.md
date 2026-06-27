# Database Schema (LLD) — DSA Sheet

MongoDB, one **logical database per service**. There are **no cross-service foreign keys** — services
reference each other's entities by id (stored as strings) and never join across databases. This keeps
each service independently deployable and shardable.

```
auth_db        → users
content_db     → topics, problems
progress_db    → user_progress
notif_db       → notifications
```

---

## Entities & relationships

```
   users (auth_db)                    topics (content_db)
   ┌──────────────┐                   ┌──────────────┐
   │ _id          │◀─────┐            │ _id          │◀────┐
   │ email (uniq) │      │            │ slug (uniq)  │     │
   │ role         │      │            │ order        │     │ topicId
   └──────────────┘      │            └──────────────┘     │ (1 topic : N problems)
                         │                                 │
                         │ userId          problems (content_db)
                         │ (string ref)    ┌──────────────────┐
                         │                 │ _id              │◀────┐
   user_progress (progress_db)            │ topicId  ─────────┘     │
   ┌────────────────────────────┐         │ difficulty       │     │ problemId
   │ _id                        │         │ youtube/leetcode/│     │ (string ref)
   │ userId    (ref users._id)  │─────────│ article URLs     │     │
   │ problemId (ref problems._id)──────────────────────────────────┘
   │ completed, completedAt     │   UNIQUE (userId, problemId)
   └────────────────────────────┘
```

**Relationships**
- `topics 1 ── N problems` (within `content_db`, real ObjectId ref `problems.topicId → topics._id`).
- `users N ── N problems` resolved through **`user_progress`**, the join entity. Because users and
  problems live in different services/DBs, `user_progress` stores `userId` and `problemId` as **opaque
  string ids** rather than DB-enforced foreign keys.

---

## Collections

### `users` (auth_db)
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK |
| `email` | String | **unique**, lowercased |
| `name`, `firstName`, `lastName` | String | display + editable profile names |
| `bio` | String | profile bio (≤280) |
| `avatarUrl` | String | `/api/auth/avatar/<id>` once uploaded (file on a volume) |
| `passwordHash` | String \| null | bcrypt; null for Google-only accounts |
| `role` | enum `student`\|`admin` | first registered user = admin |
| `notifPrefs` | `{ dailyReminder, weeklySummary }` | notification preferences |
| `twoFactorEnabled` | Boolean | email-OTP 2FA on/off |
| `otpHash` | String \| null | bcrypt hash of the current one-time code; `select:false` |
| `otpExpiresAt` | Date \| null | code expiry (10 min); `select:false` |
| `otpPurpose` | String \| null | `login`\|`enable`\|`disable`; `select:false` |
| `googleId` | String \| null | sparse |
| `lastLoginAt`, `createdAt`, `updatedAt` | Date | |

**Indexes:** `{ email: 1 }` unique · `{ role: 1 }` · `{ googleId: 1 }` sparse.

### `pending_signups` (auth_db) — signup email-verification holding area

Holds a not-yet-created account while the user verifies their email with an OTP. No real
`User` exists until the code is confirmed.

| Field | Type | Notes |
|-------|------|-------|
| `email` | String | lowercased, indexed |
| `name` | String | provided full name |
| `passwordHash` | String | bcrypt |
| `otpHash` | String | bcrypt hash of the emailed code |
| `otpExpiresAt` | Date | TTL index auto-purges expired/abandoned signups |

**Indexes:** `{ email: 1 }` · `{ otpExpiresAt: 1 }` TTL (`expireAfterSeconds: 0`).

### `topics` (content_db)
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK |
| `title` | String | e.g. "Dynamic Programming" |
| `slug` | String | **unique**, url-safe |
| `description` | String | |
| `order` | Number | display order in the sheet |

**Indexes:** `{ slug: 1 }` unique · `{ order: 1 }`.

### `problems` (content_db)
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK |
| `topicId` | ObjectId → `topics._id` | parent topic |
| `title` | String | |
| `difficulty` | enum `Easy`\|`Medium`\|`Hard` | |
| `order` | Number | order within topic |
| `youtubeUrl` | String | tutorial video |
| `leetcodeUrl` | String | LeetCode/Codeforces practice |
| `articleUrl` | String | theory article |

**Indexes:** `{ topicId: 1 }` · `{ topicId: 1, order: 1 }` (ordered fetch per topic) · `{ difficulty: 1 }`.

### `user_progress` (progress_db) — the join / tracker
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK |
| `userId` | String → `users._id` | who |
| `problemId` | String → `problems._id` | which problem |
| `completed` | Boolean | true when ticked (rows are deleted on un-tick) |
| `completedAt` | Date | when |
| `createdAt`, `updatedAt` | Date | |

**Indexes:** **`{ userId: 1, problemId: 1 }` unique** (idempotent upsert, no duplicates) ·
`{ userId: 1 }` (fast "all my progress" read for resume).

### `notifications` (notif_db)
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK |
| `userId` | String | recipient |
| `type` | enum `progress`\|`milestone` | |
| `message` | String | |
| `read` | Boolean | |
| `createdAt` | Date | |

**Indexes:** `{ userId: 1 }`.

---

## Indexing strategy — rationale

- **Read the sheet (hot path):** served from a Redis cache; on a cache miss, `problems` is fetched and
  grouped by `topicId` using the `{ topicId: 1, order: 1 }` index. Topics/problems are small and rarely
  change, so this is cheap and cached.
- **Resume progress (per login):** `user_progress.{ userId: 1 }` returns a user's completed ids in one
  index scan, independent of total user count.
- **Mark complete (write):** the unique `{ userId, problemId }` index makes the upsert O(log n) and
  guarantees one row per (user, problem) — toggling is naturally idempotent.
- **Login:** `users.email` unique index → single-document lookup.

## Why strings for cross-service ids (trade-off)

Using DB-enforced `ObjectId` foreign keys would require all entities in one database. By storing
`userId`/`problemId` as strings, each service owns its own database and can be scaled, migrated, or
sharded (e.g. `user_progress` sharded on `userId`) independently. The cost is that referential
integrity is enforced in application logic (e.g. content-service checks a topic exists before adding a
problem) rather than by the database — an intentional microservices trade-off.
