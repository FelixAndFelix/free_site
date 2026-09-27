# Decisions

Single source of truth for architecture and process decisions. If another planning document contradicts this file, this file wins.

| Area | Decision | Reason |
|---|---|---|
| Auth | DHBW email verified by a 6-digit code, then a password. Passkey (WebAuthn via `simplewebauthn`) is an optional convenience. Course join code required at registration. | Email proves DHBW membership; the course code places the user in a course; passkeys add convenient login. |
| Registration | Email + course code -> emailed code -> set password -> optionally add a passkey. One course per user in the MVP. | Simplest flow that gates on both domain and course. |
| Login | Email + password, or passkey if set up. | Conventional model users expect. |
| Password reset | Email code, then a new password. Revokes all sessions of that user. Replaces the former recovery code. | Email is the recovery path, so no recovery-code slice. |
| Email storage | Plaintext `users.email`, unique, lowercased. | Needed to send mail on our own initiative. The privacy screen must state that the operator can link an email to a vote. |
| Email domains | Env var `ALLOWED_EMAIL_DOMAINS`, exact domain match, checked before any mail is sent. | Proves DHBW membership and limits spam abuse. Exact campus domains are set in the deploy config. |
| Email sending | Transactional provider (e.g. Resend or Brevo) with SPF, DKIM, DMARC on `felixkarg.de`, behind a single `sendMail` function. | Home-server mail is not deliverable to university addresses. Swappable provider. |
| Email types | Transactional only in the MVP: verification code, reset code, optional "new passkey added" notice. Notifications with opt-in and unsubscribe are post-MVP. | No consent or queue work before shipping. |
| Password | Argon2id, minimum 10 characters, no composition rules. | Current best practice, KISS. |
| Email code | 6 digits from a CSPRNG, stored hashed, valid 10 minutes, single-use, 5 wrong attempts invalidate it, one new code per address per 60 seconds. | Bounded brute-force and resend abuse. |
| Rate limits | Send-code: 5 per IP per hour plus a per-email limit. Login: 5 failures per email, then a growing delay of up to 15 minutes (no permanent lockout). | Prevents spam and brute force without letting an attacker lock out a victim. |
| Anti-enumeration | Login and reset return the same generic response whether or not the email exists. | Does not leak who is registered. |
| Vote link | `votes(user_id, modul_id, vote_value, updated_at)`, composite PK `(user_id, modul_id)`, changed via upsert. | KISS. Votes are linked to `user_id`, and `users` holds the email, so votes are not anonymous towards the operator. |
| Vote values | Enum `free` / `possible` / `impossible` (UI: green / yellow / red). | Matches the app's purpose; a single enum column. |
| Session | Server-side session stored in Postgres, opaque ID in an `HttpOnly; Secure; SameSite=Lax` cookie. | Not readable by XSS, revocable server-side. |
| Course management | Admins are global: every admin manages all courses, modules, join codes and users. Admins create and delete courses and modules, rotate join codes, and move a user to another course or remove them from their course. A course can only be deleted when it has no members; its modules go with it. | Deleting an empty course cannot remove accounts by accident. Global admins fit a small app run by a few trusted people. |
| Admin | `ADMIN_SETUP_CODE` env var used at registration creates the first admin; it is accepted only while no admin exists. `users.role` is `user` or `admin`. Admins can promote and demote others, never themselves. | The code cannot mint a second admin even if it leaks, so rotating it is optional. The admin's email must still pass the domain check, and a course code is still required. |
| Backend | Node.js, TypeScript, Express, Drizzle ORM, PostgreSQL. | Best `simplewebauthn` support; typed parameterized queries; readable SQL migrations. |
| Frontend | Vite, React, TypeScript, React Router, plain mobile-first CSS. | Small app (4 screens); matches `DevelopingRules.md`. Screens are designed fresh later; the old Stitch prototype is discarded. |
| Repo | npm workspaces monorepo: `frontend/`, `backend/`, `shared/`, plus `docker-compose.yml`. Each package has its own Dockerfile. | One PR flow and CI; shared API types and vote enum avoid drift. |
| Testing | Vitest everywhere, Testing Library for React, real-Postgres integration tests, WebAuthn and mail sending mocked at their boundaries, TDD per slice. No E2E in the MVP. | Upsert and constraint logic is where bugs live. |
| Hosting | Own homeserver, Docker Compose. Production publishes no host ports; an existing Traefik instance and Cloudflare Tunnel (already used for other apps on the same infra) route to it, via a generic `FRONTEND_BIND` address/port. Deploys run on a shared GitHub Actions self-hosted runner (no dedicated one). | Reuses infra that already exists instead of standing up a second tunnel or runner; see `docs/deployment.md` (kept generic, since the repo is public). |
| Domain | `free.felixkarg.de`, also the WebAuthn `rpID`. | Passkeys are bound to it. It must not change once users register. |
| Git | `main` = production, `develop` = integration, `feature/*` branches. Merging `develop` into `main` deploys. | Follows `DevelopingRules.md`. |

## Build order

1. ✅ Walking skeleton: monorepo scaffold, Docker Compose (frontend, backend, Postgres), `/api/health` endpoint, CI (lint, test, build), first deployment to `free.felixkarg.de` via the existing reverse proxy.
2. ✅ Registration and login: email code, password, course code, sessions, password reset, `sendMail` with the provider configured (DNS records included).
3. ✅ Admin bootstrap (`ADMIN_SETUP_CODE`, `/claim-admin`); create courses, join codes and modules on `/admin`.
4. Voting (upsert) and overview with bar chart.
5. Detail view and privacy info screen.
6. Optional passkeys and "My devices".

## Post-MVP

Comments, long-term vote graphs, profile settings, "my modules" list, email notifications with opt-in and unsubscribe, joining several courses.
