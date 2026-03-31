# adraba v3 — Family Holdings Tracker

Growth & Capital Advisory — track stocks, warrants, real estate, art, and more across family members and brokerage accounts.

## What's New in v3

- **Fintech-grade UI** redesign with adraba brand (Rubik font, gold/brown/cream palette, sidebar nav)
- **Bulk transaction entry** — spreadsheet-like inline form for entering many transactions at once
- **Excel upload** — import transactions from .xlsx/.csv files directly
- **Live stock prices** via Yahoo Finance (Vercel API route at `/api/prices`)
- **Portfolio valuation** — holdings show computed value (units × last price) across all views
- **Checkboxes** on Holdings and Assets tables — check rows to see selected total
- **Consolidated Admin** — Members, Assets, and Accounts combined under single Administration page
- **Assets with prices** — Last Price column, Value column, change %, illiquid manual valuation

## Deployment

Same as v2: `npm install && npm run dev` for local. For production: Vercel + Supabase.

### Stock Price API

The `/api/prices.js` is a Vercel serverless function that proxies Yahoo Finance. It deploys automatically when you deploy to Vercel. No API key needed.

### Setup Steps

1. Create Supabase project, run `supabase/schema.sql`
2. Create users in Auth dashboard, set roles via SQL
3. Push to GitHub, deploy on Vercel with env vars
4. See v2 README for detailed step-by-step

## Brand

Colors from `ADRABA_Brand_logo_guideline.pdf`:
- Gold: `#FFBE14` (primary)
- Orange: `#FA8100` (accent)
- Dark Brown: `#3D372C` (text, sidebar)
- Brown: `#675C47` (secondary)
- Cream: `#F4EDE5` (backgrounds)
- Font: Rubik (Regular + Medium)

## Tech Stack

React 18 · Vite 5 · Supabase · Recharts · jsPDF · SheetJS (xlsx) · Vercel Serverless