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
- [ ] Rating modal shows star input plus pill tags (no open comment box by default)
- [ ] Selecting only positive tags keeps the comment box hidden; selecting any negative tag or "Other" reveals it
- [ ] Comment box is always optional to fill, regardless of which tags are selected
- [ ] Submitting a review with a negative tag shows the animated sad-face outcome modal; submitting with only positive tags (or none) shows the animated happy-face modal
- [ ] Clicking "Continue" on the outcome modal returns the user to the Home/Dashboard tab

## Worker (worker-dashboard.html / worker-profile.html)
- [ ] Availability + emergency toggles persist
- [ ] Pending → Accept/Reject → Arrived (OTP) → Completed flow works end-to-end
- [ ] Earnings, performance grid, and achievements reflect real data
- [ ] Booking calendar renders bookings on correct dates
- [ ] Profile edit/save persists to `workers`
- [ ] Positive streak increments on a review with no negative tags, resets to 0 on a negative tag (verify against `workers.positive_streak` directly)
- [ ] Bonus is credited every 5th consecutive positive review, logged in `worker_bonuses`, and reflected in `workers.bonus_balance` on the dashboard
- [ ] A worker who is currently logged in gets force-signed-out within seconds of an admin ban being applied (test via Realtime, not just the poll fallback)
- [ ] A banned worker attempting to log in sees an animated cross modal (not a native `alert()`) stating the exact unban time
- [ ] A banned worker cannot log in again until `banned_until` has passed

## Admin (admin.html)
- [ ] Admin-only gate blocks non-admin accounts
- [ ] Admin login never creates or leaves a stray row in the customer `users` table
- [ ] Create/Edit/Delete campaign works and reflects in customer-facing offers
- [ ] User Passes and Analytics tabs load real data
- [ ] Reviews tab shows Job (worker skill) and Service (booked item) columns, correctly resolved from the linked booking
- [ ] Reviews tab "Ban" action is hidden for: an already-banned worker (shows "Banned" badge), a review with no negative tags, and a 4–5 star review
- [ ] Ban modal duration picker accepts minutes/hours/days/weeks; suggested amount escalates correctly on repeat bans (1st: 5 hrs, 2nd: 1 day, 3rd+: 5 days)
- [ ] Confirming a ban actually updates `workers.banned_until`/`ban_count`/`last_ban_duration_label` (verify via a fresh `SELECT`, not just the success modal) and logs a row in `worker_bans`
- [ ] Ban/verification confirmations show an animated tick/cross modal — no native `alert()` for these actions
- [ ] Banned Workers tab lists every worker with at least one ban, showing total ban count and full ban history
- [ ] Users tab loads real customer data (name, email, phone, saved address, QuickCoins, completed bookings)
- [ ] Workers tab loads real worker data including positive streak and bonus balance
- [ ] Workers tab "View" on ID Document opens the actual image (signed URL) rather than a broken image
- [ ] Workers tab "View" on Photo opens the actual image
- [ ] Approve/Reject buttons are pill-shaped and side-by-side; clicking either shows the animated tick/cross result modal
- [ ] Once approved, a worker's Actions cell shows no buttons — only the Verification column's "APPROVED" badge (no duplicate badge)
- [ ] New review appears in the Reviews tab immediately (Realtime), without a manual refresh
- [ ] A change to a `users` or `workers` row (via the app or direct SQL `UPDATE`/`DELETE`, not `TRUNCATE`) reflects in the relevant admin tab without a manual refresh
- [ ] Tab order is: Campaigns, User Passes, Analytics, Reviews, Banned Workers, Users, Workers

## Cross-cutting
- [ ] No inline `<style>`/`<script>` remains in any HTML file (Phase 5.2 regression check)
- [ ] All `js/common/*.js` load in the documented order on every page that needs them
- [ ] No `console.log`/debug output in production JS
- [ ] `sql/` package runs clean on a fresh Supabase project in documented order
- [ ] RLS policies confirmed present: `admins_can_update_any_worker`, `admins_can_update_worker_verification`, `admins_can_select_all_users`, `admins_can_select_worker_documents`, `admins_can_select_worker_bans`/`admins_can_insert_worker_bans`, `workers_can_select_own_bonuses`/`admins_can_select_worker_bonuses`
- [ ] `reviews`, `users`, and `workers` are all present in the `supabase_realtime` publication, and `workers` has `REPLICA IDENTITY FULL` set
- [ ] `handle_review_streak()` trigger fires correctly on `AFTER INSERT ON reviews` and is not bypassable by a direct client write to `workers.positive_streak`/`bonus_balance`

## Sign-off
| Field | Value |
|---|---|
| Verified by | _____________ |
| Date | _____________ |
| Result | ☐ Pass ☐ Pass with known gaps (see docs/ROADMAP.md §7 risks) |