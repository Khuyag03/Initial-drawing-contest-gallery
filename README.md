# Children’s Day Drawing Contest Voting Gallery

Production-ready Next.js App Router app for a private employee voting gallery. Public visitors can browse drawings and vote once per device. Vote totals stay hidden from public pages and are visible only in the password-protected admin dashboard.

## Stack

- Next.js 16 App Router, satisfying the requested Next.js 14+ baseline
- TypeScript
- Tailwind CSS
- Supabase Postgres and Storage
- Vercel-ready environment variables

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a Supabase project.

3. Open the Supabase SQL editor and run:

```sql
-- paste supabase/schema.sql
```

This creates `drawings`, `votes`, the `drawing-images` storage bucket, indexes, the `votes.device_hash` unique constraint, and RLS policies.

4. Copy the environment example:

```bash
cp .env.local.example .env.local
```

5. Fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
ADMIN_PASSWORD=replace-with-a-strong-admin-password
VOTE_HASH_SECRET=replace-with-a-long-random-secret
```

6. Run locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Pages

- `/` public image-focused gallery with fullscreen lightbox and secret voting
- `/admin/login` password login using `ADMIN_PASSWORD`
- `/admin` protected dashboard for uploads, edits, deletes, vote counts, sorting, filtering, and CSV export

## Voting Security

- One vote is allowed per device for the full contest.
- The client creates a localStorage device ID, a cookie device ID, and a browser fingerprint hash.
- The server combines those with hashed IP and hashed user-agent data.
- Only HMAC hashes are stored in Supabase.
- `votes.device_hash` has a unique constraint to stop duplicate submissions.
- Public users cannot read `votes`.
- Vote inserts happen through the server action using `SUPABASE_SERVICE_ROLE_KEY`, never from the browser.
- A small in-memory rate limiter slows repeated vote submissions.

## Vercel Deployment

1. Push the project to GitHub.
2. Import the repo in Vercel.
3. Add these Environment Variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`
   - `VOTE_HASH_SECRET`
4. Deploy.

Keep `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_PASSWORD` server-only. Do not prefix them with `NEXT_PUBLIC_`.

## Folder Structure

```text
src/app
  actions/          server actions for public data, voting, admin CRUD
  admin/            admin login and dashboard routes
  page.tsx          public gallery page
src/components      gallery and dashboard UI
src/lib             Supabase clients, auth, hashing, validation, rate limit
src/types           app and Supabase TypeScript types
supabase/schema.sql database, storage, indexes, and RLS policies
```
