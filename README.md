# Eugene Card — Supabase-only clean foundation

This build removes Firebase/Firestore dependencies completely.

## Configure
Edit `js/supabase-config.js` with the public Supabase project URL and anon/publishable key.

## Database
Run `supabase-setup.sql` in the Supabase SQL editor.

## Authentication
The app uses only `@supabase/supabase-js` v2 and `supabase.auth`.
There is no Firebase SDK, Firestore, Firebase Messaging, Firebase compatibility bridge, or Firebase service worker.

## Google-only login

Authentication is Google OAuth through Supabase Auth. Email/password login is not implemented.

In Supabase:
1. Authentication → Providers → Google → enable Google.
2. Add your Google OAuth client ID/secret.
3. Add your deployed site URL to the Supabase Auth redirect URLs.
4. Add the same URL to the Google OAuth authorized redirect configuration as the Supabase callback URL.
