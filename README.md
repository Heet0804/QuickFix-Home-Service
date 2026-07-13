# QuickFix – Smart Home Service Booking Platform

QuickFix is a full-stack home service marketplace that connects customers with nearby verified service professionals in real time.

The platform provides a complete booking lifecycle—from service discovery to worker assignment, live tracking, OTP verification, payments, reviews, achievements, and worker analytics.

---

# Features

## Customer Features

- User Authentication
- Browse services by category
- Search and filter services
- Emergency booking support
- Schedule bookings
- Cash / Online payment options
- Automatic nearest worker assignment
- Real-time booking timeline
- Live worker tracking using GPS
- Arrival OTP verification
- Completion OTP verification
- Booking history
- Rating & Review system
- Achievement system
- Real-time notifications

---

## Worker Features

- Worker Registration & Login
- Worker Profile Management
- Area-based availability
- Accept / Reject bookings
- Live GPS location sharing
- Job Timeline
- Earnings Dashboard
- Acceptance Rate
- Reliability Score
- Worker Score
- Achievement System
- Profile statistics
- Booking history

---

# Service Categories

- Electrician
- Plumber
- Carpenter
- Painter
- Mason
- Cleaner
- AC Repair
- Pest Control
- House Help
- Massage & Wellness

---

# Tech Stack

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript

### Backend

- Supabase
  - PostgreSQL Database
  - Authentication
  - Realtime
  - Row Level Security (RLS)
  - SQL Functions (RPC)

### Other Technologies

- Leaflet.js
- OpenStreetMap
- Firebase Realtime Database (Fire Safety Project Integration)
- Browser Geolocation API

---

# Major Functionalities

## Booking Workflow

Customer Books Service

↓

Nearest Available Worker Assigned

↓

Worker Accepts / Rejects

↓

Worker Travels

↓

Live GPS Tracking

↓

Arrival OTP Verification

↓

Service Starts

↓

Completion OTP Verification

↓

Payment

↓

Review & Rating

↓

Achievements Updated

---

# Worker Performance System

The application calculates worker statistics dynamically using PostgreSQL RPC functions.

Metrics include:

- Accepted Jobs
- Completed Jobs
- Cancelled Jobs
- No Show Count
- Average Rating
- Completion Rate
- Reliability Score
- Activity Score
- Worker Score
- Total Earnings

These statistics are generated directly from booking history instead of cached values.

---

# Achievement System

Both customers and workers can unlock achievements based on platform activity.

Examples include:

### Customer

- First Booking
- Repeat Customer
- Emergency Booking
- Multiple Reviews

### Worker

- First Job
- 10 Jobs Completed
- Highly Rated Worker
- Reliable Worker
- Top Performer

Achievements unlock automatically after qualifying actions.

---

# Project Structure

```
QuickFix
│
├── index.html
├── auth.html
├── landing.html
├── worker-dashboard.html
├── worker-profile.html
├── styles.css
└── assets/
```

---

# Database

Supabase Tables

- users
- workers
- bookings
- reviews
- worker_achievements
- achievements
- areas

The project also uses PostgreSQL RPC functions for worker statistics.

---

# Real-Time Features

- Live booking updates
- Worker location tracking
- Booking status synchronization
- Achievement unlock notifications

Powered by Supabase Realtime.

---

# Future Improvements

- In-app chat
- Push notifications
- Razorpay integration
- Admin dashboard
- AI worker recommendation
- Dynamic pricing
- Route optimization
- Multi-city support

---

# Developed By

**Heet Lakhani**

B.Tech Computer Science

Shah & Anchor Kutchhi Engineering College

---

# License

This project is developed for educational and portfolio purposes.