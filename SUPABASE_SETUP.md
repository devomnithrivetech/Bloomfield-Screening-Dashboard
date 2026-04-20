# Supabase Setup Guide

Follow these steps in order. The whole thing takes ~10 minutes.

---

## 1. Grab your project credentials

Supabase dashboard → **Project Settings → API**:

| Field | Where to use it |
| --- | --- |
| **Project URL** (`https://<ref>.supabase.co`) | `VITE_SUPABASE_URL` (frontend) and `SUPABASE_URL` (backend) |
| **anon public key** | `VITE_SUPABASE_ANON_KEY` (frontend) and `SUPABASE_ANON_KEY` (backend) |
| **service_role secret key** | `SUPABASE_SERVICE_ROLE_KEY` (backend only — NEVER expose to the browser) |

Copy the frontend env template and fill the two values:

```bash
cd frontend
cp .env.example .env.local
# then edit .env.local
```

Final `frontend/.env.local`:

```
VITE_SUPABASE_URL=https://abcdefghij.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_API_BASE_URL=http://localhost:8000
```

Restart `npm run dev` whenever you change env files.

---

## 2. Run the SQL migration

Dashboard → **SQL Editor → New query**. Paste the contents of
[supabase/migrations/0001_initial.sql](supabase/migrations/0001_initial.sql) and click **Run**.

This creates:

- `profiles` — one row per user, auto-created on sign-up via a trigger.
- `user_settings` — per-user dashboard preferences.
- `emails` and `deals` — minimal placeholder tables (expanded when the backend pipeline lands).
- Row-level-security policies so each user only sees their own rows.

Verify under **Table Editor** that all four tables exist with RLS enabled
(green shield icon).

---

## 3. Configure Authentication

### 3a. Site URL + Redirect URLs

Dashboard → **Authentication → URL Configuration**:

- **Site URL** — the URL users will be at when they click email links. For local
  dev use `http://localhost:8080`. In production put your deployed URL
  (e.g. `https://dashboard.bloomfieldcapital.com`).
- **Redirect URLs** (allow-list — add all of these, comma-separated):

  ```
  http://localhost:8080/auth/callback
  http://localhost:8080/auth/reset-password
  https://dashboard.bloomfieldcapital.com/auth/callback
  https://dashboard.bloomfieldcapital.com/auth/reset-password
  ```

These have to match exactly — Supabase will refuse any redirect not in this list.

### 3b. Email provider

Dashboard → **Authentication → Providers → Email**:

- **Enable Email provider** — should already be on.
- **Confirm email** — recommended **ON** for production, OFF for local dev so
  you don't have to check your inbox every time you create a test account.
- **Secure email change** — ON.
- **Secure password change** — ON.
- **Minimum password length** — 8 or higher.

### 3c. Email templates (optional, polish)

Dashboard → **Authentication → Email Templates**. The defaults work; if you want
Bloomfield-branded emails, update these three:

- **Confirm signup** — subject: `Confirm your Bloomfield Dashboard account`
- **Reset password** — subject: `Reset your Bloomfield Dashboard password`
- **Magic link** — (not used by default; you can disable magic link if you prefer)

### 3d. SMTP (production only)

For production, configure custom SMTP (Dashboard → **Project Settings → Auth →
SMTP Settings**) so reset emails come from a `@bloomfieldcapital.com` address
instead of the default `noreply@mail.app.supabase.io`. Popular choices: SendGrid,
Postmark, Resend, or Amazon SES. Without this, Supabase's dev-mail has a 4
emails/hour rate limit.

---

## 4. Storage (for populated screeners)

Dashboard → **Storage → Create bucket**:

- Name: `deal-artifacts`
- Public: **OFF**
- File size limit: 50 MB

Then create a bucket policy under **Policies** on `deal-artifacts`:

```sql
-- allow each user to read/write only their own folder
create policy "users can read own artifacts"
  on storage.objects for select
  using ( bucket_id = 'deal-artifacts' and (storage.foldername(name))[1] = auth.uid()::text );

create policy "users can upload own artifacts"
  on storage.objects for insert
  with check ( bucket_id = 'deal-artifacts' and (storage.foldername(name))[1] = auth.uid()::text );
```

Backend uploads will be keyed `deal-artifacts/<user_id>/<deal_id>/screener.xlsx`.

---

## 5. Environment variables — reference

### Frontend (`frontend/.env.local`)

| Variable | Required | Example |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | `https://abcd.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | yes | `eyJhbGci...` |
| `VITE_API_BASE_URL` | yes | `http://localhost:8000` |

### Backend (`backend/.env`)

| Variable | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | yes | same as frontend `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | yes | used for RLS-respecting reads |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | used for backend writes, realtime broadcasts. NEVER commit. |
| `SUPABASE_STORAGE_BUCKET` | yes | `deal-artifacts` |
| `ANTHROPIC_API_KEY` | yes | Claude API key |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | later | for Gmail OAuth |

---

## 6. Test auth end-to-end

1. `cd frontend && npm run dev`
2. Open http://localhost:8080 — you should be redirected to `/auth/login`.
3. Click **Create account**, sign up with a test email + password.
   - If you left "Confirm email" ON, check your inbox and click the link.
4. You should land on the dashboard with your initials in the avatar.
5. Avatar menu → **Log out** should bounce you back to `/auth/login`.
6. Click **Forgot password?** on the login page and confirm the reset email
   arrives with a link pointing to `/auth/reset-password`.

---

## 7. What's NOT configured yet

Future work, NOT needed to test the dashboard UI today:

- Google OAuth for Gmail inbox access (adds a "Sign in with Google" option AND
  unlocks the Gmail API integration the backend needs).
- Real-time subscriptions on `deals:<deal_id>` for live pipeline updates.
- Custom SMTP for production-grade reset emails.
- Production role-based access (Option 3 multi-user — analyst / originator / admin).
