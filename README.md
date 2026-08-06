# The Daily Commit Ordering App

A simple booth ordering system:

- Customers scan a QR code and place an order on their phone.
- New orders appear live on the iPad dashboard.
- Customers can track orders through New, Preparing, Ready, Completed, and Cancelled states.
- Drinks that require a sugar choice enforce Sugar or No Sugar before they can be added.
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
2. Install and authenticate the Supabase CLI.
3. Link the repository with `supabase link --project-ref YOUR_PROJECT_REF`.
4. Apply the versioned migrations with `supabase db push`.
5. If the original prototype schema was previously applied, back up its orders first. The Phase 2
   baseline migration replaces those prototype tables.
6. In **Project Settings → API**, copy:
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
```

## 3. Menu and prices

The migration seeds the complete Coffee and Chocolate menu with placeholder SGD prices. In
Supabase, open **Table Editor → menu_items** to review them.

- Update `price` before launch with the confirmed booth prices.
- Set `available` to false to temporarily hide an item.

## 4. Run locally

Use Node.js 22 or newer. The repository includes an `.nvmrc` file for version managers such as
`nvm`.

```bash
npm ci
npm run dev
```

Open the URL shown by Vite. The admin dashboard is at `/admin`.

### Test the customer flow

1. Open `/` and add both a standard drink and a drink that requires a sugar choice.
2. Adjust quantities, remove an item, enter a pickup name and optional remarks, then place the
   order.
3. Confirm the browser opens `/order/:trackingToken` and displays the server-calculated total.
4. In Supabase Table Editor, change the status to `preparing`, then `ready`. The tracking page
   refreshes within 10 seconds and displays the green collection state.
5. Verify an unavailable menu item disappears and cannot be submitted through the RPC.

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
- Add the two environment variables from `.env` in your hosting dashboard.

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

## Security

Anonymous customers can read available menu items and call the narrowly scoped order and tracking
RPCs. They cannot list, insert, or update order tables directly. Secure staff authentication and
order management will be added in Phase 3; `/admin` is intentionally a placeholder until then.
