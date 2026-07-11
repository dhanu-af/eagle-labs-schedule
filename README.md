# Eagle Labs — Team Work Schedule & KPI Management

Next.js 16 (App Router) + Tailwind CSS v4 + Prisma. Runs on local SQLite in dev;
the schema is Postgres-compatible so switching to Supabase is a config change,
not a rewrite (see below).

## Local development

```bash
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Seeded logins (password `password123`):

| Email | Role |
|---|---|
| dhanu@healthicons.com | Permanent Super Admin (protected — cannot be demoted or deactivated in the UI) |
| admin@eaglelabs.com | Admin |
| eden@eaglelabs.com | Supervisor (Blending) |
| deepthi@eaglelabs.com | Supervisor (Encapsulation) |
| employee@eaglelabs.com | Employee |

New accounts can also self-register at `/register` — they stay inactive until
an Admin/Super Admin approves them from the Team page.

## Environment variables

Copy `.env.example` to `.env` and fill in real values before deploying:

- `DATABASE_URL` — SQLite locally (`file:./dev.db`); a Postgres connection string once on Supabase.
- `SESSION_SECRET` — random 32+ byte secret used to sign session cookies. **Rotate this before going to production** — the committed dev value is not safe to use for real data.

## Migrating from SQLite to Supabase Postgres

This app doesn't use any SQLite-only features, so the cutover is:

1. Create a Supabase project and grab the Postgres connection string (Project
   Settings → Database → Connection string — use the pooled "Transaction"
   URI for serverless deploys).
2. In `prisma/schema.prisma`, change the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Set `DATABASE_URL` to the Supabase connection string (locally in `.env`,
   and in your hosting provider's environment variables for production).
4. Run `npx prisma migrate deploy` to apply all existing migrations to the
   new database.
5. Decide whether to run `npm run seed` against production — it currently
   wipes and reseeds demo data, so treat it as a dev-only script and adapt it
   (or write a real onboarding flow) before running it against live data.

Auth, sessions, and file structure don't change — only the `datasource` block
and `DATABASE_URL`.

## Deploying to a custom domain (e.g. dkns.ai)

This repo is deployable as-is to Vercel or any Node hosting platform. Domain
cutover needs access this environment doesn't have (your registrar/DNS panel,
or a hosting account tied to the domain), so it has to happen on your side:

1. Deploy the app (e.g. `vercel --prod` from this directory, or connect the
   repo in the Vercel dashboard).
2. Set the environment variables above in the hosting provider's dashboard.
3. In the hosting provider's project settings, add `dkns.ai` (and/or a
   subdomain) as a custom domain.
4. In your DNS provider for `dkns.ai`, add the CNAME/A records the hosting
   provider gives you for that domain.
5. Wait for DNS propagation and TLS certificate issuance.

## Payroll module — compliance note

The Payroll module computes gross pay as `hours × rate` (overtime at 1.5×)
from recorded attendance. It does **not** calculate PAYG withholding,
superannuation, or apply Fair Work award interpretation. Have an
accountant/payroll specialist review it before running real wages through it.
