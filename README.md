# AlgoSheet — Full-Stack DSA Practice Tracker

A web application where students work through a structured **DSA (Data Structures & Algorithms) sheet**:
topic-wise problems, difficulty tags, learning-resource links (YouTube / LeetCode / article), and a
**persisted progress tracker** — tick a problem, log out, log back in, and your progress is exactly where
you left it.

Built as a **MERN microservices** system (MongoDB · Express · React · Node) behind an API gateway, runnable
with a single `docker compose up`. The UI is a light Material-style design (React + Tailwind) with a
persistent app shell.

---

## Features

| # | Feature | Where |
|---|---------|-------|
| 1 | Secure student login (JWT) + **email-OTP 2-factor auth** + email-verified signup + optional Google OAuth | `services/auth` |
| 2 | Structured sheet: topics → problems, easy navigation | `services/content` + `web` |
| 3 | Problem breakdown under each topic | `services/content` |
| 4 | YouTube + LeetCode/Codeforces + Article links per problem | seed data |
| 5 | Easy / Medium / Hard difficulty tags + filter | `web` |
| 6 | **Checkbox progress tracker — saved server-side, resumes on next login** | `services/progress` |

**App shell & screens:** Overview dashboard (stats + progress-by-topic), Problems (the sheet), Rankings
(leaderboard by solved), Analytics (solved by difficulty/topic), Account Settings, Security (2FA).

**Account & security (full backend):** edit profile (name/email/bio), **avatar upload** (stored on a
volume, served back), notification preferences, **change password**, **export my data** (JSON), and
**delete account** (cascades progress *and* notifications). Optional **"Continue with Google"** button
(env-gated). All wired to real `auth-service` endpoints.

**In-app notifications:** the notification-service exposes `GET /notifications` + `POST /read-all`; the
SPA shows a **bell with an unread badge and a dropdown** (milestone + progress events). Events still flow
asynchronously via BullMQ, so the core app never blocks on it.

Plus: API gateway with JWT verification & distributed rate-limiting, Redis caching, and the event-driven
notification service (BullMQ).

---

## Architecture (at a glance)

```
Browser ──▶ nginx (edge, :80) ──┬──▶ /api/* ──▶ API Gateway ──┬──▶ auth-service     ──▶ Mongo auth_db
                                │   (JWT verify,              ├──▶ content-service  ──▶ Mongo content_db  (+Redis cache)
                                │    rate-limit, RBAC)        └──▶ progress-service ──▶ Mongo progress_db
                                │                                        │
                                └──▶ /*  ──▶ React SPA                   └─(BullMQ/Redis)─▶ notification-service ──▶ Mongo notif_db
```

Full write-up: [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md) ·
Schema: [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) ·
Deploy: [`docs/GCP_DEPLOYMENT.md`](docs/GCP_DEPLOYMENT.md)

---

## Quick start (local, Docker)

```bash
cp .env.example .env          # then edit JWT_SECRET / INTERNAL_KEY to long random strings
docker compose up -d --build  # builds & starts everything
docker compose exec content node services/content/src/seed.js   # load the DSA sheet
open http://localhost         # the app
```

First account you register becomes **admin** (so you can manage content); everyone after is a **student**.

### Run without Docker (for development)

```bash
npm install
# start mongo + redis however you like, then in separate shells:
MONGO_URL=mongodb://localhost:27017 REDIS_URL=redis://localhost:6379 \
JWT_SECRET=dev INTERNAL_KEY=dev npm run dev:auth      # :4001
# …same for dev:content (:4002), dev:progress (:4003), dev:notification, dev:gateway (:4000)
cd web && npm install && npm run dev                  # Vite dev server on :5173 (proxies /api to :4000)
```

---

## Project layout

```
dsa-sheet/
├── docker-compose.yml          # one-command orchestration
├── nginx/nginx.conf            # edge reverse proxy (single public origin)
├── libs/common/                # shared: mongo/redis connect, auth middleware, errors, logger
├── gateway/                    # API gateway: JWT verify, rate-limit, inject internal identity headers
├── services/
│   ├── auth/                   # register/login/JWT, email-OTP 2FA, Google OAuth        (auth_db)
│   ├── content/                # topics/problems CRUD, Redis-cached sheet, seed     (content_db)
│   ├── progress/               # per-user progress upsert, emits BullMQ events      (progress_db)
│   └── notification/           # BullMQ worker: progress milestones                (notif_db)
├── web/                        # React + Vite SPA
└── docs/                       # system design, DB schema, AWS deployment
```

## Tech

Node 20 (ESM) · Express · Mongoose/MongoDB 7 · Redis 7 · BullMQ · React 18 + Vite · React Router ·
JWT · bcrypt · nodemailer (Gmail SMTP, email OTP) · nginx · Docker Compose.
