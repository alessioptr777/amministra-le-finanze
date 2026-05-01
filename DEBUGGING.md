# Debug Guide - Data Persistence Issues

## Problem
Data (entrate and debiti) appears to disappear when deploying or on page refresh.

## Solution Steps

### 1. Test Supabase Connection
1. Go to the app and login (password: M3tapr8s)
2. Click on any nav item and look for `/test` in the URL
3. Or go directly to: `https://amministra-le-finanze.vercel.app/test`
4. Click "Run Tests" button
5. Check the results:
   - ✓ All tests pass = Database is working correctly
   - ✗ Any test fails = See the error message for details

### 2. Check Browser Console for Errors
1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to Console tab
3. Try adding a new entrata:
   - Go to "Entrate" page
   - Click "+ Aggiungi"
   - Fill in form (Cash totale €, Card €, Cash dichiarato €)
   - Click "Salva entrata"
4. Check console for:
   - "Form validation failed" - missing activity or zero amount
   - "Saving entrata: {...}" - data being sent
   - "Supabase error: {...}" - database error details
   - "Insert successful: [...]" - successful insert

### 3. Verify Vercel Environment Variables
The app needs these environment variables on Vercel:
- `VITE_SUPABASE_URL` = Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key
- `VITE_APP_PASSWORD` = M3tapr8s

To set them on Vercel:
1. Go to https://vercel.com/dashboard
2. Select "amministra-le-finanze" project
3. Settings > Environment Variables
4. Add/verify the three variables above

### 4. Check Supabase RLS Policies
1. Go to https://app.supabase.com (your project)
2. Database > Tables
3. For each table (attivita, entrate, spese, debiti, fatture_*, categorie_spese):
   - Click table name
   - Go to "Auth" tab
   - Verify RLS is "Disabled" (allow any insert/update/delete)
   - If RLS is enabled, click "Disable RLS"

### 5. Verify Database Schema
The entrate table should have these columns:
- id (uuid, primary key)
- data (date)
- attivita_id (text)
- attivita_nome (text)
- attivita_colore (text)
- importo_cash (numeric)
- importo_card (numeric)
- importo_lordo (numeric)
- cash_dichiarato (numeric)
- importo_netto (numeric)
- igic_percentuale (numeric)
- note (text)
- dichiara (boolean, default true)

Missing columns? Run this in Supabase SQL Editor to add them:
```sql
ALTER TABLE entrate ADD COLUMN IF NOT EXISTS cash_dichiarato NUMERIC DEFAULT 0;
```

### 6. Common Issues

**Issue: "No activities to select from"**
- Solution: Click "Attività" button, then "Reset a default"
- This should auto-happen now on first load

**Issue: Form won't save**
- Make sure you've selected an activity from the dropdown
- Make sure you've entered at least Cash or Card amount

**Issue: "Azzera tutti i dati" button was clicked**
- This permanently deletes all data
- It's the "Reset All Data" button in Dashboard
- Can't be undone from the app (would need SQL restore from backups)

## Browser Console Commands

You can also test directly from browser console:

```javascript
// Test insert
const { data, error } = await supabase.from('entrate').insert([{
  data: '2026-05-01',
  attivita_id: 'test',
  attivita_nome: 'Test',
  importo_cash: 100,
  importo_lordo: 100,
  cash_dichiarato: 100,
  importo_netto: 100
}]).select()

// Read back
await supabase.from('entrate').select('*').order('data', { ascending: false }).limit(1)
```

## Still Having Issues?

1. Check browser console while performing actions
2. Use the Test page (/test) to verify connection
3. Verify Vercel environment variables are set
4. Verify Supabase RLS is disabled on all tables
5. Check Supabase database for correct schema

The app should now auto-initialize default activities on first load, which should allow you to add entries immediately.
