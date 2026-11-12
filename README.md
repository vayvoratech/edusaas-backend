# EDU-SAAS Backend

Node.js + Express + Prisma. Two environments out of the box:

| Env | Storage | File | Use case |
|---|---|---|---|
| **dev** | In-memory (resets on restart) | `.env.dev` | Local UI work, demos, no DB needed |
| **stage** | Azure PostgreSQL (persistent) | `.env.stage` | Real data, integration testing |

Both files are gitignored — they hold secrets.

## Setup

```bash
npm install
```


Install dependencies and configure the required environment files (`.env.dev` and `.env.stage`) using the values provided by your team.

## Run

### 1. HTTP API (server.js)

```bash
npm run start:dev    # in-memory / local dev env
npm run start:stage  # connects to persistent Postgres
npm start            # alias for start:stage
npm run dev          # nodemon + dev env
npm run dev:stage    # nodemon + stage env
```

On boot you'll see `[env] APP_ENV=dev` or `[env] APP_ENV=stage` so you always know which one is active.

- API root: http://localhost:5000
- Swagger UI: http://localhost:5000/api-docs

### 2. Static Analysis Worker (worker.js)

The static analysis worker processes queued mini-project submissions in the background. It clones student code at the submitted commit to a temporary folder, runs Semgrep, and stores findings in PostgreSQL. It does **not** execute student code and does **not** create Docker containers per submission.

**Prerequisite:** Semgrep must be installed in the environment running the worker:
```bash
pip install semgrep
semgrep --version
```

**Run the worker:**
```bash
npm run worker:dev   # worker with dev env
npm run worker:stage # worker with stage env
npm run worker       # alias for worker:stage (or: node worker.js)
```

### 3. Coding Assessment Sandboxing (Docker)

Docker is used **strictly** for executing untrusted student code during live coding assessments (`src/services/dockerService.js`), providing process, CPU, memory, and network isolation.
- Docker is **NOT** required for deploying the API or worker.
- Docker is **NOT** required for mini-project static analysis.
- When running coding assessments, ensure Docker Desktop / engine is active on the host.

For full production architecture and process management (PM2, systemd, PaaS), see [DEPLOYMENT.md](DEPLOYMENT.md).

## How env selection works

`src/config/env.js` reads `APP_ENV` and loads `.env.<APP_ENV>` first, then `.env` as a fallback. The npm scripts above set `APP_ENV` automatically via `cross-env`.

If you want to add a third env (e.g. `prod`):
1. Create `.env.prod` (already gitignored)
2. Run `cross-env APP_ENV=prod node server.js`

## Test users (seeded in both envs)

| Email | Password | Role |
|---|---|---|
| `admin@edu.local` | `admin123` | admin |
| `priya.sharma@email.com` | `demo123` | student |
| `yash@educator.local` | `demo123` | educator |
| `ankit@employer.local` | `demo123` | employer |

Or sign up new users via the UI — in **stage** they persist, in **dev** they live until the next restart.

## Working with the Azure DB

Prisma commands need to read `.env.stage`, so use the staged scripts:

```bash
npm run db:migrate:stage    # apply pending migrations
npm run db:seed:stage       # seed roles/permissions/users
npm run db:studio:stage     # open Prisma Studio
npm run db:push:stage       # push schema without a migration
npm run db:generate         # regenerate Prisma Client (no DB needed)
```

The DB schema lives in `education` (not `public`). See [prisma/schema.prisma](prisma/schema.prisma).

## Initial assessment question bank

Assessments follow the student's selected domain role and that role's required
skills; the `courses` and `lessons` tables must contain curriculum data before
results can be certified against formal course syllabi. The question bank in
`prisma/data/initial-assessment-questions.json` contains ten skill-mapped
questions per required skill (four Easy, three Medium, three Hard).

Synchronize the role-to-skill mappings first:

```bash
npm run db:seed:domain-required-skills:stage
```

Then validate the bank against the stage database and preview how many
difficulty levels and questions would be added:

```bash
npm run db:seed:initial-questions:stage
```

This command is preview-only. After reviewing the preview, explicitly apply
missing difficulty levels and questions with:

```bash
npm run db:seed:initial-questions:stage:apply
```

The question seed preserves existing question and answer history, skips
questions with the same assessment type, skill, and question text, and retires
only the known unfinished placeholder stems so they are not selected for new
attempts. It seeds the bank for both `INITIAL` and `PRACTICE`, reactivates
matching inactive questions, and validates ten source questions per skill in
the 4/3/3 difficulty distribution. The domain-skill seed adds missing skills
and their mappings only for roles present in the database; missing domain
roles are reported and skipped.

### Repairing a missing Python INITIAL bank

The general question-bank seed is preview-only unless invoked with
`--apply`. Running `db:seed:stage` does not apply that question bank. This
commonly explains why Python `INITIAL` question lookups return zero even when
the checked-in JSON bank contains Python questions. Assessment lookups also
require the exact `Python` skill row and active question rows tagged
`assessment_type=INITIAL`.

To add beginner (`Easy`) Python questions without touching existing question
rows, use the dedicated idempotent seed:

```bash
npm run db:seed:python-initial-questions:stage
```

It inserts only missing question texts for the exact `Python` skill and
`INITIAL` assessment type. It requires an existing `Easy` difficulty row and
will report an error if the skill or difficulty is missing. It does not delete,
update, or reactivate existing questions. Inspect the target environment and
obtain approval before running a database-writing command.

### AI Engineer supplemental questions

The AI Engineer seed adds five distinct `INITIAL` questions for each skill
listed for that role in `prisma/seed-domain-required-skills.js`. It uses the
existing `questions`, `skills`, and `difficulty_levels` tables, stores the
answer rationale in the nullable `questions.explanation` column, and skips
matching skill/question rows on subsequent runs. Seed the role skills and the
Easy/Medium/Hard levels first, then run:

```bash
npm run db:seed:ai-engineer-questions:stage
```

Question GET responses omit both the correct option and its explanation.
Apply the accompanying Prisma migration before running this seed against a
database that does not yet have the `questions.explanation` column.

## Practice quiz API

All routes require a student bearer token. Quiz questions are returned without
the correct answer. The `INITIAL` and `FINAL` assessment lifecycles continue to
use the timed endpoints below; standalone submissions are only allowed for
`PRACTICE`.

Retrieve active `PRACTICE` questions for a skill. Bulk retrieval of timed
`INITIAL` and `FINAL` question banks is intentionally unavailable; those
assessment flows return their current question through the existing endpoints.

```http
GET /api/assessments/quiz/questions?skill_id=1&assessment_type=PRACTICE
Authorization: Bearer <access-token>
```

```json
{
  "success": true,
  "data": {
    "skill": { "skill_id": 1, "skill_name": "Python" },
    "assessment_type": "PRACTICE",
    "questions": [
      {
        "question_id": 101,
        "skill_id": 1,
        "question_text": "Example question?",
        "option_a": "Option A",
        "option_b": "Option B",
        "option_c": "Option C",
        "option_d": "Option D"
      }
    ]
  }
}
```

Submit selected options for a practice attempt. The server calculates the score
and saves the session, answers, and skill result atomically:

```http
POST /api/assessments/quiz/attempts
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "assessment_type": "PRACTICE",
  "skill_id": 1,
  "answers": [
    { "question_id": 101, "answer": "B" },
    { "question_id": 102, "answer": "D" }
  ]
}
```

The response includes `session_id`, score totals, percentage, skill level, and
per-question correctness, but not the correct answer values. The student must
have a selected domain role so the attempt can be associated with the existing
`QuizSession` model.

## RBAC
## RBAC
#

Roles + permissions are stored in dedicated tables (`roles`, `permissions`, `role_permissions`). The canonical catalog is defined in [src/config/rbac.js](src/config/rbac.js) — edit there, then re-seed.

```bash
npm run db:seed:stage   # re-runs upserts; safe to re-run
```

Routes use `permissionRequired('courses:create')` from [src/middleware/auth.js](src/middleware/auth.js).

## Troubleshooting

**`P1001: Can't reach database server`**
- Verify you're on a network that can reach the Azure private endpoint.
- Test: `npm run db:studio:stage` — if Studio opens, connectivity is fine.

**`UNABLE_TO_VERIFY_LEAF_SIGNATURE` / TLS errors**
The Azure cert chain isn't trusted by Node by default. `.env.stage` already sets `NODE_TLS_REJECT_UNAUTHORIZED=0` for this reason. For prod you should install the proper CA bundle instead
**Forgot which env you're in**
Look at the server boot log — `[env] APP_ENV=...` is the first line. Or `curl localhost:5000` returns the API root.

**Fraud AI proctoring cannot connect**
The Fraud AI service is implemented in the sibling `vayvoratech/edusaas-aiml` repository on its `develop` branch. Its FastAPI entry point is `aiml-unified-service/main.py`; the health route is `GET /health` and the proctoring route is `WS /ws/proctor`. The backend sends `START_EXAM` and requires `PROCTORING_STARTED`.

The service Dockerfile sets `PORT=8000` for local use. The Render manifest overrides this with `PORT=10000`; that deployment is reached over HTTPS/WSS, not by connecting to local port 8000. To run the verified local Docker configuration on Windows, install and start Docker Desktop with Linux containers enabled, then use a separate PowerShell terminal:

```powershell
Set-Location 'C:\Users\Digital\Documents\GitHub\edusaas-aiml'
docker build -t edusaas-aiml:local -f Dockerfile .
docker run --rm --name edusaas-aiml-local -p 8000:8000 -e PORT=8000 edusaas-aiml:local
```

In another terminal, verify the listener and the service's implemented health route:

```powershell
Test-NetConnection 127.0.0.1 -Port 8000
Invoke-RestMethod http://127.0.0.1:8000/health
```

Configure `PROCTOR_API_URL` as the proctoring service's HTTP(S) base URL and
`PROCTOR_API_KEY` as its API key. For example, use
`PROCTOR_API_URL=http://127.0.0.1:8000` for a service running directly on the
same machine, or `https://edusaas-aiml-parb.onrender.com` for the hosted service.
The backend sends `Authorization: Bearer <PROCTOR_API_KEY>` to the service's
`/health` and `/ws/proctor` endpoints. Proctoring connections have a 30-second
timeout and retry once on timeout. Check `GET /api/proctor/health` before
starting an assessment; the authenticated assessment flow must still receive
`PROCTORING_STARTED`.

When the backend runs in Docker and the proctoring service runs on the host,
use `PROCTOR_API_URL=http://host.docker.internal:8000` rather than
`localhost`/`127.0.0.1`. Pass secrets at runtime rather than baking them into
the image; `.dockerignore` excludes `.env*` files. For example:

```bash
docker run --env-file .env.docker -p 5000:5000 edusaas-backend
```

The Compose configuration already reads `.env.docker` as a runtime `env_file`.
On Linux, if `host.docker.internal` does not resolve, add
`--add-host=host.docker.internal:host-gateway` to `docker run`.

## Project layout

```
src/
├── config/         env (APP_ENV-aware), swagger, rbac catalog
├── data/           repo toggle (memory + Prisma) + dataStore seed
├── middleware/     authentication, RBAC authorization, error handling
└── routes/         one file per resource
prisma/
├── schema.prisma   data model (26 tables under `education` schema)
├── migrations/     versioned schema changes
└── seed.js         run via `npm run db:seed:stage`
```
## Development 
Db connected successfully