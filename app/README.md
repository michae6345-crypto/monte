# app

Next.js App Router.

| Path | What it is |
|---|---|
| `page.tsx` | The site: hero, the five people, every section, tap demo |
| `dashboard/` | Every demo wallet side by side |
| `brand/` | The brand sheet: mark, colours, type |
| `opengraph-image.tsx` | The link-preview card |
| `api/health/` | Health check; no Plaid call, so it can't fail on a missing key |
| `api/plaid/` | `link-token`, `exchange`, `data`, `sandbox`; 503 `plaid_not_configured` without keys |
