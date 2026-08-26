# ⚡ QuickFix – Smart Home Service Booking Platform

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active--development-yellow.svg)
![Backend](https://img.shields.io/badge/backend-Supabase-3ECF8E.svg)

<p align="center">
  <b>Book trusted home service professionals in just a few clicks.</b><br>
  A complete full-stack service marketplace built using HTML, CSS, JavaScript, and Supabase.
</p>

---

## 📖 About the Project

QuickFix is a modern home service booking platform that connects customers with verified service professionals such as electricians, plumbers, carpenters, painters, cleaners, AC technicians, masons and many more.

Unlike a simple booking website, QuickFix manages the complete service lifecycle—from booking creation, address validation, permanent building-location pinning and worker assignment, to live GPS + road-route tracking with real-time ETA, OTP verification, payments, QuickCoins rewards, service passes, reviews, achievements, worker analytics and a full admin portal.

The project was built as a major academic project with a focus on solving real-world service booking problems while implementing production-style workflows.

---

# ✨ Features

## 👤 Customer Side

- 🔐 User Authentication
- 📍 Area-based worker matching
- 🛠️ Multiple service categories
- 📅 Date & Time slot booking
- 🚨 Emergency booking mode
- 🏠 Address validation with automatic area-match checking
- 🌍 Customer address geocoding (exact building-level coordinates)
- 📌 Permanent building-location pinning on a map — reused automatically on repeat bookings to the same address
- 🏢 Resolved building/society name shown live on the pin picker as the marker is placed or dragged (Geoapify Reverse Geocoding)
- 💳 Cash & UPI payment options
- 🪙 QuickCoins wallet & rewards
- 🎟️ Service Passes & priority booking
- 🏷️ Offers system
- 📜 Booking history
- ⭐ Worker ratings & reviews
- 📍 Live worker tracking using Leaflet Maps
- 🛣️ Road-following route to the assigned worker (Geoapify Routing API)
- 🏢 Destination building name shown on the Track Worker map (Geoapify Reverse Geocoding)
- 🚗 Live-updating worker marker as the worker travels
- ⏱️ Live Distance Remaining & ETA on the Track Worker map
- 🔢 OTP based arrival & completion verification
- 📊 Booking timeline

---

## 👷 Worker Side

- 📥 Accept / Reject booking requests
- 📅 Job management dashboard
- 📍 Continuous live GPS location sharing (`watchPosition()`)
- 🧭 Live "Track Customer" map with road route to the customer (Geoapify Routing API)
- 🏢 Destination building name shown on the Track Customer map (Geoapify Reverse Geocoding)
- 🚗 Live Distance to Customer & ETA on the Track Customer map
- 💰 Earnings dashboard
- 📈 Worker performance statistics
- 🏅 Achievement & badge system
- ⭐ Dynamic rating calculation
- 📊 Worker score calculation
- 🔔 Real-time booking updates

---

## 🛡️ Admin Side

- 🔒 Secure, hidden admin access
- 🔐 Dedicated admin authentication
- 📊 Central admin dashboard
- 📋 Booking management
- 👷 Worker management
- ⭐ Review management
- 👤 User management
- 📈 Platform-wide analytics
- 🚪 Logout
- 🔙 Return to Landing Page button

---

# 🪙 QuickCoins Wallet

QuickFix includes a built-in loyalty wallet that rewards customers for completed services.

- 💰 Persistent wallet balance per customer
- ♾️ Lifetime coins earned (separate from spendable balance)
- ✅ Coins automatically credited after a booking is marked **Completed**
- 🔗 Fully integrated into the booking lifecycle — no manual crediting
- 🧾 Balance and lifetime totals visible from the customer dashboard

---

# 🎟️ Service Passes & Offers

A subscription-style layer on top of regular bookings, designed to reward repeat customers.

- 🎟️ Purchasable Service Passes
- ⚡ Priority booking for pass holders
- 📉 Automatic pass usage/consumption tracking on eligible bookings
- 🏷️ Offers system for discounted or promotional bookings

---

# 🛡️ Admin Portal

A complete, separately-secured control panel for platform operators.

- 🔒 Hidden entry point, not linked from normal customer/worker navigation
- 🔐 Dedicated admin authentication flow
- 📊 Dashboard with platform-wide KPIs
- 📋 Booking management (view, filter, oversee all bookings)
- 👷 Worker management (view/manage the worker roster)
- ⭐ Review management (moderate customer reviews)
- 👤 User management (view/manage customer accounts)
- 📈 Analytics across bookings, workers, and revenue
- 🚪 Logout and a **Return to Landing Page** button for safe exit

---

# 📱 Responsive UI & Mobile Navigation

QuickFix's core screens — the landing page, the customer app, and the admin portal — have been fully audited and upgraded for production-grade responsiveness, while keeping the existing desktop layout, colors, typography, and business logic completely unchanged.

- 🖥️ Verified across 4K, desktop, laptop, tablet, foldables, large phones, small phones, portrait and landscape
- 📐 Fluid layouts using CSS Grid, Flexbox, `clamp()`, `minmax()` and fluid spacing/typography — no fixed widths, no device-specific hacks
- 🍔 Hamburger navigation with a smooth slide-in drawer on tablet/mobile across `landing.html`, `index.html`, and `admin.html` — opens on tap, closes on outside click or item selection, desktop's horizontal nav is untouched
- 📊 Admin tables scroll horizontally only within their own container — headers stay visible, the page itself never scrolls sideways
- 🧰 Filters, forms, stat cards, and analytics cards stack and resize cleanly on narrow screens
- 👆 Touch-friendly control sizing (buttons, tabs, inputs) on mobile breakpoints
- 🚫 No horizontal page scroll, no clipped text, no hidden controls, no overlapping sections on any supported screen size

---

# 🗺️ Live Worker Tracking (Phase 4)

QuickFix's live tracking system is being built in incremental phases. Progress so far:

### ✅ Phase 4.1 — Tracking Maps
- Worker Dashboard includes a **Track Customer** map
- Customer Dashboard includes a **Track Worker** map
- Both dashboards render live Leaflet maps once a booking is accepted
- The worker's tracking map automatically disappears once the **Arrival OTP** is verified
- The customer's tracking map automatically collapses once arrival is confirmed

### ✅ Phase 4.2 — Customer Address Validation & Geocoding
- Customers enter their complete address (building/society, road, landmark, area, city)
- Flat number, wing, house number, apartment number, and room number are automatically **ignored** for location detection — only the building/society name, landmark, road, area and city are used
- The address is checked against the **selected service area**; if the address doesn't belong to the selected area, booking is blocked with an inline validation message
- The cleaned address is geocoded to obtain exact coordinates
- **`customer_lat`** and **`customer_lng`** are captured and stored for every booking — no longer the selected area's center point

### ✅ Phase 4.3 — Road Route Generation
- Real driving routes generated using **OSRM** (Open Source Routing Machine)
- The route is drawn as a **road-following blue polyline** — not a straight line
- 🟠 Worker marker and 🟢 Customer marker shown on both dashboards
- Map view automatically calls `fitBounds()` so the worker, the customer, and the full route are visible without manual zooming
- The **same routing logic is shared** between the customer's Track Worker map and the worker's Track Customer map — one implementation, reused on both sides
- Route generation uses `worker_live_lat` / `worker_live_lng` and `customer_lat` / `customer_lng` exclusively — never area-center coordinates

### ✅ Phase 4.4 — Live Worker Movement
- Worker location is published continuously via `navigator.geolocation.watchPosition()` — not a one-time fix
- Every GPS update writes `worker_live_lat`, `worker_live_lng` and `worker_last_seen` to the active booking(s) in Supabase
- The worker marker updates its position on both dashboards without ever recreating the map, markers, or route layer
- The existing OSRM route automatically refreshes as the worker moves, reusing the Phase 4.3 routing implementation and its request throttle unchanged
- Customer marker position remains fixed on both dashboards — only the worker marker moves

### ✅ Phase 4.5 — Live ETA
- Distance Remaining and ETA are read directly from the same OSRM route response used to draw the polyline — no extra network request
- Displayed on both dashboards:
  - Customer's Track Worker map — **🚗 Distance Remaining** and **⏱ ETA**
  - Worker's Track Customer map — **🚗 Distance to Customer** and **⏱ ETA**
- Values update automatically every time the route refreshes, in sync with live worker movement
- Falls back to `--` / `--` gracefully if OSRM is unreachable, without breaking the map or throwing errors
- `_fetchRoadRoute()` / `_fetchRoadRouteW()` remain fully backward-compatible with Phase 4.3 — distance/duration are carried as extra properties on the same array these functions already returned, so no existing caller's contract changed

### ✅ Phase 4.6 — Permanent Customer Location Pinning
- On a first booking to a given address, after area validation succeeds, the customer places a marker on a Leaflet map — by dragging it or tapping the map — to pin their exact building location, then confirms with **Confirm Location**
- The complete, unmodified address text, the selected area, and the pinned coordinates are saved permanently against the customer's account (`saved_address`, `saved_area_id`, `saved_lat`, `saved_lng`) — no cleaning or normalization applied to the stored address
- The pinned coordinates are copied into the booking's `customer_lat` / `customer_lng` and are the **only** source for those fields — the one-time live-GPS overwrite from earlier phases was removed so a manually pinned location can never be silently replaced by wherever the customer's device happens to be at booking time
- On a repeat booking, the newly entered address is compared to the saved address with an **exact string match**; any difference at all — including just a flat, wing, or house number — skips the reuse prompt and opens the map picker again
- On an exact match, the customer is asked **"Use your previously pinned location?"** — choosing **YES** reuses the saved pin instantly with no map interaction; choosing **Pin Again** reopens the map to re-pin
- Worker-side behavior is unaffected — workers still receive the full address exactly as entered

### ✅ Phase 4.7 — Geoapify Integration (Reverse Geocoding & Routing)
- A single reusable `GEOAPIFY_API_KEY` constant is shared by both `index.html` and `worker-dashboard.html`
- **Reverse Geocoding:** after the customer manually places or drags the pin on the Leaflet map (Phase 4.6), the exact marker coordinates are resolved to a human-readable building/society name via the Geoapify Reverse Geocoding API, shown live in the pin picker and updated on every move — the manual pin remains the only source of truth for `customer_lat` / `customer_lng`, the reverse-geocoded name is display-only
- The same resolved building name is also surfaced to the worker on their **Track Customer** map, and to the customer on their **Track Worker** map, so both sides see the identical destination — computed independently on each dashboard from the same stored coordinates and the same API key
- **Routing:** the OSRM road-route implementation from Phase 4.3 is replaced with the **Geoapify Routing API** on both dashboards, still producing a proper road-following route with turns and junctions
- The route line is always rendered **solid, blue, and rounded** — the straight-line/dashed fallback used previously has been removed entirely; if a routing request fails, the existing route on screen is simply left in place rather than degrading to a straight line
- Booking, payment, OTP, timeline, worker assignment, GPS publishing, polling, and Phase 4.6 manual pinning are all unchanged

### ✅ Phase 4.8 — Tracking System Integration & Verification
- Full end-to-end verification pass across the live tracking stack built in Phases 4.1–4.7
- Confirmed working together as one integrated system: customer pin coordinates (4.6), worker live GPS (4.4), Geoapify road routing (4.7), the live road-following polyline (4.3/4.7), Distance Remaining & ETA calculation (4.5), the customer's Track Worker map and the worker's Track Customer map (4.1), Re-center/auto-follow behavior, and route synchronization between both dashboards
- No new routing, geocoding, or map behavior introduced — this phase closes out and hardens the tracking system rather than extending it
- Sets a stable baseline for Phase 4.9 (Tracking System Stabilization & Resource Cleanup) to build on

### ✅ Phase 4.9 — Tracking System Stabilization & Resource Cleanup
- Automatic cleanup of tracking maps after booking completion/cancellation
- Proper destruction of Leaflet map instances
- Prevention of tracking memory leaks
- Production-safe tracking lifecycle
- Removal of development/debug console logs
- General tracking stability improvements

# ✅ Phase 4 Complete

The complete live tracking system has now been fully implemented and verified.

The tracking system now includes:

- Live worker GPS tracking
- Customer address validation
- Building-level customer geocoding
- Permanent customer location pinning
- Geoapify routing
- Road-following navigation
- Live ETA
- Live Distance Remaining
- Worker ↔ Customer synchronized tracking
- Automatic cleanup of tracking resources
- Production-ready tracking lifecycle

---

# 🏆 Achievement System

QuickFix contains a gamified achievement engine for workers. Achievements are **fully dynamic and database-driven** — nothing is hardcoded or manually assigned.

Examples include:

- 🥇 First Job
- 🔟 10 Jobs Completed
- ⭐ Highly Rated Worker
- 💯 Perfect Reliability
- 💸 Earnings Milestones
- 🔥 Booking Streaks

Achievements unlock automatically after meeting the required conditions, computed live from booking history, and are shown through animated popup notifications.

---

# 📊 Worker Analytics

The platform automatically calculates every metric below, generated dynamically from booking history instead of relying on manually maintained counters:

- ⭐ Rating
- 📈 Worker Score
- 🤝 Acceptance Rate
- 🛡️ Reliability Score
- 💵 Total Earnings
- 📅 Jobs Completed
- 🚫 Cancelled Jobs
- ❌ No Shows

---

# 🔄 Booking Workflow

```
Customer Login
      │
      ▼
Address Validation
      │
      ▼
Geocoding
      │
      ▼
Location Pin (new address) OR Reuse Saved Pin (unchanged address)
      │
      ▼
Job Broadcast to All Eligible Workers
      │
      ▼
First Worker to Accept (accept_booking RPC)
      │
      ▼
Track Worker (Live Route + Live ETA)
      │
      ▼
Arrival OTP (verified server-side via RPC)
      │
      ▼
Service Started
      │
      ▼
Completion OTP (verified server-side via RPC)
      │
      ▼
Payment
      │
      ▼
QuickCoins (awarded server-side, redemption tiers server-verified)
      │
      ▼
Review
      │
      ▼
Achievements
```

---

# ⚙️ Tech Stack

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript (modular: `js/common/` shared modules + per-page scripts)

### Backend

- Supabase
  - Authentication
  - PostgreSQL Database
  - Realtime
  - RPC Functions — now the trusted path for OTP verification, QuickCoins
    crediting, pass activation/consumption, and broadcast job assignment
  - Row Level Security (RLS) — hardened in Phase 6; several previously
    client-writable fields are now server/RPC-owned only
  - Edge Functions — `geoapify-proxy`, isolating the Geoapify API key server-side

### Maps & Routing

- Leaflet.js
- OpenStreetMap
- Geoapify Routing API — road-following route generation and live ETA/distance,
  called via the `geoapify-proxy` Edge Function rather than directly from the client

### Location & Geocoding

- Nominatim (OpenStreetMap) — customer address validation and area-match geocoding (Phase 4.2)
- Geoapify Reverse Geocoding API — resolves the manually pinned marker to a building/society name, shown on the customer's pin picker and on both dashboards' tracking maps; routed through `geoapify-proxy` so no API key ships to the browser
- `navigator.geolocation.watchPosition()` — continuous live worker GPS publishing
- Leaflet drag/tap marker picker — permanent customer building-location pinning

### Notifications

- Supabase Realtime — used for live booking status updates across customer and worker dashboards

---

# 📂 Project Structure

```
QuickFix/
│
├── index.html                 # Customer Application
├── auth.html                  # Authentication
├── landing.html               # Landing Page
├── admin.html                 # Admin Portal
├── worker-dashboard.html      # Worker Dashboard
├── worker-profile.html        # Worker Profile
│
├── css/
│   ├── customer/
│   │   └── index.css
│   ├── worker/
│   │   ├── dashboard.css
│   │   └── profile.css
│   ├── admin/
│   │   └── admin.css
│   ├── landing/
│   │   └── landing.css
│   └── auth/
│       └── auth.css
│
├── js/
│   ├── common/                # Shared across all pages
│   │   ├── supabase.js        # Supabase client (window.sb)
│   │   ├── config.js          # Shared app config
│   │   ├── constants.js       # Centralized magic numbers / enums
│   │   ├── utils.js           # Generic helpers (markErr, closeModal, getIST, escHtml…)
│   │   ├── toast.js           # showToast()
│   │   ├── maps.js            # Geoapify proxy calls, route formatting, marker animation
│   │   └── nav.js             # Shared mobile nav toggle (worker pages)
│   ├── customer/
│   │   └── index.js
│   ├── worker/
│   │   ├── dashboard.js
│   │   └── profile.js
│   ├── admin/
│   │   └── admin.js
│   ├── landing/
│   │   └── landing.js
│   └── auth/
│       └── auth.js
│
├── assets/
├── images/
└── README.md
```

---

# 🚀 Highlights

- ✅ Full service lifecycle management
- ✅ Broadcast-model job assignment — a new job is visible to every eligible worker, first to accept via `accept_booking()` gets it
- ✅ Dynamic worker ranking
- ✅ Customer address validation against selected service area
- ✅ Building-level customer geocoding (no area-center fallback for new bookings)
- ✅ Permanent, reusable customer location pinning with exact-match detection on repeat bookings
- ✅ Continuous live GPS tracking for the worker via `watchPosition()`
- ✅ Road-following route generation via the Geoapify Routing API (now proxied through a Supabase Edge Function), shared across both dashboards — always solid, blue and rounded, never a straight or dashed line
- ✅ Destination building name resolved via Geoapify Reverse Geocoding, shown identically on both dashboards
- ✅ Live route refresh as the worker moves — no map, marker, or polyline recreation
- ✅ Live Distance Remaining & ETA, computed from the existing route response with zero extra network calls
- ✅ Automatic map fitBounds — no manual zooming required
- ✅ OTP verification for arrival & completion — verified and written entirely server-side via RPC
- ✅ QuickCoins wallet with lifetime coin tracking, credited server-side via `award_quickcoins()`
- ✅ QuickCoins redemption with fixed tiers, independently recomputed and enforced server-side via `quickcoins_redemption_value()`
- ✅ Service Passes with priority booking, including coin-only passes with a dedicated redemption flow
- ✅ Offers system
- ✅ Complete, securely hidden Admin Portal
- ✅ Achievement engine (fully dynamic, database-driven)
- ✅ Worker analytics computed live from booking history
- ✅ Fully responsive UI across 4K, desktop, laptop, tablet, foldables and phones (portrait & landscape)
- ✅ Hamburger navigation with slide-in drawer on landing, customer, and admin screens — desktop nav unchanged
- ✅ Admin tables scroll within their own container — no page-level horizontal scroll
- ✅ Real-time updates, with reduced fallback polling now that Realtime is primary
- ✅ Production-style workflow
- ✅ Phase 4 tracking system fully completed
- ✅ Automatic cleanup of Leaflet tracking resources
- ✅ Production-ready tracking lifecycle
- ✅ Cleaner production console
- ✅ Modular `css/` and `js/` folder structure with shared common modules (Phase 5)
- ✅ Zero client-side API secrets — Geoapify key isolated behind an Edge Function (Phase 6)
- ✅ Server-trusted business logic for OTP, QuickCoins, and passes via atomic RPCs (Phase 6)

---

# ✅ Phase 5–7 Complete

## 🧹 Phase 5 — Project Refactor & Professional Codebase

QuickFix has been transformed from a prototype into a production-quality codebase.

Completed work:

- Split HTML, CSS, and JavaScript into separate files
- Created a professional folder structure (`css/{customer,worker,admin,landing,auth}/`,
  `js/{common,customer,worker,admin,landing,auth}/`)
- Modularized reusable JavaScript components — shared modules for Supabase client
  (`supabase.js`), app config (`config.js`), constants (`constants.js`), generic
  utilities (`utils.js`), toast notifications (`toast.js`), map/routing helpers
  (`maps.js`), and mobile nav (`nav.js`)
- Removed duplicated code — toast, IST clock, date formatting, modal-close, HTML
  escaping, mobile nav toggle, and tracking math (route fetch, distance/duration
  formatting, marker animation) each consolidated into a single implementation,
  with backward-compatible aliases preserved where call sites depended on old names
- Hardcoded magic numbers (timeouts, delays, poll intervals) consolidated into a
  single `CONSTANTS` object
- Overall codebase cleanup and maintainability improvements across all five pages

---

## 🔒 Phase 6 — Backend Hardening & Production Readiness

QuickFix has been prepared for real production deployment.

Completed work:

- Improved Supabase Row Level Security (RLS) — customers can no longer write
  `Worker on Way` status, set `is_no_show`, or write to `user_passes` directly
  (blocked by `trg_prevent_direct_pass_tampering`)
- Moved sensitive business logic to backend functions — OTP verification (arrival &
  completion), QuickCoins crediting, and pass consumption now run as atomic,
  server-side RPCs (`verify_arrival_otp`, `verify_completion_otp`,
  `award_quickcoins`, `consume_pass_visit`) instead of client-side writes
- Better validation — service pass activation (`activate_pass`) re-reads the real
  campaign row server-side rather than trusting client-supplied visit counts,
  validity, or perks
- Secure API key handling — `GEOAPIFY_API_KEY` removed from the client entirely;
  routing and reverse geocoding now go through a `geoapify-proxy` Supabase Edge
  Function, with the key stored only as a server-side secret
- Optimized database queries — single-worker lookups no longer pull a full
  `workers` table scan plus a bulk stats RPC just to find one row; service search
  is debounced (300ms) instead of firing a fetch on every keystroke
- Improved performance — worker dashboard fallback poll reduced from 5s to 30s and
  admin dashboard poll reduced from 4s to 15s, now that Supabase Realtime is the
  primary sync mechanism and these are just safety-net fallbacks
- Prepared for multiple concurrent users — booking assignment changed from a
  single-worker lock to a broadcast model: a new job is visible to every eligible
  worker via `get_available_jobs()`, and `accept_booking()` atomically awards it
  to whichever eligible worker accepts first
- Production-level backend architecture — client-trusted values reduced to IDs
  only (e.g. `campaign.id`, `booking.id`); all derived values (discounts, coin
  balances, pass validity) are recomputed and enforced server-side

---

## 🪙 Phase 7 — QuickCoins Ecosystem

The customer loyalty platform has been expanded.

Completed work:

- QuickCoins earning — unchanged automatic crediting on booking completion, now
  verified server-side via `award_quickcoins()`
- Wallet enhancements — persistent balance and lifetime-earned tracking, shown from
  the Quick Wallet modal
- Coin redemption — fixed redemption tiers (e.g. 1000 coins → ₹200 off), mirrored
  server-side by `quickcoins_redemption_value()`; the client's tier list is
  display-only, the server independently recomputes and enforces the discount and
  never trusts the client-sent value
- Promotional campaigns — admin-managed campaigns support both GPay and
  QuickCoins-only purchase methods
- Service Pass improvements — coin-only campaign passes get a dedicated pure
  redemption flow (no QR/GPay/timer), calling `activate_pass()` directly
- Priority booking — unchanged, still tied to active Service Passes
- Offers ecosystem — redemption and an active Service Pass are mutually exclusive,
  enforced identically on client and server
- Future loyalty features — foundation in place for further expansion

---

# 🗓️ Version History

```
v1.0
Core Booking System

v2.0
QuickCoins

v3.0
Service Passes & Offers

v4.0
Complete Admin Portal

v4.1
Worker Tracking Maps

v4.2
Address Validation & Customer Geocoding

v4.3
Road Route Generation (OSRM)

v4.4
Live Worker Movement (watchPosition + Live Route Refresh)

v4.5
Live ETA & Distance Remaining

v4.6  
Permanent Customer Location Pinning

v4.7
Geoapify Integration (Reverse Geocoding & Routing)

v4.8
Tracking System Integration & Verification

v4.9
Tracking System Stabilization & Resource Cleanup

v4.10
Responsive UI Overhaul & Hamburger Navigation (Landing, Customer App, Admin Portal)

v5.0
Project Refactor — Modular css/ and js/ Folder Structure, Shared Common Modules,
Deduplicated Logic

v6.0
Backend Hardening — Server-Side RPCs for OTP/QuickCoins/Passes, Tightened RLS,
Broadcast Booking Model, Geoapify Key Moved Behind Edge Function Proxy

v7.0
QuickCoins Ecosystem — Server-Verified Redemption Tiers, Coin-Only Campaign
Passes, Redemption/Pass Mutual Exclusivity
```

---

# 📄 License

MIT — see [`LICENSE`](./LICENSE).

---

# 👨‍💻 Developer

**Heet Lakhani**

B.Tech Computer Science Engineering

Developed as a major project to demonstrate full-stack web development, database management, real-time systems and modern service marketplace architecture.

---

# ⭐ Support

If you like this project, consider giving it a ⭐ on GitHub!