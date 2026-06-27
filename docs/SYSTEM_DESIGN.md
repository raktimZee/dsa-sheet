# System Design (HLD) — DSA Sheet

Designed for **10,000–50,000 active users**. The goal is a system that is simple to run (one
`docker compose up`), yet structured as independent services so each concern can scale and be
reasoned about on its own.

---

## 1. Architecture diagram (Client → Server → Database → Deployment)

```
                                   ┌──────────────────────────────────────────────────────────┐
                                   │                    EC2 / Docker host                       │
                                   │                                                            │
  ┌─────────┐    HTTPS    ┌────────┴────────┐                                                   │
  │ Browser │ ──────────▶ │  nginx (edge)   │  :80/:443  — single public origin                │
  │  (SPA)  │ ◀────────── │  reverse proxy  │                                                   │
  └─────────┘             └───┬─────────┬───┘                                                   │
                              │ /*      │ /api/*                                                 │
                              ▼         ▼                                                        │
                     ┌──────────┐   ┌───────────────────────┐                                   │
                     │ React    │   │   API Gateway (Node)   │                                   │
                     │ SPA      │   │  • JWT verify          │                                   │
                     │ (static) │   │  • rate-limit (Redis)  │                                   │
                     └──────────┘   │  • RBAC                │                                   │
                                    │  • inject x-user-id +  │                                   │
                                    │    x-internal-key      │                                   │
                                    └──┬─────────┬────────┬──┘                                   │
                       internal network│         │        │                                      │
                       ┌───────────────┘         │        └───────────────┐                     │
                       ▼                         ▼                        ▼                      │
                ┌─────────────┐          ┌──────────────┐        ┌────────────────┐              │
                │ auth-service│          │content-service│       │progress-service│              │
                │  JWT, 2FA   │          │ topics/probs  │       │  checkboxes    │              │
                └──────┬──────┘          └──────┬───────┘        └───────┬────────┘              │
                       │                        │  ▲                     │  emits                │
                       │                        │  │ cache               │  progress.updated     │
                       ▼                        ▼  │                     ▼  (BullMQ on Redis)     │
                ┌───────────┐    ┌─────────────────┴──┐         ┌────────────────────┐           │
                │ auth_db   │    │ content_db │ Redis  │         │ progress_db        │           │
                └───────────┘    └────────────┴────────┘         └────────────────────┘           │
                                                                          │                       │
                                                                          ▼                       │
                                                              ┌────────────────────────┐          │
                                                              │ notification-service   │          │
                                                              │ (BullMQ worker)        │ ─▶ notif_db
                                                              └────────────────────────┘          │
                                   └────────────────────────────────────────────────────────────┘
```

- **Client** — React single-page app (Vite build), served as static files.
- **Server** — an nginx edge proxy in front of an API gateway, which fronts four stateless Node
  microservices.
- **Database** — one MongoDB deployment with a **logical database per service** (`auth_db`,
  `content_db`, `progress_db`, `notif_db`). Redis backs caching, rate-limiting, and the job queue.
- **Deployment** — all of it as Docker containers, brought up together with `docker compose` on a
  single EC2 instance for this assignment (with a clear path to ECS/EKS — see §6).

---

## 2. Request flow

Take the most important interaction, **"tick a problem complete"**:

1. The browser sends `PUT /api/progress/:problemId` with `Authorization: Bearer <JWT>` to **nginx**.
2. nginx matches `/api/*` and proxies to the **API gateway** (same origin, so no CORS).
3. The gateway:
   - applies a **Redis-backed rate limit** (per client IP),
   - **verifies the JWT** (signature + expiry) and extracts the user id and role,
   - **injects trusted headers** `x-user-id`, `x-user-role`, and a shared `x-internal-key`, and
     *strips* any client-supplied copies of those headers (anti-spoofing),
   - proxies the request to **progress-service** over the internal Docker network.
4. progress-service trusts the gateway headers (it is not publicly reachable), upserts the
   `UserProgress` row, and **enqueues a `progress.updated` job** on BullMQ.
5. It responds immediately with the new completed-count — the user gets instant feedback.
6. Asynchronously, **notification-service** consumes the job and records an in-app
   notification / milestone. If it is down, jobs simply wait in Redis — the user is never blocked.

The SPA updates the checkbox **optimistically** and reconciles with the server response.

---

## 3. Authentication mechanism

- **Primary:** email + password. Passwords are hashed with **bcrypt** (cost 10); plaintext is never
  stored.
- **Sessions:** stateless **JWT** (HS256), 7-day expiry, carrying `sub` (user id), `role`, and email.
  The SPA stores it and sends it as a Bearer token. Because sessions are stateless, any gateway
  replica can validate any request — no sticky sessions, no shared session store.
- **Email-verified signup:** `register` validates input and stores a `pending_signups` row with the
  hashed password + a hashed 6-digit code, then emails the code (nodemailer/Gmail SMTP). No `User`
  exists until `register/verify` confirms the code, at which point the account is created and a token
  issued. A TTL index purges abandoned signups.
- **Two-factor (email OTP):** users can enable an email second factor. When enabled, `login` first
  checks the password, then emails a 6-digit code and returns `{ twoFactorRequired: true }`; the
  client re-submits with the code, which is verified (bcrypt hash + 10-min expiry + purpose tag)
  before a token is issued. Enable/disable in Settings each require a freshly emailed code. The code
  hash/expiry/purpose are stored `select:false` so they never leave the DB by accident.
- **Optional Google OAuth:** if `GOOGLE_CLIENT_ID` is configured, the Google ID token is verified
  server-side and mapped to a user. The app is fully functional without it.
- **Authorization (RBAC):** two roles — `student` and `admin`. Content mutations
  (create/edit/delete topics & problems) require `admin`; the gateway forwards the role and each
  service enforces it (`requireRole('admin')`).
- **Trust boundary:** only `nginx → gateway` is public. Services accept requests **only** with the
  correct `x-internal-key`, so they cannot be reached directly and identity headers cannot be forged.

---

## 4. Data flow for progress tracking (the graded path)

```
Mark complete:   SPA ──PUT /api/progress/:id {completed:true}──▶ gateway ──▶ progress-service
                     progress-service: upsert {userId, problemId} in progress_db   (unique index)
                                       enqueue progress.updated ──▶ (Redis/BullMQ) ──▶ notification-service
                     ◀── {completed:true, count} ─── (instant)

Resume on login: SPA ──GET /api/content/sheet──▶ content-service (Redis-cached)  → topics+problems
                 SPA ──GET /api/progress────────▶ progress-service               → [completed problemIds]
                     SPA renders each checkbox checked iff its id ∈ completed set
```

Progress is keyed by a **compound unique index `(userId, problemId)`**, so marking is idempotent and a
user can never get duplicate rows. "Resume where you left off" is just: fetch the sheet, fetch the set
of completed ids, and check the matching boxes — fast, because the per-user progress lookup hits an
index on `userId`.

---

## 5. Scalability considerations (10k–50k users)

**Where the load actually is.** This workload is **read-heavy** (everyone reads the same sheet) with a
**modest, per-user write stream** (checkbox toggles). That shapes every decision below.

- **Stateless services + horizontal scale.** Gateway and all services hold no local session state, so
  they scale by running more replicas behind the load balancer. JWT verification and the rate limiter
  are both replica-independent (the limiter's counters live in Redis).
- **Caching the hot read.** The full sheet is identical for all users and changes rarely, so
  content-service caches it in **Redis** (5-min TTL, busted on any admin write). At 50k users this
  turns "load the sheet" from a Mongo query-per-request into a single cached blob — the dominant read
  path barely touches the database.
- **Indexing.** `UserProgress(userId, problemId)` unique compound index makes both the write (upsert)
  and the per-user read O(index lookup). `users.email` unique, `problems.topicId` for sheet assembly.
  See [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md).
- **Async fan-out.** Notifications/analytics happen off the request path via BullMQ, so spikes in
  activity don't add latency to the user action, and a slow/down consumer can't degrade the core app.
- **Rate limiting** at the gateway (120 req/min/IP) protects every downstream service from abuse and
  accidental hot loops with one control point.
- **Data sizing.** 50k users × ~40 problems ≈ 2M `UserProgress` docs worst-case — tiny for MongoDB and
  fully index-served. No sharding needed at this scale; the schema (string `userId`, no cross-service
  joins) makes sharding by `userId` trivial later if needed.

---

## 6. Trade-offs & deliberate decisions

| Decision | Why | Trade-off / future |
|----------|-----|--------------------|
| Microservices (not a monolith) | Clear ownership, independent scaling, matches the Technical-Lead brief | More moving parts; mitigated by a shared `libs/common` and one compose file |
| One Mongo, **DB per service** | Service isolation + no cross-service foreign keys, but one thing to operate | Split into separate clusters later with zero schema change |
| Deploy all on **one EC2 via compose** | One public link, trivial to run/grade, cost-effective | Not HA. Production path: push images to ECR, run on **ECS Fargate** (one task per service) behind an ALB, **MongoDB Atlas** + **ElastiCache Redis**. The code does not change — only `*_URL` env vars. |
| **Email OTP** 2FA (not TOTP/SMS) | No authenticator app to install; reuses the email we already have; same channel verifies signup | Depends on email deliverability + an SMTP credential; codes are short-lived to limit interception risk |
| **JWT** (stateless) | Horizontal scale without a session store | Can't instantly revoke a token; mitigated by short-ish TTL (rotate to refresh-tokens for stricter revocation) |
| Gateway-injected identity + `x-internal-key` | Authenticate once at the edge; services stay simple | Shared-secret trust model; fine inside a private network, upgrade to mTLS/service-mesh if services span hosts |
| Optimistic UI for checkboxes | Instant feel | Reverts on server error (handled) |

---

## 7. API surface (summary)

| Method & path (via `/api`) | Auth | Purpose |
|---|---|---|
| `POST /auth/register` | public | Start signup → emails a verification code (`{ otpRequired: true }`) |
| `POST /auth/register/verify` | public | Confirm emailed code → creates account (first user = admin), returns JWT |
| `POST /auth/login` | public | Password → if 2FA on, emails a code (`{ twoFactorRequired: true }`); re-submit with `otp` → JWT |
| `POST /auth/google` | public | Google OAuth sign-in (if configured) |
| `GET  /auth/me` | user | Current user (full profile) |
| `POST /auth/2fa/setup` · `/enable` · `/disable/setup` · `/disable` | user | Manage email 2FA (each step verified by an emailed code) |
| `POST /auth/change-password` | user | Change password (verifies current) |
| `PATCH /auth/profile` | user | Update name / email / bio |
| `PUT  /auth/notifications` | user | Notification preferences |
| `POST /auth/avatar` · `GET /auth/avatar/:id` | user | Upload / serve avatar (volume-backed) |
| `GET  /auth/leaderboard` | user | Rankings (progress counts + names) |
| `GET  /auth/export` | user | Download all my data (profile + progress) |
| `DELETE /auth/account` | user | Delete account (cascades progress) |
| `GET  /content/sheet` | user | Full topics+problems (Redis-cached) |
| `POST/PATCH/DELETE /content/topics` · `/problems` | admin | Manage content |
| `GET  /progress` | user | Completed problem ids (resume) |
| `PUT  /progress/:problemId` | user | Mark / unmark complete |
| `GET  /progress/summary` | user | Completed count |
| `GET  /progress/leaderboard` | internal | Top users by solved (for Rankings) |
| `DELETE /progress/internal/user/:id` | internal | Cascade delete on account removal |
| `GET  /notifications` · `POST /notifications/read-all` | user | List notifications / mark read (bell) |
| `DELETE /notifications/internal/user/:id` | internal | Cascade delete on account removal |
