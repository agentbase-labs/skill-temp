---
name: agentbase
description: "Deploy websites and backends with custom domains, databases, and SSL via the AgentBase API (Render.com hosting). Handles account setup automatically; usage is paid with in-app credits (1 credit = 1 USD)."
metadata: { "joni": { "emoji": "🌐", "requires": { "bins": ["node", "curl"] } } }
---

# AgentBase Skill

Deploy production apps: static sites, SSR frontends, backend APIs, PostgreSQL databases — all with custom domains, DNS, and SSL. Hosted on Render.com, domains via OpenProvider, DNS via Cloudflare.

Account creation happens automatically. Usage is paid with **in-app credits** (billing model B — 1 credit = 1 USD), keyed by the account's email. There is **no crypto wallet** to fund. Deployments tracked in `~/.joni/agentbase/websites.json`.

**API Base:** `https://dev-render-api.agentbase.network/v1`
**Config:** `~/.joni/agentbase/config.json` (auto-created on first run)

> **Memory rule:** Every workflow has a single entry in `websites.json` keyed by `workflow_id`. That entry must contain ALL relevant data — frontend URLs, backend URLs, service IDs, env vars, DB info, domain info, deploy IDs. After every step, check what was saved. Never rely on memory across tool calls — always read `websites.json` first.

---

## 1 — Decision Tree

Read this first. Figure out what the user actually needs before running anything.

| User wants...                          | What to do                                                  |
| -------------------------------------- | ----------------------------------------------------------- |
| A website (HTML/React/Vue/etc.)        | Website Pipeline only (Section 4)                           |
| A full-stack app (frontend + API + DB) | Website Pipeline (Section 4) → Backend Pipeline (Section 5) |
| To update existing code                | Post-Deploy Operations (Section 6)                          |
| To roll back a bad deploy              | Git History & Rollback (Section 6)                          |
| To check on something                  | Monitoring (Section 7)                                      |

**At session start or when resuming work — ALWAYS run this first:**

```bash
node {baseDir}/scripts/list-websites.cjs
```

Then for any active workflow, read its full record:

```bash
cat ~/.joni/agentbase/websites.json
```

This tells you what's already deployed, what step you're at, all service URLs and IDs. Never ask the user for workflow IDs you already have saved.

---

## 2 — Before You Start (Preflight)

Every workflow costs real money — paid from **in-app credits** (1 credit = 1 USD) on the account's email. Do these checks before touching anything.

**Step A — Know the billing model (credits, model B):**

- Funding lives in the agentic app's **in-app credits**, keyed by the account **email** (`~/.joni/agentbase/config.json` → `email`). 1 credit = 1 USD.
- **No crypto, no Polygon, no wallet address, no deposits.** There is no public balance endpoint on AgentBase — the credit balance is enforced server-side at spend time.
- Spending is **atomic deduct-before-work**: when a step spends, the backend deducts first. **HTTP 402 `insufficient_credits`** means the email account is out of credits. Downstream failures **auto-refund**.
- `check-balance.cjs` shows the billing model + recent spend ledger (it does **not** show a numeric credit balance — that lives in the app).

```bash
node {baseDir}/scripts/check-balance.cjs
```

**Step B — Rough cost guide (so you can warn the user up front):**

- Website with .com domain → roughly **$50** of credits
- Website with .io domain → roughly **$100**
- Full-stack (.com) → roughly **$75**
- Full-stack (.io) → roughly **$125**

⚠️ **These are one-time setup estimates.** On top of them, every deployed web service and database incurs a **recurring monthly** cost — roughly **~$7/mo per web service** (frontend or backend, `starter` plan) and **~$6–7/mo per database** — separate from the one-time domain registration cost. There is no free tier for tenant resources. See **Recurring Billing & Dunning** in the reference section.

**Step C — If credits run out, the workflow pauses.** A step that hits `insufficient_credits` (HTTP 402) stops cleanly with no charge. To continue: **add credits to the account's email in the app**, then retry the step. For a workflow paused at `paused_insufficient_funds`, top up credits and use `increase-budget.cjs` to allocate more, then resume.

⚠️ **Sending crypto does nothing** — there is no wallet to fund. The deprecated `auto-fund.cjs` / `check-deposit.cjs` scripts now exit with an error pointing here.

**Step D — Search domains and show prices:**

```bash
node {baseDir}/scripts/search-domains.cjs --keywords "bakery sweet" [--tlds ".com,.io"]
```

Show the user what's available and what it costs. Get their pick before continuing.

**Step E — Get user confirmation.** Confirm the plan: domain choice, budget, what you're building. Don't spend money without a yes.

---

## 3 — Critical Rules

These are hard constraints. Follow them every time.

1. **Billing is in-app credits (1 credit = 1 USD), keyed by the account email** — there is no crypto wallet and no `/wallet` endpoints. Run `check-balance.cjs` to see the billing model + spend ledger before a workflow.
2. **If a step returns HTTP 402 `insufficient_credits`, stop and ask the user to add credits** to the account email in the app — never assume funds. Spends are atomic (deduct-before-work) and auto-refund on downstream failure.
3. **Never register a domain without user confirmation** — show the price first.
   3a. **Do NOT send crypto to fund AgentBase** — it does nothing. Funding is in-app credits on the account email only.
4. **Steps are sequential** — each depends on the previous one completing
5. **Commit ALL files** — when using `commit-code.cjs` or `commit-backend-code.cjs`, pass _every_ file. Text files via `--file name=content`, **binary files (images, fonts, favicons) via `--file-base64 path=<base64>`**, or use `--files-json <path>` for both at once. If you generated 12 files, pass all 12. See Section 8 → “Binary files (images, favicons, fonts) — use base64” before committing any binary asset.
6. **Match the framework to the code — VERIFY before every deploy** — see the mandatory Pre-Deploy Verification Checklist in Section 4 and 5. Never guess. Never default to `static`.
7. **If a script fails, report the error** — don't retry with modified commands, don't guess. Exception: `register-domain.cjs` is safe to retry — the backend auto-recovers from 504 timeouts and prevents double-registration
8. **SSL takes 5-15 minutes** — retry `verify-ssl`, don't skip it
9. **Wait for DNS** — after `update-nameservers`, wait ~5 min before `attach-domain`
10. **`deploy.cjs` success = job queued, NOT build passed** — a 200 response only means Render accepted the job. You MUST poll `service-status.cjs` until you get `live` or `failed`. Never assume the build succeeded and move on.
11. **Never proceed past a deploy step without confirming `live`** — if you skip the status check and go straight to DNS/subdomain setup, you are building on a broken foundation. Always wait for `live`.
12. **On `failed` status — read logs before anything else** — run `deploy-logs.cjs` immediately, read the output, identify the error, fix it. Do not redeploy blind.
13. **When in doubt about workflow state** — run `status.cjs` immediately. Never guess what state a workflow is in.
14. **Save everything to websites.json after every step** — scripts now do this automatically, but verify the output line `📁 Saved to websites.json:` after each command. If it's missing, manually upsert the data.
15. **For code updates — always follow the full update procedure** — update code → redeploy → poll status → check logs on failure. Never skip any step. See Section 6 for the exact procedure.

---

## 4 — Website Pipeline

9 steps, in order. Don't skip any.

### Step 1: Initialize

```bash
node {baseDir}/scripts/initialize.cjs --prompt "bakery website" --budget 50 [--domains "sweet,bakery"] [--tlds ".com,.io"]
```

Auto-creates the account (credits-based, keyed by email) if needed. Returns a `workflow_id` — you'll use this for every subsequent step. Credits are deducted per spending step; an out-of-credits step returns HTTP 402 `insufficient_credits`.

### Step 2: Register Domain

```bash
node {baseDir}/scripts/register-domain.cjs --workflow-id <id> --domain sweetbakes.com
```

Credits debited atomically (deduct-before-work). Auto-refund on genuine failure. If a 504 timeout occurs but the domain was actually registered on OpenProvider, the backend recovers automatically — no double-charge, no stuck workflow. Safe to retry if this step fails. If credits are insufficient you'll get HTTP 402 `insufficient_credits` — add credits to the account email and retry.

### Step 3: Create Repo

```bash
node {baseDir}/scripts/create-repo.cjs --workflow-id <id>
```

### Step 4: Commit Code

```bash
node {baseDir}/scripts/commit-code.cjs --workflow-id <id> \
  --file index.html="<html>..." \
  --file style.css="body{}" \
  --file script.js="console.log('hi')"
```

Remember: pass _every_ file you generated.

**Binary assets (PNG / JPG / ICO / fonts / etc.):** plain `--file` is utf8-only and **will corrupt binary bytes**. Use one of these instead:

```bash
# Single binary file inline
node {baseDir}/scripts/commit-code.cjs --workflow-id <id> \
  --file index.html="<html>..." \
  --file-base64 public/logo.png="<base64-of-logo.png>" \
  --file-base64 public/favicon.ico="<base64-of-favicon.ico>"

# Mixed text + binary via a JSON manifest (recommended for >2 files or any binary)
node {baseDir}/scripts/commit-code.cjs --workflow-id <id> --files-json /tmp/site/files.json
```

See Section 8 → “Binary files (images, favicons, fonts) — use base64” for the JSON manifest shape.


### Step 5: Pre-Deploy Verification Checklist (MANDATORY — do this before running deploy.cjs)

Stop. Answer every question before you run deploy.cjs. If you cannot answer one, go back and check the code.

**[ ] 1. What framework is this project?**
Open `package.json` and check `dependencies` (NOT devDependencies):

- Has `next`? → **nextjs** (NEVER static — needs a server)
- Has `nuxt`? → **nuxtjs** (NEVER static — needs a server)
- Has `vite` + `react`? → **react**
- Has `react` only (no vite, uses `react-scripts`)? → **react** with `--publish-path ./build`
- Has `vue` (no nuxt)? → **vue**
- Has `@angular/core`? → **angular**
- Has `svelte`? → **svelte**
- Plain HTML/CSS/JS, no package.json or no framework dep? → **static**

**[ ] 2. What is the build output path?**

- `react` (Vite) → `./dist`
- `react` (CRA / react-scripts) → `./build` → add `--publish-path ./build`
- `vue` → `./dist`
- `angular` → `./dist/<project-name>` → verify and add `--publish-path`
- `svelte` → `./build`
- `nextjs` / `nuxtjs` → N/A (SSR, no publish path)
- `static` → root directory

**[ ] 3. Is there a custom build command needed?**

- Default for most frameworks: `npm run build`
- CRA: `npm run build` (correct, no override needed)
- Only add `--build-command` if the project has a non-standard build script

**[ ] 4. Will the app listen on `process.env.PORT`?**

- SSR frameworks (nextjs/nuxtjs) — yes, handled automatically
- Custom node server? Check main entry file. Must use `process.env.PORT || 3000`

**[ ] 5. Are there required env vars?**

- API keys, public URLs, etc. — list them all before deploying
- Pass via `--env KEY=VALUE` (repeatable)
- For Next.js public vars: must be prefixed `NEXT_PUBLIC_`

**✅ Only run deploy.cjs after you can check all 5 boxes.**

### Step 5: Deploy to Render

```bash
node {baseDir}/scripts/deploy.cjs --workflow-id <id> --framework <framework> [--env KEY=VALUE ...]
```

Examples by framework:

```bash
# Next.js
node deploy.cjs --workflow-id <id> --framework nextjs

# Vite React
node deploy.cjs --workflow-id <id> --framework react

# CRA React (react-scripts)
node deploy.cjs --workflow-id <id> --framework react --publish-path ./build

# Vue
node deploy.cjs --workflow-id <id> --framework vue

# Static HTML
node deploy.cjs --workflow-id <id> --framework static

# Angular (check actual output dir)
node deploy.cjs --workflow-id <id> --framework angular --publish-path ./dist/my-app
```

**Never default to `static` for SSR frameworks (Next.js, Nuxt).** Static deploys have no server — SSR apps will be completely broken.

Deploying **spends credits** (atomic deduct, auto-refunded on failure) and returns **HTTP 402 `insufficient_credits`** if the account is out of credits. Note this is a **recurring** monthly charge for anything but a static site — see **Recurring Billing & Dunning**.

**⛔ MANDATORY: After running deploy.cjs, you MUST wait for the build to complete before proceeding. Do not move to Step 6 until you have confirmed `live` status.**

**Poll loop — run this repeatedly until resolved:**

```bash
node {baseDir}/scripts/service-status.cjs --workflow-id <id> --type website
```

| Status     | Action                                                                    |
| ---------- | ------------------------------------------------------------------------- |
| `building` | Wait 90 seconds, then check again. Repeat up to 10 times (~15 min total). |
| `live`     | ✅ Build succeeded. Proceed to Step 6.                                    |
| `failed`   | 🛑 STOP. Do NOT proceed. Run deploy-logs immediately (see below).         |

**If status is `failed` — read logs before anything else:**

```bash
node {baseDir}/scripts/deploy-logs.cjs --workflow-id <id> --type website --log-type build
```

Read the full output. Identify the error (missing dependency, wrong framework, build command, etc.). Fix the code or deploy flags. Then:

```bash
node {baseDir}/scripts/update-code.cjs --workflow-id <id> --file <filename>="<content>" --message "Fix build error"
node {baseDir}/scripts/redeploy.cjs --workflow-id <id>
```

Then re-enter the poll loop above. Do NOT use `commit-code.cjs` after a failed deploy — use `update-code.cjs` instead (workflow is in `deploy_failed` state).

### Step 6: Setup DNS

```bash
node {baseDir}/scripts/setup-dns.cjs --workflow-id <id>
```

### Step 7: Update Nameservers

```bash
node {baseDir}/scripts/update-nameservers.cjs --workflow-id <id>
```

⏳ Wait ~5 minutes for DNS propagation before the next step.

### Step 8: Attach Domain

```bash
node {baseDir}/scripts/attach-domain.cjs --workflow-id <id>
```

### Step 9: Verify SSL

```bash
node {baseDir}/scripts/verify-ssl.cjs --workflow-id <id>
```

Returns `active` (done ✅) or `pending` (retry in 5 min).

---

## 5 — Backend Pipeline

6 steps. **Requires a registered domain** — complete at least Website Pipeline Steps 1-2 first.

### Step 1: Provision Database

```bash
node {baseDir}/scripts/provision-database.cjs --workflow-id <id> [--name app_db] [--plan starter]
```

Don't use `free` plan — Render limits 1 free DB per account. Default plan: `starter` (~$7/mo).

### Step 2: Create Backend Repo

```bash
node {baseDir}/scripts/create-backend-repo.cjs --workflow-id <id> --name myapp-api [--framework nestjs]
```

### Step 3: Commit Backend Code

```bash
node {baseDir}/scripts/commit-backend-code.cjs --workflow-id <id> \
  --file package.json="{...}" \
  --file src/main.ts="..." \
  --message "Initial backend commit"
```

Pass _every_ file.

### Step 4: Pre-Deploy Verification Checklist (MANDATORY — do this before running deploy-backend.cjs)

Stop. Answer every question before running. Check the actual committed code files.

**[ ] 1. What backend framework is this?**
Check `package.json` dependencies (or `requirements.txt`, `Gemfile`, `go.mod`, `Cargo.toml`):

- Has `@nestjs/core`? → **nestjs**
- Has `express`? → **express**
- Has `fastapi` in requirements.txt? → **fastapi**
- Has `django` in requirements.txt? → **django**
- Has `flask` in requirements.txt? → **flask**
- Has `Gemfile` with `rails`? → **rails**
- Has `go.mod`? → **go**
- Has `Cargo.toml`? → **rust**
- Has `Dockerfile`? → **docker**
- Generic Node.js (`npm start`)? → **nodejs**

**[ ] 2. Does the app listen on `process.env.PORT` (not a hardcoded port)?**
Render injects `PORT=10000`. A hardcoded port will fail health checks.

- NestJS: `await app.listen(process.env.PORT || 3000);`
- Express: `app.listen(process.env.PORT || 3000)`
- FastAPI: `uvicorn main:app --port $PORT`
- Go: `port := os.Getenv("PORT")`

**[ ] 3. Does the DB connection include `ssl: { rejectUnauthorized: false }`?**
Render Postgres requires SSL. Any connection without it will timeout.

**[ ] 4. For NestJS — does `tsconfig.json` have both required flags?**

```json
{ "emitDecoratorMetadata": true, "experimentalDecorators": true }
```

And `main.ts` starts with `import 'reflect-metadata';`?

**[ ] 5. Are ALL build-time deps in `dependencies` (not `devDependencies`)?**
Render runs `npm install --production`. Anything needed at build time must be in `dependencies`:

- TypeScript, ts-node, @types/\*
- @nestjs/cli, @nestjs/schematics
- tailwindcss, postcss, autoprefixer
- Any webpack/vite/esbuild tool

**[ ] 6. What env vars does this backend need?**
List them all. Pass via `--env KEY=VALUE`. Auto-injected: `DATABASE_URL`, `JWT_SECRET`, `PORT`.

**[ ] 7. Does it need a `--pre-deploy-cmd` for DB migrations?**
E.g. `--pre-deploy-cmd "npm run migration:run"`

**✅ Only run deploy-backend.cjs after you can check all 7 boxes.**

### Step 4: Deploy Backend

```bash
node {baseDir}/scripts/deploy-backend.cjs --workflow-id <id> --framework <framework> [--env KEY=VALUE ...]
```

Examples:

```bash
# NestJS
node deploy-backend.cjs --workflow-id <id> --framework nestjs

# Express
node deploy-backend.cjs --workflow-id <id> --framework express

# FastAPI
node deploy-backend.cjs --workflow-id <id> --framework fastapi

# NestJS with migrations
node deploy-backend.cjs --workflow-id <id> --framework nestjs --pre-deploy-cmd "npm run migration:run"
```

Deploying **spends credits** (atomic deduct, auto-refunded on failure) and returns **HTTP 402 `insufficient_credits`** if the account is out of credits. This is a **recurring** monthly charge while the backend is live — see **Recurring Billing & Dunning**.

Auto-injected env vars: `DATABASE_URL` (if DB provisioned), `JWT_SECRET` (auto-generated), `PORT=10000` (all frameworks). Your `--env` values win on conflict, except `DATABASE_URL` which always uses the provisioned DB.

**⛔ MANDATORY: After running deploy-backend.cjs, you MUST wait for the build to complete before proceeding. Do not move to Step 5 until you have confirmed `live` status.**

**Poll loop — run this repeatedly until resolved:**

```bash
node {baseDir}/scripts/service-status.cjs --workflow-id <id> --type backend
```

| Status     | Action                                                                    |
| ---------- | ------------------------------------------------------------------------- |
| `building` | Wait 90 seconds, then check again. Repeat up to 10 times (~15 min total). |
| `live`     | ✅ Build succeeded. Proceed to Step 5.                                    |
| `failed`   | 🛑 STOP. Do NOT proceed. Run deploy-logs immediately (see below).         |

**If status is `failed` — check build logs first:**

```bash
node {baseDir}/scripts/deploy-logs.cjs --workflow-id <id> --type backend --log-type build
```

Read the full output. If the build passed but the service crashed on startup, also check runtime logs:

```bash
node {baseDir}/scripts/deploy-logs.cjs --workflow-id <id> --type backend --log-type runtime
```

Common causes: wrong PORT binding, missing `reflect-metadata`, SSL not configured, missing dependency. Fix the code, then:

```bash
node {baseDir}/scripts/update-backend-code.cjs --workflow-id <id> --file <filename>="<content>" --message "Fix build error"
node {baseDir}/scripts/redeploy-backend.cjs --workflow-id <id>
```

Then re-enter the poll loop above. Do NOT use `commit-backend-code.cjs` after a failed deploy — use `update-backend-code.cjs` instead.

### Step 5: Attach Subdomain

```bash
node {baseDir}/scripts/attach-subdomain.cjs --workflow-id <id> [--subdomain api]
```

Creates `api.yourdomain.com` → backend.

### Step 6: Verify Health

```bash
node {baseDir}/scripts/verify-health.cjs --workflow-id <id>
```

Checks `/health` endpoint. Returns healthy/unhealthy.

---

## 6 — Post-Deploy Operations

### Recreate Service (Fix Wrong Framework)

**Frontend:**

```bash
node {baseDir}/scripts/recreate-service.cjs --workflow-id <id> [--framework nextjs] [--env KEY=VALUE ...]
```

**Backend:**

```bash
node {baseDir}/scripts/recreate-backend-service.cjs --workflow-id <id> [--framework nestjs] [--env KEY=VALUE ...]
```

⚠️ **Use when a service was deployed with the wrong type or framework** (e.g., Next.js as static_site, or wrong backend framework). This deletes the old Render service and creates a new one with the correct framework. Auto-detects from committed code if `--framework` is not provided. Re-attaches custom domain/subdomain if configured. Backend version also re-injects DATABASE_URL and DB vars.

After recreating, check service status and wait for the build to complete before proceeding.

---

### Recurring Billing & Recovery

Live web services and databases are re-billed **monthly on the 1st** (see **Recurring Billing & Dunning** in the reference section). If a monthly charge fails, the resource goes `past_due` → `suspended` (after 3 days) → hard-`DELETED` (after 30 days).

**Resume a suspended site after topping up credits (USER-facing recovery):**

```bash
# 1. Add credits to the account email in the agentic app, then:
node {baseDir}/scripts/retry-dunning.cjs
```

`retry-dunning.cjs` calls `POST /billing/retry-mine` — **tenant-scoped**, authenticated with the account's own API key. It re-attempts payment for **only this account's** past-due resources, resumes suspended ones on Render, and prints a summary (attempted / recovered / suspended / hard-deleted / still-past-due / errors). Use it whenever a user tops up and needs their own suspended site back up without waiting for the daily 06:00 UTC cron. It never touches other tenants' resources.

> ⚠️ **Rate limit:** `retry-mine` is capped at **6/min per tenant**. On **HTTP 429**, back off and retry after ~1 minute — don't hammer.

---

### Update Website Code — Full Procedure

**This is a 5-step process. Do not skip any step.**

**Step 1: Read current state from websites.json**

```bash
cat ~/.joni/agentbase/websites.json
```

Verify the workflow_id, current frontend_service_url, frontend_framework, and last deploy status before touching anything.

**Step 2: Identify what files need changing**

- List every file that has been modified
- If it's a large codebase, use the direct API pattern (see Section 8 — Committing Large Codebases)
- Never pass partial files. If you update `App.tsx`, include the full file content, not a diff.

**Step 3: Push the code update**

```bash
node {baseDir}/scripts/update-code.cjs \
  --workflow-id <id> \
  --file src/App.tsx="<full file content>" \
  --file src/components/Hero.tsx="<full file content>" \
  --message "Describe what changed"
```

⚠️ Use `update-code.cjs` NOT `commit-code.cjs` — after any deploy (even successful), the workflow state requires update-code.

**Step 4: Trigger redeploy**

```bash
node {baseDir}/scripts/redeploy.cjs --workflow-id <id> [--env KEY=VALUE ...]
```

**Step 5: Poll until resolved — do NOT stop here**

```bash
node {baseDir}/scripts/service-status.cjs --workflow-id <id> --type website
```

| Status     | Action                                       |
| ---------- | -------------------------------------------- |
| `building` | Wait 90s, poll again. Repeat up to 10 times. |
| `live`     | ✅ Done. Confirm the live URL.               |
| `failed`   | 🛑 Read build logs immediately — see below.  |

**If failed — read logs before anything else:**

```bash
node {baseDir}/scripts/deploy-logs.cjs --workflow-id <id> --type website --log-type build
```

Read the FULL output. Identify the root cause. Fix it in the code. Then repeat Steps 3–5.

---

### Update Backend Code — Full Procedure

**This is a 5-step process. Do not skip any step.**

**Step 1: Read current state from websites.json**

```bash
cat ~/.joni/agentbase/websites.json
```

Verify the workflow_id, backend_service_url, backend_framework, backend_env_vars, and last deploy status.

**Step 2: Identify what files need changing**

- List every file that has been modified
- Include complete file contents, not partial diffs
- For large codebases, use the direct API pattern (Section 8)

**Step 3: Push the code update**

```bash
node {baseDir}/scripts/update-backend-code.cjs \
  --workflow-id <id> \
  --file src/main.ts="<full file content>" \
  --file src/app.module.ts="<full file content>" \
  --message "Describe what changed"
```

**Step 4: Trigger redeploy**

```bash
node {baseDir}/scripts/redeploy-backend.cjs --workflow-id <id> [--env KEY=VALUE ...]
```

**Step 5: Poll until resolved — do NOT stop here**

```bash
node {baseDir}/scripts/service-status.cjs --workflow-id <id> --type backend
```

| Status     | Action                                       |
| ---------- | -------------------------------------------- |
| `building` | Wait 90s, poll again. Repeat up to 10 times. |
| `live`     | ✅ Done. Run verify-health to confirm.       |
| `failed`   | 🛑 Read logs immediately — see below.        |

**If failed — two-stage log check:**

```bash
# Stage 1: build logs (compilation errors, missing deps)
node {baseDir}/scripts/deploy-logs.cjs --workflow-id <id> --type backend --log-type build

# Stage 2: if build passed but service crashed on startup
node {baseDir}/scripts/deploy-logs.cjs --workflow-id <id> --type backend --log-type runtime
```

Common causes to check:

- **Build logs show error** → missing dep, wrong framework, TS compile error
- **Runtime logs show crash** → wrong PORT binding, missing reflect-metadata, SSL not configured, env var missing
- **No logs at all** → service didn't start; check if framework is correct

Fix the issue in code, repeat Steps 3–5.

---

**Env var tips:** Pass `--env KEY=VALUE` to add/update. Pass `--env KEY=` (empty value) to remove. DB vars are always synced automatically on backend redeploys.

### Delete Files

Remove obsolete files from a repo. **Websites and backends use SEPARATE scripts/endpoints:**

```bash
# Website repo
node {baseDir}/scripts/delete-files.cjs --workflow-id <id> \
  --path src/Old.tsx --path public/stale.png [--message "Remove obsolete files"]

# Backend repo
node {baseDir}/scripts/delete-backend-files.cjs --workflow-id <id> \
  --path src/old.module.ts [--message "Remove dead module"]
```

- 🔴 **Deletion does NOT auto-redeploy.** Follow with `redeploy.cjs` (website) or `redeploy-backend.cjs` (backend) to publish the change to the live service.
- ⚠️ **Non-existent paths are NOT an error** — they come back in `not_found` and are simply skipped. If NONE of the given paths exist, no commit is created and the script reports that clearly.
- Pass `--path` once per file (repeatable). At least one `--path` is required.
- Rate limited to ~10 requests/min per tenant. On HTTP 429, wait ~1 minute and retry.

### Increase Budget

```bash
node {baseDir}/scripts/increase-budget.cjs --workflow-id <id> --amount 25
```

Deducts the additional amount from in-app credits (atomically) and raises the workflow's budget. Use this for a workflow paused at `paused_insufficient_funds` after topping up credits on the account email; returns HTTP 402 `insufficient_credits` if the email account still lacks credits.

### View Commit History

```bash
node {baseDir}/scripts/commit-history.cjs --workflow-id <id> [--type website|backend] [--page 1] [--per-page 30]
```

### View Commit Detail

```bash
node {baseDir}/scripts/commit-detail.cjs --workflow-id <id> --sha <commit-sha> [--type website|backend]
```

### Revert to a Commit

```bash
node {baseDir}/scripts/revert-repo.cjs --workflow-id <id> --sha <target-sha> [--type website|backend]
```

⚠️ Destructive — force-resets branch. Run `redeploy.cjs` or `redeploy-backend.cjs` afterward.

### Delete Last N Commits

```bash
node {baseDir}/scripts/delete-commits.cjs --workflow-id <id> --count <N> [--type website|backend]
```

⚠️ Destructive — removes most recent N commits (1-100). At least one commit must remain. Redeploy afterward.

---

## 7 — Monitoring & Debugging

### When to run what

| Situation                           | Command                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| Don't know what's deployed          | `cat ~/.joni/agentbase/websites.json` first, then `list-websites.cjs`         |
| Don't know what step you're on      | `status.cjs --workflow-id <id>`                                               |
| Build triggered, waiting for result | `service-status.cjs --workflow-id <id> --type website\|backend`               |
| Build failed                        | `deploy-logs.cjs --workflow-id <id> --type website\|backend --log-type build` |
| Build passed but service crashed    | `deploy-logs.cjs --workflow-id <id> --type backend --log-type runtime`        |
| Remove obsolete file(s) from a repo | `delete-files.cjs` (website) / `delete-backend-files.cjs` (backend) `--workflow-id <id> --path <p>` — then `redeploy.cjs`/`redeploy-backend.cjs` to publish |
| SSL not active                      | `verify-ssl.cjs --workflow-id <id>` (retry every 5 min)                       |
| Backend not responding              | `verify-health.cjs --workflow-id <id>` (retry 2-3x, cold starts take 30-60s)  |
| Site went down / `suspended` (unpaid) | Add credits, then `retry-dunning.cjs` → `/billing/retry-mine` (resumes **your own** suspended resources; 6/min) |

### Workflow Status

```bash
node {baseDir}/scripts/status.cjs --workflow-id <id>
```

Returns full workflow state: current step, domain, service URLs, budget used.

### Render Service Status

```bash
node {baseDir}/scripts/service-status.cjs --workflow-id <id> [--type website|backend]
```

Returns: `building` / `live` / `failed`.

**Always poll this after every deploy or redeploy. Never move to the next step without `live`.**

### Deploy Logs

```bash
# Build logs (compilation, install errors)
node {baseDir}/scripts/deploy-logs.cjs --workflow-id <id> --type website --log-type build
node {baseDir}/scripts/deploy-logs.cjs --workflow-id <id> --type backend --log-type build

# Runtime logs (startup crashes, PORT errors, DB connection failures)
node {baseDir}/scripts/deploy-logs.cjs --workflow-id <id> --type backend --log-type runtime
```

Note: Render's log API returns all logs regardless of `--log-type` flag. The flag is preserved for future use.

### Billing Status

```bash
node {baseDir}/scripts/check-balance.cjs
```

Shows the billing model (in-app credits, 1 credit = 1 USD, keyed by account email) and the recent spend ledger. There is **no numeric credit balance endpoint** on AgentBase — the balance lives in the agentic app and is enforced server-side at spend time.

### Spend Ledger

```bash
node {baseDir}/scripts/funding-history.cjs [--limit 50]
```

Shows the local spend ledger (debits for domains/deploys, refunds) from `GET /tenant/transactions`.

### Funding

There is no crypto deposit step. To add funds, **add credits to the account's email in the agentic app**. An out-of-credits spend returns HTTP 402 `insufficient_credits`. (The old `check-deposit.cjs` / `auto-fund.cjs` scripts are deprecated and exit with an error.)

### List All Workflows

```bash
node {baseDir}/scripts/list-websites.cjs
```

---

## 8 — Known Gotchas (Read Before Generating Code)

These are real issues encountered during deployments. Read this before writing code — they'll save you a failed build cycle.

### 🔴 devDependencies are NOT installed on Render

Render runs `npm install` in production mode, which skips `devDependencies`. Anything needed at **build time** must be in `dependencies`.

**Affected packages:**

- `tailwindcss`, `postcss`, `autoprefixer` — move to `dependencies` for any CSS framework project
- `@nestjs/cli`, `@nestjs/schematics` — move to `dependencies` for NestJS projects
- `typescript`, `ts-node`, `@types/*` — move to `dependencies` for any TypeScript project
- Any build tool (`webpack`, `vite`, `esbuild`, etc.) — move to `dependencies`

**Rule:** If the build command uses it, it goes in `dependencies`. Only truly runtime-irrelevant packages (test frameworks, linters) can stay in `devDependencies`.

---

### 🔴 Don't use `@/` path aliases in Next.js code

`@/components/Foo` imports fail on Render even with correct `tsconfig.json` paths config. Always use **relative imports** in generated Next.js code:

```typescript
// ❌ Breaks on Render
import Navbar from "@/components/Navbar";

// ✅ Works
import Navbar from "../components/Navbar";
import Navbar from "../../components/Navbar"; // from nested routes
```

---

### 🟡 After a failed deploy, use `update-code` not `commit-code`

Once a deploy fails, the workflow state is `deploy_failed`. The `commit-code` step rejects in this state. To fix code and retry:

1. Fix the code files
2. Use `update-code.cjs` to push the fix
3. Use `redeploy.cjs` to trigger a new build

Do NOT try to re-run `commit-code.cjs` — it will 400.

**Same applies to backend:** use `update-backend-code.cjs` + `redeploy-backend.cjs`.

---

### 🟡 Committing large codebases — use `--files-json` (or a direct API call)

The `--file name=content` approach in `commit-code.cjs` breaks with large files (shell arg limits, escaping issues, and it cannot carry binary bytes safely). For anything beyond a few small text files — or any project with images/fonts/favicons — use a JSON manifest.

**Option A — `--files-json` (preferred, works with the existing scripts)**

1. Write all files to a temp directory: `/tmp/<project>/`
2. Build a manifest at `/tmp/<project>/files.json`:

```json
{
  "index.html": "<html>...</html>",
  "style.css": "body { ... }",
  "public/logo.png": { "content": "<base64-of-logo.png>", "encoding": "base64" },
  "public/favicon.ico": { "content": "<base64-of-favicon.ico>", "encoding": "base64" }
}
```

Each value is either a plain string (utf8 text) or a `FileEntry` object `{ content, encoding: "utf8" | "base64" }`. This is exactly the shape the backend expects (`Record<string, string | FileEntry>`).

3. Commit:

```bash
node {baseDir}/scripts/commit-code.cjs   --workflow-id <id> --files-json /tmp/myproject/files.json
node {baseDir}/scripts/update-code.cjs   --workflow-id <id> --files-json /tmp/myproject/files.json --message "Update site"
node {baseDir}/scripts/commit-backend-code.cjs --workflow-id <id> --files-json /tmp/myapi/files.json
node {baseDir}/scripts/update-backend-code.cjs --workflow-id <id> --files-json /tmp/myapi/files.json --message "Fix"
```

You can mix `--files-json` with `--file` / `--file-base64` flags; later flags override earlier on path collision.

**Option B — Direct API call (when you want full control)**

```javascript
// /tmp/do-commit.cjs
const fs = require("fs"), path = require("path");
const { api, tenantId } = require("/path/to/agentbase-skill/scripts/_api.cjs");

const root = "/tmp/myproject";
const textFiles = ["package.json", "src/main.ts", "index.html"];
const binaryFiles = ["public/logo.png", "public/favicon.ico"];

const files = {};
for (const f of textFiles) {
  files[f] = fs.readFileSync(path.join(root, f), "utf8");
}
for (const f of binaryFiles) {
  files[f] = {
    content: fs.readFileSync(path.join(root, f)).toString("base64"),
    encoding: "base64",
  };
}

(async () => {
  const r = await api("/website/commit-code", "POST", {
    tenant_id: tenantId(),
    workflow_id: "<id>",
    files,
  });
  console.log("Committed:", r.commit.commit_hash);
})();
```

For backend, call `/backend/commit-code` (initial) or `/backend/update-code` (post-deploy) with the same payload shape.

---

### 🔴 Binary files (images, favicons, fonts) — use base64

The backend treats plain string file values as **utf8 text**. If you send raw PNG/JPG/ICO/font bytes as a utf8 string they will be corrupted (or silently truncated at the first null byte) and either fail to render or break the build.

**Always base64-encode binary assets** and send them as a `FileEntry`:

```ts
// Backend DTO accepts:
files: Record<string, string | { content: string, encoding?: "utf8" | "base64" }>
```

File types that **must** use `encoding: "base64"`:

- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ico`, `.bmp`, `.tiff`
- Fonts: `.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`
- Other binaries: `.pdf`, `.zip`, `.wasm`, audio/video files, etc.

File types that can stay as plain strings (utf8): `.html`, `.css`, `.js`, `.ts`, `.tsx`, `.json`, `.md`, `.txt`, `.svg` (SVG is XML), `.yaml`, `.toml`, source code in any language.

**Three ways to send binary files** (pick whichever fits the situation):

```bash
# 1. CLI flag for one-off binary files
node {baseDir}/scripts/commit-code.cjs --workflow-id <id> \
  --file index.html="<html>..." \
  --file-base64 public/logo.png="$(base64 -w0 ./logo.png)"

# 2. JSON manifest (preferred when you have multiple files or any binary)
#    Build /tmp/site/files.json with FileEntry objects for binaries (see prev section).
node {baseDir}/scripts/commit-code.cjs --workflow-id <id> --files-json /tmp/site/files.json

# 3. Direct API call — build the files object yourself in JS (see prev section)
```

**Common pitfall:** generating a logo or favicon with an image-gen skill, then trying to commit it via `--file public/logo.png=<bytes>`. That path corrupts the file. Always go through `--file-base64` or the JSON manifest → `FileEntry` form.

---

### 🟢 DB takes ~30s to populate on first boot

If your backend syncs data from an external API on startup (e.g. CoinGecko prices), the first `/api/prices` call may return `[]`. This is normal — the sync job runs in `onModuleInit` and takes 10-30 seconds. Wait a minute before concluding the backend is broken.

---

### 🔴 App must listen on `PORT` env var — not a hardcoded port

Render injects `PORT=10000`. If your app listens on a hardcoded port (e.g. `3000`), Render's health checks will fail and the deploy will be marked as crashed.

```typescript
// ❌ Breaks on Render
await app.listen(3000);

// ✅ Works
await app.listen(process.env.PORT || 3000);
```

Same for Express, FastAPI, Flask, Go, etc. — always bind to `$PORT` / `process.env.PORT`.

---

### 🔴 PostgreSQL SSL is required on Render — add `rejectUnauthorized: false`

Render's managed Postgres requires SSL. If your app connects without SSL config it will hang or throw `connection timeout`.

```typescript
// TypeORM
TypeOrmModule.forRoot({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required on Render
  ...
})

// node-postgres (pg)
new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
```

Always include this when the app uses `DATABASE_URL` from Render.

---

### 🔴 Python: `gunicorn` must be in `requirements.txt`

For Django/Flask, Render uses `gunicorn` as the WSGI server. If it's not in `requirements.txt` the start command will fail with `command not found`.

```
# requirements.txt — always include these
gunicorn>=21.0.0
psycopg2-binary>=2.9.0  # if using PostgreSQL
```

---

### 🔴 NestJS: `emitDecoratorMetadata` must be `true` in `tsconfig.json`

Without this, NestJS dependency injection silently breaks — services inject as `undefined` and the app crashes on first request.

```json
{
  "compilerOptions": {
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true
  }
}
```

Always include both flags in any NestJS `tsconfig.json`.

---

### 🔴 `reflect-metadata` must be the FIRST import in `main.ts`

NestJS requires `reflect-metadata` to be imported before anything else. If it's missing or in the wrong position, decorators silently fail.

```typescript
// main.ts — reflect-metadata MUST be first
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
```

---

### 🟡 Cold starts on low-tier services after inactivity

Lower-tier Render web services can spin down when idle; the first request after sleep takes 30-60 seconds (cold start). This affects:

- Health check on `verify-health.cjs` — may timeout on first attempt
- User experience — first visit is slow

⚠️ **Note:** `free` is **NOT** an option for tenant resources — the backend auto-substitutes the cheapest paid plan (`starter`) and charges for it (see `resolveServicePlan`/`resolveDatabasePlan` in the backend). So this is about paid low-tier cold starts, not "free tier."

**Mitigation:** Use a higher instance plan (`standard`+) for backends that must stay warm, and retry `verify-health` a couple of times before declaring failure.

---

### 🟡 Next.js `Image` component requires allowed domains in `next.config.js`

If your pages use `<Image src="https://external.com/image.png" />`, Next.js will block it unless the domain is whitelisted.

```javascript
// next.config.js
module.exports = {
  images: {
    domains: [
      "coin-images.coingecko.com",
      "assets.coingecko.com",
      "example.com", // add any external image host
    ],
  },
};
```

If you forget this, images will 400 in production but work fine in dev.

---

### 🟡 DNS propagation takes time — don't fail on subdomain SSL errors

After `update-nameservers`, the nameservers need to propagate (up to 24-48h but usually 15-60 min). During this time:

- `verify-ssl` will return `pending` — keep retrying every 5-10 min
- `verify-health` on the subdomain (e.g. `api.cryptonews247.xyz`) will fail with SSL handshake error
- The Render `.onrender.com` URL **always works** — use it to verify the app itself is healthy

**Don't confuse DNS propagation failures with app failures.** Test the `.onrender.com` URL first.

---

### 🟡 `nest build` outputs to `dist/` — `start:prod` must point there

If `package.json` has `"start:prod": "node dist/main"` but the build outputs to a different path, the service will crash on start.

```json
"scripts": {
  "build": "nest build",        // outputs to ./dist/
  "start:prod": "node dist/main" // ✅ matches
}
```

If you use a custom `outDir` in `tsconfig.json`, update `start:prod` to match.

---

### 🟡 Django: `ALLOWED_HOSTS` must include the Render domain

Django rejects requests from unknown hosts with a 400. Always set:

```python
# settings.py
ALLOWED_HOSTS = ['*']  # permissive for Render
# or more precise:
ALLOWED_HOSTS = ['.onrender.com', '.yourdomain.com', 'localhost']
```

Also set `DJANGO_SETTINGS_MODULE` env var in the deploy command.

---

### 🟡 React CRA outputs to `./build`, not `./dist`

Create React App puts its build output in `./build`. Vite-based React uses `./dist`. The default framework config assumes Vite. If the code uses CRA (`react-scripts` in package.json), override the publish path:

```bash
node deploy.cjs --workflow-id <id> --framework react --publish-path ./build
```

How to tell: check `package.json` — if it has `react-scripts`, it's CRA. If it has `vite`, it's Vite.

---

### 🟡 Go: binary name must be predictable for `startCommand`

`go build -o app ./...` produces a binary called `app`. The default start command is `./app`. If you use a different output name, override `--start-command`.

```bash
# If your build command uses a different name:
node deploy-backend.cjs --workflow-id <id> --framework go \
  --build-command "go build -o server ." \
  --start-command "./server"
```

---

### 🟡 TypeORM `synchronize: true` is fine for new projects, dangerous on existing ones

With `synchronize: true`, TypeORM auto-runs schema migrations on every startup. Safe when starting fresh. Dangerous on a live DB — a schema change could drop columns.

For new deployments: `synchronize: true` is fine and simplest.
For production after first deploy: switch to migration files and set `synchronize: false`.

---

### 🟢 Render build logs are truncated in the API response

The `deploy-logs.cjs` script returns recent logs but may not capture the very beginning of a build. If you're chasing a specific error and the logs seem to start mid-build, the error may have occurred before the log window. In that case, trigger a fresh redeploy and check logs immediately.

---

### 🟢 `npm ci` is faster and more reliable than `npm install` for builds

For projects with a `package-lock.json`, use `npm ci` in the build command instead of `npm install`. It's faster (skips resolution), more reproducible, and fails loudly if `package-lock.json` is out of sync.

```bash
npm ci && npm run build
```

Only use `npm install` if there's no lockfile.

---

### 🟢 CORS must be enabled on backends called from a browser frontend

If the frontend (e.g. cryptonews247.xyz) calls the backend API directly from the browser, the backend must allow cross-origin requests.

```typescript
// NestJS
app.enableCors({ origin: '*' }); // or restrict to your domain

// Express
app.use(require('cors')());

// FastAPI
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=['*'])
```

Without this, browser requests will fail with `CORS policy blocked` even though direct API calls work fine.

---

## 9 — Reference

### Framework Auto-Detection

The backend auto-detects the framework by reading `package.json` from the committed code. If you pass `--framework static` but the code is actually Next.js or Nuxt (or any SSR framework), the backend will **override your choice** and deploy correctly.

Still — always try to pass the correct framework. Auto-detection is a safety net, not a crutch.

### Frontend Frameworks

| Framework | Build Command   | Output            | Notes                                                       |
| --------- | --------------- | ----------------- | ----------------------------------------------------------- |
| `static`  | None            | As-is             | Plain HTML/CSS/JS                                           |
| `react`   | `npm run build` | `./dist`          | Vite-based. CRA users: override build-command + publishPath |
| `vue`     | `npm run build` | `./dist`          | Vue CLI or Vite                                             |
| `angular` | `npm run build` | `./dist`          | Nested output may need publishPath override                 |
| `svelte`  | `npm run build` | `./build`         | SvelteKit + adapter-static                                  |
| `nextjs`  | `npm run build` | SSR (web service) | Sets `PORT=10000`                                           |
| `nuxtjs`  | `npm run build` | SSR (web service) | Nuxt 3+ Nitro. Nuxt 2: override startCommand                |

### Backend Frameworks

| Framework            | Build                   | Start                              | Notes                                           |
| -------------------- | ----------------------- | ---------------------------------- | ----------------------------------------------- |
| `nodejs` / `express` | `npm install`           | `npm start`                        | Must listen on `process.env.PORT`               |
| `nestjs`             | `npm run build`         | `npm run start:prod`               | Standard NestJS project                         |
| `fastapi`            | `pip install`           | `uvicorn main:app`                 | Expects `main.py` with `app = FastAPI()`        |
| `django`             | `pip install`           | `gunicorn config.wsgi:application` | Expects `config/` directory                     |
| `flask`              | `pip install`           | `gunicorn app:app`                 | Expects `app.py` with `app = Flask(__name__)`   |
| `rails`              | `bundle install`        | `rails server`                     | Auto-runs `db:migrate` on build                 |
| `go`                 | `go build -o app`       | `./app`                            | Must read `PORT` env var                        |
| `rust`               | `cargo build --release` | Auto-detects binary                | Override startCommand if needed                 |
| `laravel`            | Docker                  | Docker                             | Requires a Dockerfile (no native PHP on Render) |
| `springboot`         | Docker                  | Docker                             | Requires a Dockerfile (no native JVM on Render) |
| `docker`             | Dockerfile              | Dockerfile                         | App must listen on `$PORT` (10000)              |

### Deploy Flags (Frontend & Backend)

All optional. Use only when defaults don't work.

- `--build-command <cmd>` — Custom build command
- `--start-command <cmd>` — Custom start command
- `--runtime <rt>` — node, python, ruby, go, rust, docker, image, static
- `--dockerfile-path <path>` — Path to Dockerfile (implies runtime=docker)
- `--docker-context <dir>` — Docker build context (default: ./)
- `--docker-command <cmd>` — Override Dockerfile CMD
- `--publish-path <path>` — Static site publish directory (frontend only)
- `--pre-deploy-cmd <cmd>` — Runs after build, before start (e.g. DB migrations)
- `--health-check-path <path>` — Health endpoint for zero-downtime deploys
- `--plan <plan>` — free, starter, standard, pro, pro_plus, pro_max, pro_ultra. ⚠️ `free` is **NOT honored for tenant resources** — the backend auto-substitutes the cheapest paid plan (`starter`, ~$7/mo) and charges for it (see `resolveServicePlan` in the backend). Our Render account is shared across all tenants, so the single free slot can never be handed to a tenant service.
- `--num-instances <n>` — Horizontal scaling
- `--max-shutdown <sec>` — Graceful shutdown timeout (1-300)
- `--region <region>` — oregon, ohio, virginia, frankfurt, singapore
- `--branch <branch>` — Git branch (default: main)
- `--auto-deploy false` — Disable auto-deploy on push
- `--env KEY=VALUE` — Environment variables (repeatable)

### Database Plans

- `starter` (~$7/mo) — recommended default
- `standard` (~$20/mo)
- `pro`, `basic_256mb`..`basic_4gb`, `pro_4gb`..`pro_512gb`, `accelerated_16gb`..`accelerated_1024gb`
- `free` — ⚠️ **NOT honored for tenant databases.** The backend auto-substitutes the cheapest paid DB plan (`basic_256mb`, ~$6/mo) and charges for it (see `resolveDatabasePlan` in the backend). Render allows only 1 free DB per (shared) account, so it can never be a tenant default.

### Costs

| Item                | Cost                  |
| ------------------- | --------------------- |
| .com domain         | ~$13-15/year          |
| .io domain          | ~$35-40/year          |
| Frontend deploy     | ~$7/mo (starter plan — cheapest paid; no free tier for tenant services) |
| Backend deploy      | ~$7/mo (starter plan — cheapest paid; no free tier for tenant services) |
| Database (starter)  | ~$7/month             |
| Database (standard) | ~$20/month            |
| DNS + SSL           | $0 (Cloudflare)       |
| Recurring billing   | Live web services & databases are billed monthly on the 1st |

### Workflow States

**Website:** `initialized` → (`registering_domain`) → `domain_registered` → `repo_created` → `code_committed` → `deployed` → `dns_setup` → `nameservers_updated` → `domain_attached` → `completed` ✅

Note: `registering_domain` is a transient in-progress state. If registration fails, the workflow is automatically reset to `initialized` so it can be retried.

**Backend:** `not_started` → `database_provisioning` → `repo_created` → `code_committed` → `deployed` → `subdomain_attached` → `backend_live` ✅

**Billing / dunning states (can occur for either lifecycle once a resource is live).** These are driven by the recurring billing cron, not the deploy flow — a completed/live workflow can still enter them later if a monthly charge fails:

- `paused_insufficient_funds` — a workflow step (or the deploy budget) hit HTTP 402 `insufficient_credits`. **Handling:** add credits to the account email in the app, then `increase-budget.cjs` / retry the paused step.
- `suspended` — a live resource went `past_due` and, after **3 days** unpaid, was suspended on Render (site/backend goes down but is recoverable). **Handling:** add credits, then run `retry-dunning.cjs` (→ `/billing/retry-mine`, your own resources) to resume it.
- `DELETED` / `terminated` — a resource stayed unpaid **> 30 days** past-due and was hard-deleted on Render (irrecoverable). **Handling:** it must be rebuilt from scratch (new deploy).

See **Recurring Billing & Dunning** below for the full ladder.

### Financial Safety

- Billing is in-app credits (1 credit = 1 USD), keyed by the account email — no crypto wallet
- Credit spends are atomic: the external Credits API performs balance-check + deduct in one server-side operation (the deduct call IS the gate; the read-balance call is display/preflight only)
- Insufficient credits return **HTTP 402 `insufficient_credits`** at spend time (no charge)
- Deduct-before-work: credits are deducted before external API calls
- Auto-refund: if the downstream call fails, credits are refunded (domain registration verifies ownership on OpenProvider before refunding — prevents free domains)
- 504 timeout recovery: domain registration verifies ownership on OpenProvider before refunding — no double-charge
- Cross-tenant safety: lookups scoped by tenant — no data leaks between customers
- Stuck workflow recovery: failed domain registration resets workflow to `initialized` (retryable)
- Idempotent deduct/refund keys prevent double-charges under retries; a best-effort local ledger (`/tenant/transactions`) records spends but never blocks a real spend

### Rate Limits (HTTP 429)

The API is now rate-limited per tenant. Expect and handle **HTTP 429 (Too Many Requests)** by **backing off ~1 minute and retrying** — do not hammer in a tight loop.

- **Spending endpoints** (`initialize`, `register-domain`, `deploy`, `provision-database`, `recreate-service`, `increase-budget`): ~**10/min per tenant**.
- **`retry-dunning.cjs` → `/billing/retry-mine`** (user recovery): **6/min per tenant**.

List endpoints (`workflow/list`, `website/list`) are paginated: `?limit=` (default 50, max 200) and `?offset=` (default 0), and return `pagination` metadata (`total`, `limit`, `offset`, `count`, `hasMore`) alongside the array. The array key is unchanged (`workflows` / `websites`), so existing parsing keeps working; page through with `offset` if a tenant has more than 50 items.

### Recurring Billing & Dunning

Deploys are **not** one-time costs. Understand this before quoting a price to the user.

**Billing model.** Funds are in-app **credits** (1 credit = 1 USD), keyed by the tenant/account **email**. Usage — domain registration, deploys — debits credits immediately (atomic deduct-before-work; a failed downstream step auto-refunds).

**Recurring charge.** Every **live web service and database** is re-billed **monthly on the 1st** (00:00 UTC) by a backend cron. A single deploy therefore recurs **every month** while the service stays live (~$7/mo per web service, ~$6–7/mo per database). Static sites are genuinely free on Render and are never charged.

**Dunning ladder** (what happens when a recurring charge fails because the account is out of credits):

1. 🟡 **`past_due`** — the charge returns HTTP 402, the resource is flagged past-due but **stays live** during a grace window. A daily retry cron (06:00 UTC) keeps re-attempting the charge.
2. 🟠 **`suspended`** — after **3 days** past-due and still unpaid (`SUSPEND_AFTER_DAYS = 3`), the resource is **suspended on Render** (the site/backend goes down, but is recoverable).
3. 🔴 **`DELETED` / terminated** — after **30 days** past-due and still unpaid (`HARD_DELETE_AFTER_DAYS = 30`), the resource is **hard-deleted on Render** — **irrecoverable**. Billing stops.

**Recovery (user-facing).**

- If `past_due` or `suspended`: **add credits** to the account (in the agentic app, by email), then run `retry-dunning.cjs` to re-charge and **resume** the suspended resource without waiting for the daily cron. This hits `POST /billing/retry-mine` — **tenant-scoped**, authenticated with the account's own API key, and only ever affects **this account's** resources.
- If already **hard-deleted**: it is gone — it must be **rebuilt from scratch** (a fresh deploy).

```bash
# After topping up credits: recover YOUR OWN past-due / suspended resources
node {baseDir}/scripts/retry-dunning.cjs
```

> ⚠️ `retry-mine` is rate-limited to **6/min per tenant**. On **HTTP 429**, wait ~1 minute and retry — don't hammer.

### Log Filtering Note

The `--log-type` flag on `deploy-logs.cjs` (build/runtime) is passed to the backend but Render's log API does not support server-side type filtering. All logs are returned regardless. The flag is preserved for future use but currently has no filtering effect.
