# Changelog
## QuickFix — On-Demand Home Services Marketplace

This changelog follows the [Keep a Changelog](https://keepachangelog.com/) format, adapted to this project's actual versioning reality: **no semantic version tags (e.g. `v1.0.0`), release dates, or Git tags exist anywhere in the inspected project.** The only version-like identifiers found in the source are phase-numbered code comments (`Phase 4.5`, `Phase 4.7`, `Phase 5.3.2` through `Phase 5.3.7.1`) and this conversation's own documentation-phase label (`Phase 5.4`). This changelog uses those verified phase numbers as its version identifiers rather than inventing a semantic-versioning scheme the project does not have. No date is fabricated for any entry; every entry is labeled by phase only.

---

# Project

| Field | Detail |
|---|---|
| Project Name | QuickFix |
| Purpose | An on-demand home-services marketplace connecting customers with verified local workers (electrician, plumber, carpenter, painter, cleaner, AC repair, mason, pest control, househelp) for booking, live GPS tracking, OTP-verified service delivery, payment, and post-service review, per `docs/PRD.md` |
| Current Version | **Phase 5.4 — Documentation** (in progress; see `docs/ROADMAP.md` §3). No numbered application release exists beyond the phase-labeled milestones below. |

---

# Version History

Ordered chronologically by dependency and by the phase numbering found directly in the source (`docs/ROADMAP.md` §2, §6). Entries before Phase 4.5 are grouped as "Foundational Build," since no phase-numbered comment for Phases 1–4 exists anywhere in the inspected code — their completion is inferred only from the fact that Phase 4.5/4.7 explicitly refine features that must already have existed (`docs/ROADMAP.md` §2.1).

## [Foundational Build] — Unreleased / Pre-Phase-4.5

No phase-numbered comment names this work directly; it is inferred as already complete because Phase 4.5 and Phase 4.7 explicitly build on top of it.

### Added
- Six-page application structure: `landing.html`, `auth.html`, `index.html`, `worker-dashboard.html`, `worker-profile.html`, `admin.html`.
- Customer authentication and booking creation flow.
- Worker authentication, job-acceptance lifecycle (Pending → Accepted → Arrived → Completed), and Arrival/Completion OTP verification.
- Client-side worker-assignment algorithm (area/skill/radius/Haversine-distance eligibility).
- Admin campaign management (Create/Edit/Delete Service Pass campaigns).
- A first working version of GPS-based live tracking and map rendering.
- Supabase as the sole backend: Auth, Postgres, Storage (`worker-documents`, `worker-photos` buckets).
- QuickCoins wallet fields on the `users` table and the crediting mechanism tied to booking completion.
- Service Pass purchase flow (`user_passes` against `campaigns`).
- Post-completion review submission (`reviews` table plus mirrored fields on `bookings`).

**Note.** This document does not assign more granular "Phase 1/2/3/4" boundaries to the items above, since no such boundary is evidenced anywhere in the inspected source — doing so would fabricate a release history the project does not document.

---

## [Phase 4.5] — Tracking Formatting Helpers

### Added
- `_fmtDistance()` and `_fmtDuration()` — pure formatting helpers for tracking-panel display, explicitly scoped by the code's own comment as introducing "no network calls, no map/marker/polyline creation."

---

## [Phase 4.7] — Geoapify Routing and Reverse Geocoding

### Changed
- Replaced OSRM with the **Geoapify Routing API** for road-following routes between worker and customer during live tracking.

### Added
- **Geoapify Reverse Geocoding** — resolves a pinned or destination coordinate to a human-readable building/society name, with a defined field-preference order (`building` → `amenity` → `name` → `housename` → `street` → `suburb` → `locality`).

---

## [Phase 5.3.2] — Shared Supabase Client

### Refactored
- Consolidated all per-page Supabase client instantiation into a single canonical instance, `window.sb`, declared once in `js/common/supabase.js`.

### Changed
- Standardized the Supabase Auth configuration (`persistSession:true`, `autoRefreshToken:true`, `detectSessionInUrl:false`) across every page, replacing what had previously been page-by-page configuration.

---

## [Phase 5.3.3] — Shared Application Configuration

### Refactored
- Centralized `GEOAPIFY_API_KEY`, `RELIABILITY_MIN_ACCEPTED_JOBS`, and `TRACKING_ZOOM` into a single `window.CONFIG` object in `js/common/config.js`, removing three confirmed cases of identical-value duplication between `index.js`/`dashboard.js`/`profile.js`.

### Documentation
- The file's own header records an explicit audit trail of which duplicated constants were centralized and which page-specific constants were deliberately left alone.

---

## [Phase 5.3.4] — Shared Utilities

### Refactored
- Extracted five generic, page-agnostic helper functions (`markErr`, `closeModal`, `getIST`, `_fmtDate`, `escHtml`) — previously duplicated across `auth.js`, `index.js`, `dashboard.js`, `admin.js`, and `profile.js` — into a single shared file, `js/common/utils.js`.

### Fixed
- Nothing was changed in `index.js`'s own separate, unguarded `fmtDate(d)` implementation; it was deliberately left untouched to avoid an unintended behavior change on falsy input, per the file's own comment.

---

## [Phase 5.3.5] — Shared Toast System

### Refactored
- Moved `showToast()` and its backing `_tt` timer handle out of `js/common/utils.js` into a dedicated `js/common/toast.js`, isolating toast-specific code from generic utilities.

---

## [Phase 5.3.6] — Shared Map/Routing Helpers

### Refactored
- Moved six tracking/routing helper functions (`_geoapifyReverseGeocode`, `_fetchRoadRoute`, `_fmtDistance`, `_fmtDuration`, `_metersBetween`, `_animateMarkerTo`) — previously byte-identical, aside from a "W" naming suffix, between `index.js` and `dashboard.js` — into a single shared file, `js/common/maps.js`.

### Improved
- Eliminated a full duplicate implementation of routing/formatting logic using a function-aliasing pattern (canonical name plus a "W"-suffixed alias pointing at the same function object), specifically so neither `index.js`'s nor `dashboard.js`'s existing call sites required renaming.

---

## [Phase 5.3.7.1] — Shared Mobile Nav Toggle

### Refactored
- Moved the byte-identical `toggleMenu()` implementation — previously duplicated between `dashboard.js` and `profile.js` — into a single shared file, `js/common/nav.js`.

### Documentation
- The file's own header explicitly records that `index.js`, `landing.js`, and `admin.js` each retain their own independent mobile-nav implementation, since each operates on different DOM ids, and were deliberately left out of this consolidation's scope.

---

## [Phase 5.4] — Documentation (Current)

### Documentation
- `docs/SRS.md` — Software Requirements Specification, produced and self-audited against the codebase and `docs/PRD.md`; corrected to explicitly flag the PRD's Firebase Realtime Database claim against the codebase's actual Supabase Realtime implementation.
- `docs/ARCHITECTURE.md` — Software Architecture Document, produced and self-audited, documenting the module dependency flow, folder structure, and per-subsystem architecture.
- `docs/DATABASE.md` — Database Architecture and Reference Document, produced and self-audited, reverse-engineering all eleven tables and two Storage buckets directly from client-side reads/writes (no schema file exists in the project).
- `docs/API.md` — API Reference Document, produced and self-audited, cataloging every Supabase SDK call, third-party HTTP call (Geoapify, Nominatim), and Browser API used, explicitly noting that no custom REST/GraphQL API exists in the project.
- `docs/DEPLOYMENT.md` — Deployment and Operations Reference, produced and self-audited, documenting the static-site-plus-Supabase deployment model and flagging the hardcoded-configuration and absent-CI/CD/monitoring/backup gaps.
- `docs/ROADMAP.md` — Program Roadmap and Phase History, produced and self-audited, consolidating completed phases, current status, and future work drawn from all prior documents.
- `docs/CHANGELOG.md` — this document.
- `docs/SECURITY.md` — Security Architecture and Reference Document, produced and self-audited, documenting current security posture and known gaps.

**Status.** Complete. `docs/SECURITY.md` — Security Architecture and Reference Document, produced and self-audited against the client-side source and every prior Phase 5.4 document, documenting the current security posture, unverifiable RLS enforcement, plaintext client-side API keys, and client-side business-logic risks — was completed after this entry was originally drafted; this changelog was not updated at the time. It now exists as a full document, not a placeholder.

---

# Current Release

The project's current state, as of Phase 5.4, is a **functionally complete, six-page marketplace application** — customer booking, worker job management, and admin campaign oversight are all fully implemented and cross-verified against a now-complete, self-audited six-document documentation set (SRS, Architecture, Database, API, Deployment, Roadmap). The application runs entirely client-side against a Supabase backend, with no custom application server. Known, explicitly documented gaps carried into this release include: unverifiable Row Level Security enforcement, plaintext client-side API keys, no automated test suite or CI pipeline, no backup/recovery procedure, and two independently coded OTP-verification paths with differing side effects. Per `docs/ROADMAP.md` §8.3, the project is **not yet production-ready** against its own documented production checklist.

---

# Next Planned Release

Per `docs/ROADMAP.md` §4 and §9, the next planned work is:

- **Remaining Phase 5.4 work** — authoring `docs/SECURITY.md`.
- **SQL schema and migration generation** — an authoritative, provisionable database script, since none currently exists.
- **Phase 6 — Backend Hardening** (`PRD.md` §21.2) — Row Level Security policy hardening; relocating booking-price, worker-assignment, and QuickCoins-crediting logic server-side; secured API key handling; database query optimization; support for concurrent users at production scale.
- **Code-quality work** — consolidating the dual OTP-verification paths; completing in-app worker-registration persistence; reducing the remaining duplicate mobile-nav implementations.
- **Testing and CI** — introducing an automated test suite and a CI pipeline, neither of which currently exists.
- **Deployment improvements** — an environment-variable/build-time configuration system, a server-side Geoapify proxy, deployment cache-busting, and a defined backup/recovery procedure.
- **Phase 7 — QuickCoins Ecosystem** (`PRD.md` §21.3) — a redemption write path for `users.quickcoins_redeemed` and expanded campaign/offer tooling.

No release date is committed for any of the above anywhere in `PRD.md`, `SRS.md`, or `ROADMAP.md`; this document does not fabricate one.

---

## [Phase 5.6] — Code Quality

### Changed
- Consolidated remaining hardcoded delay/interval/countdown literals in `admin.js`, `index.js`, `landing.js`, `toast.js`, and `dashboard.js` into named entries on `window.CONSTANTS` (`js/common/constants.js`), with no change to any value or behavior.
- Added `js/common/constants.js` to the `<script>` load order of `admin.html` and `landing.html`, which previously did not load it.
- Added a header banner comment to `landing.js`, the one page script that was missing one.

### Added
- `.editorconfig`, encoding the indentation/line-ending/whitespace conventions the codebase already followed in practice.

### Verified
- No `console.log` debug statements or commented-out dead code found anywhere in the JS codebase.
- Function/variable naming left as-is where renaming risked breaking existing call sites, consistent with the precedent set in `maps.js`/`nav.js`.
- Checked every `.js`/`.css` file for tabs, trailing whitespace, and line-ending consistency: all clean, 100% spaces, 100% CRLF. The single/double-quote mix is not an inconsistency — it's the correct, uniformly-applied convention (single quotes for JS strings, double quotes for HTML attributes inside template literals).

### Status
Complete.

## [Phase 5.7] — GitHub Professionalization

### Added
- `.gitignore` at repo root.
- License section and corrected badges in root `README.md`.

### Fixed
- Root `README.md`'s "Notifications" entry incorrectly listed Firebase Realtime Database; the codebase uses only Supabase Realtime (confirmed — zero Firebase references anywhere in source). Corrected.
- Root `README.md`'s Project Structure section updated to reflect the actual `css/`, `js/common/`, `js/<section>/`, `sql/`, `docs/` folder layout from Phase 5.1 onward.
- The SQL package's own `README.md` (previously colliding in name with the project root README) correctly placed at `sql/README.md`.

### Skipped
- `CONTRIBUTING.md` intentionally not created — single-developer project, no external contributors to onboard.

### Status
Complete.

## [Phase 5.8] — Final Verification

### Added
- `docs/VERIFICATION.md` — manual end-to-end sign-off checklist covering landing, auth, customer, worker, and admin flows, plus cross-cutting checks.

### Status
Pending manual sign-off against `docs/VERIFICATION.md`.