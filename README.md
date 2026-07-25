# ⚡ QuickFix – Smart Home Service Booking Platform

<p align="center">
  <b>Book trusted home service professionals in just a few clicks.</b><br>
  A complete full-stack service marketplace built using HTML, CSS, JavaScript, Supabase and Firebase.
</p>

---

## 📖 About the Project

QuickFix is a modern home service booking platform that connects customers with verified service professionals such as electricians, plumbers, carpenters, painters, cleaners, AC technicians, masons and many more.

Unlike a simple booking website, QuickFix manages the complete service lifecycle—from booking creation, address validation and worker assignment, to live GPS + road-route tracking with real-time ETA, OTP verification, payments, QuickCoins rewards, service passes, reviews, achievements, worker analytics and a full admin portal.

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
- 💳 Cash & UPI payment options
- 🪙 QuickCoins wallet & rewards
- 🎟️ Service Passes & priority booking
- 🏷️ Offers system
- 📜 Booking history
- ⭐ Worker ratings & reviews
- 📍 Live worker tracking using Leaflet Maps
- 🛣️ Road-following route to the assigned worker (OSRM)
- 🚗 Live-updating worker marker as the worker travels
- ⏱️ Live Distance Remaining & ETA on the Track Worker map
- 🔢 OTP based arrival & completion verification
- 📊 Booking timeline

---

## 👷 Worker Side

- 📥 Accept / Reject booking requests
- 📅 Job management dashboard
- 📍 Continuous live GPS location sharing (`watchPosition()`)
- 🧭 Live "Track Customer" map with road route to the customer
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

### ⏳ Remaining Phase 4 Roadmap
- **Phase 4.6** — Route Recalculation
- **Phase 4.7** — Smart Status Updates
- **Phase 4.8** — Automatic Arrival Detection
- **Phase 4.9** — Final Production Polish

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
Worker Assignment
      │
      ▼
Worker Accepts
      │
      ▼
Track Worker (Live Route + Live ETA)
      │
      ▼
Arrival OTP
      │
      ▼
Service Started
      │
      ▼
Completion OTP
      │
      ▼
Payment
      │
      ▼
QuickCoins
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
- Vanilla JavaScript

### Backend

- Supabase
  - Authentication
  - PostgreSQL Database
  - Realtime
  - RPC Functions

### Maps & Routing

- Leaflet.js
- OpenStreetMap
- OSRM (Open Source Routing Machine) — road-following route generation and live ETA/distance

### Location

- `navigator.geolocation.watchPosition()` — continuous live worker GPS publishing

### Notifications

- Firebase Realtime Database

---

# 📂 Project Structure

```
QuickFix/
│
├── index.html                 # Customer Application
├── auth.html                  # Authentication
├── landing.html               # Landing Page
├── worker-dashboard.html      # Worker Dashboard
├── worker-profile.html        # Worker Profile
├── assets/
├── images/
└── README.md
```

---

# 🚀 Highlights

- ✅ Full service lifecycle management
- ✅ Area-based worker allocation
- ✅ Dynamic worker ranking
- ✅ Customer address validation against selected service area
- ✅ Building-level customer geocoding (no area-center fallback for new bookings)
- ✅ Continuous live GPS tracking for the worker via `watchPosition()`
- ✅ Road-following route generation via OSRM, shared across both dashboards
- ✅ Live route refresh as the worker moves — no map, marker, or polyline recreation
- ✅ Live Distance Remaining & ETA, computed from the existing OSRM response with zero extra network calls
- ✅ Automatic map fitBounds — no manual zooming required
- ✅ OTP verification for arrival & completion
- ✅ QuickCoins wallet with lifetime coin tracking
- ✅ Service Passes with priority booking
- ✅ Offers system
- ✅ Complete, securely hidden Admin Portal
- ✅ Achievement engine (fully dynamic, database-driven)
- ✅ Worker analytics computed live from booking history
- ✅ Responsive UI
- ✅ Real-time updates
- ✅ Production-style workflow

---

# 🎯 Future Improvements

- 🔁 Automatic route recalculation (Phase 4.6)
- 🔔 Smart status updates (Phase 4.7)
- 📍 Automatic arrival detection (Phase 4.8)
- 💬 In-app chat between customer & worker
- 📹 Video consultation support
- 🤖 AI-powered worker recommendation
- 💳 Online payment gateway integration
- 📱 Progressive Web App (PWA)
- 🌍 Multi-city support
- 🔔 Push notifications

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
```

---

# 👨‍💻 Developer

**Heet Lakhani**

B.Tech Computer Science Engineering

Developed as a major project to demonstrate full-stack web development, database management, real-time systems and modern service marketplace architecture.

---

# ⭐ Support

If you like this project, consider giving it a ⭐ on GitHub!