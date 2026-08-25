# Eugene Card — Supabase-only clean foundation

This build removes Firebase/Firestore dependencies completely.

## Configure
Edit `js/supabase-config.js` with the public Supabase project URL and anon/publishable key.

## Database
Run `supabase-setup.sql` in the Supabase SQL editor.

## Authentication
The app uses only `@supabase/supabase-js` v2 and `supabase.auth`.
There is no Firebase SDK, Firestore, Firebase Messaging, Firebase compatibility bridge, or Firebase service worker.
