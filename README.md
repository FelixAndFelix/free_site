# free_site

Webapp for students to call out which exams are free this semester.

Live at [free.felixkarg.de](https://free.felixkarg.de).

## Planning

- [`planning/Decisions.md`](planning/Decisions.md) — architecture and process decisions (source of truth)
- [`planning/UserFocusedDesignJournal.md`](planning/UserFocusedDesignJournal.md) — the design dialogue behind those decisions
- [`planning/DevelopingRules.md`](planning/DevelopingRules.md) — commit, branching and code-style conventions
- [`docs/deployment.md`](docs/deployment.md) — one-time production deploy setup

Privacy information for users is on [free.felixkarg.de/privacy](https://free.felixkarg.de/privacy); security reports go to the contact in [`security.txt`](https://free.felixkarg.de/.well-known/security.txt).

## Structure

npm workspaces monorepo:

- `backend/` — Express + TypeScript + Drizzle ORM + PostgreSQL
- `frontend/` — Vite + React + TypeScript
- `shared/` — API types shared by both

## Development

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

Run the full stack locally with Docker Compose:

```bash
cp .env.example .env   # set POSTGRES_PASSWORD
docker compose up -d --build
```

The app is then at http://localhost:8080, proxying `/api` to the backend.

To register locally, set `ALLOWED_EMAIL_DOMAINS` in `.env` and use the course code `INF24B-local` (and the admin setup code `admin-local` for the first account to become admin). Without `RESEND_API_KEY`, the emailed codes are printed to the backend log (`docker compose logs backend`).

## Deployment

Merging into `develop` deploys the dev instance at [free-dev.felixkarg.de](https://free-dev.felixkarg.de); merging `develop` into `main` deploys production. See [`docs/deployment.md`](docs/deployment.md).
