# Deployment

Merging `develop` into `main` runs `.github/workflows/deploy.yml`: CI on a GitHub-hosted runner, then a deploy job on a self-hosted runner on your app host.

Traffic path: your reverse proxy -> `FRONTEND_BIND` (an internal LAN address:port on the app host, frontend/nginx) -> backend -> database. Production does not publish the frontend on a public interface; only the reverse proxy forwards to it.

## One-time setup

1. **App host: env file.** Create an env file for this project outside the repo (mode 600), containing:
   ```
   POSTGRES_PASSWORD=<long random>
   FRONTEND_BIND=<lan-ip>:<port>
   ```
   Pick a free port (`ss -tlnp`).
2. **GitHub: secret.** In the repo, go to Settings -> Secrets and variables -> Actions -> New repository secret. Name it `ENV_FILE_PATH` and set it to the absolute path of the env file from step 1. This keeps the path out of the public repo.
3. **App host: runner.** Reuse an existing self-hosted runner that can reach the app host's Docker daemon, or register a new one (Settings -> Actions -> Runners -> New self-hosted runner, Linux x64, as a non-root user already in the `docker` group, run as a service). The workflow targets the `self-hosted` label only, so any such runner picks up the job.
4. **Reverse proxy.** Route `free.felixkarg.de` to `FRONTEND_BIND` using whatever your reverse proxy expects (see `deploy/traefik-free-site.yml` for a Traefik file-provider template).
5. **DNS / tunnel.** Point `free.felixkarg.de` at your existing public entry point the same way your other `*.felixkarg.de` apps are exposed.
6. **Branch protection.** Protect `main` so only reviewed merges from `develop` deploy. The runner executes repo code on a shared host, so the deploy workflow only triggers on pushes to `main`, never on pull requests.

## Notes

- The compose project name is `free-site`, to avoid clashing with other projects on the same host.
- The first deploy creates the `free-site_database_data` volume. Back it up before schema work starts.
- Local development: `docker compose up` loads `docker-compose.override.yml` and serves on http://localhost:8080.
- Keep host names, LAN addresses, usernames and file paths for your infrastructure out of this repo (it is public); they belong only in the server's env file and your own notes.
