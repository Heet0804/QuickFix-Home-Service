# ⚡ QuickFix – Smart Home Service Booking Platform

<p align="center">
  <b>Book trusted home service professionals in just a few clicks.</b><br>
  A complete full-stack service marketplace built using HTML, CSS, JavaScript, Supabase and Firebase.
</p>

---

## 📖 About the Project

QuickFix is a modern home service booking platform that connects customers with verified service professionals such as electricians, plumbers, carpenters, painters, cleaners, AC technicians, masons and many more.

Unlike a simple booking website, QuickFix manages the complete service lifecycle—from booking creation, address validation and worker assignment, to live GPS + road-route tracking, OTP verification, payments, QuickCoins rewards, service passes, reviews, achievements, worker analytics and a full admin portal.

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
- 🔢 OTP based arrival & completion verification
- 📊 Booking timeline

---

## 👷 Worker Side

- 📥 Accept / Reject booking requests
- 📅 Job management dashboard
- 📍 Live GPS location sharing
- 🧭 Live "Track Customer" map with road route to the customer
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
- This routing implementation is **production-ready**

### ⏳ Remaining Phase 4 Roadmap
- **Phase 4.4** — Live Worker Movement
- **Phase 4.5** — Live ETA
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
Track Worker
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
- OSRM (Open Source Routing Machine) — road-following route generation

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
- ✅ Live GPS tracking for both customer and worker
- ✅ Road-following route generation via OSRM, shared across both dashboards
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

- 🚶 Live worker movement animation (Phase 4.4)
- ⏱️ Live ETA calculation (Phase 4.5)
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
```

---

# 👨‍💻 Developer

**Heet Lakhani**

B.Tech Computer Science Engineering

Developed as a major project to demonstrate full-stack web development, database management, real-time systems and modern service marketplace architecture.

---

# ⭐ Support

If you like this project, consider giving it a ⭐ on GitHub!
