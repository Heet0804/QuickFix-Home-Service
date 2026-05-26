# QuickFix Home Service

A lightweight browser-based service booking app for home repair, cleaning, wellness, and worker booking.

## Overview

`QuickFix` lets users browse home service categories, select a specific service, and book a nearby worker. The app supports categories such as:

- Electrician
- Plumber
- Carpenter
- Painter
- Cleaner
- AC Repair
- Mason
- Pest Control
- Househelp
- Massage & Wellness

The current project is built as a static HTML/CSS/JavaScript application in `index.html` with separate pages for authentication, landing, worker profile, and dashboard flows.

## Features

- Unified category picker UI for all service categories
- Service selection with nearest-worker booking flow
- Worker profile and booking pages
- Search, filter, and sort support on the services page
- Booking status and review flow
- Basic local state management in plain JavaScript

## Files

- `index.html` - Main user-facing application and UI logic
- `auth.html` - Authentication page
- `landing.html` - Landing page for app entry
- `worker-dashboard.html` - Worker dashboard and job management UI
- `worker-profile.html` - Worker profile and account management UI

## How to Run

1. Open `index.html` in a web browser.
2. Use the navigation menu to explore categories and book services.

> Note: This is a static client-side app and does not require a backend to view the UI. Some booking actions may be simulated in the code.

## How to Push Changes

```bash
cd "c:/Users/Heet Lakhani/Documents/QuickFix"
git add .
git commit -m "Update QuickFix app"
git push
```

## Recommended Improvements

- Add a backend API for persistent booking and authentication
- Use a front-end build tool or framework for scalability
- Improve responsive layout and mobile experience
- Add user login state and worker authentication

## License

Use this project freely for testing and learning.
