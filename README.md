# Authentication test console

Select an institution in the dashboard (or in GitHub Actions) instead of editing `.env` for each site.

## Institutions

URLs live in `config/institutions.json`. Override them with secrets if needed:

- `HAPPYPRANCER_LOGIN_URL` / `HAPPYPRANCER_SIGNUP_URL`
- `BWORKZ_LOGIN_URL` / `BWORKZ_SIGNUP_URL`
- `AWSAIAPP_LOGIN_URL` / `AWSAIAPP_SIGNUP_URL`

Credentials still come from `.env` locally, or from GitHub secrets in CI (`LOGIN_EMAIL`, `LOGIN_PASSWORD`, `SIGNUP_*`).

## Local dashboard

```bash
npm install
npx playwright install chromium
npm run dashboard
```

Open http://localhost:3000, choose HappyPrancer / Bworkz / AWSAIAPP, pick Login, Signup, or both, then run tests. HTML and Excel reports are linked from the same page.

CLI equivalent:

```bash
node scripts/run-auth-tests.js --institution happyprancer --module login --project "Desktop Chrome"
```

## GitHub workflow

The workflow `.github/workflows/auth-tests.yml` has the same institution and module dropdowns.

1. Push this repo to GitHub.
2. Add repository secrets for credentials (and optional URL overrides).
3. Enable GitHub Pages with **Source: GitHub Actions**.
4. Run **Actions → Authentication tests → Run workflow**.
5. The job summary and environment URL point at the published HTML report.

To trigger that workflow from the dashboard after it is hosted, set:

- `GITHUB_TOKEN` (PAT with `actions:write`)
- `GITHUB_REPOSITORY` (`owner/repo`)
- `DASHBOARD_PUBLIC_URL` (the hosted dashboard link, sent into the workflow as `dashboard_url`)
