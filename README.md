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
- Staff login: `/admin/login`
- Live dashboard: `/admin`
- Menu management: `/admin/menu`
- Order history: `/admin/history`
- Printable QR code: `/admin/qr`

## 1. Create the Supabase backend

1. Create a free Supabase project.
2. Install project dependencies with `npm ci`; the Supabase CLI is pinned as a development
   dependency.
3. Authenticate with `npx supabase login`.
4. Link the repository with
   `npx supabase link --project-ref rfxowcdtkqfjjakmgnhv`.
5. Apply every versioned migration with `npx supabase db push` (or `supabase db push` when the CLI
   is installed globally).
6. If the original prototype schema was previously applied, back up its orders first. The Phase 2
   baseline migration replaces those prototype tables.
7. In **Project Settings → API**, copy:
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
Supabase, open the staff menu page at `/admin/menu` to review them.

- Administrators can update prices, menu copy, categories, availability, and display order.
- Staff-role accounts can view orders but cannot edit the menu.

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
4. In the staff dashboard, move the order to `preparing`, then `ready`. The tracking page refreshes
   within 10 seconds and displays the green collection state.
5. Verify an unavailable menu item disappears and cannot be submitted through the RPC.

### Create the first administrator

1. In Supabase Dashboard, open **Authentication → Users → Add user**.
2. Create an email/password user with a strong unique password and mark the email confirmed.
3. Copy the user's UUID.
4. As a one-time privileged administrator action, run this in the Supabase SQL Editor, replacing the
   UUID and display name:

```sql
insert into public.staff_profiles (user_id, display_name, role, is_active)
values ('USER_UUID', 'Booth Admin', 'admin', true)
on conflict (user_id) do update
set display_name = excluded.display_name,
    role = excluded.role,
    is_active = true;
```

5. Sign in at `/admin/login` and confirm that Dashboard, Menu, History, and QR Code are available.

To disable access immediately without deleting authentication history:

```sql
update public.staff_profiles
set is_active = false
where user_id = 'USER_UUID';
```

To restore access, set `is_active = true`. To permanently remove the login, delete the user in
**Authentication → Users**; the profile is removed automatically.

### Test staff operations

1. Confirm an unauthenticated visit to `/admin` redirects to `/admin/login`.
2. Sign in as an active staff account and confirm the session survives a page refresh.
3. Place a customer order in another browser and confirm it appears live with one notification.
4. Move it through New → Preparing → Ready → Completed and expand its audit history.
5. Attempt an invalid transition through the RPC and confirm PostgreSQL rejects it.
6. Sign in as a staff-role user and confirm `/admin/menu` is denied and editing RPC calls fail.
7. Filter and search the dashboard together; verify Clear restores Active orders.
8. Use History with date/status/search filters and paginate beyond 20 records.
9. Open `/admin/qr`, verify the QR targets `/`, and print-preview it as A4 portrait.

### Realtime

The Phase 3 migration adds `orders` and `order_items` to the `supabase_realtime` publication when
they are not already present. No Dashboard publication changes are required. Realtime reads still
pass through RLS, so only authenticated active staff receive operational records. The dashboard
shows connection state and retains a manual refresh fallback.

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
- In **Supabase Authentication → URL Configuration**, set the Site URL to the deployed origin and
  add the deployed `/admin/login` URL to the redirect allow list.

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
RPCs. They cannot list, insert, or update order tables directly. Authenticated users receive no
operational access unless they have an active `staff_profiles` row. Active staff can read orders and
audit entries and can change status only through the transition-enforcing RPC. Only active admins
can update menu items. The browser uses only the Supabase publishable key; never add a service-role
key to Vite environment variables.
