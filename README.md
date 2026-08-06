# The Daily Commit Ordering App

A simple booth ordering system:

- Customers scan a QR code and place an order on their phone.
- New orders appear live on the iPad dashboard.
- Staff can mark orders as New, Preparing, Completed, or Cancelled.
- Sugar / no-sugar choices are available for Hot Americano, Hot Latte, Iced Americano, and Iced Latte.
- The app does not collect online payment. Customers pay at the booth.

## Technology

- React and TypeScript
- Vite
- Tailwind CSS
- Supabase

## Pages

- Customer ordering page: `/`
- Staff dashboard: `/admin`

## 1. Create the Supabase backend

1. Create a free Supabase project.
2. Open **SQL Editor**.
3. Paste and run `supabase/schema.sql`.
4. In **Project Settings → API**, copy:
   - Project URL
   - Anon public key

## 2. Configure the app

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update the values:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_ADMIN_PIN=2468
```

Change `VITE_ADMIN_PIN` before deployment.

## 3. Set coffee prices

In Supabase, open **Table Editor → menu_items** and fill in the `price` column.

- Leave a price blank to show “Pay at booth”.
- Set `available` to false to temporarily hide an item.

## 4. Run locally

Use Node.js 22 or newer. The repository includes an `.nvmrc` file for version managers such as
`nvm`.

```bash
npm ci
npm run dev
```

Open the URL shown by Vite. The admin dashboard is at `/admin`.

## Quality checks

Run the complete local quality gate before opening a pull request:

```bash
npm run check
```

This checks formatting, lint rules, TypeScript, and the production build. GitHub Actions runs the
same command for pushes and pull requests targeting `main`.

## 5. Deploy

Recommended: Cloudflare Pages, Vercel, or Netlify.

Build settings:

- Build command: `npm run build`
- Output directory: `dist`
- Add the three environment variables from `.env` in your hosting dashboard.

For single-page routing, configure the host to rewrite all paths to `index.html`.

### Cloudflare Pages rewrite

Create `public/_redirects` before building:

```text
/* /index.html 200
```

### Netlify rewrite

Use the same `public/_redirects` file.

### Vercel rewrite

Add `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

## 6. Print the QR code

After deployment:

1. Open `https://YOUR-DOMAIN/admin` on the iPad.
2. The dashboard displays a QR code for the customer ordering page.
3. Screenshot or print that QR code for the booth.

## Security note

The starter dashboard uses a browser PIN and permissive Supabase policies so it is easy to launch. For a long-term production setup, replace this with Supabase Auth and restrict order read/update access to logged-in staff.
