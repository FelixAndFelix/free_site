# Deployment

Merging `develop` into `main` runs `.github/workflows/deploy.yml`: CI on a GitHub-hosted runner, then a deploy job on a self-hosted runner on your app host.

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
   ```
   Pick a free port (`ss -tlnp`). The backend refuses to start in production without `RESEND_API_KEY`.
   Optional: `TRUST_PROXY` (default `loopback, linklocal, uniquelocal`) decides which proxy hops are trusted when reading the client IP for rate limits. The default fits a chain of LAN/Docker proxies; change it only if the rate limit sees your proxy's address instead of the client's.
2. **GitHub: secret.** In the repo, go to Settings -> Secrets and variables -> Actions -> New repository secret. Name it `ENV_FILE_PATH` and set it to the absolute path of the env file from step 1. This keeps the path out of the public repo.
3. **App host: runner.** Reuse an existing self-hosted runner that can reach the app host's Docker daemon, or register a new one (Settings -> Actions -> Runners -> New self-hosted runner, Linux x64, as a non-root user already in the `docker` group, run as a service). The workflow targets the `self-hosted` label only, so any such runner picks up the job.
4. **Reverse proxy.** Route `free.felixkarg.de` to `FRONTEND_BIND` using whatever your reverse proxy expects (see `deploy/traefik-free-site.yml` for a Traefik file-provider template).
5. **DNS / tunnel.** Point `free.felixkarg.de` at your existing public entry point the same way your other `*.felixkarg.de` apps are exposed.
6. **Mail (Resend).** Add the sending subdomain `noreply.felixkarg.de` in Resend and create the DNS records it shows (SPF and DKIM; Resend's Cloudflare auto-configuration does this), plus a DMARC record such as `_dmarc.felixkarg.de TXT "v=DMARC1; p=none"` (tighten to `p=quarantine` once all senders of the domain pass), which also covers the subdomain. `MAIL_FROM` must use an address on that subdomain. Wait until Resend marks the domain verified before the first registration. The provider sits behind the single `sendMail` function in `backend/src/mail.ts`, so switching provider means changing only that file.
7. **Branch protection.** Protect `main` so only reviewed merges from `develop` deploy. The runner executes repo code on a shared host, so the deploy workflow only triggers on pushes to `main`, never on pull requests.

## Notes

- The compose project name is `free-site`, to avoid clashing with other projects on the same host.
- The first deploy creates the `free-site_database_data` volume. Back it up before schema work starts.
- Database migrations run automatically when the backend starts. After a schema change in `backend/src/schema.ts`, run `npm run db:generate -w backend` and commit the new file in `backend/drizzle/`.
- Local development: `docker compose up` loads `docker-compose.override.yml` and serves on http://localhost:8080. Without `RESEND_API_KEY`, mails (and their codes) are printed to the backend log.
- Registration needs a course code. On start the backend creates the course `INF24B` with `INITIAL_COURSE_JOIN_CODE` if no course of that name exists; hand that code to your fellow students. Changing the env value later does not change an existing course (rotation comes with the admin screens in build step 3). Locally the code is `INF24B-local`.
- Keep host names, LAN addresses, usernames and file paths for your infrastructure out of this repo (it is public); they belong only in the server's env file and your own notes.
