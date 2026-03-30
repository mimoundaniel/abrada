# adraba v2 — Family Holdings Tracker

Track stocks, warrants, real estate, art, and other assets across family members and brokerage accounts. Role-based auth, CSV/PDF export, and dashboard charts.

## What's New in v2

- **Authentication**: Email/password login via Supabase Auth
- **Role-based access**: Superadmin sees everything; members see only their own
- **Dashboard**: Charts for holdings by asset, by person, cash, and transaction activity
- **Export**: CSV and PDF export on Ledger, Holdings, and Cash tabs
- **Local mode**: Works without Supabase (localStorage only, no login)

---

## Quick Start (Local Dev — No Auth)

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. With empty env vars, you get local-only mode with full admin access and localStorage persistence.

---

## Full Deployment: Vercel + Supabase

### 1. Create Supabase Project (~5 min)

1. [supabase.com](https://supabase.com) → New Project → name: `adraba`
2. Wait for provisioning

### 2. Run Database Schema (~2 min)

1. Supabase → **SQL Editor** → New query
2. Paste contents of `supabase/schema.sql` → **Run**

### 3. Configure Authentication (~3 min)

1. Supabase → **Authentication** → **Providers** → Ensure **Email** is enabled
2. Authentication → **Settings** → Disable **"Confirm email"** (for easier dev)
3. Authentication → **Users** → **Add user**:
   - `menny@yourdomain.com` / your password
4. Run this SQL to make Menny the superadmin:

```sql
UPDATE profiles
SET role = 'superadmin', member_id = 'm1', display_name = 'Menny'
WHERE email = 'menny@yourdomain.com';
```

5. Add other family members the same way:

```sql
-- After creating each user in Auth → Users → Add user:
UPDATE profiles SET member_id = 'm2', display_name = 'Itamar' WHERE email = 'itamar@...';
UPDATE profiles SET member_id = 'm3', display_name = 'Amir'   WHERE email = 'amir@...';
UPDATE profiles SET member_id = 'm4', display_name = 'Dorit'  WHERE email = 'dorit@...';
UPDATE profiles SET member_id = 'm5', display_name = 'Rachel' WHERE email = 'rachel@...';
UPDATE profiles SET member_id = 'm6', display_name = 'Yechezkel' WHERE email = 'yechezkel@...';
```

### 4. Get API Keys (~1 min)

Supabase → **Project Settings** → **API**:
- Copy **Project URL** (`https://abc123.supabase.co`)
- Copy **anon public key** (`eyJ...`)

### 5. Push to GitHub (~2 min)

```bash
git init && git add . && git commit -m "adraba v2"
git remote add origin https://github.com/YOU/adraba.git
git push -u origin main
```

### 6. Deploy on Vercel (~3 min)

1. [vercel.com](https://vercel.com) → Import `adraba` repo
2. Add environment variables:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | Your project URL |
| `VITE_SUPABASE_ANON_KEY` | Your anon key |

3. Click **Deploy**. Done.

---

## Roles & Permissions

| Role | See All Members | Edit Data | Manage Members/Assets/Accounts | Delete Transactions |
|------|:-:|:-:|:-:|:-:|
| **superadmin** (Menny) | ✅ | ✅ | ✅ | ✅ |
| **member** | Own data only | Record own tx | ❌ | ❌ |

- **Superadmin** sees all tabs including Members, Assets, Accounts management
- **Members** see Dashboard, Ledger, Record, Holdings, Cash — filtered to their own data
- Member dropdown on Record Transaction is limited to the logged-in member (unless superadmin)

---

## Export

Every data tab has CSV and PDF export buttons:

| Tab | CSV | PDF |
|-----|-----|-----|
| Ledger | ✅ | ✅ |
| Holdings by Person | ✅ | ✅ |
| Cash Summary | ✅ | ✅ |

PDF exports include the adraba header, generation date, and formatted tables.

---

## Dashboard Charts

The dashboard shows:
- **KPI cards**: Members, total units, total cash, transaction count
- **Holdings by Asset**: Bar chart of units per ticker
- **Holdings by Person**: Donut chart of share distribution
- **Cash by Person**: Bar chart of cash from sales
- **Transactions by Type**: Donut chart of issuance/transfer/sale/buy
- **Activity Over Time**: Line chart of monthly transaction volume

---

## Tech Stack

React 18 · Vite 5 · Supabase (Postgres + Auth) · Recharts · jsPDF · Vercel

## Cost

Vercel free tier + Supabase free tier = **$0/month** for a family of 6.
