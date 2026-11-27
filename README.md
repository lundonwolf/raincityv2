# Rain City Scooter

Modern web application for **Rain City Scooter** — independent mobile electric scooter repair in Seattle, featuring live service pricing, online mobile repair booking, live Google Business Profile reviews, policy documentation, and a Firebase-backed Admin Console with Recharts analytics.

## Features

- **Multi-Page SPA Architecture**: Dedicated routes for `/` (Home & OP-1 Service Inspector), `/pricing` (Official Service & Labor Menu), `/reviews` (Live Google Reviews & Supported Makes), `/book` (Mobile Repair Booking Console), `/warranty`, `/terms`, `/privacy`, and `/admin`.
- **Firebase Backend**: Real-time Firestore sync for live pricing, business settings, customer repair bookings, and CRM profiles, secured by Google Authentication and hardened `firestore.rules`.
- **Admin Operations Console (`/admin`)**: Manage bookings, inspect booking & service request trends via Recharts analytics, maintain customer equipment profiles, edit live site pricing, and configure your Google Business Profile Place ID.
- **Live Google Reviews (`/reviews`)**: Streams verified Google Business Profile ratings and reviews live via Google Maps Platform Places API (New) (`@vis.gl/react-google-maps`).

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Motion, Recharts, Lucide Icons
- **Backend / Data**: Firebase Firestore & Firebase Authentication (Google Sign-In)
- **Reviews**: Google Maps Platform (Maps JavaScript API + Places API New)

## Local Development

1. **Install dependencies** (requires Node.js 20+):
   ```bash
   npm ci
   ```
2. **Create a local `.env` file** based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Set `VITE_GOOGLE_MAPS_API_KEY` to your Google Maps Platform API key with **Maps JavaScript API** and **Places API (New)** enabled.
3. **Run the dev server**:
   ```bash
   npm run dev
   ```
4. **Type-check and build for production**:
   ```bash
   npm run lint
   npm run build
   ```

## Production Deployment (aaPanel)

See **[DEPLOY_AAPANEL.md](./DEPLOY_AAPANEL.md)** for the complete step-by-step guide to hosting this repository on an **aaPanel** server with Nginx or Apache, Let's Encrypt SSL, Firebase domain authorization, Google Maps API key restrictions, and automated GitHub webhook deployments.
