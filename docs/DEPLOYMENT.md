# Deployment Documentation
## QuickFix — On-Demand Home Services Marketplace

| Field | Detail |
|---|---|
| Document Type | Deployment and Operations Reference |
| Basis | Direct inspection of all attached source files, cross-referenced against `docs/PRD.md`, `docs/SRS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, and `docs/API.md` |
| Critical Constraint | **No build tool, package manifest, or CI/CD configuration file exists anywhere in the inspected project** (confirmed: no `package.json`, no `.env` file, no `node_modules`, no webpack/vite config). QuickFix is a set of static HTML files with plain, non-module `<script>` tags and hardcoded configuration constants. This document describes deployment of the project **as it actually exists** — a static-site deployment plus Supabase project configuration — and explicitly labels anything not yet implemented (env-var injection, CI/CD, automated backups, monitoring) as a Future Enhancement rather than describing it as already in place. |

---

## 1. Deployment Overview

### 1.1 Purpose
This document describes how to deploy QuickFix to a production hosting environment, based strictly on what the codebase requires to run: static file hosting for the six HTML entry points and their CSS/JS, plus a correctly configured Supabase project. It does not describe a deployment pipeline that does not exist in the source (no CI/CD file was found).

### 1.2 Deployment Strategy
QuickFix requires no compilation, bundling, or transpilation step. Every JavaScript file is a plain classic script (no `type="module"`, no `import`/`export`, per `ARCHITECTURE.md` §2), and every page is a self-contained static HTML file. Deployment therefore consists of two independent parts:
1. **Static asset deployment** — copying the HTML/CSS/JS files as-is to any static file host or CDN.
2. **Supabase project configuration** — provisioning the Postgres tables, Storage buckets, and (if desired) Row Level Security policies that the client code expects to already exist (see Section 7).

### 1.3 Current Deployment Model
No hosting provider, domain, or live deployment target is named or configured anywhere in the inspected source. `SRS.md` and `PRD.md` do not specify a target static host (e.g. Vercel, Netlify, GitHub Pages, S3+CloudFront). This document therefore describes the **generic requirements** any static host must satisfy, without asserting that a specific provider is already in use. Any specific hosting provider selection is a deployment decision the project has not yet documented, not a fact this document invents.

---

## 2. System Requirements

| Requirement | Detail | Verified Basis |
|---|---|---|
| Operating System (server/host) | None specific — any static file host (Linux-based CDN/object storage, or any OS capable of serving static files over HTTPS) is sufficient, since the app has no server-side runtime of its own | No server-side code exists anywhere in the inspected source |
| Browser Support | Any modern evergreen browser supporting `fetch`, `IntersectionObserver`, `MutationObserver`, ES2017+ syntax (`async`/`await`, arrow functions, template literals, optional chaining `?.`), CSS custom properties, and the Geolocation API | Directly used across `index.js`, `dashboard.js`, `maps.js`; no polyfill or transpilation target was found, so no legacy-browser support (e.g. IE11) is implied or claimed |
| Node.js Requirement | **None for running the deployed application.** No `package.json`, no `node_modules`, and no build script exist in the inspected project. Node may optionally be used as a local static-file dev server (e.g. `npx serve`) during development, but this is a convenience, not a project requirement, since no such tooling file was found in the source | Confirmed by absence in the uploaded file set |
| Internet Requirements | The application requires live internet connectivity at runtime to reach: Supabase (Auth/Postgres/Storage/Realtime), the Geoapify Routing/Reverse-Geocoding APIs, the Nominatim forward-geocoding API, the Leaflet/OpenStreetMap tile CDN, the `@supabase/supabase-js@2` CDN bundle, the `qrcodejs` CDN bundle, and Google Fonts. There is no offline mode, service worker, or cached-asset fallback anywhere in the source | `ARCHITECTURE.md` §5 |
| Supabase Account | A Supabase project (URL + anon key) is a hard prerequisite — `supabase.js` fails immediately if `SUPABASE_URL`/`SUPABASE_KEY` do not point to a live, correctly provisioned project | `supabase.js` |
| Geoapify API Key | A Geoapify account and API key are required for reverse geocoding and routing; the key is held server-side only, as a `geoapify-proxy` Supabase Edge Function secret (not present in any client file). The routing/tracking features fail gracefully (return `null`, tracking degrades) rather than crash if the key is invalid or the account is rate-limited, per the try/catch in `_fetchRoadRoute` | `maps.js` |

---

## 3. Environment Configuration

**This is the most significant deployment gap identified in the project.** There is no environment-variable system in the codebase. All configuration values are **hardcoded as plaintext JavaScript constants directly in committed source files**, not injected via `.env`, build-time substitution, or a server-side config endpoint. This is stated explicitly here because it is a genuine production-readiness concern that any deployment process must account for, not because a different configuration approach is being described.

| Value | Location | Mechanism | Note |
|---|---|---|---|
| `SUPABASE_URL` | `supabase.js` | Hardcoded `const SUPABASE_URL='https://oycurbgzzgfzilpflwks.supabase.co'` | Not environment-injected |
| `SUPABASE_KEY` (anon key) | `supabase.js` | Hardcoded `const SUPABASE_KEY='eyJhbGci...'` (a Supabase anon/public JWT) | Anon keys are designed to be public-facing in Supabase's own security model (protected by RLS, not secrecy), but this project's specific RLS configuration cannot be verified from client code (`DATABASE.md` §9) |
| `GEOAPIFY_API_KEY` | Not present in client code (removed from `config.js` as of Phase 6.1) | Held server-side only, as a `geoapify-proxy` Supabase Edge Function secret | Not shipped to the browser; not visible in network traffic |
| `RELIABILITY_MIN_ACCEPTED_JOBS`, `TRACKING_ZOOM` | `config.js` | Hardcoded plaintext constants | Non-sensitive application constants, not secrets |

**Configuration files.** The only configuration file in the project is `js/common/config.js` itself, which — per its own header comment — is a "Plain classic script... it makes no Supabase calls," holding only the three values above. There is no `.env`, `.env.example`, `config.json`, or secrets-manager integration anywhere in the source.

**Deployment implication.** Because `SUPABASE_URL`/`SUPABASE_KEY` are committed directly into `supabase.js`, which gets deployed to a static host, **rotating them requires editing and redeploying `supabase.js` directly** — there is no environment-variable override mechanism to change these per-environment (e.g. staging vs. production) without maintaining separate file copies. The Geoapify key is rotated independently, server-side, as a `geoapify-proxy` Supabase Edge Function secret, with no client file to redeploy. Introducing a real environment-variable/build-time-injection system for `SUPABASE_URL`/`SUPABASE_KEY` is not implemented and is noted as a Future Enhancement in Section 9.

---

## 4. Project Structure

The folder structure below matches `ARCHITECTURE.md` §6 exactly, annotated here with deployment relevance.

```
/
├── landing.html                  → deploy as static root or /landing
├── auth.html                     → deploy as static route /auth.html
├── index.html                    → customer app entry point
├── worker-dashboard.html         → worker app entry point
├── worker-profile.html           → worker app entry point
├── admin.html                    → admin portal entry point (no distinct
│                                     access restriction beyond in-app auth —
│                                     see Section 9, Security)
│
├── css/
│   ├── landing/landing.css
│   ├── auth/auth.css
│   ├── customer/index.css
│   ├── worker/dashboard.css
│   └── admin/admin.css           (worker-profile.html has no dedicated
│                                   CSS file — inline <style>, per
│                                   ARCHITECTURE.md §6)
│
└── js/
    ├── common/                   → must be deployed and reachable at the
    │   ├── supabase.js             same relative path referenced by every
    │   ├── config.js               page's <script src="js/common/...">
    │   ├── utils.js                tag; deploying this folder under a
    │   ├── toast.js                different path without updating every
    │   ├── maps.js                 HTML file's script tags will break
    │   └── nav.js                  every page
    ├── landing/landing.js
    ├── auth/auth.js
    ├── customer/index.js
    ├── worker/
    │   ├── dashboard.js
    │   └── profile.js
    └── admin/admin.js
```

All paths above are relative (`js/common/supabase.js`, `css/customer/index.css`, etc.), confirmed from every inspected `<script src>`/`<link href>` tag. This means the six HTML files and the `css/`/`js/` folders **must be deployed together, preserving this exact relative structure**, from a single origin — there is no absolute-URL or CDN-hosted first-party asset anywhere in the source.

---

## 5. Frontend Deployment

| Asset Type | Deployment Method | Notes |
|---|---|---|
| HTML (6 files) | Deploy as-is to any static host (object storage + CDN, or a static-site host) | No templating or server-side rendering; every page is delivered exactly as committed |
| CSS | Deploy the `css/` folder alongside the HTML, preserving relative paths | No CSS preprocessor (Sass/Less) or build step was found — files are plain `.css` |
| JavaScript | Deploy the `js/` folder alongside the HTML, preserving relative paths and the exact script-tag load order documented in `ARCHITECTURE.md` §7 | No bundler; each `<script>` tag loads its own file directly over HTTP(S) — script-tag order in each HTML file is load-bearing and must not be altered during deployment |
| Images/Assets | No dedicated `images/`, `assets/`, or `public/` folder was found in the inspected file set. Icons are inline emoji/Unicode characters or SVG-in-`href` data URIs (e.g. `admin.html`'s favicon: `href="data:image/svg+xml,..."`) | No binary image asset pipeline exists to document |
| Fonts | Loaded from Google Fonts CDN (`fonts.googleapis.com`) directly in each page's `<head>` — not self-hosted | Requires the deployment environment to allow outbound requests to this CDN at render time |
| Third-Party Library CDNs | `@supabase/supabase-js@2` (jsDelivr), Leaflet 1.9.4 (unpkg), `qrcodejs@1.0.0` (cdnjs, lazy-loaded only on first QR render) | None of these are vendored/self-hosted; the deployed site depends on these three CDNs being reachable at runtime |

**Caching consideration.** Because there is no build step producing content-hashed filenames (e.g. `app.a1b2c3.js`), a CDN or browser cache configured with a long TTL on `js/*`/`css/*` could serve a stale version of a page's script after a deployment update, since the filenames never change between versions. No cache-busting mechanism (query-string versioning, hashed filenames) was found anywhere in the source. This is noted as a real deployment risk, not a resolved feature.

---

## 6. Backend Deployment

**QuickFix has no custom backend server to deploy.** This is stated explicitly and is consistent with `ARCHITECTURE.md` §4: there is no Node/Express/Django/etc. application, no server-side rendering process, and no custom API route anywhere in the inspected source. Every "backend" responsibility is fulfilled by the hosted Supabase project referenced by the hardcoded `SUPABASE_URL` in `supabase.js`:

| Responsibility | Where It Runs | Client's Role |
|---|---|---|
| Authentication | Supabase Auth (hosted) | Calls `sb.auth.*` methods only |
| Data persistence | Supabase Postgres (hosted) | Calls `sb.from(...)` only |
| File storage | Supabase Storage (hosted) | Calls `sb.storage.from(...)` only |
| Read-only aggregation | Two Postgres RPCs, `get_worker_stats`/`get_worker_stats_bulk` (hosted in the Supabase project; SQL body not part of the inspected client code) | Calls `sb.rpc(...)` only |
| Realtime push | Supabase Realtime (hosted) | Subscribes via `sb.channel(...)` only |

**Deployment action required for the backend.** "Deploying the backend" for this project means provisioning and configuring the Supabase project itself (Section 7) — there is no server process to provision, containerize, or scale independently of Supabase's own infrastructure.

---

## 7. Database Deployment

| Item | Status | Detail |
|---|---|---|
| Supabase Project Setup | Prerequisite, not automated | A Supabase project must be created, and its URL/anon key must match what is hardcoded in `supabase.js` (or `supabase.js` must be edited to match a new project — see Section 3) |
| Tables | Must be created manually | No schema/migration file was supplied with this project (`DATABASE.md`, Critical Constraint). The eleven tables documented in `DATABASE.md` §4 (`users`, `workers`, `bookings`, `areas`, `campaigns`, `user_passes`, `worker_achievements`, `admins`, `reviews`, `profiles`) must be created in the target Supabase project with, at minimum, the columns enumerated in that document, inferred entirely from client-side reads/writes |
| Row Level Security Policies | **Not verifiable from the client code; not confirmed to exist.** | `DATABASE.md` §9 and `PRD.md` §22A.2 both note that business-rule enforcement (booking price, worker assignment, QuickCoins crediting) currently happens client-side, with no confirmed RLS policy backing these writes. Provisioning correct RLS policies for every table above is a deployment/security task this document cannot mark as already complete, since it cannot be verified from the inspected files |
| Functions (RPCs) | Must be created manually | `get_worker_stats(p_worker_id)` and `get_worker_stats_bulk(p_worker_ids)` are called by the client but their SQL definitions are not part of the inspected source; they must be authored and deployed to the Supabase project separately |
| Storage Buckets | Must be created manually | `worker-documents` and `worker-photos`, referenced by name in `auth.js`; both must exist in the target project with upload permissions matching what the signup flow expects. `worker-documents` must remain a **private** bucket (`public:false`) — the admin portal's document-viewing feature (Phase 8) depends on this, retrieving objects via a short-lived signed URL (`createSignedUrl`) rather than a public URL. A `storage.objects` SELECT policy scoped to active admins (`admins_can_select_worker_documents`) must also be provisioned for this to succeed. |
| Realtime | Must be enabled per-table | The `bookings` table must have Postgres change replication enabled for the worker-dashboard Realtime channel (`worker-bookings-<id>`) to function. **Phase 8 addition:** `workers`, `users`, and `reviews` must also be added to the `supabase_realtime` publication (`ALTER PUBLICATION supabase_realtime ADD TABLE workers, users, reviews;`) for the worker-side ban-enforcement channel and the three admin-dashboard sync channels to function; `workers` additionally requires `ALTER TABLE workers REPLICA IDENTITY FULL;` so that `payload.new` on an `UPDATE` event carries the full row (specifically `banned_until`), not just the primary key. None of this is enabled by default when a table is created. |

---

## 8. External Services

| Service | Deployment Dependency | Configuration Required |
|---|---|---|
| Supabase | Hard dependency — the application cannot function at all without a live, correctly provisioned project | `SUPABASE_URL`, `SUPABASE_KEY` in `supabase.js`; tables/policies/functions/buckets/Realtime per Section 7 |
| Geoapify | Required for routing and reverse geocoding (tracking degrades gracefully, per Section 1, if unavailable — but the "Resolve address" reverse-geocode step is also used during booking-pin resolution) | Geoapify API key held as a `geoapify-proxy` Supabase Edge Function secret (not in `config.js`); an active Geoapify account with sufficient quota for the expected request volume |
| Leaflet.js + OpenStreetMap Tiles | Required for every map render (pin picker, tracking) | No account/key required; CDN reachability required (`unpkg.com`) |
| Nominatim (OpenStreetMap) | Required for address-to-coordinate forward geocoding at booking time | No account/key required; subject to OpenStreetMap's own public usage policy (no rate-limit handling beyond a generic `if(!res.ok)` check was found in `index.js`) |
| Browser APIs (Geolocation, `sessionStorage`, `localStorage`) | Client-side only; no deployment action required, but the deployed site must be served over HTTPS for the Geolocation API to function in most modern browsers | — |

---

## 9. Production Checklist

| Category | Item | Status |
|---|---|---|
| Configuration | Supabase URL/anon key in `supabase.js` point to the correct (production, not development) project | Manual verification required before each deployment |
| Configuration | Geoapify Edge Function secret (`geoapify-proxy`) has adequate quota for expected traffic | Manual verification required |
| Configuration | All six HTML files and the `css/`/`js/` folders deployed together with relative paths intact | Manual verification required (Section 4) |
| Security | Row Level Security policies actually enforce the business rules currently assumed to be client-side only | **Not implemented/not verifiable** — flagged as a Future Enhancement (`PRD.md` §21.2) |
| Security | Admin-scoped UPDATE policies exist on `workers` for ban/verification writes, and admin-scoped SELECT policies exist for `users`, `worker_bans`, `worker_bonuses`, and the `worker-documents` storage bucket | **Implemented** — Phase 8: `admins_can_update_any_worker`, `admins_can_update_worker_verification`, `admins_can_select_all_users`, `admins_can_select_worker_documents`, `admins_can_select_worker_bans`/`admins_can_insert_worker_bans` (see `DATABASE.md` §8 for full policy list). A pre-Phase-8 gap where the admin ban write silently failed under the pre-existing `workers_update` policy (no admin-scoped UPDATE policy existed at all) was found and fixed during this phase — see `CHANGELOG.md` Phase 8. |
| Security | Geoapify key moved behind a server-side proxy instead of a plaintext client constant | **Implemented** — Phase 6.1: Geoapify calls are proxied through the `geoapify-proxy` Supabase Edge Function; no Geoapify key exists in client code |
| Security | Worker ID document Storage buckets have a defined retention/encryption/deletion policy | **Not implemented** — open compliance item (`PRD.md` §22A.5) |
| Testing | Automated test suite / CI pipeline | **Not present anywhere in the inspected source** — no test file, no CI config |
| Performance | Cache-busting for `js/*`/`css/*` on deployment (Section 5) | **Not implemented** |
| Performance | Client-side aggregation cost (admin analytics, worker stats) reviewed against expected data volume | Manual review recommended; no server-side aggregate query exists for these two areas (`DATABASE.md` §10) |
| Monitoring | Application error tracking / uptime monitoring | **Not present anywhere in the inspected source** — the only error visibility is `console.error()` calls, visible solely in an individual user's own browser console |
| Monitoring | Supabase project's own built-in dashboards (Auth, Database, Storage, Realtime usage) | Available via Supabase's hosted dashboard; not something this codebase configures itself, but usable as-is post-provisioning |

---

## 10. Backup & Recovery

No backup, recovery, or disaster-recovery procedure is defined, scripted, or referenced anywhere in the inspected project files, `PRD.md`, or `SRS.md`. The following reflects only what is available by virtue of using Supabase as the backend, not a project-authored backup strategy:

| Aspect | Current State |
|---|---|
| Supabase Backup Strategy | Whatever automatic backup tier is included with the Supabase project's plan (e.g. daily backups on paid tiers) — this is a Supabase-platform capability, not something configured or scripted by this project. No backup schedule, retention policy, or restore runbook was found in the inspected source |
| Database Recovery | No project-specific recovery procedure (e.g. a documented point-in-time-restore runbook, or a script to reseed `areas`/`admins`) exists in the inspected files |
| Configuration Backup | Since `SUPABASE_URL`/`SUPABASE_KEY` live as plaintext constants in version-controlled JavaScript files (Section 3), that configuration is implicitly backed up by whatever source-control system holds the repository — but this is incidental to the hardcoding approach, not a designed configuration-backup feature. The Geoapify key is a Supabase Edge Function secret and is backed up (or not) according to Supabase's own secret-storage guarantees, independent of source control |

**This entire section is a gap, not an implemented capability**, and any real backup/recovery procedure should be treated as a Future Enhancement to be defined before production launch, consistent with the absence of any such procedure in `PRD.md`/`SRS.md`.

---

## 11. Scaling Strategy

### 11.1 Current Architecture
As documented in `ARCHITECTURE.md` §15 and `DATABASE.md` §10:
- Static frontend assets scale trivially via any CDN, since there is no server-side rendering or per-request computation on the frontend host.
- The Supabase project is the single scaling bottleneck — Postgres connections, Realtime channel count (currently one dedicated channel per connected worker, `worker-bookings-<id>`), Storage bandwidth, and Auth throughput all scale with Supabase's own project tier, not with anything this codebase configures.
- Client-side aggregation (admin analytics, most worker performance figures) scales with the number of rows fetched into an individual browser session, not with a server-side query plan — this becomes a real performance concern as `bookings`/`campaigns`/`user_passes` volume grows, independent of Supabase's own scaling.
- GPS writes are batched per position fix across a worker's active bookings (`.in('id', activeIds)`), the one deliberate scalability optimization found in the client code.

### 11.2 Future Improvements
Only items already named as planned in `PRD.md`/`SRS.md`:
- Phase 6 (`PRD.md` §21.2): optimize database queries, move business logic server-side, support multiple concurrent users at production scale.
- No CDN-edge, horizontal-scaling, or load-balancing strategy beyond "use a static host/CDN for the frontend" is named anywhere in the source; this document does not invent one.

---

## 12. Troubleshooting

| Issue | Likely Cause | Verified Resolution Path |
|---|---|---|
| Blank page / "supabase is not defined" error | The Supabase CDN script (`@supabase/supabase-js@2`) failed to load before `supabase.js` executed, or `supabase.js` was not loaded before the page's own script | Confirm the CDN `<script>` tag is present and precedes `js/common/supabase.js`, which must precede every other script, per `ARCHITECTURE.md` §7 |
| "CONFIG is not defined" error in `maps.js` or a page script | `config.js` was not loaded, or was loaded after `maps.js`/the page script | Confirm `config.js` is included and ordered per `ARCHITECTURE.md` §7 — note that `admin.html` and `landing.html` intentionally do not load `config.js` at all, since neither page's script references `CONFIG` |
| Booking/login works locally but fails after deployment | Relative script/CSS paths broken because the `js/`/`css/` folder structure was not preserved exactly during deployment (Section 4) | Verify every `<script src>`/`<link href>` resolves correctly from the deployed root |
| Geoapify calls failing (routing/reverse-geocode silently return `null`, tracking shows stale ETA) | Invalid, quota-exhausted, or missing Geoapify key in the `geoapify-proxy` Supabase Edge Function's secret configuration, or the Edge Function itself failing/misconfigured | Verify the key directly against the Geoapify dashboard and check the `geoapify-proxy` Edge Function logs in the Supabase dashboard; the client code fails gracefully (returns `null`) rather than surfacing the underlying HTTP error to the end user, so this can be easy to miss without checking the browser console |
| Address geocoding always fails | Nominatim usage-policy rate limiting, or a network/CORS block on `nominatim.openstreetmap.org` from the deployment environment | Check the browser console for the specific `[geocode]` log line (`geocodeAddress()` logs network, HTTP-status, JSON-parse, and non-numeric-coordinate failures distinctly) |
| Worker dashboard bookings not updating live | Supabase Realtime not enabled for the `bookings` table in the target project (Section 7), or the worker's `worker_id` filter mismatched | Confirm Realtime replication is enabled for `bookings`; the 5-second polling fallback should still function even if the channel itself fails, per `dashboard.js`'s own fallback comment |
| Admin portal inaccessible for a legitimate admin | The signed-in email has no row (or `is_active=false`) in the `admins` table | Verify/insert the correct row directly in the Supabase project — there is no in-app admin-management UI to do this, per `ARCHITECTURE.md` §10 |
| Worker signup succeeds but the worker never appears assignable | The `workers` insert failed after a successful Storage upload, or `is_available` was never set `true` (workers start `is_available:false` at signup, per `DATABASE.md` §4.2) | Check the Supabase Auth dashboard for an orphaned auth account (the client rolls back a failed `workers` insert and signs the session out, per `API.md` §2) and confirm the worker has toggled themselves online from the dashboard |
| Environment-specific configuration (staging vs. production) bleeding together | There is no environment-variable mechanism — `supabase.js`/`config.js` hold one hardcoded set of values (Section 3) | Maintain separate file copies per environment until a proper build-time injection mechanism is introduced (Future Enhancement) |

Future Enhancement: a structured environment-variable/build-time configuration system, an automated CI/CD pipeline, and application-level error/uptime monitoring would each resolve a class of the troubleshooting scenarios above at the source, but none of the three exists in the inspected project today.