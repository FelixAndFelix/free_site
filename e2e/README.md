# End-to-end tests

Playwright tests that drive the real thing: the built backend, a PostgreSQL database and the built
frontend (behind `vite preview`, which proxies `/api` like nginx does in production).

## Run them

```bash
createdb e2e                                   # once; any empty PostgreSQL database will do
npm run build                                  # the tests use the built backend and frontend
npx playwright install chromium                # once
DATABASE_URL=postgres://user@localhost:5432/e2e npm run e2e
```

- `DATABASE_URL` defaults to `postgres://free_site@localhost:5432/e2e`. The suite **empties the users
  table** of that database at the start, so never point it at real data.
- Ports: the backend runs on 3100 and the frontend on 4173 (`E2E_BACKEND_PORT`, `E2E_FRONTEND_PORT`).
- `CHROMIUM_PATH` runs an existing Chromium instead of Playwright's own download.
- One spec: `npx playwright test tests/admin.spec.ts`; the setup project runs first by itself.
- After a failure: `npx playwright show-report`, or open `test-results/*/trace.zip` with
  `npx playwright show-trace`. In CI the report and the backend log are uploaded as an artifact.

## How it is built

- **Setup project** (`00-first-admin.setup.ts`): registers the first admin through the UI with the setup
  code, which only works while no admin exists, and saves the session in `.state/admin.json`.
- **Own data per test:** a test creates its own course through the admin API (`createCourse`), so tests
  do not depend on each other or on the order they run in.
- **Mail codes** are read from the backend log (`.backend.log`): without `RESEND_API_KEY` the backend
  prints mails. `newCodeFor(email, known)` waits for a new mail to an address.
- **Rate limits stay on.** Each test pretends to come from its own address with `X-Forwarded-For`; the
  backend trusts that header from loopback proxies, as it does behind nginx in production. Create extra
  visitors with `newGuestContext`, because `browser.newContext()` inherits the project's login.
- **Projects:** `desktop` runs everything except `mobile.spec.ts`; `mobile` runs that file as a phone.
- **Accessibility:** `a11y.spec.ts` runs axe on every kind of page in light and dark mode and fails on
  serious or critical WCAG A/AA problems.
- Playwright is pinned to one version, and `overrides` in the root `package.json` keeps `axe` on the
  same `playwright-core`, so the types match.
