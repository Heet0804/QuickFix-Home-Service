# Project Roadmap
## QuickFix — On-Demand Home Services Marketplace

| Field | Detail |
|---|---|
| Document Type | Program Roadmap and Phase History |
| Basis | Direct inspection of all attached source files, cross-referenced against `docs/PRD.md`, `docs/SRS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md`, and `docs/DEPLOYMENT.md` |
| Phase-Numbering Evidence | Every phase number in this document is either (a) directly quoted from a phase-labeled comment in the source code (e.g. `maps.js`'s "Phase 4.7," `supabase.js`'s "Phase 5.3.2"), (b) directly quoted from `PRD.md`'s own phased-roadmap sections (Phase 6, Phase 7), or (c) the phase label the user of this conversation has themselves applied to the current documentation effort ("Phase 5.4"). No phase number, objective, or "completed" status is invented beyond what one of these three sources supports. |

---

## 1. Project Overview

### 1.1 Purpose
QuickFix is an on-demand home-services marketplace connecting customers with verified local workers (electricians, plumbers, carpenters, painters, cleaners, AC repair technicians, masons, pest-control workers, and househelp) for booking, live tracking, and payment of home-repair and household services, per `PRD.md`'s stated product definition.

### 1.2 Vision
Per `PRD.md`, QuickFix's stated intent is to replace the informal, phone-call-based process of finding and booking local service workers with a structured, trackable, ratings-backed digital booking flow — covering discovery, booking, live GPS tracking, OTP-verified service delivery, payment, and post-service review, with a loyalty layer (QuickCoins) and a promotional-offer system (Service Pass campaigns) layered on top.

### 1.3 Long-Term Goals
As stated in `PRD.md` §21/§24 and reflected in the phase structure below, the long-term goals beyond the currently shipped feature set are:
- Move business-rule enforcement (booking price, worker assignment, QuickCoins crediting) from the browser into a hardened, RLS-protected server-side layer (Phase 6).
- Mature the QuickCoins loyalty system into a full redemption ecosystem, not just an earning mechanism (Phase 7).
- Close the current gaps in testing, environment configuration, monitoring, and backup/recovery identified in `DEPLOYMENT.md`, ahead of a genuine production launch.

This document does not add any long-term goal beyond what these prior documents already establish.

---

## 2. Completed Phases

### 2.1 Core Application Build (pre-Phase-4.5, unlabeled in the inspected source)
**Status.** Completed and shipped — this is the feature set documented in full across `SRS.md` and `ARCHITECTURE.md`.

The earliest phase-numbered comments found anywhere in the codebase begin at "Phase 4.5" and "Phase 4.7" (both in `maps.js`), which by their own numbering imply that phases 1 through 4 existed and were completed beforehand. No comment, file header, or document anywhere in the inspected project independently names or describes the content of Phases 1–4 — this document does not invent a breakdown of what each of those earlier phases specifically contained. What can be stated with confidence is that, by the time Phase 4.5 was reached, the following was already fully built and working, since Phase 4.5/4.7 explicitly refine it rather than introduce it for the first time:

- The full six-page structure (`landing.html`, `auth.html`, `index.html`, `worker-dashboard.html`, `worker-profile.html`, `admin.html`).
- Customer authentication, booking creation, and the worker-assignment algorithm.
- Worker authentication, job-acceptance lifecycle, and OTP verification.
- Admin campaign management.
- A first working version of GPS tracking and map rendering (since Phase 4.5/4.7 explicitly improve, rather than introduce, this feature).

**Objectives (of the two specifically-labeled sub-phases found).**
- **Phase 4.5** — formatting and panel-update helper functions for tracking (`_fmtDistance`, `_fmtDuration`), explicitly scoped as "Pure functions, no network calls, no map/marker/polyline creation," per the code's own comment.
- **Phase 4.7** — replacing OSRM with the Geoapify Routing API for road-following routes, and adding Geoapify Reverse Geocoding to resolve a pinned coordinate to a building/society name.

**Major achievements.** A fully functional booking-to-completion pipeline, live GPS tracking with road-accurate routing, and role-separated authentication — all confirmed working end-to-end in the source inspected for this documentation set.

**Important architectural decisions.** Client-heavy, Supabase-only backend architecture (no custom server), established from the earliest inspected code and never revisited in any later phase.

### 2.2 Shared-Module Consolidation (Phase 5.3.2 – 5.3.7.1)
**Status.** Completed. This entire sub-phase is directly evidenced by explicit "Phase 5.3.x" headers in the shared module files themselves.

| Sub-Phase | File | Objective | Major Achievement |
|---|---|---|---|
| 5.3.2 | `supabase.js` | Establish a single, canonical Supabase client instance (`window.sb`) and standardize the Auth config (`persistSession`, `autoRefreshToken`, `detectSessionInUrl`) across all pages | Eliminated per-page duplicate client instantiation; every page now shares one client identity |
| 5.3.3 | `config.js` | Centralize values that were genuinely duplicated with identical meaning across files (`GEOAPIFY_API_KEY`, `RELIABILITY_MIN_ACCEPTED_JOBS`, `TRACKING_ZOOM`) | Removed three confirmed cases of identical-value duplication, while explicitly leaving page-specific constants alone (per the file's own audit-note comment) |
| 5.3.4 | `utils.js` | Extract generic, page-agnostic helpers (`markErr`, `closeModal`, `getIST`, `_fmtDate`, `escHtml`) that were duplicated across `auth.js`/`index.js`/`dashboard.js`/`admin.js`/`profile.js` | Consolidated five previously-duplicated utility functions into one shared file, explicitly preserving `index.js`'s intentionally different unguarded `fmtDate` rather than merging it and risking a behavior change |
| 5.3.5 | `toast.js` | Isolate the toast-notification system (`showToast`, `_tt`) out of `utils.js` into its own dedicated module | Cleaner separation between generic utilities and the toast subsystem |
| 5.3.6 | `maps.js` | Move the six tracking/routing helper functions, previously byte-identical (aside from a "W" naming suffix) between `index.js` and `dashboard.js`, into one shared module | Eliminated a full duplicate copy of routing/formatting logic, using a function-aliasing pattern (Section 16 of `ARCHITECTURE.md`) specifically so neither file's existing call sites needed to be renamed |
| 5.3.7.1 | `nav.js` | Move the byte-identical `toggleMenu()` mobile-nav implementation, previously duplicated between `dashboard.js` and `profile.js`, into one shared module | Removed one of the four total mobile-nav implementations identified in `ARCHITECTURE.md` §16 (the other three — `index.js`, `landing.js`, `admin.js` — were left independent, since each operates on different DOM ids and was explicitly out of this sub-phase's scope) |

**Current project status at the end of Phase 5.3.** A fully modularized shared-script layer (`js/common/*.js`) sits beneath six independent, feature-complete page applications, with the specific, audited duplication cases named above resolved and every other page-specific difference explicitly left untouched, per each file's own header commentary.

### 2.4 Structured Reviews, Worker Discipline & Verification (Phase 8)
**Status.** Completed, pending manual sign-off against the updated `docs/VERIFICATION.md`.

Delivered as a sequence of incremental feature requests within a single working session, later consolidated: pill-tag review feedback replacing the open comment box; an escalating worker-ban system with real-time forced logout and a permanent ban-history table; an admin worker-verification workflow (ID document + photo review, signed-URL retrieval for the private `worker-documents` bucket); a server-side positive-streak bonus trigger; and three new admin tabs (Users, Workers, Banned Workers) backed by new Realtime channels for live dashboard sync.

**Objectives.** Give the platform a structured, actionable feedback loop from customer reviews through to worker consequences (bans) and rewards (streak bonuses), and close the admin portal's remaining blind spots (no visibility into individual customers or workers, no verification workflow, no ban mechanism).

**Major achievements.** Found and fixed a genuine silent-failure bug (an admin ban write that reported success while being fully blocked by RLS), a query bug (ordering by a non-existent column breaking the entire Workers tab), and a storage-access misunderstanding (a private bucket's public-URL string can never resolve, regardless of `storage.objects` RLS) — all three fixed within this phase and documented in `CHANGELOG.md`.

**Important architectural decisions.** Ban/verification/streak state is split across `workers` (current state) and two new append-only tables, `worker_bans` and `worker_bonuses` (historical record) — deliberately not consolidated into `workers` alone, so history survives a ban expiring or being overridden. Streak/bonus crediting was implemented as a Postgres trigger rather than client logic, making it the first (and only) Phase 8 addition that is server-authoritative by construction.

### 2.3 Documentation Phase, Part 1 (Phase 5.4 — in progress; see Section 3)
Five of the six planned documentation deliverables have been completed as of this document:

| Deliverable | Status |
|---|---|
| `docs/SRS.md` | Completed and passed its own self-audit |
| `docs/ARCHITECTURE.md` | Completed and passed its own self-audit |
| `docs/DATABASE.md` | Completed and passed its own self-audit |
| `docs/API.md` | Completed and passed its own self-audit |
| `docs/DEPLOYMENT.md` | Completed and passed its own self-audit |
| `docs/ROADMAP.md` | This document — completed as of this pass |

`docs/PRD.md` predates this documentation effort and was treated as an input, not a deliverable of Phase 5.4.

---

## 3. Current Phase

**Phase 5.4 — Documentation.** This is the current phase, as named by this conversation's own governing instructions rather than by a pre-existing code comment (no "Phase 5.4" marker exists anywhere in the source files themselves; it is the label under which SRS.md, ARCHITECTURE.md, DATABASE.md, API.md, DEPLOYMENT.md, and this ROADMAP.md were requested and produced in sequence within this conversation).

**What exists as of this document.** All six planned documentation files listed in Section 2.3 are complete. Each was produced against the same standard: derive every claim from the inspected source, PRD.md, and the prior documents in the set; explicitly flag anything that cannot be verified rather than asserting it; and run a self-audit before being presented as final.

**What remains in this phase.** Two items were identified but are outside the six-document set requested so far:
- An empty `docs/SECURITY.md` placeholder file exists in the project's file set (confirmed zero-byte) but has not been requested or authored as part of this documentation effort. Its scope would logically consolidate the security-relevant findings already scattered across `ARCHITECTURE.md` §14, `DATABASE.md` §9, `API.md` §11, and `DEPLOYMENT.md` §9 (unverifiable RLS enforcement, plaintext Geoapify key, ungoverned ID-document storage, absent OTP lockout) into one dedicated document, but this document does not attempt to author `SECURITY.md` itself, since it was not requested in this pass.
- A previously-referenced, empty `docs/ROADMAP.md` placeholder existed prior to this document; this document is that file's completed content.

---

## 4. Upcoming Phases

Only work explicitly named as planned in `PRD.md` (§21, §24), `SRS.md` §9, or identified as an open gap in `DATABASE.md`/`API.md`/`DEPLOYMENT.md` is listed. No additional phase is invented.

### 4.1 Remaining Documentation
- Authoring `docs/SECURITY.md` (Section 3), consolidating the security findings already distributed across the existing five technical documents.

### 4.2 SQL Generation / Database Scripts
`DATABASE.md`'s Critical Constraint states that no SQL schema, migration, or `CREATE TABLE` file exists anywhere in the inspected project — every table in `DATABASE.md` §4 was reverse-engineered from client-side reads/writes. Generating an authoritative SQL schema/migration script (including the RLS policies, indexes, and constraints only inferred, not confirmed, in `DATABASE.md`) is necessary future work before the database can be provisioned repeatably, but no such script exists today.

### 4.3 Code Quality Improvements
Per `SRS.md`'s own audit findings and `ARCHITECTURE.md` §16:
- Consolidating the two independently coded OTP-verification paths (`index.js`'s `triggerOtp`/`verifyOtp` and `dashboard.js`'s `submitArrivalOtp`/`submitCompletionOtp`) into one authoritative implementation.
- Fully wiring `index.js: submitReg()`'s collected in-app worker-registration fields into a persisted profile, rather than the current four-column `profiles` insert (`DATABASE.md` §4.10).
- Reducing the four independent mobile-nav toggle implementations (`index.js`, `nav.js`, `landing.js`, `admin.js`) where feasible.

### 4.4 GitHub Professionalization
No `.gitignore`, `README.md`, contribution guideline, license file, or repository metadata was found anywhere in the inspected file set. `DEPLOYMENT.md` §9 separately confirms no CI/CD configuration exists. Establishing these repository-hygiene basics is necessary future work, though no specific plan for them is named in `PRD.md`/`SRS.md` beyond the general Phase 6 quality-hardening intent.

### 4.5 Testing
`SRS.md`'s own audit and `DEPLOYMENT.md` §9 both confirm: no automated test suite, linting configuration, or CI pipeline file exists anywhere in the inspected source. Introducing test coverage (unit tests for the assignment/pricing/QuickCoins logic at minimum, given that all three are client-side business logic per `ARCHITECTURE.md` §14) is unstarted work, named only generally under Phase 6's "improve reliability" framing in `PRD.md`, not yet scoped into a specific test plan.

### 4.6 Deployment Improvements
Per `DEPLOYMENT.md` §3, §9, §10:
- Introducing a real environment-variable/build-time configuration system, replacing the current hardcoded constants in `supabase.js`/`config.js`.
- Moving the Geoapify API key behind a server-side proxy.
- Defining a backup/recovery procedure (currently entirely absent — `DEPLOYMENT.md` §10).
- Introducing cache-busting for deployed `js/*`/`css/*` assets, and application-level error/uptime monitoring.

### 4.7 Future Scalability (Phase 6 / Phase 7, per `PRD.md`)
- **Phase 6 (`PRD.md` §21.2).** Strengthen Supabase Row Level Security policies; move booking validation, worker-assignment logic, and QuickCoins crediting out of the browser and into RLS-protected server-side functions; secure API key handling; optimize database queries; support multiple concurrent users at production scale.
- **Phase 7 (`PRD.md` §21.3).** Introduce a write path for `users.quickcoins_redeemed` (currently read-only per `DATABASE.md` §4.1), and expand the campaign/offer tooling.

---

## 5. Milestones

### 5.1 Milestones Already Achieved
- A complete, working six-page application covering customer, worker, and admin roles, with no custom backend server, entirely on Supabase (Section 2.1).
- Live GPS tracking with road-accurate routing via Geoapify, replacing an earlier OSRM-based approach (Phase 4.7).
- A fully modularized shared-script layer, with every genuinely duplicated piece of logic identified and consolidated across six sub-phases (Phase 5.3.2–5.3.7.1), each with its own documented before/after audit trail in the code's own comments.
- A complete, six-document, self-audited documentation set (`SRS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `DEPLOYMENT.md`, and this `ROADMAP.md`), each cross-referenced against the others with zero unresolved contradictions carried forward.

### 5.2 Milestones Remaining
- An authoritative SQL schema/migration script and a defined, provisionable RLS policy set (Section 4.2).
- Server-side relocation of business-rule enforcement (Phase 6).
- A completed `docs/SECURITY.md` (Section 3).
- A working automated test suite and CI pipeline (Section 4.5).
- A defined backup/recovery procedure and monitoring setup (Section 4.6).
- QuickCoins redemption functionality (Phase 7).

---

## 6. Timeline

The order below reflects logical dependency, not calendar dates — no calendar date is committed anywhere in `PRD.md` or `SRS.md` for any future phase, so none is invented here.

```
Core Application Build (pre-4.5)
        │
        ▼
Phase 4.5 / 4.7 — Tracking & Routing Refinement
        │
        ▼
Phase 5.3.2 → 5.3.3 → 5.3.4 → 5.3.5 → 5.3.6 → 5.3.7.1
   (Supabase client → Config → Utils → Toast → Maps → Nav)
        │   (this exact order is load-bearing — see ARCHITECTURE.md §7)
        ▼
Phase 5.4 — Documentation
   SRS → ARCHITECTURE → DATABASE → API → DEPLOYMENT → ROADMAP
   (each phase's document depends on the ones before it, since each
    later document cross-references and is audited against every
    earlier one, per this conversation's own stated process)
        │
        ├──► docs/SECURITY.md (remaining Phase 5.4 item)
        │
        ▼
SQL Schema / Migration Generation (Section 4.2)
   — logically must precede any real Phase 6 RLS work, since RLS
     policies are authored against actual table/column definitions
        │
        ▼
Phase 6 — Backend Hardening (PRD §21.2)
   — depends on the SQL schema existing, and benefits from the
     code-quality and testing work in Sections 4.3/4.5 being at
     least underway, since moving business logic server-side without
     any test coverage increases regression risk
        │
        ▼
Phase 7 — QuickCoins Ecosystem Expansion (PRD §21.3)
   — depends on Phase 6's server-side logic layer existing, since
     redemption is itself a business rule that should not be
     re-introduced as another client-side-only write path
```

GitHub professionalization (Section 4.4), deployment improvements (Section 4.6), and testing (Section 4.5) are not strictly sequential dependencies of the phases above — they can proceed in parallel with the SQL-generation and Phase 6 work, since none of them is a prerequisite the code comments or PRD state must come first.

---

## 7. Risks

| Risk | Category | Description | Mitigation Strategy |
|---|---|---|---|
| Client-side business-rule enforcement | Current | Booking price, worker assignment, and QuickCoins crediting are all computed and written directly from the browser, with RLS enforcement unverifiable from client code (`DATABASE.md` §9) | Phase 6's planned server-side relocation (Section 4.7); until then, this is an accepted, explicitly-flagged risk, not a hidden one |
| No automated testing or CI | Current | Any code change (including the Phase 5.3.x consolidation already completed) carries regression risk with no automated safety net | Section 4.5's planned test-suite introduction; in the interim, manual verification remains the only safeguard |
| Hardcoded, non-rotatable configuration | Current | `SUPABASE_URL`, `SUPABASE_KEY`, and `GEOAPIFY_API_KEY` are plaintext constants in committed files, requiring a direct file edit and redeploy to rotate (`DEPLOYMENT.md` §3) | Section 4.6's planned environment-variable system |
| Ungoverned identity-document storage | Current | Worker ID documents/photos have no defined retention, encryption-at-rest, or deletion policy (`PRD.md` §22A.5, `DEPLOYMENT.md` §9) | Named as an open compliance item to be resolved before production launch; no interim mitigation exists in the current code |
| No backup/recovery procedure | Current | No project-specific backup schedule or restore runbook exists beyond whatever Supabase's own platform tier provides by default (`DEPLOYMENT.md` §10) | Section 4.6's planned backup/recovery definition |
| PRD/implementation discrepancy (Firebase vs. Supabase Realtime) | Current, documentation-only | `PRD.md` attributes real-time sync to Firebase Realtime Database; the codebase uses only Supabase Realtime; already flagged consistently across `SRS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md` | Requires a product-level decision to correct `PRD.md` itself; this document does not resolve it, only carries the flag forward |
| Dual, divergent OTP-verification code paths | Current | `index.js` and `dashboard.js` each independently implement OTP verification with different side effects (`ARCHITECTURE.md` §16) | Section 4.3's planned consolidation into one authoritative path |
| Client-side aggregation cost at scale | Future | Admin analytics and most worker performance figures are computed by iterating full row sets loaded into the browser; this will degrade as `bookings`/`campaigns`/`user_passes` volume grows (`DATABASE.md` §10) | Phase 6's planned query-optimization work; no interim mitigation exists today |
| No cache-busting on deployed assets | Future | A CDN/browser cache with a long TTL could serve a stale script after a deployment update, since no content-hashed filenames exist (`DEPLOYMENT.md` §5) | Section 4.6's planned deployment-improvement work |

---

## 8. Success Criteria

### 8.1 What Defines Project Completion
Based on the phase structure established in `PRD.md` and reflected throughout this documentation set, project completion is not a single defined milestone in any inspected source — `PRD.md` frames Phase 6 and Phase 7 as ongoing hardening/expansion efforts rather than naming a final "done" state. This document does not invent a completion criterion that the source material does not state. What can be said with evidence:
- The currently shipped feature set (Sections 2.1–2.2) constitutes a functionally complete marketplace application covering the full customer/worker/admin lifecycle, per `SRS.md`'s functional-requirements coverage.
- The documentation set (Section 2.3) is complete for the six files explicitly requested in this conversation.

### 8.2 Quality Goals
Consistent with the standard applied throughout Phase 5.4's own documents:
- No client-facing feature should exist without a corresponding, verified entry in `SRS.md`/`API.md`/`DATABASE.md`.
- No security-relevant gap (RLS enforcement, plaintext keys, OTP lockout, document retention) should remain undocumented, even where it cannot yet be resolved in code.
- No future-phase claim should be presented as already implemented.

### 8.3 Production Readiness
Per `DEPLOYMENT.md` §9's Production Checklist, the project is **not yet production-ready** on the following confirmed, unresolved points: unverifiable/unconfirmed RLS enforcement, plaintext API key exposure, absent test coverage, absent CI/CD, absent monitoring, and absent backup/recovery procedure. Production readiness, for this project, means resolving each specific checklist item in `DEPLOYMENT.md` §9 — not a general aspiration — and this document does not claim that state has been reached.

---

## 9. Future Enhancements

Consolidated from `PRD.md` §21/§24, `SRS.md` §9, `DATABASE.md` §11, and `API.md` §12 — no item below is introduced here for the first time.

| Enhancement | Source |
|---|---|
| RLS policy hardening; server-side relocation of booking/assignment/QuickCoins logic; secured API key handling; query optimization; concurrent-scale support | `PRD.md` §21.2 (Phase 6) |
| QuickCoins redemption write path; expanded campaign/offer tooling | `PRD.md` §21.3 (Phase 7) |
| Real payment gateway integration, replacing the simulated GPay QR/polling flow | `SRS.md` §9 |
| Functional Google/Phone-OTP social sign-in (currently "coming soon" toasts only) | `SRS.md` §9 |
| Unified OTP verification path | `SRS.md` §9 |
| In-app worker-registration persistence completion | `SRS.md` §9 |
| Government ID data-handling (retention/encryption/deletion) policy | `PRD.md` §22A.5 |
| Authoritative SQL schema/migration generation | `DATABASE.md` §11 |
| Environment-variable/build-time configuration system; server-side Geoapify proxy; backup/recovery procedure; deployment cache-busting; monitoring | `DEPLOYMENT.md` §9–§10 |

No other future enhancement (new feature category, new integration, new user role) is named anywhere in the reviewed documentation; this document does not add one.