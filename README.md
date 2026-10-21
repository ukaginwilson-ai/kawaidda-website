# Kawaidda Poultry website

## Project layout

- `index.html` — the single-page website structure and content.
- `assets/css/styles.css` — layout, responsive styling, and typography.
- `assets/js/main.js` — navigation, Supabase authentication, inquiry and order-request submissions, and WhatsApp notifications.
- `admin.html` and `assets/js/admin.js` — protected staff dashboard for customer submissions, catalog content, and gallery images.
- `KAWAIDDA POULTRY BREEDERS2.html` — compatibility redirect for the previous page URL.
- `supabase-setup.sql` — database setup.
- `supabase/functions/` — Supabase Edge Functions.

## Run locally

Install dependencies once with `npm install`, then start the development server with `npm run dev`. Vite serves the site at `http://127.0.0.1:5173/`. Use `npm run build` to create the production site in `dist/`.

Apply `supabase-setup.sql` in the Supabase SQL Editor to create/update the database schema, public submission policies, admin authorization, and storage permissions. Order requests are not confirmed purchases; the team must follow up to confirm availability and pricing.

The public product, service, and gallery sections load active records from Supabase. Customer inquiries and order requests are saved in Supabase. After submitting a new order request, the customer receives a private tracking code to save and can later use it on the public order page to see the current status and request details. Supabase stores only the hash of the tracking code, and the public status lookup does not return customer contact information. Existing requests cannot be looked up with a tracking code; only new requests submitted after applying the tracking setup receive one. In `/admin.html`, staff can update orders through the Pending, Confirmed, Processing, Completed, and Cancelled lifecycle, as well as edit customer and request details. Requests are not paid purchases. The same dashboard manages catalog entries and gallery photos; uploaded photos are stored in the public `site-images` bucket.

The setup script grants administrator access to `ukaginwilson@gmail.com`. Create that Supabase account and confirm its email before applying `supabase-setup.sql`; the script reports an error if the account does not exist. Sign in at `/admin.html` with that account after applying the setup. Browser accounts cannot grant themselves administrator access.

The SQL setup adds the authorization policies, submission status fields, and storage upload permissions used by the dashboard. Re-run it after a deployment that includes database changes. The dashboard uses row-level security; hiding its URL is not an access control mechanism.

Supabase email redirect URLs should point to the deployed site's `/index.html` page. For local development, allow `http://127.0.0.1:5173/index.html` in the Supabase Auth redirect URL settings.
