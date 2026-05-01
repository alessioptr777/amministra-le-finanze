# Track Sheet - Personal Finance App

A simple finance tracking app for freelancers/solopreneurs to track income and expenses for Spanish tax reporting (Mod 130 and Mod 420).

## Features

- **Entrate (Income)** - Track cash and card payments, separate declarable amounts
- **Spese (Expenses)** - Track variable expenses
- **Spese Fisse (Fixed Expenses)** - Track recurring monthly expenses
- **Fatture (Invoices)** - Track invoices issued and received
- **Debiti (Debts/Loans)** - Track payment plans and loan schedules
- **Dashboard** - View financial summary and tax calculations
- **Tax Forms** - Auto-calculate Spanish tax forms:
  - Mod 130 (IRPF quarterly income)
  - Mod 420 (IGIC/VAT quarterly)

## Tech Stack

- **Frontend:** React 19 + Vite + React Router
- **Styling:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth)
- **Hosting:** Vercel
- **Security:** Simple password-based authentication

## Development

### Prerequisites
- Node.js 16+
- npm or pnpm

### Setup

1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file with Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_APP_PASSWORD=your-password
   ```

4. Start dev server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## Deployment to Vercel

### Important: Environment Variables

The `.env` file is not committed to GitHub (it's in `.gitignore` for security). You must set environment variables in Vercel:

1. Go to https://vercel.com/dashboard
2. Select the `amministra-le-finanze` project
3. Settings → Environment Variables
4. Add these three variables:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `VITE_APP_PASSWORD` - Login password for the app

Without these environment variables, the app will not be able to connect to the database.

## Troubleshooting

### Data Not Persisting?

1. **Check environment variables** - Make sure they're set in Vercel dashboard (see above)
2. **Run diagnostic test** - Go to `/test` page and click "Run Tests"
3. **Check browser console** - DevTools F12 → Console while submitting form
4. **See DEBUGGING.md** - Comprehensive troubleshooting guide

### Issues?

- Read `DEBUGGING.md` for step-by-step troubleshooting
- Read `FIXES_APPLIED.md` for recent fixes to data persistence
- Check browser console for error messages while performing actions

## Key Files

```
src/
  pages/
    Dashboard.jsx     - Main dashboard with tax calculations
    Entrate.jsx       - Income entry form
    Spese.jsx         - Variable expenses
    Debiti.jsx        - Loans/payment plans
    Fatture.jsx       - Invoices
    SpeseFisse.jsx    - Fixed monthly expenses
    Budget.jsx        - Budget tracking
    Test.jsx          - Diagnostic test page
  lib/
    supabase.js       - Supabase client setup
    useAuth.jsx       - Authentication hook
```

## Configuration Files

- `vite.config.js` - Vite configuration
- `vercel.json` - Vercel deployment config (SPA routing)
- `tailwind.config.js` - Tailwind CSS config
- `eslint.config.js` - ESLint rules
- `DEBUGGING.md` - Troubleshooting guide
- `FIXES_APPLIED.md` - Recent fixes summary

## License

Private project for personal use.
