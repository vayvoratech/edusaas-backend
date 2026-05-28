# EDU-SAAS Backend

Node.js + Express + Prisma. Default storage is in-memory; flip `USE_DB=true` to use PostgreSQL.

## Setup

```bash
npm install
cp .env.example .env
# edit .env with your DATABASE_URL and JWT_SECRET
```

## Run

```bash
npm start              # production
npm run dev            # nodemon
```

- API root: http://localhost:5000
- Swagger UI: http://localhost:5000/api-docs

## Storage modes

| `.env` `USE_DB` | Behaviour |
|---|---|
| unset / `false` | In-memory store, seeded with `admin@edu.local / admin123` and `priya.sharma@email.com / demo123`. Data resets on restart. |
| `true` | Connects to PostgreSQL via Prisma using `DATABASE_URL`. |

## Switching to PostgreSQL

The Prisma schema is already written ([prisma/schema.prisma](prisma/schema.prisma)) for these 10 tables in the `education` schema:

`users, profiles, assessments, gap_reports, courses, enrollments, jobs, applications, notifications, subscriptions`

Steps:

```bash
# 1. Verify you can reach the DB
#    Windows:
powershell -Command "Test-NetConnection 192.168.1.12 -Port 5432"

# 2. Set USE_DB=true and a valid DATABASE_URL in .env (special characters URL-encoded)
# Example: postgresql://user:Dev%40123@host:5432/edu_saas_db?schema=education

# 3. Generate Prisma client
npm run db:generate

# 4. Create tables (first time) or apply pending migrations
npm run db:migrate

# 5. Seed admin + student + sample courses
npm run db:seed

# 6. Start the server
npm start
```

## Troubleshooting

**`P1001: Can't reach database server`**
The DB host is not reachable from your machine. Verify:
- Postgres machine is running and on the same LAN
- `postgresql.conf` has `listen_addresses = '*'`
- `pg_hba.conf` allows your client IP, e.g. `host all all 192.168.1.0/24 md5`
- Windows Firewall on the DB machine allows inbound TCP 5432
- Restart Postgres after any config change

**`UNABLE_TO_VERIFY_LEAF_SIGNATURE` during `npm install` or `prisma`**
Corporate proxy intercepting TLS. Workarounds (dev only):
```powershell
npm config set strict-ssl false
$env:NODE_TLS_REJECT_UNAUTHORIZED='0'
```

## Default seed credentials

| Email | Password | Role |
|---|---|---|
| `admin@edu.local` | `admin123` | admin |
| `priya.sharma@email.com` | `demo123` | student |

## Project layout

```
src/
├── config/        env + swagger config
├── data/          repository toggle (memory vs Prisma)
│   ├── memoryRepo.js
│   ├── prismaRepo.js
│   └── index.js
├── middleware/    auth (JWT), error handler
└── routes/        one file per resource
prisma/
├── schema.prisma  data model
└── seed.js        npm run db:seed
```
