# Deploying Rain City Scooter to aaPanel

This guide walks step by step through moving the Rain City Scooter web app from this GitHub repository onto a Linux server managed by **aaPanel** (using **Nginx** or **Apache**).

Because this application is a static **React + Vite** single-page app backed directly by **Firebase (Firestore + Google Auth)** and **Google Maps Platform (Places API New)**, you do **not** need a running Node.js background server in production—Node.js is only used during the build step (`npm run build`), and Nginx serves the compiled `dist/` folder directly at full static speed.

---

## Prerequisites

Before you start, make sure you have:

1. **aaPanel installed** on your VPS/server with **Nginx** (recommended) or **Apache**.
2. **A domain name** pointed to your server's IP address via DNS `A` records (e.g., `raincityscooter.com` and `www.raincityscooter.com`).
3. **Git** installed on your server (`git --version`).
4. **Node.js v20+ (LTS)** installed via aaPanel:
   - Open aaPanel → **App Store** → search for **Node Version Manager** → install it.
   - Open **Node Version Manager** → install **Node.js 20.x** or **22.x** and set it as the default CLI version.
5. **Firebase project access** (your existing Firestore database and Authentication project) and a **Google Cloud API key** for Google Maps Platform.

---

## Step 1: Clone the Repository on Your aaPanel Server

SSH into your server (or open **aaPanel → Terminal**) and clone your GitHub repository into `/www/wwwroot/`:

```bash
cd /www/wwwroot
git clone https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPO_NAME>.git raincityscooter.com
cd /www/wwwroot/raincityscooter.com
```

Verify that `firebase-applet-config.json` is present in the root folder:

```bash
ls -la firebase-applet-config.json
```

> **Note:** `firebase-applet-config.json` contains your public Firebase Web App config (`apiKey`, `authDomain`, `projectId`, `firestoreDatabaseId`). Firebase security is enforced server-side by `firestore.rules` and Firebase Auth, not by hiding this web config.

---

## Step 2: Configure Your Production Environment File (`.env.production`)

Create a `.env.production` file in `/www/wwwroot/raincityscooter.com` (this file is already ignored by `.gitignore`, so it will never be committed to GitHub):

```bash
nano /www/wwwroot/raincityscooter.com/.env.production
```

Add your Google Maps Platform API key:

```env
VITE_GOOGLE_MAPS_API_KEY="YOUR_PRODUCTION_GOOGLE_MAPS_API_KEY"
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

### Setting Up & Restricting Your Google Maps API Key for Your Domain

In [Google Cloud Console → APIs & Services](https://console.cloud.google.com/apis/dashboard):

1. Ensure **Maps JavaScript API** and **Places API (New)** are enabled on your Google Cloud project.
2. Go to **Credentials** → open your API key → under **Application restrictions**, choose **Websites (HTTP referrers)** and add:
   - `https://raincityscooter.com/*`
   - `https://www.raincityscooter.com/*`
3. Under **API restrictions**, select **Restrict key** and check only:
   - **Maps JavaScript API**
   - **Places API (New)**
4. Save your changes. See the [Google Maps API Key Restriction Guide](https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys?utm_campaign=gmp_mcp_codeassist_v1_aistudio) for details.

---

## Step 3: Install Dependencies and Build the Production Site

From inside `/www/wwwroot/raincityscooter.com`, verify Node.js is v20+ and build the static bundle:

```bash
node -v
npm ci
npm run build
```

When the build completes, Vite creates `/www/wwwroot/raincityscooter.com/dist/` containing:
- `index.html`
- `assets/` (compiled JS & CSS bundles)
- `src/assets/images/` (studio imagery copied automatically by `vite.config.ts`)
- `assets/aistudio/` (public static media)

> **Important:** Vite injects `VITE_GOOGLE_MAPS_API_KEY` at **build time**. If you ever update `.env.production`, run `npm run build` again.

---

## Step 4: Create the Website in aaPanel

1. Log in to **aaPanel** → click **Website** in the left sidebar → select the **PHP Project** (or **HTML/Static**) tab → click **Add site**.
2. Fill in the site settings:
   - **Domain name:**
     ```text
     raincityscooter.com
     www.raincityscooter.com
     ```
   - **Document Root:** `/www/wwwroot/raincityscooter.com`
   - **FTP:** Not created
   - **Database:** Not created
   - **PHP version:** **Static** (Pure static)
3. Click **Submit**.

### Point the Running Directory to `/dist`

1. In **aaPanel → Website**, click **Settings** (or your domain name) next to `raincityscooter.com`.
2. Open the **Site directory** tab.
3. Change **Running directory** from `/` to `/dist` and click **Save**.
4. *(Optional)* If aaPanel warns about `Anti-XSS attack (open_basedir)`, you can leave it off since this is a pure static site with no PHP runtime.

---

## Step 5: Configure SPA Routing (Required for Multi-Page URLs)

Rain City Scooter uses client-side routing for `/pricing`, `/reviews`, `/book`, `/warranty`, `/terms`, `/privacy`, and `/admin`. Without a fallback rewrite rule, refreshing any of those pages directly will return an HTTP `404`.

### Option A: Nginx (Recommended in aaPanel)

1. Open **aaPanel → Website → `raincityscooter.com` → Settings → URL rewrite**.
2. Paste the following rule and click **Save**:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

3. Open the **Config** tab in the same site settings modal and add optimal caching + popup auth headers inside your `server { ... }` block (right above the `include` for rewrite rules):

```nginx
# Allow Firebase Google Sign-In popup on /admin to communicate cleanly
add_header Cross-Origin-Opener-Policy "same-origin-allow-popups" always;

# Never cache index.html so new deployments appear immediately
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}

# Cache fingerprinted Vite bundles aggressively
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}
```

4. Click **Save** (aaPanel automatically validates and reloads Nginx).

### Option B: Apache (If Using Apache Instead of Nginx)

If your aaPanel server runs Apache, create `/www/wwwroot/raincityscooter.com/dist/.htaccess` (or place it in `/public/.htaccess` so Vite copies it automatically on every build):

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

<IfModule mod_headers.c>
  Header always set Cross-Origin-Opener-Policy "same-origin-allow-popups"
</IfModule>
```

---

## Step 6: Enable HTTPS (Let's Encrypt SSL)

HTTPS is required for Firebase Google Sign-In (`/admin`) and recommended for Google Maps referrer restrictions.

1. Go to **aaPanel → Website → `raincityscooter.com` → Settings → SSL**.
2. Click the **Let's Encrypt** tab.
3. Select **File verification** (or DNS verification), check both `raincityscooter.com` and `www.raincityscooter.com`, and click **Apply**.
4. Once issued, toggle **Force HTTPS** ON in the top-right of the SSL panel.

---

## Step 7: Authorize Your Domain in Firebase Console (Required for `/admin`)

Firebase Authentication blocks Google Sign-In on domains that have not been explicitly allowlisted.

1. Open the [Firebase Console](https://console.firebase.google.com/) and select your Rain City Scooter project.
2. Go to **Authentication → Settings → Authorized domains**.
3. Click **Add domain** and add:
   - `raincityscooter.com`
   - `www.raincityscooter.com`
4. Verify your Firestore rules are already deployed (the repo includes `firestore.rules`). If you ever edit `firestore.rules` locally, deploy them using Firebase CLI:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

---

## Step 8: Post-Deployment Verification Checklist

Open `https://raincityscooter.com` in an incognito browser window and verify:

- [ ] **Home (`/`)**: Hero image loads, live Seattle Pacific Time clock ticks, and the OP-1 Service Inspector switches live packages.
- [ ] **Direct URL Refresh**: Visit `/pricing`, `/reviews`, `/book`, `/warranty`, `/terms`, and `/privacy`, and press hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`) on each—confirm zero `404` errors.
- [ ] **Live Google Reviews (`/reviews`)**: Confirm Google reviews load from Google Maps Platform without browser console errors.
  - If your mobile business profile is not matched automatically by name, sign in to `/admin` → **Site Data & Pricing**, paste your **Google Business Profile Place ID** (`ChIJ...`), and click **Publish Site Settings**.
- [ ] **Booking Submission (`/book`)**: Submit a test repair request and confirm you receive a reference ID (`RCS-...`).
- [ ] **Admin Console (`/admin`)**: Sign in with your authorized owner Google account (`Lundonwolf@gmail.com`), verify the test booking appears in **Bookings**, charts render in **Analytics**, and clean up the test booking afterward.

---

## Step 9: Updating the Site Later (Manual or Automatic Webhook)

### Manual One-Command Update

Create a small deploy helper script at `/www/wwwroot/raincityscooter.com/deploy.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /www/wwwroot/raincityscooter.com
git fetch origin main
git reset --hard origin/main
npm ci
npm run build
echo "Rain City Scooter deployed successfully at $(date)"
```

Make it executable:

```bash
chmod +x /www/wwwroot/raincityscooter.com/deploy.sh
```

Whenever you push changes to GitHub, run:

```bash
/www/wwwroot/raincityscooter.com/deploy.sh
```

### Optional: Auto-Deploy on GitHub Push via aaPanel WebHook

1. In aaPanel → **App Store**, install the free **WebHook** plugin.
2. Open **WebHook** → **Add Hook** → name it `Rain City Scooter Deploy` and paste:
   ```bash
   #!/bin/bash
   export PATH="/www/server/nodejs/v20.18.0/bin:$PATH" # Replace with your actual `which node` directory
   /www/wwwroot/raincityscooter.com/deploy.sh
   ```
   *(Run `dirname "$(which node)"` in aaPanel Terminal to get your exact Node bin path.)*
3. Copy the aaPanel WebHook URL + key.
4. In your GitHub repository → **Settings → Webhooks → Add webhook**:
   - **Payload URL:** paste the aaPanel WebHook URL.
   - **Content type:** `application/json`
   - **Events:** Just the `push` event.
5. Save—future pushes to `main` will automatically rebuild `/dist` on your server.

---

## Troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| **404 Not Found** when refreshing `/pricing` or `/admin` | Missing SPA rewrite rule | Add `try_files $uri $uri/ /index.html;` in aaPanel → Website → **URL rewrite** (Step 5). |
| **`auth/unauthorized-domain`** when signing in to `/admin` | New domain not added to Firebase Auth | Add `raincityscooter.com` and `www.raincityscooter.com` in Firebase Console → **Authentication → Settings → Authorized domains** (Step 7). |
| **Reviews show API key / referrer error** (`RefererNotAllowedMapError`) | Google Maps key missing or referrer restriction doesn't include your domain | Verify `.env.production` has `VITE_GOOGLE_MAPS_API_KEY`, allow `https://raincityscooter.com/*` in Google Cloud Credentials, and re-run `npm run build` (Step 2 & 3). |
| **Reviews say "Place ID Needed"** | Service-area / mobile Google Business Profiles sometimes don't return on text search | Open `/admin` → **Site Data & Pricing**, paste your Google Place ID (`ChIJ...`), and click **Publish Site Settings**. |
| **`npm run build` fails with syntax or engine errors** | System default Node version is too old (< 20) | Install Node.js 20+ via aaPanel **Node Version Manager** and run `node -v` to confirm before building. |
| **Hero background image missing on live site** | Uploaded source files instead of building with Vite | Always run `npm run build` and point aaPanel **Running directory** to `/dist` (Step 3 & 4). |
