# Eugene Card — Supabase configuration

Canonical project URL: https://tsjgvzpzfjyecnginipt.supabase.co

All Eugene Card pages should use the same Supabase project and publishable key. The shared browser configuration lives in `js/supabase-config.js`.

## Authentication
1. Enable Google provider in Supabase Auth.
2. Set the production Eugene Card URL as the Supabase Site URL.
3. Add the production Eugene Card URL and local development URL(s) to Supabase Redirect URLs.
4. In Google Cloud, keep the Supabase OAuth callback URL shown by Supabase as an authorized redirect URI.

The browser package uses a publishable key only. Never put a `service_role` key in frontend files.

## Data
The existing Eugene Card pages use the same Supabase database for profiles, cards, transactions, listings, trades, posts, notifications, and related application data. The `public.cards` table is the centralized card inventory used across devices.

## Admins
The application admin allowlist is:
- eugene.aquila06@gmail.com
- eugenecard.market@gmail.com

No Firebase or Firestore service is required by the production architecture.
