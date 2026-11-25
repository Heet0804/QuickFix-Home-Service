# Product Requirements Document — QuickFix

## Document Control

| Field | Detail |
|---|---|
| Product Name | QuickFix |
| Document Type | Product Requirements Document (PRD) |
| Source of Truth | `index.html`, `worker-dashboard.html`, `worker-profile.html`, `admin.html`, `auth.html`, `landing.html`, `README.md` |
| Prepared For | QuickFix Product Documentation (`docs/PRD.md`) |
| Revision | v1.2 — v1.1 fixes retained; additionally: converted open QuickCoins rate and reliability-penalty weighting into tracked action items with owner/status, added Stakeholders (7A) and User Roles (7B) sections, closed the Achievement condition list, defined "area-eligible"/"nearest" (9.5.6), aligned OTP digit format between FR and Workflow sections, added refunds/disputes/support to Out of Scope, added a government-ID data-handling constraint (22A.5), added framing notes distinguishing Sections 11–16 from Section 9, and defined GPS-permission-denial behavior (9.6.8) |
| Prior Revision | v1.1 — resolved emergency-hours contradiction, added Assumptions (4A), Business Rules (10A), and Constraints (22A) sections, reconciled professional onboarding field sets, added OTP-failure and payment-timeout rules, restructured Success Criteria into Success Metrics & Acceptance Criteria |

---

## 1. Project Overview

QuickFix is a full-stack, on-demand home services marketplace that connects customers with verified local service professionals — electricians, plumbers, carpenters, painters, cleaners, AC technicians, masons, pest control operators, househelp, and massage & wellness providers. The platform manages the complete service lifecycle: service discovery, booking, address validation and geocoding, automated professional assignment, payment, live GPS tracking with road-based routing, OTP-based arrival and completion verification, a loyalty wallet (QuickCoins), purchasable service passes, professional performance analytics, an achievement system, and a dedicated administrative control panel.

The platform is composed of six primary interfaces:

| Interface | File | Purpose |
|---|---|---|
| Landing Page | `landing.html` | Public entry point; routes visitors to customer or professional sign-up/sign-in |
| Authentication | `auth.html` | Unified sign-in and sign-up for both customers and professionals |
| Customer Application | `index.html` | Service discovery, booking, tracking, wallet, passes, offers, account management |
| Professional Dashboard | `worker-dashboard.html` | Job management, live tracking, earnings, performance, achievements |
| Professional Profile | `worker-profile.html` | Professional's own profile view/edit, performance metrics, badges, earnings history |
| Admin Portal | `admin.html` | Campaign management, purchased-pass oversight, platform analytics |

---

## 2. Vision

To be the most trusted and frictionless way for a household to get verified, reliable local service professionals to their door — replacing phone calls, uncertainty, and price haggling with a transparent, trackable, on-demand booking experience for both customers and the professionals who serve them.

---

## 3. Objectives

1. Allow a customer to discover, book, pay for, and track a verified local service professional in minutes, with no phone calls required.
2. Automatically match bookings to the nearest available, area-eligible professional rather than requiring manual dispatch.
3. Guarantee booking integrity through address validation, building-level geocoding, and OTP-based arrival and completion verification.
4. Give professionals a self-serve dashboard to manage availability, accept or reject jobs, track earnings, and monitor their own performance and reliability.
5. Reward repeat customers through a loyalty wallet (QuickCoins) and a purchasable service-pass system with priority booking benefits.
6. Provide platform operators with a secure, no-SQL-required admin portal to run promotional campaigns and monitor platform-wide performance.
7. Maintain a fully responsive experience across desktop, tablet, and mobile without altering core business logic.

---

## 4. Problem Statement

Booking a trustworthy local service professional (electrician, plumber, painter, and similar trades) is traditionally slow, opaque, and dependent on personal referrals or phone-based negotiation. Customers cannot verify a professional's identity or reliability in advance, cannot track when help will arrive, and have no structured way to confirm that the job was actually completed as agreed. Service professionals, in turn, lack a structured channel to receive job requests matched to their skill, location, and availability, and have no way to build a portable, verifiable track record of their work.

---

## 4A. Assumptions

1. The platform operates in a single country/region (India) and a single currency (INR); all payment amounts, ID verification (Aadhaar/PAN), and time windows (IST) are scoped to this market.
2. Customers and professionals have a smartphone or desktop with a modern browser, an active internet connection, and (for professionals) a device capable of continuous GPS reporting via `navigator.geolocation.watchPosition()`.
3. The platform is operated by a single administrative team; the current admin portal design assumes one active admin role rather than a multi-tenant or multi-role admin hierarchy.
4. The UI is assumed to be English-only for the current phase; no localization requirement exists yet.
5. All business logic currently executing client-side (in `index.html`, `worker-dashboard.html`, `admin.html`) is assumed to be temporary and is planned for migration to backend functions in Phase 6 (Section 21.2); this PRD does not assume production-grade server-side enforcement of business rules in the current phase.

---

## 5. Existing Problems

- No standardized way to verify a professional's identity or trade skill before they arrive at a customer's home.
- Customers have no visibility into a professional's live location or estimated arrival time once a job is booked.
- No safeguard exists to confirm that the professional who arrives is genuinely the one assigned, or that the job was genuinely completed, before payment is finalized.
- Job matching is manual and location-blind — customers must search for and contact professionals themselves, or professionals must be dispatched by a human coordinator.
- Customers have no incentive structure to remain loyal to a single platform; each booking is a one-off transaction.
- Repeat customers must re-enter their exact address and location every time they book.
- Emergency service needs (for example, outside normal daytime hours) are not clearly differentiated from routine bookings.
- Platform operators have no centralized way to run promotional campaigns, monitor purchased passes, or view platform-wide performance without direct database access.
- Professionals have no structured system for tracking their own reliability, earnings, or reputation over time.

---

## 6. Proposed Solution

QuickFix addresses these problems with an integrated marketplace that:

- Verifies professional identity at registration through mandatory government ID (Aadhaar/PAN) and profile photo upload, with a stated 24-hour manual verification turnaround before a professional's profile goes live.
- Validates the customer's entered address against their selected service area, geocodes it to exact building-level coordinates, and lets the customer permanently pin their exact location on a map — reusing that pin automatically on future bookings to the same address.
- Broadcasts confirmed bookings to nearby, area-eligible, available professionals and assigns the job to the nearest professional who accepts within a fixed acceptance window.
- Provides live, road-following GPS tracking with real-time distance-remaining and ETA on both the customer's and the professional's dashboards.
- Requires OTP verification at two checkpoints — professional arrival and job completion — before a booking can progress to payment finalization and rating.
- Rewards customers automatically with QuickCoins after every completed booking, and offers purchasable, time-limited Service Passes with priority booking and bundled visit benefits.
- Gives professionals a dedicated dashboard with an online/offline toggle, an emergency-availability toggle, job-request tabs, an earnings dashboard, a computed performance/reliability scorecard, and a dynamic, database-driven achievement system.
- Gives administrators a secure, hidden portal to create and manage promotional campaigns, monitor purchased passes, and view platform-wide analytics without writing SQL.

---

## 7. Target Audience

| Audience | Description |
|---|---|
| Urban and suburban homeowners/tenants | Individuals needing on-demand home repair or maintenance services and who value speed, verified professionals, and transparent tracking over price negotiation. |
| Independent local service professionals | Tradespeople (electricians, plumbers, carpenters, painters, cleaners, AC technicians, masons, pest control operators, househelp professionals, and massage/wellness providers) seeking a steady stream of job requests matched to their skill and location. |
| Platform operators/administrators | The team or individual responsible for running promotional campaigns, verifying professional onboarding, and monitoring platform health. |

---

## 7A. Stakeholders

| Stakeholder | Interest |
|---|---|
| Product Owner | Owns feature prioritization, campaign strategy, and the open business-rule decisions flagged in Section 10A. |
| Engineering Team | Implements and maintains the platform per this PRD and the downstream SRS/Architecture documents. |
| Platform Administrators | Day-to-day operators of the admin portal (Section 9.15); a subset of the "Platform operators/administrators" audience in Section 7, but distinguished here as an internal operating stakeholder rather than an end-user segment. |
| Customers and Professionals | End users of the platform; represented as personas in Section 8. |

## 7B. User Roles

| Role | Access | Key capabilities |
|---|---|---|
| Customer | `index.html`, `auth.html` (customer path) | Book, pay, track, review, manage wallet/passes/account (Sections 9.2–9.11). |
| Professional | `worker-dashboard.html`, `worker-profile.html`, `auth.html` (professional path), in-app registration on `index.html` | Manage availability, accept/reject jobs, track earnings/performance, manage profile (Sections 9.12–9.14). |
| Admin | `admin.html` | Campaign management, purchased-pass oversight, analytics (Section 9.15). Access gated by account role per NFR 8. |

No role is permitted to access another role's application shell; this is enforced today only for the Admin role (NFR 8) and is not yet specified for Customer/Worker cross-access, since the current source files do not describe that boundary.

---

## 8. User Personas

### 8.1 Customer Persona — "Rahul, the Homeowner"

- Lives in an urban apartment/society and needs occasional home repairs.
- Wants a service booked in under two minutes without phone calls.
- Values being able to see who is coming, when they will arrive, and confirming the job is genuinely complete before paying.
- Prefers a mix of digital (UPI/Google Pay) and cash payment.
- Responds well to loyalty rewards (QuickCoins) and limited-time offers (Service Passes).

### 8.2 Professional Persona — "Suresh, the Electrician"

- An independent tradesperson who wants job requests filtered to his skill and travel radius.
- Needs to control when he is available (online/offline) and whether he accepts emergency-hours work.
- Wants clear visibility into his earnings, acceptance rate, and reliability score, since these affect his standing on the platform.
- Values a portable, self-managed profile with visible badges and performance history.

### 8.3 Admin Persona — "Platform Operator"

- Responsible for running promotional campaigns (service passes) without needing engineering support.
- Needs a single dashboard to see purchased passes, revenue by campaign, and platform-wide KPIs.
- Requires the admin entry point to be hidden from normal customer/professional navigation and separately authenticated.

---

## 9. Functional Requirements

### 9.1 Authentication & Onboarding

1. The system shall provide a unified authentication screen (`auth.html`) with a role toggle between "I'm a User" and "I'm a Professional."
2. The system shall support account creation and sign-in via email and password.
3. The system shall support a "Forgot password" flow.
4. The system shall display, but not yet functionally implement, Google and Phone OTP social sign-in options (shown with a "coming soon" notice).
5. Customer sign-up shall require first name, email, phone number, and password (minimum six characters). Last name is optional.
6. Professional sign-up shall require full name, phone, email, skill/category, service radius (km), service area, years of experience, a government ID proof upload (Aadhaar/PAN — JPG, JPEG, PNG, or PDF, maximum 5MB), a profile photo upload (JPG, JPEG, PNG, maximum 5MB, with camera-capture support), and a password (minimum six characters).
7. Professional sign-up shall conditionally present an "Available During Emergency Hours" checkbox based on the selected skill category.
8. The system shall also provide an in-app professional registration flow from the customer application (`index.html`, "Register as a Professional" page), collecting the same core field set as the `auth.html` professional sign-up flow (full name, phone, email, skill/category, service area, service radius, years of experience, government ID proof — captured here specifically as Aadhaar number plus optional PAN — and a profile photo/Aadhaar photo upload), plus two fields unique to this entry point: a starting price and a short bio. Both flows shall write to the same professional profile fields; "service area" and "service radius" are the canonical field names used by both flows.
9. Upon professional registration submission, the system shall display a confirmation screen stating that the team will call within 24 hours and that Aadhaar will be verified before the professional's profile is activated.
10. The system shall provide a separate, hidden administrator authentication gate (`admin.html`) that checks the existing session and the account's role; only accounts with the `admin` role are granted access to the admin application shell. Non-admin visitors are shown a "not authorized" message and are not automatically redirected elsewhere.

### 9.2 Service Discovery

1. The system shall present nine service categories: Electrician, Plumber, Carpenter, Painter, Cleaner, AC Repair, Mason, Pest Control, and Househelp, plus a "Massage & Wellness" category available within the customer application's service filters and professional registration options.
2. The system shall provide a home-page search bar and a dedicated Services page with category filtering, text search, and sorting (Default, Top Rated, Price Low→High, Price High→Low).
3. The system shall hide individual professional identity in service listings until a booking is confirmed.
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
3. For Cash, the system shall inform the customer that payment is due in cash on arrival and that the professional will not begin work until arrival is confirmed via OTP.
4. The system shall use a separate, GPay-only payment flow for Service Pass purchases, with its own two-minute countdown, independent of the booking payment flow.
5. If the five-minute Google Pay countdown (booking payment) or the two-minute Google Pay countdown (Service Pass purchase) elapses without a confirmed payment, the system shall cancel the pending transaction, notify the customer that the payment window has expired, and return them to the payment method selection step to retry.

### 9.5 Professional Assignment

1. Upon successful payment or cash confirmation, the system shall broadcast the booking to nearby, area-eligible, available professionals.
2. The system shall display a broadcasting screen to the customer with a two-minute countdown and progress indicator.
3. The system shall assign the booking to the nearest available professional who accepts within the window.
4. If no professional accepts within the window, the system shall inform the customer and offer a retry.
5. The system shall present pending job requests to eligible professionals, who may accept or reject each request from their dashboard.
6. "Area-eligible" means the professional's registered service area (Section 9.1.6) string-matches the booking's selected service area, and the booking address falls within the professional's registered service radius (km). "Nearest" is determined by straight-line distance between the professional's last published GPS coordinate and the customer's pinned booking location at the moment of broadcast.

### 9.6 Live Tracking

1. Once a booking is accepted, the system shall render a live Leaflet-based tracking map on both the customer's dashboard ("Track Professional") and the professional's dashboard ("Track Customer").
2. The system shall continuously publish the professional's live GPS location and update the professional's marker on both dashboards without recreating the map or route layer.
3. The system shall generate a road-following (not straight-line) route between the professional and the customer, refreshing automatically as the professional moves.
4. The system shall display live distance-remaining and estimated time of arrival (ETA) on both dashboards, computed from the same route data used to draw the route line, and gracefully fall back to a placeholder if routing is temporarily unavailable.
5. The system shall automatically fit the map view to show the professional, the customer, and the full route without requiring manual zoom.
6. The system shall resolve and display the destination building/society name identically on both the customer's and the professional's tracking maps.
7. The system shall automatically remove or collapse the tracking map once arrival is confirmed via OTP, and shall clean up map resources on booking completion or cancellation to prevent memory leaks.
8. If the professional's device denies or revokes location permission while a booking is in progress, the system shall display a clear in-app message to the professional indicating that location sharing is required to continue live tracking, and shall show a "location unavailable" state on both dashboards' tracking maps in place of the professional's marker, without breaking or removing the map itself.

### 9.7 OTP Verification

1. The system shall generate a unique six-digit arrival OTP for each booking, displayed to the customer once the professional is en route.
2. The system shall present the customer a fifteen-minute arrival countdown timer with the option to extend by five minutes or cancel the booking if the professional has not arrived.
3. The system shall require the professional to obtain the arrival OTP from the customer in person and enter it on the professional's dashboard to confirm arrival before service can begin.
4. The system shall generate a separate six-digit completion OTP, obtained from the customer and entered by the professional to confirm that the job is finished.
5. The system shall block progression to payment finalization, review, and QuickCoins crediting until the completion OTP is successfully verified.
6. If the professional enters an incorrect Arrival OTP or Completion OTP, the system shall reject the entry, display an error message, and allow re-entry without limit within the active countdown window; no lockout is imposed on OTP entry attempts in the current phase.

### 9.8 Reviews and Ratings

1. The system shall prompt the customer to rate the completed service on a five-star scale, with an optional free-text comment.
2. The system shall require a star rating (but not a comment) before the review can be submitted.
3. The system shall present the customer with a fixed set of pill-shaped positive and negative feedback tags (for example: well-mannered, punctual, professional, skilled work, good value; late, rude, unprofessional, poor quality, overcharged) plus an "Other" option, in place of an always-visible open comment box.
4. The system shall reveal the free-text comment field only when the customer selects a negative tag or "Other"; selecting only positive tags shall not reveal the comment field. The comment field shall remain optional regardless of which tags are selected.
5. The system shall show the customer an animated confirmation screen after submitting a review, using a positive (happy-face) presentation when no negative tag was selected and a negative (sad-face) presentation when at least one negative tag was selected.
6. Full review detail (star rating, selected tags, and comment) shall be visible to platform administrators only. Professionals shall see only an aggregated count of their own positive tags, with no visibility into star ratings, comments, or negative tags.
7. The system shall automatically increase a professional's consecutive positive-review streak on any review containing no negative tag, and reset the streak to zero on any review containing a negative tag.
8. The system shall automatically credit a professional with a monetary bonus after every fifth consecutive positive review, computed and recorded independently of any client-supplied value.

### 9.16 Professional Discipline and Verification

1. The system shall allow an administrator to impose a time-limited suspension ("ban") on a professional directly from a flagged review, specifying the duration in minutes, hours, days, or weeks.
2. The system shall suggest a default ban duration to the administrator that increases with the professional's prior ban count (first offense: 5 hours; second: 1 day; third and beyond: 5 days), while allowing the administrator to override both the amount and the unit.
3. The Ban action described in 9.16.1 shall not be offered against a review that contains no negative feedback tag, against a review rated 4 or 5 stars, or against a professional who is already under an active ban.
4. A professional under an active ban who is currently signed in shall be automatically signed out as soon as the ban takes effect, without requiring the professional to take any action or refresh the page.
5. A banned professional attempting to sign in shall be blocked and shown the exact date and time their account becomes usable again.
6. The system shall permanently record every ban applied to a professional (duration and time window), viewable by an administrator independently of the professional's current ban status.
7. The system shall allow an administrator to review a professional's uploaded government ID document and profile photo, and to mark the professional's verification status as Approved or Rejected.

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

### 9.12 Professional Dashboard and Job Management

1. The system shall provide a professional-facing dashboard displaying the professional's profile summary, skill, phone, service radius, and area.
2. The system shall provide an online/offline availability toggle and a separate emergency-availability toggle, each independently switchable by the professional.
3. The system shall organize job requests into Pending, Accepted, Arrived, Completed, and Cancelled tabs, each with a live count badge.
4. The system shall require explicit confirmation before a professional accepts, rejects, or cancels an already-accepted booking, warning that frequent cancellations reduce the professional's reliability score.
5. The system shall display an offline banner when the professional is not online, prompting them to go online to receive job requests.
6. The system shall display an upcoming-bookings timeline and a full booking calendar (month view with per-day booking lists).

### 9.13 Professional Earnings and Performance

1. The system shall display an earnings dashboard broken into Today, This Week, and This Month totals.
2. The system shall compute and display: accepted jobs, completed jobs, cancelled jobs, no-show count, reliability score, completion rate, activity score, and an overall professional score.
3. The system shall compute and display an acceptance rate from accepted versus rejected job counts.
4. The system shall assign and display a professional rank badge and a reliability status pill derived from the professional's computed metrics.
5. The system shall display an informational cancellation-warning banner when relevant.
6. The system shall provide a dedicated Professional Profile page allowing the professional to view and edit their name, phone number, skill/trade, experience, service area, and service radius, alongside their performance metrics, badges, and a recent-earnings list computed from booking history.

### 9.14 Achievement System

1. The system shall maintain a dynamic, database-driven achievement engine for professionals, with no hardcoded or manually assigned unlocks.
2. The system shall automatically unlock achievements when a professional meets one of the following conditions, computed live from booking history: first job completed; ten jobs completed; being a highly rated professional; perfect reliability; earnings milestones; and booking streaks. This is the complete set of achievement conditions for the current phase; any additional achievement types require a Product-approved update to this list before implementation.
3. The system shall display an animated popup notification when an achievement is unlocked, and shall provide an in-dashboard and in-profile view of all badges earned.

### 9.15 Admin Portal

1. The system shall provide a Campaign Dashboard allowing administrators to create, edit, search, and filter campaigns by name, service, status, and priority.
2. The system shall present campaign creation and editing through a single modal form covering all campaign fields listed in Section 9.11.1.
3. The system shall provide a User Passes tab listing purchaser, email, campaign, purchase date, expiry date, visits remaining, and status for every purchased pass.
4. The system shall provide an Analytics tab showing a platform-wide statistics overview and a per-campaign breakdown of total purchases, active passes, expired passes, and revenue generated.
5. The system shall provide sign-out and "return to landing page" actions from the admin navigation.
6. The system shall provide a Reviews tab showing, for each review: the customer, the professional, the professional's skill/trade, the specific service booked, the star rating, the selected feedback tags, the comment (if any), and the date, per the tag-visibility rule in Section 9.8.6.
7. The system shall provide a Banned Professionals tab showing, per professional, the total number of bans applied and the full history of each ban's duration and time window, per Section 9.16.6.
8. The system shall provide a Users tab showing customer profile information, QuickCoins balance, and completed-booking count.
9. The system shall provide a Professionals tab showing full professional profile information, computed performance figures, positive-review streak, bonus balance, and the professional's uploaded ID document and profile photo, with actions to approve or reject the professional's verification status per Section 9.16.7.
10. The system shall reflect new reviews, customer account changes, and professional account changes (including bans, verification status, and streak/bonus updates) in the relevant admin tab without requiring the administrator to manually refresh the page.

---

## 10. Non-Functional Requirements

1. **Responsiveness.** The landing page, customer application, and admin portal shall render correctly across 4K, desktop, laptop, tablet, foldable, large-phone, and small-phone form factors in both portrait and landscape orientation, using fluid CSS Grid/Flexbox layouts rather than fixed widths or device-specific overrides, without altering existing desktop layout, color, typography, or business logic.
2. **Mobile navigation.** The landing page, customer application, professional dashboard, professional profile, and admin portal shall provide a hamburger-triggered slide-in navigation drawer on tablet and mobile breakpoints, opening on tap and closing on outside click or item selection, while leaving the desktop horizontal navigation unchanged.
3. **No unintended page-level horizontal scroll.** Admin data tables shall scroll horizontally only within their own container, with table headers remaining visible; the surrounding page shall never scroll sideways.
4. **Touch usability.** Buttons, tabs, and inputs shall be sized appropriately for touch interaction on mobile breakpoints.
5. **Real-time responsiveness.** Booking status changes, job broadcasts, and professional location updates shall propagate to relevant dashboards in real time via Supabase Realtime and Firebase Realtime Database without requiring a manual page refresh.
6. **Resource cleanup.** Leaflet map instances, markers, and route layers used for live tracking shall be properly destroyed on booking completion or cancellation to prevent memory leaks, and development/debug console logging shall be removed from production code paths.
7. **Data integrity for location.** Once a customer has manually pinned a location, that pin shall be the sole source of the booking's stored coordinates; a live-GPS reading shall never silently overwrite a manually pinned location.
8. **Security boundary for admin access.** The admin portal's entry point shall not be linked from customer or professional navigation, shall require its own authentication check against the account's role, and shall not automatically redirect an authenticated non-admin user into another role's application.
9. **Graceful degradation.** If the routing service is temporarily unreachable, the live tracking map shall retain the last known route rather than falling back to a straight-line or dashed placeholder, and distance/ETA values shall fall back to a placeholder rather than causing an error.

---

## 10A. Business Rules

1. **QuickCoins earning rate.** QuickCoins are credited at a rate to be defined by Product.
   - **Status:** OPEN — blocking for SRS Section covering QuickCoins crediting only.
   - **Owner:** Product Manager.
   - **Needed by:** before SRS drafting begins on Section 9.10 (QuickCoins Wallet).
   - **Note to engineering:** do not implement crediting logic against an assumed value; treat this rule as unspecified until this row is updated with a confirmed number.
2. **Professional assignment tie-break.** If two or more eligible professionals accept the same broadcast within the same window, the booking is assigned to whichever acceptance the system receives first (server timestamp order); the losing worker(s) are notified the job is no longer available.
3. **No-show definition and trigger.** A booking is marked "No-Show" when the fifteen-minute arrival window (Section 9.7.2) elapses without a successful Arrival OTP verification and the customer chooses to cancel rather than extend. No-show is attributed to the professional and is included in the professional's no-show count (Section 9.13.2).
4. **Reliability-score cancellation penalty.** Each professional-initiated cancellation of an already-accepted booking, and each recorded no-show, reduces the professional's reliability score by a weighting to be defined by Product.
   - **Status:** OPEN — blocking for SRS Section covering professional reliability scoring only.
   - **Owner:** Product Manager.
   - **Needed by:** before SRS drafting begins on Section 9.13 (Professional Earnings and Performance).
   - **Note to engineering:** do not implement scoring logic against an assumed weighting; treat this rule as unspecified until this row is updated with a confirmed value.
5. **Service Pass expiry.** A purchased Service Pass with visits remaining becomes unusable once its expiry date passes, regardless of the originating campaign's own end date; unused visits are forfeited and are not refunded or converted to QuickCoins.
6. **Address reuse matching.** Reuse of a previously pinned location (Section 9.3.7) is offered on an exact string match of the normalized address (case-insensitive, whitespace-trimmed), not including flat/wing/house/apartment/room number, so that the geocoding-based unit-number tolerance in Section 9.3.5 and the reuse-detection logic in Section 9.3.7 are consistent.

---

## 11. Customer Features

*(This section restates the customer-facing Functional Requirements in Section 9 as a flat feature checklist, for stakeholders who need a scannable summary rather than numbered requirements. Section 9 remains the authoritative source for requirement wording.)*

- Landing page with clear "I Need a Service" and "I Want to Work" entry paths.
- Unified sign-in/sign-up with role selection.
- Home page with search, category browsing, and platform statistics.
- Category-filtered, sortable service listings with professional identity hidden until booking confirmation.
- Full booking flow: service, date/time, address, service area, notes, live price summary.
- Address validation against selected service area with inline error messaging.
- Building-level address geocoding and permanent, reusable location pinning with exact-match reuse detection.
- Google Pay (QR) and Cash payment options.
- Automated nearest-professional broadcast and assignment with a retry path on timeout.
- Live "Track Professional" map with road-following route, live distance remaining, and ETA.
- Fifteen-minute arrival window with extend/cancel options.
- Two-step OTP verification (arrival and completion).
- Post-completion review and star rating.
- "My Bookings" history with status filters and a clear-history option.
- "My Account" page for account details, booking history, and password change.
- Quick Wallet showing QuickCoins balance, lifetime earnings, redeemed amount, and completed-booking count.
- Automatic QuickCoins crediting with a dedicated reward confirmation screen.
- Offers page listing active, time-limited Service Pass campaigns with countdown.
- "My Passes" page listing purchased passes.
- In-app professional registration flow (become a professional from within the customer application).
- Emergency-hours banner indicating restricted service availability during defined hours.

---

## 12. Professional Features

*(This section restates the professional-facing Functional Requirements in Section 9 as a flat feature checklist, for stakeholders who need a scannable summary rather than numbered requirements. Section 9 remains the authoritative source for requirement wording.)*

- Role-specific sign-up with skill/category, work radius, service area, experience, government ID upload, and profile photo upload.
- Online/offline availability toggle and independent emergency-availability toggle.
- Job request tabs: Pending, Accepted, Arrived, Completed, Cancelled, each with live counts.
- Accept/reject confirmation modals, and a cancellation-confirmation modal warning of reliability impact.
- Offline banner prompting the professional to go online.
- Upcoming-bookings timeline and a full booking calendar with per-day detail.
- "Track Customer" live map with road-following route, live distance to customer, and ETA.
- Continuous live GPS publishing while online.
- Arrival OTP and Completion OTP verification modals.
- Earnings dashboard (today, this week, this month).
- Performance scorecard: accepted, completed, cancelled, no-show counts; reliability score; completion rate; activity score; overall professional score; acceptance rate.
- Professional rank badge and reliability status pill.
- Dynamic, database-driven achievement/badge system with unlock popups.
- Dedicated Professional Profile page for viewing/editing personal and professional details, viewing performance metrics, badges, and recent earnings history.

---

## 13. Admin Features

*(This section restates the admin-facing Functional Requirements in Section 9.15 as a flat feature checklist, for stakeholders who need a scannable summary rather than numbered requirements. Section 9 remains the authoritative source for requirement wording.)*

- Hidden, separately authenticated admin entry point checked against account role.
- Campaign Dashboard: create, edit, search, and filter campaigns (by name, service, status, priority).
- Single create/edit modal covering all campaign attributes (title, service, description, price, visits, validity, priority, start/end dates, emergency-included flag, priority-booking flag, status).
- User Passes tab: purchaser, email, campaign, purchase date, expiry, visits, status.
- Analytics tab: platform-wide overview plus per-campaign purchases, active passes, expired passes, and revenue generated.
- Sign-out and "Return to Landing" navigation actions.

---

## 14. Booking Workflow

*(This section restates the relevant Functional Requirements from Section 9 as a sequential end-to-end flow, for readers tracing the booking lifecycle rather than looking up individual requirements.)*

1. Customer logs in.
2. Customer selects a service, date, time slot, and enters their address and service area.
3. System validates the address against the selected service area.
4. System geocodes the validated address.
5. System either reuses the customer's previously saved location pin (on an exact address match) or prompts the customer to pin their exact building location on the map.
6. Customer reviews the price summary and proceeds to payment (Google Pay or Cash).
7. On successful payment/cash confirmation, the system broadcasts the booking to nearby eligible professionals.
8. A nearby professional accepts the booking within the acceptance window; if none accepts, the customer is offered a retry.
9. The customer's "Track Professional" map activates, showing the live route and ETA as the professional travels.
10. The professional arrives; the customer shares the Arrival OTP, which the professional enters to confirm arrival.
11. Service is performed.
12. The customer shares the Completion OTP, which the professional enters to confirm completion.
13. Payment is finalized.
14. QuickCoins are automatically credited to the customer's wallet.
15. The customer is prompted to leave a star rating and optional review.
16. Any newly qualifying professional achievements are unlocked and displayed.

---

## 15. Tracking Workflow

*(This section restates the relevant Functional Requirements from Section 9.6 as a sequential end-to-end flow, for readers tracing the tracking lifecycle rather than looking up individual requirements.)*

1. Once a booking is accepted, both the customer's ("Track Professional") and the professional's ("Track Customer") live maps activate.
2. The professional's device continuously publishes GPS coordinates while online, using continuous location watching rather than one-time fixes.
3. A road-following route is generated between the professional's live location and the customer's pinned location and rendered as a solid route line on both dashboards.
4. As the professional's location updates, the professional's marker moves and the route refreshes automatically without recreating the map, markers, or route layer; the customer's marker remains fixed.
5. Live distance-remaining and ETA are derived from the same route response used for the route line and displayed on both dashboards, falling back to a placeholder if routing is temporarily unavailable.
6. The map view automatically fits to show both parties and the full route.
7. The destination building/society name is reverse-geocoded from the pinned coordinates and shown identically on both dashboards.
8. The tracking map is automatically removed or collapsed once the Arrival OTP is verified, and all map resources are cleaned up on booking completion or cancellation.

---

## 16. OTP Verification Workflow

*(This section restates the relevant Functional Requirements from Section 9.7 as a sequential end-to-end flow, for readers tracing the OTP lifecycle rather than looking up individual requirements.)*

1. The system generates a unique six-digit Arrival OTP for the booking and displays it to the customer once a professional is en route.
2. When the professional physically arrives, the customer verbally shares the Arrival OTP; the professional enters it into the Arrival OTP modal on their dashboard to confirm arrival.
3. Successful arrival verification collapses the live tracking map and allows the service to begin.
4. Upon job completion, the system provides a Completion OTP; the customer shares it with the professional, who enters it into the Completion OTP modal to confirm the job is finished.
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

- The customer application displays an emergency-hours banner indicating that only Electrician and Plumber services are available during defined emergency hours, shown as 8:30 PM–8:30 AM IST. This is the single canonical emergency-hours window for the product.
- Professionals may opt in to emergency-hours availability. The professional sign-up flow (`auth.html`) conditionally presents an "Available During Emergency Hours" checkbox for eligible skill categories, labeled with the canonical 8:30 PM–8:30 AM window; the in-app professional registration flow (`index.html`) presents an equivalent "Available for Emergency" checkbox at sign-up time, using the same wording and the same window. The 9:30 PM–9:30 AM label and the "(24/7)" phrasing found in the current source files are known defects to be corrected in implementation to match this canonical window before SRS handoff.
- Independently of the sign-up-time preference, the professional dashboard provides a live "Emergency" toggle that lets an onboarded professional switch their real-time emergency availability on or off.
- Administrators can flag a campaign/Service Pass as including emergency service coverage.

---

## 20. Notifications

- Real-time booking status updates (broadcast, acceptance, arrival, completion) are delivered via Firebase Realtime Database, keeping the customer's and professional's dashboards synchronized without a manual refresh.
- In-app toast notifications surface transient system messages (for example, upload confirmations and "coming soon" notices for unimplemented social sign-in options).
- Achievement unlocks are surfaced to professionals through an animated popup notification at the moment they are earned.
- The professional dashboard reflects new job requests and status changes in real time.

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
| Live Location | `navigator.geolocation.watchPosition()` for continuous professional GPS publishing |
| Notifications / Real-time Sync | Firebase Realtime Database |

This section is intentionally limited to a high-level technology overview; implementation-level architecture belongs in a separate `Architecture.md`.

---

## 22A. Constraints

1. **Third-party service dependency.** Live tracking, routing, and geocoding depend on Geoapify and Nominatim availability and rate limits; real-time sync depends on Firebase Realtime Database and Supabase Realtime availability. Outages in these services degrade tracking/notification functionality as described in Section 9.6.4 and NFR 9, but the product has no fallback provider.
2. **Client-side business logic.** In the current phase, booking validation, professional-assignment logic, and QuickCoins crediting run client-side rather than in a hardened backend; this is a known constraint being addressed in Phase 6 (Section 21.2) and should not be treated as a production-security posture.
3. **Browser geolocation dependency.** Live tracking requires the professional's browser/device to grant location permission continuously; there is no server-side or SMS-based location fallback if permission is denied or revoked mid-booking.
4. **No modularized codebase yet.** The frontend is currently monolithic per-role HTML files rather than a modular component structure (Phase 5, Section 21.1); any SRS/architecture work done against the current codebase should account for this pre-refactor state.
5. **Government ID data handling.** Aadhaar and PAN documents are collected at professional onboarding (Section 9.1.6, 9.1.8) but the current source files define no retention, encryption-at-rest, or deletion policy for this data. This is flagged as an open compliance item; a data-handling policy must be defined (likely in Architecture.md or a dedicated privacy addendum) before production launch.

---

## 23. Project Scope

The current, implemented scope of QuickFix covers:

1. Customer-facing service discovery, booking, payment, tracking, OTP verification, review, wallet, offers, and account management.
2. Professional-facing job management, live tracking, earnings, performance analytics, achievements, and profile management.
3. A complete, separately secured admin portal for campaign management, purchased-pass oversight, and analytics.
4. End-to-end live tracking (Phases 4.1–4.9): tracking maps, address validation and geocoding, road-route generation, live professional movement, live ETA/distance, permanent location pinning, Geoapify integration, and tracking-system stabilization/resource cleanup.
5. A fully responsive UI across desktop, tablet, foldable, and mobile devices, including hamburger navigation on the landing page, customer application, and admin portal.

---

## 24. Out of Scope

The following are explicitly identified in the project roadmap as not yet implemented and are out of scope for the current version:

1. Splitting the codebase into a fully modularized, production-grade file/folder structure (planned for Phase 5).
2. Hardened Supabase Row Level Security, backend-side business logic, secure API key handling, and query optimization for production-scale concurrency (planned for Phase 6).
3. QuickCoins redemption against real offers, expanded promotional campaign tooling, and a broader offers ecosystem (planned for Phase 7).
4. Functional Google and Phone OTP social sign-in (currently displayed as "coming soon" placeholders with no backing implementation).
5. Any features, workflows, or data not represented in the attached source files.
6. Refund processing, dispute resolution, and dedicated customer-support/complaint-handling tooling — none of these are represented in the attached source files and are out of scope for the current version.

---

## 25. Success Metrics & Acceptance Criteria

### 25.1 Success Metrics

1. ≥90% of started bookings reach payment confirmation without customer drop-off due to address-validation errors.
2. ≥95% of broadcast bookings are accepted by a professional within the acceptance window (Section 9.5.2), without requiring a retry.
3. Average time from booking confirmation to professional acceptance is under a target to be defined by Product.
   - **Status:** OPEN — not blocking for implementation (this is a monitoring target, not a feature dependency), but should be confirmed before this metric is reported against.
   - **Owner:** Product Manager.
   - **Needed by:** before this metric is used in any launch or post-launch reporting.
4. ≥98% of completed bookings result in a successful arrival + completion OTP verification pair with no manual override.
5. Month-over-month repeat-booking rate among customers holding an active Service Pass or nonzero QuickCoins balance is higher than among customers with neither.

### 25.2 Acceptance Criteria

1. A customer can complete an entire booking — from service selection through payment, professional assignment, live tracking, arrival OTP, completion OTP, QuickCoins crediting, and review — without needing a phone call or manual intervention.
2. Address validation correctly blocks bookings where the entered address does not match the selected service area, and correctly geocodes and pins valid addresses at building level.
3. A booking broadcast reaches nearby eligible professionals and is either accepted within the acceptance window or clearly reported to the customer as unaccepted, with a retry path offered.
4. Live tracking maps on both the customer and professional dashboards remain synchronized in real time, with distance and ETA values updating as the professional moves, and degrade gracefully (rather than breaking) if the routing service is briefly unavailable.
5. Both the arrival and completion OTP checkpoints reliably gate progression of the booking lifecycle, preventing payment finalization or QuickCoins crediting from occurring without verification.
6. QuickCoins are credited automatically and accurately for every booking marked Completed, with balance and lifetime-earned figures remaining consistent in the Quick Wallet view.
7. Purchased Service Passes are correctly tracked for visit consumption and correctly reflected in both the customer's "My Passes" page and the admin portal's User Passes tab.
8. Professional performance metrics (reliability score, completion rate, activity score, professional score, acceptance rate) are computed consistently from booking history and displayed identically on the professional dashboard and professional profile page.
9. The admin portal remains inaccessible to non-admin accounts and is not discoverable through normal customer/professional navigation.
10. All core screens (landing, customer application, professional dashboard, professional profile, admin portal) render without layout breakage, clipped content, or unwanted horizontal scrolling across desktop, tablet, and mobile viewports.