# User Guide
## QuickFix — On-Demand Home Services Marketplace

| Field | Detail |
|---|---|
| Document Type | End-User Guide |
| Basis | Direct inspection of the QuickFix application (`landing.html`, `auth.html`, `index.html`, `worker-dashboard.html`, `worker-profile.html`, `admin.html`), cross-referenced against `docs/PRD.md`, `docs/SRS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/SECURITY.md`, and `docs/TESTING.md` |
| Critical Constraint | This guide describes only what a user can actually do in the application today. Where a screen, button, or field exists but does not lead to a working outcome, this is stated plainly rather than described as a normal feature. Planned features that are not yet available are listed only in Section 9, Future Features. |

---

## 1. Introduction

### 1.1 Purpose of QuickFix

QuickFix is an on-demand home-services marketplace. It connects customers who need a household service — electrician, plumber, carpenter, painter, cleaner, AC repair, mason, pest control, or househelp — with verified local workers who can accept, travel to, and complete the job, with live tracking and OTP-confirmed service delivery.

### 1.2 Who Should Use This Guide

This guide is for three kinds of people:

- **Customers** who want to book a home service.
- **Workers** who want to accept and complete service jobs.
- **Administrators** who manage promotional campaigns on the platform.

### 1.3 Supported Users

QuickFix supports three account roles, each with its own application:

| Role | Application | Entry Point |
|---|---|---|
| Customer | Customer app | `index.html`, reached after login |
| Worker | Worker dashboard and profile | `worker-dashboard.html`, `worker-profile.html`, reached after login |
| Admin | Admin portal | `admin.html`, a separate, unlinked entry point (Section 5.1) |

---

## 2. Getting Started

### 2.1 Opening the Application

QuickFix opens on a landing page with two clear entry paths: **"I Need a Service"** for customers and **"I Want to Work"** for workers. Selecting either path takes you to the sign-in/sign-up screen.

### 2.2 Creating an Account

1. From the landing page, choose whether you are signing up as a customer or a worker.
2. On the sign-in/sign-up screen, switch to the sign-up panel for your role.
3. **Customer sign-up** requires: first name, last name (optional), email, phone number, and a password of at least 6 characters.
4. **Worker sign-up** requires: full name, phone, email, your skill/category, your work radius in kilometers, your service area, years of experience, a government ID document (JPG, PNG, or PDF, up to 5MB), a profile photo (JPG or PNG, up to 5MB), and a password of at least 6 characters. If you selected Electrician or Plumber as your skill, you will also see a checkbox to opt in to emergency-hours availability.
5. Submit the form. On success, you are signed in and taken to your app.

**Worker account status.** After signing up, your worker account is immediately usable — you can log in and reach your dashboard right away. QuickFix describes worker verification as a manual review process that takes place after signup, but there is currently no in-app indicator that shows whether this review is complete, and nothing in the app prevents you from going online and accepting jobs before it happens.

### 2.3 Logging In

Enter your email and password on the sign-in screen. On success, you are taken directly to your role's application (customer, worker, or admin). If your credentials are incorrect, or your email has not been confirmed, a message explains the specific problem.

If you forget your password, use the "Forgot Password" option on the login screen. You will receive a password-reset email; following its link returns you to the login screen to set a new password.

### 2.4 Logging Out

Every app has a Logout action in its navigation. Logging out ends your session and returns you to the login screen.

---

## 3. Customer Guide

### 3.1 Browsing Services

The customer home page shows a search bar, category browsing, and platform statistics. Categories are shown with fixed, category-based pricing. Worker identity is not shown until after you confirm a booking.

### 3.2 Booking a Worker

1. Select a service category and sub-service.
2. Choose a date and a time slot. Time slots run from 8:30 AM to 8:30 PM in 15-minute increments.
3. Enter your address and select your service area from the list.
4. QuickFix checks that your address falls within the service area you selected. If it does not, or if your address cannot be located, you will see an inline message and the booking will not proceed until this is resolved.
5. If you have booked from this exact address before, you will be offered the option to reuse your saved pin. Otherwise, you will be shown a map and asked to drag a pin to your exact building location. This pin is saved for future bookings to the same address.
6. Review the price summary, which includes a small booking fee, and proceed.

### 3.3 Selecting Service Area

Your service area determines which workers are eligible for your booking. Eligibility is based on distance from the service area's center point to each worker's location, not your exact address pin, so choose the service area that most closely matches your address.

### 3.4 Choosing Date and Time

Standard bookings can be scheduled for any available 15-minute slot between 8:30 AM and 8:30 PM. During emergency hours (Section 3.11), the time field is hidden and your booking is scheduled for right now.

### 3.5 Payment

You can pay with:

- **Google Pay**, shown as a QR code you scan to pay. You have 5 minutes to complete payment before the session expires.
- **Cash**, which confirms immediately. If you pay with cash, the worker will not begin the job until you have shared the Arrival OTP with them.

If you hold an active, unexpired Service Pass covering the selected category, the price is shown as ₹0 and no payment step is needed.

Once payment is confirmed, your booking is broadcast to nearby eligible workers. If no worker accepts within the acceptance window, you will be offered the option to try again.

### 3.6 Booking Timeline

Each booking in "My Bookings" shows a step-by-step timeline: Created, Assigned, Accepted, On The Way, Arrived, Started, Completed, and Review. If a booking is cancelled, the timeline shows the steps completed before cancellation, followed by a cancellation marker, and stops there.

### 3.7 Tracking

Once a worker accepts your booking, a "Track Worker" map appears showing the worker's live location, a road-following route to your address, and an estimated distance and time of arrival. The map updates automatically as the worker moves — you do not need to refresh the page.

For bookings scheduled more than 10 minutes in the future, the tracking map and the worker's identity remain hidden behind a placeholder until 10 minutes before your scheduled time.

If the routing service is temporarily unavailable, the map keeps showing the last known route rather than disappearing or showing an error.

### 3.8 OTP Verification

QuickFix uses a two-step OTP process to confirm service delivery:

1. **Arrival OTP.** When the worker arrives, you share the six-digit Arrival OTP shown in your app. The worker enters it on their device to confirm arrival and begin work.
2. **Completion OTP.** When the job is finished, you share the six-digit Completion OTP shown in your app. The worker enters it to confirm the job is complete.

If a worker does not arrive within 15 minutes of being assigned, you are given the choice to extend the window by 5 minutes or cancel the booking.

There is currently no limit on how many times an incorrect OTP can be entered.

### 3.9 Reviews

After a booking is marked Completed, a "Rate" option appears. You must leave a star rating (1 to 5 stars). Instead of an open text box, you'll see a set of tappable tags describing what went well — punctual, well-mannered, professional, skilled work, good value, and similar — or what didn't — late, rude, unprofessional, poor quality, overcharged, and similar — plus an "Other" option.

If you select only positive tags, that's all you need to do — no comment box appears. If you select any negative tag, or "Other," a comment box appears so you can explain further; writing something there is still optional.

After you submit, you'll see a short animated confirmation — a happy face if your feedback was positive, or a sad face if you flagged a problem — before returning to your dashboard. A booking can only be rated once.

Your full review (rating, tags, and comment) is seen only by QuickFix's platform administrators. The worker who did the job never sees your rating, your comment, or any negative tag you selected — they only ever see a running count of positive tags they've received overall.

### 3.10 Wallet

The Quick Wallet, reachable from the main navigation, shows your current QuickCoins balance, lifetime coins earned, amount redeemed, and total completed bookings.

### 3.11 QuickCoins

QuickCoins are automatically credited to your wallet the moment a booking you have open in your app is marked Completed. A reward screen shows the coins you just earned and your updated balance. QuickCoins are virtual reward points — they cannot be withdrawn or converted to cash, and there are currently no redemption offers available; the app encourages you to keep collecting them for future offers.

### 3.12 Emergency Booking

During emergency hours (8:30 PM to 8:30 AM), an emergency-hours banner appears and only Electrician and Plumber services are shown, since these are the only categories eligible during this window. Emergency bookings are matched only to workers who have opted in to emergency availability, and the price includes an emergency surcharge.

### 3.13 Booking History

"My Bookings" lists all of your bookings, organized into status tabs. You can clear your booking history from view at any time; this hides the bookings from your list but does not delete them from QuickFix's records, and you will be asked to confirm before this happens.

### 3.14 Service Passes and Offers

Active, time-limited Service Pass campaigns appear as a countdown popup (once per login) and on a dedicated Offers page. Purchasing a pass is a separate, Google-Pay-only payment step from regular booking payment. Purchased passes are listed on your "My Passes" page, and visits against a pass are used up automatically as you make eligible bookings — you do not need to redeem anything manually.

### 3.15 Becoming a Worker From the Customer App

The customer app includes a form for registering as a worker without leaving the app, asking for your category, experience, price, bio, and identity documents. **At present, submitting this form does not create a working worker account.** Only your name, phone number, and role are saved; none of the professional details you enter are stored, and the resulting record does not appear in the system that assigns jobs to workers, so you cannot be booked through this path. If you want to work on QuickFix today, sign up through the normal worker sign-up flow described in Section 2.2 instead.

---

## 4. Worker Guide

### 4.1 Login

Log in with your worker email and password from the shared login screen. You are taken directly to your worker dashboard.

### 4.2 Availability

Use the availability toggle on your dashboard to go online or offline. You must be online to receive job broadcasts. If you are offline, a banner reminds you to go online. Accepting a job automatically takes you offline; completing a job automatically brings you back online.

A separate toggle lets you opt in or out of emergency-hours availability at any time, independent of the preference you set at sign-up.

### 4.3 Dashboard

Your dashboard organizes jobs into five tabs — Pending, Accepted, Arrived, Completed, and Cancelled — each showing a live count. It also includes an upcoming-bookings list grouped by date, a full booking calendar, and your performance figures (Section 4.9).

### 4.4 Accepting Jobs

Tap Accept on a Pending job and confirm. Once accepted, the job moves to your Accepted tab, you are set unavailable for new jobs, and your earnings for the job are calculated. If another worker accepts the same job first, you will see a message that it has already been taken.

### 4.5 Rejecting Jobs

Tap Reject on a Pending job and confirm. The job is removed from your list.

You can also cancel a job you have already accepted, but a confirmation modal warns you that this affects your reliability score before you proceed.

### 4.6 GPS Tracking

While you have a job in Accepted, Worker on Way, or Arrived status, your device continuously shares your location so the customer can see your live position on their tracking map. This requires you to grant location permission. If you deny permission, tracking stops and you'll see a message asking you to enable it; there is no alternative way to share your location if you decline. If your device reports a temporary GPS error (not a permission denial), QuickFix retries automatically after a few seconds.

Your own "Track Customer" map shows the customer's location, a route to their address, and distance/ETA, the same way it appears on the customer's side.

### 4.7 Arrival OTP

When you reach the customer's location, tap "Mark Arrived" to open the Arrival OTP entry screen. Ask the customer for the six-digit Arrival OTP shown on their app and enter it. On success, the job moves to Arrived status, the tracking map closes, and you can begin work.

### 4.8 Completion OTP

When the job is finished, ask the customer for the six-digit Completion OTP shown on their app and enter it. On success, the job is marked Completed and you are automatically set available again for new jobs.

There is currently no limit on how many times an incorrect OTP can be entered.

### 4.9 Earnings

Your dashboard shows earnings totals for today, this week, and this month, calculated from your completed jobs. It also shows your acceptance rate, a rank badge (Unranked, Bronze, Silver, or Gold, based on your worker score), and a reliability status pill. If you have several recent cancellations, a warning banner appears, with stronger wording above three cancellations.

Your dashboard also shows your **positive review streak** — a running count of consecutive customer reviews with no negative feedback — and a **bonus balance**. Every fifth consecutive positive review earns you an automatic bonus credit, shown in your bonus balance.

### 4.12 Account Suspension

If your account is suspended by an administrator (typically following a negative customer review), you'll be signed out immediately if you're logged in when it happens, and you won't be able to log back in until the suspension period ends. If you try to log in while suspended, you'll see the exact date and time you can try again.

### 4.13 Verification Status

An administrator reviews the government ID document and profile photo you submitted at sign-up and marks your account as Approved or Rejected. There is currently no in-app indicator showing you this status directly — see Section 2.2's note that your account remains usable regardless of where this review stands.

### 4.10 Achievements

QuickFix has a badge/achievement system covering job counts, ratings, reliability, activity, and overall worker score. Newly earned achievements are shown with an animated unlock popup shortly after you load your dashboard, and unlocked badges are displayed on your profile page.

### 4.11 Profile

Your Worker Profile page (separate from the dashboard) shows the same performance figures, your badges, and a recent-earnings history from your last completed jobs. From here you can edit your name, phone, skill, experience, area, and work radius (radius must be between 1 and 100 km).

---

## 5. Admin Guide

### 5.1 Login

The admin portal is reached at its own address and is not linked from the customer or worker apps. Log in with an email that has been granted admin access. If your account is not an active admin account, you will be signed out and shown an "Access Denied" message for a few seconds before the login screen reappears.

### 5.2 Dashboard

The admin portal provides campaign management, a listing of purchased Service Passes (purchaser, campaign, purchase date, expiry, visits remaining, status), and analytics.

### 5.3 Campaign Management

You can create, edit, search, and filter Service Pass campaigns by name, service, status, and priority. A single form covers every campaign attribute: title, service, description, price, number of included visits, validity period, display priority, start and end dates, whether emergency service is included, whether the pass grants priority booking, and active/inactive status. Deleting a campaign asks for confirmation first.

### 5.4 Analytics

The analytics view shows platform-wide totals — total campaigns, total passes sold, active and expired pass counts — along with per-campaign purchases, active/expired counts, and revenue.

---

## 6. Common Features

### 6.1 Navigation

On tablet and mobile screens, every app provides a hamburger menu that opens a slide-in navigation drawer, closing when you tap outside it or select an item. On larger screens, navigation is shown as a standard horizontal menu.

### 6.2 Notifications

Job broadcasts, acceptances, arrivals, and completions update your dashboard automatically. Workers see these updates arrive live without refreshing the page. On the customer side, the app checks for updates on a short interval rather than pushing them instantly, so there may be a brief delay before a change appears.

Achievement unlocks appear as an animated popup on the worker dashboard shortly after the achievement is earned.

### 6.3 Toast Messages

Brief on-screen messages ("toasts") confirm actions and report errors throughout the app — for example, confirming a successful upload or explaining why a booking could not proceed. In one specific case — a failed document upload during worker sign-up — you will also see a browser pop-up alert in addition to the toast, rather than only a toast.

### 6.4 Responsive Behaviour

QuickFix is designed to work across screen sizes, from large desktop monitors down to small phones, in both portrait and landscape orientation. On smaller screens, wide tables (such as the admin portal's data tables) scroll within their own area so the rest of the page stays in place.

---

## 7. Troubleshooting

### 7.1 Login Issues

| Problem | What It Means |
|---|---|
| "Invalid login credentials" | The email or password you entered does not match an existing account. |
| "Email not confirmed" | You need to confirm your email address before you can sign in. |
| Signed out immediately after logging in to `admin.html` | Your account does not have active admin access. |

### 7.2 Booking Issues

| Problem | What It Means |
|---|---|
| "Unable to locate this address" | Your address could not be matched to a real location. Try entering a more complete or standard address. |
| "This address does not belong to the selected area" | Your address was found, but it falls outside the service area you selected. Choose a different area or correct your address. |
| No eligible worker found | There is no available worker of the requested type within range of your selected area right now. |
| No worker accepted your booking | No nearby worker accepted within the acceptance window. You can try again from the prompt shown. |
| Payment session expired | You did not complete payment within the allowed time (5 minutes for a booking, 2 minutes for a Service Pass). Start the booking or purchase again. |

### 7.3 Tracking Issues

| Problem | What It Means |
|---|---|
| Route or ETA not updating | The routing service may be temporarily unavailable. The map keeps showing the last known route rather than failing. |
| Tracking map not visible yet | If your booking is scheduled more than 10 minutes ahead, tracking stays hidden until 10 minutes before your scheduled time. |

### 7.4 GPS Issues

| Problem | What It Means |
|---|---|
| Worker's location not updating (worker's own view) | Location permission may have been denied. Check your browser's location settings and grant permission. |
| Worker's location not updating (customer's view) | This can also mean the worker's device is temporarily unable to get a GPS fix; QuickFix retries automatically on the worker's side. |
| Geolocation not working at all | Confirm the site is being accessed over a secure connection (HTTPS or `localhost`); the Geolocation API generally requires this. |

### 7.5 Supabase Issues

| Problem | What It Means |
|---|---|
| Nothing loads / login never completes | QuickFix depends on a live connection to its backend at all times; there is no offline mode. Check your internet connection. |
| Actions fail with a generic error toast | This usually means the underlying save failed. Try the action again; if it persists, contact support. |

---

## 8. Frequently Asked Questions

**Can I choose which worker does my job?**
No. Workers are assigned automatically based on distance, availability, and skill match. Worker identity is only revealed once a worker has accepted your booking.

**Why do I need to share an OTP with the worker instead of the worker sharing one with me?**
The Arrival and Completion OTPs are generated for your booking and shown in your app. You read them to the worker so they can confirm, on their end, that they have genuinely arrived and completed the job.

**Can I cancel a booking after a worker has accepted it?**
Yes, up until the point the booking details are revealed to you, per your app's cancellation rules. As a worker, cancelling an already-accepted job is possible but affects your reliability score.

**What happens to my QuickCoins? Can I spend them?**
QuickCoins are virtual reward points, automatically credited after each completed booking. They cannot be withdrawn or converted to cash, and there are no redemption offers available yet.

**Why doesn't the "become a worker" form inside the customer app turn me into a working worker?**
This in-app path currently only stores your name, phone number, and role — none of the professional details or documents you submit are saved, and the result cannot be assigned bookings. Use the dedicated worker sign-up flow instead (Section 2.2).

**Is there a limit on how many times I can retry an OTP?**
No. Both Arrival and Completion OTPs currently accept unlimited re-entry attempts.

**Can I use QuickFix without an internet connection?**
No. QuickFix requires a live connection to its backend services at all times; there is no offline mode.

**Does QuickFix confirm a worker's identity or documents before I book them?**
Worker sign-up collects a government ID document and a profile photo, and QuickFix describes verification as a manual process. Administrators can review these documents and mark a worker Approved or Rejected from the admin portal, but there is currently no visible indicator in the customer or worker app confirming whether a specific worker has completed this review.

**What happens if a worker gets a bad review?**
An administrator may choose to suspend the worker's account for a period of time — the length can increase if the same worker is suspended repeatedly. A suspended worker is signed out automatically and cannot log back in until the suspension ends.

**Can a worker be rewarded for good reviews?**
Yes. A worker's dashboard tracks a consecutive positive-review streak, and every fifth consecutive positive review earns an automatic bonus.

---

## 9. Future Features

The following are planned but not currently available. They are not accessible in the application today.

- **Google and Phone-OTP sign-in.** Buttons for both exist on the login screen, but they currently only show a "coming soon" message.
- **QuickCoins redemption.** There is currently no way to redeem QuickCoins against real offers; this is planned for a future release.
- **A functioning in-app worker registration path.** The in-app "become a worker" form in the customer app is planned to eventually create a fully working worker account; today it does not (Section 3.15).
- **Consolidated OTP handling.** A single, unified OTP verification process is planned to replace the two separate ones that currently exist behind the scenes.
- **Stronger backend protections and server-side validation** for booking pricing, worker assignment, and QuickCoins crediting, moving this logic off the customer's device and onto a hardened backend.

---

## Document Status

This guide was produced by direct inspection of the QuickFix application and cross-referenced against `PRD.md`, `SRS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `DEPLOYMENT.md`, `ROADMAP.md`, `CHANGELOG.md`, `SECURITY.md`, and `TESTING.md`. No feature or workflow is described as available unless it was directly confirmed as implemented in these documents. Where a screen or form exists but does not lead to a working outcome — most notably the in-app worker registration path — this is stated explicitly rather than presented as a normal, working feature.