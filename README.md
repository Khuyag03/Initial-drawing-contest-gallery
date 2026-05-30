# Children’s Day Drawing Contest Voting Gallery

Production-ready Next.js App Router app for an employee SAP-gated Children’s Day drawing contest gallery. Employees enter their SAP code, browse drawings, see public vote totals, and vote once per age category.

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

This creates `drawings`, `employees`, `votes`, the public aggregate `public_drawings_with_votes` view, the `drawing-images` storage bucket, indexes, the `(employee_id, age_category)` active-vote unique index, and RLS policies.

Run this SQL again after pulling updates if you already deployed an older device-based version. Old anonymous votes cannot be mapped to employees, so the migration clears unmapped vote rows.

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

7. Import employees:

- Open `/admin/login`
- Log in with `ADMIN_PASSWORD`
- Open `/admin/employees`
- Upload `Allstaff.xlsx`
- The workbook must contain the `Employees` sheet with `SAP`, `First Name`, and `Last Name` columns.

## Pages

- `/` SAP access screen, then public image-focused gallery with fullscreen lightbox, visible vote totals, and category-based voting
- `/admin/login` password login using `ADMIN_PASSWORD`
- `/admin` protected dashboard for uploads, edits, deletes, vote counts, sorting, filtering, and CSV export
- `/admin/employees` protected employee import and voting-rights management
- `/admin/votes` protected vote record management with SAP and employee names

## Voting Security

- One vote is allowed per active SAP employee in each age category: `3-6`, `7-10`, and `11-16`.
- SAP access is stored in a signed httpOnly cookie and revalidated server-side before each vote.
- The client creates a localStorage device ID, a cookie device ID, and a browser fingerprint hash.
- Device, IP, user-agent, and browser summary are stored only as optional audit metadata.
- The server combines device/IP/user-agent identifiers into HMAC hashes.
- `votes` stores employee identity snapshots and has a partial unique `(employee_id, age_category)` index for active votes.
- Resetting voting rights soft-deletes votes so the employee can vote again.
- Public users cannot read `votes`.
- Public users cannot read `employees`.
- Public users read vote totals only through the aggregate `public_drawings_with_votes` view.
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
