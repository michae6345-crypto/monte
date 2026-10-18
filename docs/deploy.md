# Deploying Monte (Render)

Production is **Render**, not Vercel. Adrian's manual Vercel deploys are the old path; the
Vercel URL should be treated as frozen once Render is live. The Blueprint is
[`render.yaml`](../render.yaml); the service runs one long-running Node process
(`next start`), so Vercel-isms like `maxDuration` and per-function regions do not apply.

## Current state (as of this commit)

| Thing | Value |
|---|---|
| Service | `monte` |
| Service id | `srv-dba6n1uq1p3s73ahg31g` |
| URL | `https://monte-rm86.onrender.com` |
| Dashboard | `https://dashboard.render.com/web/srv-dba6n1uq1p3s73ahg31g` |
| Workspace / owner id | `tea-d9mu9bbm8hqs73d5vcrg` ("My Workspace") |
| Repo / branch | `https://github.com/adrian-erlikhman/monte` (public) / `main` |
| **State** | **suspended, autoDeploy off, zero env vars set** |

The service was created with `POST /v1/services` (HTTP 201) and started building commit
`82c1d71`. It was then deliberately **suspended** and its `autoDeployTrigger` set to
`off`, because the team agreed to **no production deploys** until Michael says go. Nothing
is serving: the URL returns 503 while suspended. Resuming is the runbook below.

### Repo access: what we actually know

- `adrian-erlikhman/monte` is a **public** repo, so Render can clone it over the plain
  public Git URL - service creation succeeding proves nothing about GitHub App access.
- Our account `michae6345-crypto` has **write, not admin** (`admin: false` on the GitHub
  permissions object).
- Registering the push webhook that makes `autoDeploy` fire needs admin on the repo, and
  we cannot even list the repo's hooks. So **assume auto-deploy will not fire on pushes
  to `main`** until someone with admin confirms the Render GitHub App is installed and has
  access to this repo. Manual deploys (`POST .../deploys`, or Deploy in the dashboard)
  work regardless, because the repo is public.
- To fix it properly, Adrian (repo owner) grants the Render GitHub App access:
  `https://github.com/settings/installations` -> Render -> Repository access -> add
  `monte`. Our side reconnects at `https://dashboard.render.com/settings#github`.
  Render's docs: `https://render.com/docs/github`.
- **If the repo is transferred to `michae6345-crypto`**, the stored repo URL goes stale
  (GitHub redirects clones, but don't rely on it): `PATCH /v1/services/<id>` with
  `{"repo":"https://github.com/michae6345-crypto/monte"}`, then re-grant the Render App on
  the new owner and, if auto-deploy still doesn't fire, disconnect/reconnect the repo in
  the dashboard to re-register the hook.

## Render settings

| Setting | Value | Why |
|---|---|---|
| Type | Web Service (`web` in the Blueprint, `web_service` in the REST API) | |
| Runtime | `node` | Next 16 needs a Node server; not a static site |
| Region | `oregon` | same region as the rest of our Render workspace |
| Plan | `starter` (paid) | free instances sleep after ~15 min and cold-start in tens of seconds - unacceptable for a live demo |
| Branch | `main` | |
| Auto deploy | `true` in the Blueprint (currently **off** on the live service) | |
| Build command | `npm ci && npm run build` | `npm ci` uses the committed lockfile |
| Start command | `npm start` | `next start` reads `$PORT` and binds `0.0.0.0`, so Render's port works with no flags (see below) |
| Health check path | `/api/health` | no Plaid call, no engine run - a missing key can't fail the health check |
| Instances | 1 | |

### `$PORT` on Render

Render injects `PORT` (10000 for this service) and expects the process to listen on it.
`next start` defines its `-p/--port` option with commander's `.env('PORT')` and defaults
the hostname to `0.0.0.0`
(`node_modules/next/dist/bin/next`, the `program.command('start')` block), so plain
`npm start` binds `$PORT` on all interfaces. No `-p`/`-H` flags needed, which matters
because `package.json` is shared and we are not editing its `start` script.

## Environment variables

| Key | Value | Secret? | Notes |
|---|---|---|---|
| `NODE_VERSION` | `24` | no | matches local dev (Node 24.x) |
| `NEXT_TELEMETRY_DISABLED` | `1` | no | |
| `PLAID_CLIENT_ID` | from the Plaid dashboard | **yes** | `sync: false` - never in the repo |
| `PLAID_SECRET` | sandbox secret | **yes** | `sync: false`; sandbox only |
| `PLAID_ENV` | `sandbox` | no-ish | `sync: false` so it is set alongside the keys; defaults to `sandbox` if unset |

With the three Plaid vars unset, the build succeeds, the app runs on the personas, and
every `/api/plaid/*` route returns `503 {"error":"plaid_not_configured"}`. Nothing else is
required to serve the demo.

**The repo is public: no keys, tokens or card numbers in it, ever.** Local values go in
`.env.local` (gitignored); the template is [`.env.example`](../.env.example).

## Using the Render API

```bash
# The key lives in ~/.render-api-key on Michael's machine. Never echo it, never commit it.
KEY=$(tr -d ' \r\n' < ~/.render-api-key)
SRV=srv-dba6n1uq1p3s73ahg31g
API=https://api.render.com/v1
AUTH="Authorization: Bearer $KEY"
JSON="Content-Type: application/json"
```

```bash
# Read the service
curl -s -H "$AUTH" $API/services/$SRV

# List env vars -> [{envVar:{key,value},cursor}]
curl -s -H "$AUTH" $API/services/$SRV/env-vars

# Set ONE env var -> 200 {key,value}. Body is oneOf {"value":...} | {"generateValue":true}
curl -s -X PUT -H "$AUTH" -H "$JSON" -d '{"value":"sandbox"}' \
  $API/services/$SRV/env-vars/PLAID_ENV

# Trigger a deploy -> 201. Setting env vars does NOT redeploy on its own.
curl -s -X POST -H "$AUTH" -H "$JSON" -d '{"clearCache":"do_not_clear"}' \
  $API/services/$SRV/deploys

# Watch the latest deploy
curl -s -H "$AUTH" "$API/services/$SRV/deploys?limit=1"
```

Gotchas: `PUT .../env-vars/<KEY>` only works for variables set directly on the service,
not ones inherited from an environment group. `autoDeploy` is deprecated in favour of
`autoDeployTrigger` (`commit` | `off` | `checksPass`) and the API rejects both in one
request. On `POST /v1/services`, `plan` defaults to `0.5c-512mb`, so it must be set
explicitly, and `serviceDetails.envSpecificDetails` for a node service is flat
`{buildCommand, startCommand}`.

### Creating the service from scratch (if it ever has to be recreated)

```bash
curl -s -X POST -H "$AUTH" -H "$JSON" $API/services -d '{
  "type": "web_service",
  "name": "monte",
  "ownerId": "tea-d9mu9bbm8hqs73d5vcrg",
  "repo": "https://github.com/adrian-erlikhman/monte",
  "branch": "main",
  "autoDeployTrigger": "commit",
  "serviceDetails": {
    "runtime": "node",
    "region": "oregon",
    "plan": "starter",
    "healthCheckPath": "/api/health",
    "envSpecificDetails": {
      "buildCommand": "npm ci && npm run build",
      "startCommand": "npm start"
    }
  }
}'
```

## Go-live runbook (60 seconds, once Michael says go)

Service state today: suspended, auto-deploy off, no env vars. Run these in order. Replace
`<CLIENT_ID>` / `<SECRET>` with the real Plaid sandbox values; do not paste them into any
file.

```bash
KEY=$(tr -d ' \r\n' < ~/.render-api-key)
SRV=srv-dba6n1uq1p3s73ahg31g
API=https://api.render.com/v1
AUTH="Authorization: Bearer $KEY"
JSON="Content-Type: application/json"

# 1. Resume the service
curl -s -X POST -H "$AUTH" $API/services/$SRV/resume

# 2. Auto-deploy on every push to main
curl -s -X PATCH -H "$AUTH" -H "$JSON" -d '{"autoDeployTrigger":"commit"}' $API/services/$SRV

# 3. Env vars (the two NODE_* ones only matter if the Blueprint wasn't applied)
curl -s -X PUT -H "$AUTH" -H "$JSON" -d '{"value":"24"}'        $API/services/$SRV/env-vars/NODE_VERSION
curl -s -X PUT -H "$AUTH" -H "$JSON" -d '{"value":"1"}'         $API/services/$SRV/env-vars/NEXT_TELEMETRY_DISABLED
curl -s -X PUT -H "$AUTH" -H "$JSON" -d '{"value":"<CLIENT_ID>"}' $API/services/$SRV/env-vars/PLAID_CLIENT_ID
curl -s -X PUT -H "$AUTH" -H "$JSON" -d '{"value":"<SECRET>"}'    $API/services/$SRV/env-vars/PLAID_SECRET
curl -s -X PUT -H "$AUTH" -H "$JSON" -d '{"value":"sandbox"}'     $API/services/$SRV/env-vars/PLAID_ENV

# 4. Deploy (env var changes do not redeploy on their own)
curl -s -X POST -H "$AUTH" -H "$JSON" -d '{"clearCache":"do_not_clear"}' $API/services/$SRV/deploys

# 5. Wait for live, then check health
curl -s -H "$AUTH" "$API/services/$SRV/deploys?limit=1"   # until "status":"live"
curl -s https://monte-rm86.onrender.com/api/health
# -> {"ok":true,"app":"monte","plaid":"sandbox","time":"..."}
#    "plaid":"not_configured" means the keys did not land.
```

To put it back to today's frozen state: `POST $API/services/$SRV/suspend` and
`PATCH $API/services/$SRV` with `{"autoDeployTrigger":"off"}`.

## Testing Plaid once keys exist

Local (`npm run dev`, or `npm run build && npm start`) - `-c/-b` keeps the httpOnly
access-token cookie in a jar, which is what links the calls together:

```bash
BASE=http://localhost:3000     # or https://monte-rm86.onrender.com
JAR=/tmp/monte-plaid-cookies

# 0. Is this instance configured at all?
curl -s $BASE/api/health
# {"ok":true,"app":"monte","plaid":"sandbox",...}  -> keys present
# {"ok":true,"app":"monte","plaid":"not_configured",...} -> every route below returns 503

# 1. The on-stage path: no Link UI. Creates a sandbox item for ins_109508 with
#    transactions + liabilities, exchanges it, and sets the cookie.
curl -s -X POST -c $JAR $BASE/api/plaid/sandbox
# {"linked":true,"institution_id":"ins_109508","item_id":"...","source":"plaid-sandbox"}

# 2. The data the UI renders: already mapped to our Txn/Holding types.
curl -s -b $JAR $BASE/api/plaid/data
# {"txns":[{"id":"...","date":"2026-09-14","merchant":"...","amount":12.34,
#   "category":"dining","cardUsed":"citi_double_cash"}],
#  "wallet":[{"cardId":"citi_double_cash","balance":410.22,"apr":27.95}],
#  "source":"plaid-sandbox","dropped":{...},"lowConfidenceIds":[],"status":"...","pages":1}

# 3. The real Link flow, if we ever show the Plaid UI instead:
curl -s -X POST -H 'Content-Type: application/json' $BASE/api/plaid/link-token
# {"link_token":"link-sandbox-...","expiration":"...","env":"sandbox"}
#   ...run Plaid Link in the browser with that token, get a public_token, then:
curl -s -X POST -c $JAR -H 'Content-Type: application/json' \
  -d '{"public_token":"public-sandbox-..."}' $BASE/api/plaid/exchange
# {"linked":true,"item_id":"..."}

# 4. Without keys, every one of them is the same documented failure:
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/api/plaid/sandbox   # 503
curl -s -X POST $BASE/api/plaid/sandbox                                     # {"error":"plaid_not_configured"}
```

Other responses worth knowing: `409 {"error":"plaid_not_linked"}` from `/api/plaid/data`
when no cookie is set (link first), `400 {"error":"bad_request"}` for a missing
`public_token`, and `502 {"error":"plaid_error","code":"..."}` passing Plaid's own
`error_code` through (never the key).

No-keys verification that does not need Plaid at all - this is what proves the mapping:

```bash
node --import ./scripts/_alias.mjs scripts/plaid-fixture-test.ts
# 70/70 checks passed
```

## What the UI needs (for Adrian)

One call swaps a persona for Plaid data. Everything else is unchanged, because
`feed.wallet` / `feed.txns` are the exact pair `lib/data/personas.ts` produces:

```ts
import { loadPlaidSandbox, PlaidUnavailable } from "@/lib/data/plaid-feed";

const feed = await loadPlaidSandbox(); // { txns, wallet, source: "plaid-sandbox", ... }
```

Error and empty states are the UI owner's job. What's needed in `components/ace/store.tsx`
(owned by Adrian, so not changed here) is a `usePlaid()` action next to `useStatement()`:

```diff
   useStatement: (txns: Txn[], cardId: string) => void;
+  /** Swap the persona for Plaid sandbox data. Throws PlaidUnavailable. */
+  usePlaid: () => Promise<void>;
 };
@@
     useStatement: (t, cardId) => { ... },
+    usePlaid: async () => {
+      const feed = await loadPlaidSandbox();
+      setCustom(feed.txns);
+      setPersonaId("you");
+      setWallet(feed.wallet);
+    },
```

States to design for:

- `PlaidUnavailable` with `code === "plaid_not_configured"` (**the current state - no keys
  exist yet**): show "Plaid isn't connected on this deployment" and stay on the personas.
  This is not an error the judges should see as a crash.
- `code === "plaid_error"`: Plaid itself failed; offer a retry.
- `code === "plaid_not_linked"`: the cookie expired; call `loadPlaidSandbox()` again.
- Empty feed (`txns.length === 0`): the sandbox item had no transactions yet - "Plaid is
  still preparing this account" and a retry.
- `feed.dropped` counts the rows that are not reward-eligible (refunds, payments,
  transfers, interest, fees) and `feed.lowConfidenceIds` the ones whose category came from
  a low-confidence map entry - both are there if you want to show "x rows weren't
  reward-eligible" or a "check this category" flag.
