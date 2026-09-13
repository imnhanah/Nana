# AAICOREFX — Trading Journal (Supabase edition)

A multi-account trading journal with **real authentication and a real cloud
database** — Supabase Auth + Postgres, with Row Level Security enforcing
that every user can only ever see their own data.

This is a genuine rewrite from the earlier localStorage prototype: there is
no fake auth, no client-side password hashing, and no data that only lives
in one browser. Sign up on your laptop, log in on your phone, see the same
trades.

## 1. Create your Supabase project (~2 minutes, free)

1. Go to [supabase.com](https://supabase.com) and create a free account/project.
2. Once the project is ready, go to **Project Settings → API**. Copy the
   **Project URL** and the **anon / public key**.
3. In this folder, copy `.env.example` to `.env` and paste those two values in:
   ```bash
   cp .env.example .env
   ```
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
   Never commit `.env` (it's already in `.gitignore`), and never put the
   **service_role** key here — only the anon key belongs in frontend code.

## 2. Set up the database

1. In your Supabase project, open **SQL Editor → New query**.
2. Paste the entire contents of `supabase/schema.sql` and click **Run**.

That one file creates every table (`profiles`, `accounts`, `trades`,
`rules`, `journal_entries`, `user_settings`), enables Row Level Security on
all of them, adds the ownership policies, and sets up a trigger so a
`profiles` row is created automatically the moment someone signs up. It's
safe to re-run if you ever need to.

## 3. (Optional) Enable Google sign-in

The app has a "Continue with Google" button wired to Supabase's OAuth
support. To make it functional: in your Supabase dashboard go to
**Authentication → Providers → Google**, enable it, and follow Supabase's
prompt to create a Google OAuth Client ID/secret and paste them in. If you
skip this, the button will just show Supabase's "provider not enabled"
error — everything else works fine without it.

## 4. Enable password reset emails

Password reset works out of the box using Supabase's built-in email
sending. For production use, go to **Authentication → Email Templates**
and **Authentication → URL Configuration** and set your **Site URL** to
wherever you deploy this (see below) — that's what the reset-password link
in the email points back to.

## 5. Run it locally

```bash
npm install
npm run dev
```

## 6. Deploy to Netlify

1. Push this folder to a GitHub repo, or drag-and-drop it into Netlify's
   "Deploy manually" flow after running `npm run build` (outputs to `dist/`).
2. In Netlify: **Site settings → Environment variables**, add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values
   from your `.env`.
3. Once deployed, go back to Supabase **Authentication → URL Configuration**
   and set your Site URL / Redirect URLs to your real Netlify URL — this is
   required for password reset and Google OAuth to redirect back correctly.

## What's real here vs. what you still need to verify yourself

I can't create a Supabase project or run code against a live cloud database
from where I'm building this — that requires your own account. Here's
exactly what that means:

**What I actually built and verified:**
- Real Supabase Auth calls throughout (`supabase.auth.signUp`,
  `signInWithPassword`, `signOut`, `resetPasswordForEmail`, `updateUser`,
  `onAuthStateChange`) — no custom password hashing anywhere anymore.
- A complete Postgres schema (`supabase/schema.sql`) with Row Level Security
  enabled on every table and policies scoped to `auth.uid()`.
- I bundled the actual application code (not a simplified copy) and ran it
  against a behaviorally-accurate mock of the Supabase client — same method
  names, same response shapes, real in-memory data — to exercise the full
  code paths for: sign up, duplicate-email rejection, sign in, sign out,
  create a trade, log out, log back in and confirm the trade persisted, and
  two separate users only ever seeing their own data. All of that passed.
- This proves the **frontend wiring is correct** — the right calls happen
  with the right data at the right times, and the UI handles the responses
  properly.

**What this does NOT prove, and what you should verify once your project is live:**
- That Postgres's actual Row Level Security engine enforces the policies as
  written — my mock doesn't run real Postgres, so it can't catch a typo'd
  policy or a misconfigured table the way the real database would. The
  `schema.sql` policies are all `user_id = auth.uid()` (or `id = auth.uid()`
  for profiles), which is the standard, correct pattern — but please still
  run through the checklist below once for real.
- Real email delivery for confirmation/reset emails, real Google OAuth
  consent screens, and real session persistence across an actual browser
  restart (my testing closed the *session* programmatically, not the
  browser process itself).

**Quick real-world QA checklist**, once your `.env` points at your real project:
1. Sign up with a new email → should land in the app with an empty starter account
2. Try signing up again with the same email → should be rejected
3. Log out, log back in with that email/password → should work
4. Close the browser tab entirely, reopen the site → should still be logged in
5. Click "Forgot password" → check your email → follow the link → set a new password
6. Create a trade, log out, log back in → trade should still be there
7. Create a second account in an incognito window → confirm it only ever
   sees its own trades, never the first account's
8. In the Supabase dashboard's **Table Editor**, open `trades` — you should
   be able to see both users' rows as the project owner (that's expected;
   RLS restricts what the *anon key from the frontend* can see, not what
   you can see with owner access in the dashboard)

## Migrating old local data

If someone used the earlier localStorage version of this app in their
browser, the first time they log in with a real account now, the app checks
for that old data and — if found — offers to import it into their new cloud
account (Settings aren't touched; only accounts/trades/rules/check-ins are
copied over). They can also just skip it.

## Notes / limitations

- The **News** page uses sample/mock economic-calendar data, not a live feed
  (see the in-app note on that page for why — ForexFactory's real feed is
  rate-limited and doesn't reliably allow direct browser requests from every
  origin).
- Screenshots attached to trades are stored as compressed base64 images
  directly in the `trades` table (`screenshots` jsonb column). This works
  fine for a handful of small images per trade; if you outgrow it, moving
  to Supabase Storage (actual file storage with its own bucket + RLS) is
  the natural next step — it wasn't required for this pass.
