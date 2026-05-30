# nourish 🌸

Intermittent fasting, weight & period tracker — a PWA backed by Supabase.

## Stack
- **Vite** — build tool & dev server
- **Supabase** — auth + Postgres database
- **Chart.js** — weight chart
- **vite-plugin-pwa** — service worker & installable PWA

---

## 1. Supabase setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. In **Project Settings → API**, copy:
   - **Project URL**
   - **anon / public** key

---

## 2. Local setup

```bash
# clone your repo
git clone https://github.com/YOUR_USERNAME/nourish.git
cd nourish

# install dependencies
npm install

# create your env file
cp .env.example .env
# → edit .env and paste your Supabase URL and anon key

# start dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 3. Deploy to GitHub Pages (free)

### One-time setup
1. Push the repo to GitHub
2. Go to repo **Settings → Pages → Source** → select **GitHub Actions**
3. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

4. In repo **Settings → Secrets → Actions**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Every push to `main` will build and deploy automatically.

---

## 4. Install as PWA

**iOS (Safari):** Share → Add to Home Screen  
**Android (Chrome):** Menu → Add to Home Screen  
**Desktop Chrome:** Click the install icon in the address bar

---

## 5. Add PWA icons

Place these in `/public/icons/`:
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

You can generate them from any image at [maskable.app](https://maskable.app).

---

## Project structure

```
nourish/
├── index.html
├── vite.config.js
├── package.json
├── .env.example
├── supabase/
│   └── schema.sql          ← run this in Supabase SQL editor
├── public/
│   └── icons/              ← add icon-192.png and icon-512.png here
└── src/
    ├── main.js             ← entry point, auth routing
    ├── style.css           ← all styles
    ├── lib/
    │   ├── supabase.js     ← Supabase client
    │   └── db.js           ← all database queries
    └── components/
        ├── auth.js         ← sign in / sign up screen
        └── app.js          ← main app (fasting, weight, calendar)
```
