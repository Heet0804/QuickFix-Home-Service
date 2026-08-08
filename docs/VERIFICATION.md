# Phase 5.8 — Final Verification Checklist
QuickFix — pre-push, end-to-end sign-off

Run through every item below against a real Supabase project before pushing.
Check each box only after manually confirming it in the browser.

## Landing (landing.html)
- [ ] Loads with no console errors
- [ ] "I Need a Service" / "I Want to Work" both route to auth.html with correct ?role=
- [ ] Logged-in session shows correct "My Dashboard" link (customer vs worker)
- [ ] Triple-shift-click on logo routes to admin.html

## Auth (auth.html)
- [ ] User signup creates a row in `users` and redirects to index.html
- [ ] Worker signup uploads doc + photo, creates a row in `workers`, redirects to worker-dashboard.html
- [ ] Login (both roles) redirects correctly
- [ ] Validation errors (missing fields, short password) surface via markErr/err-banner

## Customer (index.html)
- [ ] Full booking flow: category → worker list → booking → OTP → completion → review
- [ ] Live tracking map renders and updates
- [ ] QuickCoins wallet balance updates after a completed booking
- [ ] Service Pass purchase (QR flow) activates a pass in `user_passes`
- [ ] Campaign popup appears once per session for eligible users

## Worker (worker-dashboard.html / worker-profile.html)
- [ ] Availability + emergency toggles persist
- [ ] Pending → Accept/Reject → Arrived (OTP) → Completed flow works end-to-end
- [ ] Earnings, performance grid, and achievements reflect real data
- [ ] Booking calendar renders bookings on correct dates
- [ ] Profile edit/save persists to `workers`

## Admin (admin.html)
- [ ] Admin-only gate blocks non-admin accounts
- [ ] Create/Edit/Delete campaign works and reflects in customer-facing offers
- [ ] User Passes and Analytics tabs load real data

## Cross-cutting
- [ ] No inline `<style>`/`<script>` remains in any HTML file (Phase 5.2 regression check)
- [ ] All `js/common/*.js` load in the documented order on every page that needs them
- [ ] No `console.log`/debug output in production JS
- [ ] `sql/` package runs clean on a fresh Supabase project in documented order

## Sign-off
| Field | Value |
|---|---|
| Verified by | _____________ |
| Date | _____________ |
| Result | ☐ Pass ☐ Pass with known gaps (see docs/ROADMAP.md §7 risks) |