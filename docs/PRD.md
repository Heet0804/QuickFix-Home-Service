# Product Requirements Document — QuickFix

## Document Control

| Field | Detail |
|---|---|
| Product Name | QuickFix |
| Document Type | Product Requirements Document (PRD) |
| Source of Truth | `index.html`, `worker-dashboard.html`, `worker-profile.html`, `admin.html`, `auth.html`, `landing.html`, `README.md` |
| Prepared For | QuickFix Product Documentation (`docs/PRD.md`) |

---

## 1. Project Overview

QuickFix is a full-stack, on-demand home services marketplace that connects customers with verified local service professionals — electricians, plumbers, carpenters, painters, cleaners, AC technicians, masons, pest control operators, househelp, and massage & wellness providers. The platform manages the complete service lifecycle: service discovery, booking, address validation and geocoding, automated worker assignment, payment, live GPS tracking with road-based routing, OTP-based arrival and completion verification, a loyalty wallet (QuickCoins), purchasable service passes, worker performance analytics, an achievement system, and a dedicated administrative control panel.

The platform is composed of six primary interfaces:

| Interface | File | Purpose |
|---|---|---|
| Landing Page | `landing.html` | Public entry point; routes visitors to customer or worker sign-up/sign-in |
| Authentication | `auth.html` | Unified sign-in and sign-up for both customers and workers |
| Customer Application | `index.html` | Service discovery, booking, tracking, wallet, passes, offers, account management |
| Worker Dashboard | `worker-dashboard.html` | Job management, live tracking, earnings, performance, achievements |
| Worker Profile | `worker-profile.html` | Worker's own profile view/edit, performance metrics, badges, earnings history |
| Admin Portal | `admin.html` | Campaign management, purchased-pass oversight, platform analytics |

---

## 2. Vision

To be the most trusted and frictionless way for a household to get verified, reliable local service professionals to their door — replacing phone calls, uncertainty, and price haggling with a transparent, trackable, on-demand booking experience for both customers and the professionals who serve them.

---

## 3. Objectives

1. Allow a customer to discover, book, pay for, and track a verified local service professional in minutes, with no phone calls required.
2. Automatically match bookings to the nearest available, area-eligible worker rather than requiring manual dispatch.
3. Guarantee booking integrity through address validation, building-level geocoding, and OTP-based arrival and completion verification.
4. Give workers a self-serve dashboard to manage availability, accept or reject jobs, track earnings, and monitor their own performance and reliability.
5. Reward repeat customers through a loyalty wallet (QuickCoins) and a purchasable service-pass system with priority booking benefits.
6. Provide platform operators with a secure, no-SQL-required admin portal to run promotional campaigns and monitor platform-wide performance.
7. Maintain a fully responsive experience across desktop, tablet, and mobile without altering core business logic.

---

## 4. Problem Statement

Booking a trustworthy local service professional (electrician, plumber, painter, and similar trades) is traditionally slow, opaque, and dependent on personal referrals or phone-based negotiation. Customers cannot verify a worker's identity or reliability in advance, cannot track when help will arrive, and have no structured way to confirm that the job was actually completed as agreed. Service professionals, in turn, lack a structured channel to receive job requests matched to their skill, location, and availability, and have no way to build a portable, verifiable track record of their work.

---

## 5. Existing Problems

- No standardized way to verify a worker's identity or trade skill before they arrive at a customer's home.
- Customers have no visibility into a worker's live location or estimated arrival time once a job is booked.
- No safeguard exists to confirm that the worker who arrives is genuinely the one assigned, or that the job was genuinely completed, before payment is finalized.
- Job matching is manual and location-blind — customers must search for and contact workers themselves, or workers must be dispatched by a human coordinator.
- Customers have no incentive structure to remain loyal to a single platform; each booking is a one-off transaction.
- Repeat customers must re-enter their exact address and location every time they book.
- Emergency service needs (for example, outside normal daytime hours) are not clearly differentiated from routine bookings.
- Platform operators have no centralized way to run promotional campaigns, monitor purchased passes, or view platform-wide performance without direct database access.
- Workers have no structured system for tracking their own reliability, earnings, or reputation over time.

---

## 6. Proposed Solution

QuickFix addresses these problems with an integrated marketplace that:

- Verifies worker identity at registration through mandatory government ID (Aadhaar/PAN) and profile photo upload, with a stated 24-hour manual verification turnaround before a worker's profile goes live.
- Validates the customer's entered address against their selected service area, geocodes it to exact building-level coordinates, and lets the customer permanently pin their exact location on a map — reusing that pin automatically on future bookings to the same address.
- Broadcasts confirmed bookings to nearby, area-eligible, available workers and assigns the job to the nearest worker who accepts within a fixed acceptance window.
- Provides live, road-following GPS tracking with real-time distance-remaining and ETA on both the customer's and the worker's dashboards.
- Requires OTP verification at two checkpoints — worker arrival and job completion — before a booking can progress to payment finalization and rating.
- Rewards customers automatically with QuickCoins after every completed booking, and offers purchasable, time-limited Service Passes with priority booking and bundled visit benefits.
- Gives workers a dedicated dashboard with an online/offline toggle, an emergency-availability toggle, job-request tabs, an earnings dashboard, a computed performance/reliability scorecard, and a dynamic, database-driven achievement system.
- Gives administrators a secure, hidden portal to create and manage promotional campaigns, monitor purchased passes, and view platform-wide analytics without writing SQL.

---

## 7. Target Audience

| Audience | Description |
|---|---|
| Urban and suburban homeowners/tenants | Individuals needing on-demand home repair or maintenance services and who value speed, verified professionals, and transparent tracking over price negotiation. |
| Independent local service professionals | Tradespeople (electricians, plumbers, carpenters, painters, cleaners, AC technicians, masons, pest control operators, househelp workers, and massage/wellness providers) seeking a steady stream of job requests matched to their skill and location. |
| Platform operators/administrators | The team or individual responsible for running promotional campaigns, verifying worker onboarding, and monitoring platform health. |

---

## 8. User Personas

### 8.1 Customer Persona — "Rahul, the Homeowner"

- Lives in an urban apartment/society and needs occasional home repairs.
- Wants a service booked in under two minutes without phone calls.
- Values being able to see who is coming, when they will arrive, and confirming the job is genuinely complete before paying.
- Prefers a mix of digital (UPI/Google Pay) and cash payment.
- Responds well to loyalty rewards (QuickCoins) and limited-time offers (Service Passes).

### 8.2 Worker Persona — "Suresh, the Electrician"

- An independent tradesperson who wants job requests filtered to his skill and travel radius.
- Needs to control when he is available (online/offline) and whether he accepts emergency-hours work.
- Wants clear visibility into his earnings, acceptance rate, and reliability score, since these affect his standing on the platform.
- Values a portable, self-managed profile with visible badges and performance history.

### 8.3 Admin Persona — "Platform Operator"

- Responsible for running promotional campaigns (service passes) without needing engineering support.
- Needs a single dashboard to see purchased passes, revenue by campaign, and platform-wide KPIs.
- Requires the admin entry point to be hidden from normal customer/worker navigation and separately authenticated.

---

## 9. Functional Requirements

### 9.1 Authentication & Onboarding

1. The system shall provide a unified authentication screen (`auth.html`) with a role toggle between "I'm a User" and "I'm a Worker."
2. The system shall support account creation and sign-in via email and password.
3. The system shall support a "Forgot password" flow.
4. The system shall display, but not yet functionally implement, Google and Phone OTP social sign-in options (shown with a "coming soon" notice).
5. Customer sign-up shall require first name, email, phone number, and password (minimum six characters). Last name is optional.
6. Worker sign-up shall require full name, phone, email, skill/category, work radius (km), service area, years of experience, a government ID proof upload (Aadhaar/PAN — JPG, JPEG, PNG, or PDF, maximum 5MB), a profile photo upload (JPG, JPEG, PNG, maximum 5MB, with camera-capture support), and a password (minimum six characters).
7. Worker sign-up shall conditionally present an "Available During Emergency Hours" checkbox based on the selected skill category.
8. The system shall also provide an in-app worker registration flow from the customer application (`index.html`, "Register as a Worker" page) requiring full name, phone, email, home area, category, years of experience, service radius, starting price, a short bio, an emergency-availability checkbox, Aadhaar number, optional PAN, and an Aadhaar photo upload.
9. Upon worker registration submission, the system shall display a confirmation screen stating that the team will call within 24 hours and that Aadhaar will be verified before the worker's profile is activated.
10. The system shall provide a separate, hidden administrator authentication gate (`admin.html`) that checks the existing session and the account's role; only accounts with the `admin` role are granted access to the admin application shell. Non-admin visitors are shown a "not authorized" message and are not automatically redirected elsewhere.

### 9.2 Service Discovery

1. The system shall present nine service categories: Electrician, Plumber, Carpenter, Painter, Cleaner, AC Repair, Mason, Pest Control, and Househelp, plus a "Massage & Wellness" category available within the customer application's service filters and worker registration options.
2. The system shall provide a home-page search bar and a dedicated Services page with category filtering, text search, and sorting (Default, Top Rated, Price Low→High, Price High→Low).
3. The system shall hide individual worker identity in service listings until a booking is confirmed.
4. The system shall provide a dedicated sub-category picker for Househelp services and a generic category picker pattern reusable across other service types.
5. The system shall provide a guided "smart search" flow for categories outside the primary listing.

### 9.3 Booking Creation

1. The system shall allow a customer to select a service, date, and time slot (bookable window 8:30 AM–8:30 PM) for a booking.
2. The system shall require the customer's full address and selected service area, and shall validate that the entered address belongs to the selected service area before allowing the booking to proceed, displaying an inline warning if it does not.
3. The system shall allow an optional free-text note describing the issue.
4. The system shall display a live price summary consisting of service price, a handling fee, and the total, updating as selections change.
5. The system shall geocode the validated address to obtain exact coordinates, ignoring flat/wing/house/apartment/room numbers for location-matching purposes while keeping the full address text as entered.
6. The system shall let the customer permanently pin their exact building location on a map on first booking to a given address, storing the address text, selected area, and pinned coordinates against the customer's account.
7. On a repeat booking to an address matching the saved address by exact string comparison, the system shall prompt "Use your previously pinned location?" with options to reuse the saved pin instantly or re-pin.
8. The system shall reverse-geocode the pinned marker to a human-readable building/society name and display it live as the marker is placed or dragged.

### 9.4 Payment

1. The system shall offer two payment methods for a booking: Google Pay (QR-code based) and Cash on arrival.
2. For Google Pay, the system shall display a QR code with a five-minute countdown and confirm payment before proceeding.
3. For Cash, the system shall inform the customer that payment is due in cash on arrival and that the worker will not begin work until arrival is confirmed via OTP.
4. The system shall use a separate, GPay-only payment flow for Service Pass purchases, with its own two-minute countdown, independent of the booking payment flow.

### 9.5 Worker Assignment

1. Upon successful payment or cash confirmation, the system shall broadcast the booking to nearby, area-eligible, available workers.
2. The system shall display a broadcasting screen to the customer with a two-minute countdown and progress indicator.
3. The system shall assign the booking to the nearest available worker who accepts within the window.
4. If no worker accepts within the window, the system shall inform the customer and offer a retry.
5. The system shall present pending job requests to eligible workers, who may accept or reject each request from their dashboard.

### 9.6 Live Tracking

1. Once a booking is accepted, the system shall render a live Leaflet-based tracking map on both the customer's dashboard ("Track Worker") and the worker's dashboard ("Track Customer").
2. The system shall continuously publish the worker's live GPS location and update the worker's marker on both dashboards without recreating the map or route layer.
3. The system shall generate a road-following (not straight-line) route between the worker and the customer, refreshing automatically as the worker moves.
4. The system shall display live distance-remaining and estimated time of arrival (ETA) on both dashboards, computed from the same route data used to draw the route line, and gracefully fall back to a placeholder if routing is temporarily unavailable.
5. The system shall automatically fit the map view to show the worker, the customer, and the full route without requiring manual zoom.
6. The system shall resolve and display the destination building/society name identically on both the customer's and the worker's tracking maps.
7. The system shall automatically remove or collapse the tracking map once arrival is confirmed via OTP, and shall clean up map resources on booking completion or cancellation to prevent memory leaks.

### 9.7 OTP Verification

1. The system shall generate a unique arrival OTP for each booking, displayed to the customer once the worker is en route.
2. The system shall present the customer a fifteen-minute arrival countdown timer with the option to extend by five minutes or cancel the booking if the worker has not arrived.
3. The system shall require the worker to obtain the arrival OTP from the customer in person and enter it on the worker's dashboard to confirm arrival before service can begin.
4. The system shall generate a separate completion OTP, obtained from the customer and entered by the worker to confirm that the job is finished.
5. The system shall block progression to payment finalization, review, and QuickCoins crediting until the completion OTP is successfully verified.

### 9.8 Reviews and Ratings

1. The system shall prompt the customer to rate the completed service on a five-star scale, with an optional free-text comment.
2. The system shall require a star rating (but not a comment) before the review can be submitted.

### 9.9 Booking History

1. The system shall maintain a "My Bookings" view for customers with All, Upcoming, Completed, and Cancelled filters, including cancelled bookings.
2. The system shall allow the customer to permanently clear their booking history, with a confirmation prompt warning that the action cannot be undone.
3. The system shall display booking history within the customer's Account page alongside account details and password management.

### 9.10 QuickCoins Wallet

1. The system shall maintain a persistent QuickCoins balance per customer, separate from a lifetime-earned total.
2. The system shall automatically credit QuickCoins to the customer's wallet when a booking is marked Completed, with no manual crediting step.
3. The system shall display current balance, lifetime earnings, redeemed amount, and completed-booking count in the Quick Wallet view.
4. The system shall display a dedicated reward confirmation screen immediately after a booking is completed, showing the coins credited and the updated wallet balance.
5. The system shall clearly state that QuickCoins are virtual reward points, are not real money, and cannot be withdrawn.

### 9.11 Service Passes and Offers

1. The system shall allow administrators to create and publish time-bound promotional campaigns (Service Passes) with title, service category, description, price, number of included visits, validity period (in days), display priority, start and end dates, an emergency-included flag, a priority-booking flag, and an active/inactive status.
2. The system shall display active campaigns to customers on an Offers page, and shall present the same campaign data as a login/landing popup with a live countdown to the offer's end.
3. The system shall allow customers to purchase a pass via the GPay-only pass payment flow.
4. The system shall record and display purchased passes on a "My Passes" page.
5. The system shall automatically track and decrement pass usage/visit consumption as eligible bookings are made.
6. The system shall grant pass holders priority booking where the associated campaign specifies it.

### 9.12 Worker Dashboard and Job Management

1. The system shall provide a worker-facing dashboard displaying the worker's profile summary, skill, phone, service radius, and area.
2. The system shall provide an online/offline availability toggle and a separate emergency-availability toggle, each independently switchable by the worker.
3. The system shall organize job requests into Pending, Accepted, Arrived, Completed, and Cancelled tabs, each with a live count badge.
4. The system shall require explicit confirmation before a worker accepts, rejects, or cancels an already-accepted booking, warning that frequent cancellations reduce the worker's reliability score.
5. The system shall display an offline banner when the worker is not online, prompting them to go online to receive job requests.
6. The system shall display an upcoming-bookings timeline and a full booking calendar (month view with per-day booking lists).

### 9.13 Worker Earnings and Performance

1. The system shall display an earnings dashboard broken into Today, This Week, and This Month totals.
2. The system shall compute and display: accepted jobs, completed jobs, cancelled jobs, no-show count, reliability score, completion rate, activity score, and an overall worker score.
3. The system shall compute and display an acceptance rate from accepted versus rejected job counts.
4. The system shall assign and display a worker rank badge and a reliability status pill derived from the worker's computed metrics.
5. The system shall display an informational cancellation-warning banner when relevant.
6. The system shall provide a dedicated Worker Profile page allowing the worker to view and edit their name, phone number, skill/trade, experience, service area, and service radius, alongside their performance metrics, badges, and a recent-earnings list computed from booking history.

### 9.14 Achievement System

1. The system shall maintain a dynamic, database-driven achievement engine for workers, with no hardcoded or manually assigned unlocks.
2. The system shall automatically unlock achievements when a worker meets the required conditions, computed live from booking history (examples include milestones such as first job completed, ten jobs completed, being a highly rated worker, perfect reliability, earnings milestones, and booking streaks).
3. The system shall display an animated popup notification when an achievement is unlocked, and shall provide an in-dashboard and in-profile view of all badges earned.

### 9.15 Admin Portal

1. The system shall provide a Campaign Dashboard allowing administrators to create, edit, search, and filter campaigns by name, service, status, and priority.
2. The system shall present campaign creation and editing through a single modal form covering all campaign fields listed in Section 9.11.1.
3. The system shall provide a User Passes tab listing purchaser, email, campaign, purchase date, expiry date, visits remaining, and status for every purchased pass.
4. The system shall provide an Analytics tab showing a platform-wide statistics overview and a per-campaign breakdown of total purchases, active passes, expired passes, and revenue generated.
5. The system shall provide sign-out and "return to landing page" actions from the admin navigation.

---

## 10. Non-Functional Requirements

1. **Responsiveness.** The landing page, customer application, and admin portal shall render correctly across 4K, desktop, laptop, tablet, foldable, large-phone, and small-phone form factors in both portrait and landscape orientation, using fluid CSS Grid/Flexbox layouts rather than fixed widths or device-specific overrides, without altering existing desktop layout, color, typography, or business logic.
2. **Mobile navigation.** The landing page, customer application, worker dashboard, worker profile, and admin portal shall provide a hamburger-triggered slide-in navigation drawer on tablet and mobile breakpoints, opening on tap and closing on outside click or item selection, while leaving the desktop horizontal navigation unchanged.
3. **No unintended page-level horizontal scroll.** Admin data tables shall scroll horizontally only within their own container, with table headers remaining visible; the surrounding page shall never scroll sideways.
4. **Touch usability.** Buttons, tabs, and inputs shall be sized appropriately for touch interaction on mobile breakpoints.
5. **Real-time responsiveness.** Booking status changes, job broadcasts, and worker location updates shall propagate to relevant dashboards in real time via Supabase Realtime and Firebase Realtime Database without requiring a manual page refresh.
6. **Resource cleanup.** Leaflet map instances, markers, and route layers used for live tracking shall be properly destroyed on booking completion or cancellation to prevent memory leaks, and development/debug console logging shall be removed from production code paths.
7. **Data integrity for location.** Once a customer has manually pinned a location, that pin shall be the sole source of the booking's stored coordinates; a live-GPS reading shall never silently overwrite a manually pinned location.
8. **Security boundary for admin access.** The admin portal's entry point shall not be linked from customer or worker navigation, shall require its own authentication check against the account's role, and shall not automatically redirect an authenticated non-admin user into another role's application.
9. **Graceful degradation.** If the routing service is temporarily unreachable, the live tracking map shall retain the last known route rather than falling back to a straight-line or dashed placeholder, and distance/ETA values shall fall back to a placeholder rather than causing an error.

---

## 11. Customer Features

- Landing page with clear "I Need a Service" and "I Want to Work" entry paths.
- Unified sign-in/sign-up with role selection.
- Home page with search, category browsing, and platform statistics.
- Category-filtered, sortable service listings with worker identity hidden until booking confirmation.
- Full booking flow: service, date/time, address, service area, notes, live price summary.
- Address validation against selected service area with inline error messaging.
- Building-level address geocoding and permanent, reusable location pinning with exact-match reuse detection.
- Google Pay (QR) and Cash payment options.
- Automated nearest-worker broadcast and assignment with a retry path on timeout.
- Live "Track Worker" map with road-following route, live distance remaining, and ETA.
- Fifteen-minute arrival window with extend/cancel options.
- Two-step OTP verification (arrival and completion).
- Post-completion review and star rating.
- "My Bookings" history with status filters and a clear-history option.
- "My Account" page for account details, booking history, and password change.
- Quick Wallet showing QuickCoins balance, lifetime earnings, redeemed amount, and completed-booking count.
- Automatic QuickCoins crediting with a dedicated reward confirmation screen.
- Offers page listing active, time-limited Service Pass campaigns with countdown.
- "My Passes" page listing purchased passes.
- In-app worker registration flow (become a worker from within the customer application).
- Emergency-hours banner indicating restricted service availability during defined hours.

---

## 12. Worker Features

- Role-specific sign-up with skill/category, work radius, service area, experience, government ID upload, and profile photo upload.
- Online/offline availability toggle and independent emergency-availability toggle.
- Job request tabs: Pending, Accepted, Arrived, Completed, Cancelled, each with live counts.
- Accept/reject confirmation modals, and a cancellation-confirmation modal warning of reliability impact.
- Offline banner prompting the worker to go online.
- Upcoming-bookings timeline and a full booking calendar with per-day detail.
- "Track Customer" live map with road-following route, live distance to customer, and ETA.
- Continuous live GPS publishing while online.
- Arrival OTP and Completion OTP verification modals.
- Earnings dashboard (today, this week, this month).
- Performance scorecard: accepted, completed, cancelled, no-show counts; reliability score; completion rate; activity score; overall worker score; acceptance rate.
- Worker rank badge and reliability status pill.
- Dynamic, database-driven achievement/badge system with unlock popups.
- Dedicated Worker Profile page for viewing/editing personal and professional details, viewing performance metrics, badges, and recent earnings history.

---

## 13. Admin Features

- Hidden, separately authenticated admin entry point checked against account role.
- Campaign Dashboard: create, edit, search, and filter campaigns (by name, service, status, priority).
- Single create/edit modal covering all campaign attributes (title, service, description, price, visits, validity, priority, start/end dates, emergency-included flag, priority-booking flag, status).
- User Passes tab: purchaser, email, campaign, purchase date, expiry, visits, status.
- Analytics tab: platform-wide overview plus per-campaign purchases, active passes, expired passes, and revenue generated.
- Sign-out and "Return to Landing" navigation actions.

---

## 14. Booking Workflow

1. Customer logs in.
2. Customer selects a service, date, time slot, and enters their address and service area.
3. System validates the address against the selected service area.
4. System geocodes the validated address.
5. System either reuses the customer's previously saved location pin (on an exact address match) or prompts the customer to pin their exact building location on the map.
6. Customer reviews the price summary and proceeds to payment (Google Pay or Cash).
7. On successful payment/cash confirmation, the system broadcasts the booking to nearby eligible workers.
8. A nearby worker accepts the booking within the acceptance window; if none accepts, the customer is offered a retry.
9. The customer's "Track Worker" map activates, showing the live route and ETA as the worker travels.
10. The worker arrives; the customer shares the Arrival OTP, which the worker enters to confirm arrival.
11. Service is performed.
12. The customer shares the Completion OTP, which the worker enters to confirm completion.
13. Payment is finalized.
14. QuickCoins are automatically credited to the customer's wallet.
15. The customer is prompted to leave a star rating and optional review.
16. Any newly qualifying worker achievements are unlocked and displayed.

---

## 15. Tracking Workflow

1. Once a booking is accepted, both the customer's ("Track Worker") and the worker's ("Track Customer") live maps activate.
2. The worker's device continuously publishes GPS coordinates while online, using continuous location watching rather than one-time fixes.
3. A road-following route is generated between the worker's live location and the customer's pinned location and rendered as a solid route line on both dashboards.
4. As the worker's location updates, the worker's marker moves and the route refreshes automatically without recreating the map, markers, or route layer; the customer's marker remains fixed.
5. Live distance-remaining and ETA are derived from the same route response used for the route line and displayed on both dashboards, falling back to a placeholder if routing is temporarily unavailable.
6. The map view automatically fits to show both parties and the full route.
7. The destination building/society name is reverse-geocoded from the pinned coordinates and shown identically on both dashboards.
8. The tracking map is automatically removed or collapsed once the Arrival OTP is verified, and all map resources are cleaned up on booking completion or cancellation.

---

## 16. OTP Verification Workflow

1. The system generates a unique six-digit Arrival OTP for the booking and displays it to the customer once a worker is en route.
2. When the worker physically arrives, the customer verbally shares the Arrival OTP; the worker enters it into the Arrival OTP modal on their dashboard to confirm arrival.
3. Successful arrival verification collapses the live tracking map and allows the service to begin.
4. Upon job completion, the system provides a Completion OTP; the customer shares it with the worker, who enters it into the Completion OTP modal to confirm the job is finished.
5. Successful completion verification unlocks payment finalization, QuickCoins crediting, and the review/rating prompt.
6. If the arrival window (fifteen minutes) elapses without an arrival OTP verification, the customer is offered the option to extend by five minutes or cancel the booking.

---

## 17. Wallet & QuickCoins

- Every customer has a persistent QuickCoins wallet with a spendable balance and a separate lifetime-earned total.
- QuickCoins are automatically credited to the customer's wallet immediately after a booking is marked Completed, with no manual intervention.
- A dedicated reward screen displays the coins just credited and the updated wallet balance at the moment of crediting.
- The Quick Wallet view (accessible from the main navigation) displays current balance, lifetime earnings, amount redeemed, and total completed bookings.
- QuickCoins are explicitly virtual reward points: they are not real currency and cannot be withdrawn or converted to cash.
- At present, no redemption offers are active; the interface communicates that customers should keep collecting coins for future offers (coin redemption is planned as future scope — see Section 21).

---

## 18. Service Passes

- Service Passes are administrator-created promotional campaigns tied to a specific service category, sold to customers as a bundled entitlement.
- Each campaign defines: title, service, description, price, number of included visits, validity period in days, display priority, campaign start and end dates, whether emergency service is included, whether the pass grants priority booking, and an active/inactive status.
- Active, time-bound campaigns are surfaced to customers both as a countdown popup and on a dedicated Offers page.
- Customers purchase a pass through a dedicated, GPay-only payment flow independent of the regular booking payment flow.
- Purchased passes are listed on the customer's "My Passes" page and tracked by the admin portal's User Passes tab (purchaser, campaign, purchase date, expiry date, visits remaining, status).
- Visit/usage consumption against a purchased pass is tracked automatically as eligible bookings are made — no manual decrementing is required.
- Where specified by the campaign, pass holders receive priority booking treatment.

---

## 19. Emergency Booking System

- The customer application displays an emergency-hours banner indicating that only Electrician and Plumber services are available during defined emergency hours, shown as 8:30 PM–8:30 AM IST.
- Workers may opt in to emergency-hours availability. The worker sign-up flow (`auth.html`) conditionally presents an "Available During Emergency Hours" checkbox, labeled with a 9:30 PM–9:30 AM window, for eligible skill categories; the in-app worker registration flow (`index.html`) presents an equivalent "Available for Emergency (24/7) service" checkbox at sign-up time.
- Independently of the sign-up-time preference, the worker dashboard provides a live "Emergency" toggle that lets an onboarded worker switch their real-time emergency availability on or off.
- Administrators can flag a campaign/Service Pass as including emergency service coverage.

> Note: the customer-facing emergency window (8:30 PM–8:30 AM) and the worker-registration emergency window (9:30 PM–9:30 AM) are stated differently across the source files; this document reproduces both as found rather than reconciling them, since only the attached files were used as the source of truth.

---

## 20. Notifications

- Real-time booking status updates (broadcast, acceptance, arrival, completion) are delivered via Firebase Realtime Database, keeping the customer's and worker's dashboards synchronized without a manual refresh.
- In-app toast notifications surface transient system messages (for example, upload confirmations and "coming soon" notices for unimplemented social sign-in options).
- Achievement unlocks are surfaced to workers through an animated popup notification at the moment they are earned.
- The worker dashboard reflects new job requests and status changes in real time.

---

## 21. Future Scope

### 21.1 Phase 5 — Project Refactor & Professional Codebase

- Split HTML, CSS, and JavaScript into separate files organized by role and feature.
- Establish a professional folder structure and modularize reusable JavaScript components.
- Remove duplicated code across dashboards.
- Create SQL setup scripts and API documentation.
- Improve overall project documentation and repository structure.

### 21.2 Phase 6 — Backend Hardening & Production Readiness

- Strengthen Supabase Row Level Security (RLS) policies.
- Move sensitive business logic out of the client and into backend functions.
- Improve input validation and secure API key handling.
- Optimize database queries and overall performance.
- Prepare the platform to support multiple concurrent users at production scale.

### 21.3 Phase 7 — QuickCoins Ecosystem

- Expand QuickCoins earning mechanics and wallet functionality.
- Introduce coin redemption against real offers.
- Build out promotional campaign capabilities and an expanded offers ecosystem.
- Continue improving Service Passes and priority booking.

---

## 22. Technology Overview

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend / Database | Supabase (Authentication, PostgreSQL, Realtime, RPC Functions) |
| Maps & Routing | Leaflet.js, OpenStreetMap, Geoapify Routing API |
| Geocoding | Nominatim (OpenStreetMap) for address validation; Geoapify Reverse Geocoding API for pin-to-building-name resolution |
| Live Location | `navigator.geolocation.watchPosition()` for continuous worker GPS publishing |
| Notifications / Real-time Sync | Firebase Realtime Database |

This section is intentionally limited to a high-level technology overview; implementation-level architecture belongs in a separate `Architecture.md`.

---

## 23. Project Scope

The current, implemented scope of QuickFix covers:

1. Customer-facing service discovery, booking, payment, tracking, OTP verification, review, wallet, offers, and account management.
2. Worker-facing job management, live tracking, earnings, performance analytics, achievements, and profile management.
3. A complete, separately secured admin portal for campaign management, purchased-pass oversight, and analytics.
4. End-to-end live tracking (Phases 4.1–4.9): tracking maps, address validation and geocoding, road-route generation, live worker movement, live ETA/distance, permanent location pinning, Geoapify integration, and tracking-system stabilization/resource cleanup.
5. A fully responsive UI across desktop, tablet, foldable, and mobile devices, including hamburger navigation on the landing page, customer application, and admin portal.

---

## 24. Out of Scope

The following are explicitly identified in the project roadmap as not yet implemented and are out of scope for the current version:

1. Splitting the codebase into a fully modularized, production-grade file/folder structure (planned for Phase 5).
2. Hardened Supabase Row Level Security, backend-side business logic, secure API key handling, and query optimization for production-scale concurrency (planned for Phase 6).
3. QuickCoins redemption against real offers, expanded promotional campaign tooling, and a broader offers ecosystem (planned for Phase 7).
4. Functional Google and Phone OTP social sign-in (currently displayed as "coming soon" placeholders with no backing implementation).
5. Any features, workflows, or data not represented in the attached source files.

---

## 25. Success Criteria

1. A customer can complete an entire booking — from service selection through payment, worker assignment, live tracking, arrival OTP, completion OTP, QuickCoins crediting, and review — without needing a phone call or manual intervention.
2. Address validation correctly blocks bookings where the entered address does not match the selected service area, and correctly geocodes and pins valid addresses at building level.
3. A booking broadcast reaches nearby eligible workers and is either accepted within the acceptance window or clearly reported to the customer as unaccepted, with a retry path offered.
4. Live tracking maps on both the customer and worker dashboards remain synchronized in real time, with distance and ETA values updating as the worker moves, and degrade gracefully (rather than breaking) if the routing service is briefly unavailable.
5. Both the arrival and completion OTP checkpoints reliably gate progression of the booking lifecycle, preventing payment finalization or QuickCoins crediting from occurring without verification.
6. QuickCoins are credited automatically and accurately for every booking marked Completed, with balance and lifetime-earned figures remaining consistent in the Quick Wallet view.
7. Purchased Service Passes are correctly tracked for visit consumption and correctly reflected in both the customer's "My Passes" page and the admin portal's User Passes tab.
8. Worker performance metrics (reliability score, completion rate, activity score, worker score, acceptance rate) are computed consistently from booking history and displayed identically on the worker dashboard and worker profile page.
9. The admin portal remains inaccessible to non-admin accounts and is not discoverable through normal customer/worker navigation.
10. All core screens (landing, customer application, worker dashboard, worker profile, admin portal) render without layout breakage, clipped content, or unwanted horizontal scrolling across desktop, tablet, and mobile viewports.