# Deployment

`.github/workflows/deploy.yml` deploys two instances from the same code: every merge into `main` deploys **production** (`free.felixkarg.de`), every merge into `develop` deploys the **dev instance** (`free-dev.felixkarg.de`). Each run is CI on a GitHub-hosted runner, then a deploy job on a self-hosted runner on your app host.

| | Production | Dev instance |
|---|---|---|
| Branch | `main` | `develop` |
| Compose project | `free-site` | `free-site-dev` |
| Database volume | `free-site_database_data` | `free-site-dev_database_data` |
| Env file secret | `ENV_FILE_PATH` | `DEV_ENV_FILE_PATH` |
| Domain | `free.felixkarg.de` | `free-dev.felixkarg.de` |

The two instances share nothing but the host: separate containers, network, images, database and accounts. Test on the dev instance first; merge `develop` into `main` once it works there.

Traffic path: your reverse proxy -> `FRONTEND_BIND` (an internal LAN address:port on the app host, frontend/nginx) -> backend -> database. Production does not publish the frontend on a public interface; only the reverse proxy forwards to it.

## One-time setup

1. **App host: env file.** Create an env file for this project outside the repo (mode 600), containing:
   ```
   POSTGRES_PASSWORD=<long random>
   FRONTEND_BIND=<lan-ip>:<port>
   ALLOWED_EMAIL_DOMAINS=<campus domains, comma-separated>
   RESEND_API_KEY=<from Resend>
   MAIL_FROM=free_site <free@noreply.felixkarg.de>
   INITIAL_COURSE_JOIN_CODE=<long random, e.g. INF24B-$(openssl rand -hex 4)>
   ADMIN_SETUP_CODE=<long random, e.g. $(openssl rand -hex 16)>
   ```
   Pick a free port (`ss -tlnp`). The backend refuses to start in production without `RESEND_API_KEY`.
   Optional: `APP_URL` (default `https://free.felixkarg.de`) is the link in the mail footer.
   Optional: `TRUST_PROXY` (default `loopback, linklocal, uniquelocal`) decides which proxy hops are trusted when reading the client IP for rate limits. The default fits a chain of LAN/Docker proxies; change it only if the rate limit sees your proxy's address instead of the client's.
2. **GitHub: secret.** In the repo, go to Settings -> Secrets and variables -> Actions -> New repository secret. Name it `ENV_FILE_PATH` and set it to the absolute path of the env file from step 1. This keeps the path out of the public repo.
3. **App host: runner.** Reuse an existing self-hosted runner that can reach the app host's Docker daemon, or register a new one (Settings -> Actions -> Runners -> New self-hosted runner, Linux x64, as a non-root user already in the `docker` group, run as a service). The workflow targets the `self-hosted` label only, so any such runner picks up the job.
4. **Reverse proxy.** Route `free.felixkarg.de` to `FRONTEND_BIND` using whatever your reverse proxy expects (see `deploy/traefik-free-site.yml` for a Traefik file-provider template).
5. **DNS / tunnel.** Point `free.felixkarg.de` at your existing public entry point the same way your other `*.felixkarg.de` apps are exposed.
6. **Mail (Resend).** Add the sending subdomain `noreply.felixkarg.de` in Resend and create the DNS records it shows (SPF and DKIM; Resend's Cloudflare auto-configuration does this), plus a DMARC record such as `_dmarc.felixkarg.de TXT "v=DMARC1; p=none"` (tighten to `p=quarantine` once all senders of the domain pass), which also covers the subdomain. `MAIL_FROM` must use an address on that subdomain. Wait until Resend marks the domain verified before the first registration. The provider sits behind the single `sendMail` function in `backend/src/mail.ts`, so switching provider means changing only that file.
7. **Actions settings for the self-hosted runner (important).** The repository is public and the runner has Docker access on your host, which is root-equivalent. A pull request from a fork runs the workflow files *from the pull request*, so without these settings a stranger could change `ci.yml` to `runs-on: self-hosted` and run code on your server:
   - Settings → Actions → General → "Approval for running fork pull request workflows from contributors": **Require approval for all external contributors**. Never approve a run whose diff touches `.github/`.
   - If the runner belongs to the organization: Settings → Actions → Runner groups → its group: allow only this repository and, under "Workflow access", only `FelixAndFelix/free_site/.github/workflows/deploy.yml@refs/heads/main` and `…@refs/heads/develop`.
   - Keep the runner a non-root user; do not reuse it for repositories you do not control.
8. **Branch protection.** Protect `main` so only reviewed merges from `develop` deploy. The runner executes repo code on a shared host, so the deploy workflow only triggers on pushes to `main`, never on pull requests.

## Dev instance (one-time setup)

1. **App host: second env file.** Create another env file (mode 600) next to the production one, with its **own** values:
   ```
   POSTGRES_PASSWORD=<different long random>
   FRONTEND_BIND=<lan-ip>:<another free port>
   ALLOWED_EMAIL_DOMAINS=<campus domains, comma-separated>
   RESEND_API_KEY=<same key as production is fine>
   MAIL_FROM=free_site dev <free-dev@noreply.felixkarg.de>
   APP_URL=https://free-dev.felixkarg.de
   INITIAL_COURSE_JOIN_CODE=<different long random>
   ADMIN_SETUP_CODE=<different long random>
   INSTANCE_LABEL=Development
   ```
   `INSTANCE_LABEL` shows a "Development instance" banner on every page and appends "(Development)" to mail subjects, so the dev instance is never mistaken for production. Leave it unset in production.
2. **GitHub: secret.** Add a repository secret `DEV_ENV_FILE_PATH` with the absolute path of that file. Without it, deploys of `develop` fail with a message naming the missing secret.
3. **Reverse proxy.** Route `free-dev.felixkarg.de` to the dev `FRONTEND_BIND` (second router in `deploy/traefik-free-site.yml`).
4. **DNS / tunnel.** Expose `free-dev.felixkarg.de` like the other apps. Use this one-level name rather than `dev.free.felixkarg.de`: Cloudflare's free certificate covers `*.felixkarg.de` only, not a second level.
5. **Branch protection.** Protect `develop` as well, so only reviewed pull requests reach the shared host.

The dev database starts empty: register again there (the setup code of the dev env file makes you admin) and create test courses and modules freely.

## Notes

- The compose project names are `free-site` and `free-site-dev` (set with `-p` by the workflow), to avoid clashing with each other and with other projects on the same host. To run a command against one instance by hand, pass the same `-p`, env file and compose files as the workflow.
- The first deploy of each instance creates its database volume. Back up `free-site_database_data` regularly: it holds all accounts, votes and the vote history the graphs are built from.
- Database migrations run automatically when the backend starts. After a schema change in `backend/src/schema.ts`, run `npm run db:generate -w backend` and commit the new file in `backend/drizzle/`.
- Local development: `docker compose up` loads `docker-compose.override.yml` and serves on http://localhost:8080. Without `RESEND_API_KEY`, mails (and their codes) are printed to the backend log.
- **First admin:** register at `/register`, open "I have an admin setup code" and enter `ADMIN_SETUP_CODE`. If your account already exists, log in and open `/claim-admin` instead. The code works only while no admin exists; afterwards promote further admins on `/admin`. Courses, join codes, modules and course membership are managed there too; a course can be deleted once it has no members.
- Registration needs a course code. On start the backend creates the course `INF24B` with `INITIAL_COURSE_JOIN_CODE` if no course of that name exists; hand that code to your fellow students. Changing the env value later does not change an existing course; replace a leaked join code with "New join code" on `/admin`. Locally the code is `INF24B-local`.
- Live updates use server-sent events on `/api/events`: long-lived HTTP responses with a keep-alive every 25 s. The backend sends `X-Accel-Buffering: no`, so the bundled nginx passes them through unbuffered; a reverse proxy in front must not buffer `text/event-stream` responses either (Traefik and Cloudflare do not by default). The event hub lives in the backend's memory, so run a single backend container per instance.
- `frontend/public/.well-known/security.txt` expires on 2027-05-01 (`Expires:` line). Renew it together with the one on `felixkarg.de`.
- The privacy page (`frontend/src/pages/PrivacyPage.tsx`) describes the data the code stores; update it in the same PR whenever that changes.
- Keep host names, LAN addresses, usernames and file paths for your infrastructure out of this repo (it is public); they belong only in the server's env file and your own notes.
