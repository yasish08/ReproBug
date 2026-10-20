# ReproBug

**Smart browser error reporting and reproduction platform.**

ReproBug is a developer-focused workspace for collecting browser errors, grouping repeated failures, tracking issue status, and helping teams reproduce bugs with useful context.

## Current capabilities

- React + Vite issue dashboard with search, severity/status filters, responsive layout, and a report-issue form
- Express API with security headers, restricted CORS, JSON request limits, database-aware health checks, and JWT authentication
- Prisma/PostgreSQL data model for users, projects, memberships, issues, and issue events
- Registration/login/profile endpoints, password hashing, expiring JWT sessions, and project-membership-scoped issue reads/updates
- Issue API to list/filter issues, report errors, change status, and group matching reports by fingerprint
- Built-in Node.js unit tests for issue fingerprints and safe page URL validation
- GitHub Actions workflow to run backend unit tests, validate the Prisma schema, generate Prisma Client, and build the frontend

> **Development status:** The UI has clearly labeled sample data when the API/database cannot supply live issues. An initial PostgreSQL migration is committed and CI applies it to a temporary PostgreSQL service. Email/password registration, bcrypt password hashing, 12-hour JWT sessions, authenticated dashboard access, and workspace membership checks are implemented; the opt-in Manifest V3 capture extension is implemented; deployment and production hardening remain in progress.

## Stack

- **Frontend:** React 18, JavaScript, Vite, Lucide
- **Backend:** Node.js, Express
- **Database:** PostgreSQL, Prisma
- **Browser capture:** Chrome Extension Manifest V3 (opt-in current-tab JavaScript error and unhandled-rejection capture)
- **CI:** GitHub Actions

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL 14 or newer (for live persistence)

## Local setup

1. Clone the repository and install workspace dependencies:

   ```bash
   git clone https://github.com/yasish08/ReproBug.git
   cd ReproBug
   npm install
   ```

2. Create your local server environment file:

   ```bash
   cp server/.env.example server/.env
   ```

3. Edit `server/.env`, set `DATABASE_URL` to your local PostgreSQL database, and replace `JWT_SECRET` with a random secret of at least 32 characters. Create the database first if it does not exist.

4. Generate Prisma Client and apply the initial development migration:

   ```bash
   npm run db:generate --workspace=server
   npm run db:migrate --workspace=server
   ```

5. Start the API and frontend together:

   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:5173
   - API health: http://localhost:4000/api/health
   - Issues API: http://localhost:4000/api/issues

## Chrome extension

The unpacked Manifest V3 extension is in `extension/`. Load it through `chrome://extensions` → **Developer mode** → **Load unpacked**, selecting that folder. In the popup, enter the API URL, sign in with your ReproBug account, then click **Enable capture on this tab**. It captures JavaScript errors and unhandled promise rejections only on the tab you explicitly enable. The extension stores its short-lived session token locally and needs you to sign in again after 12 hours. See [extension setup and privacy notes](extension/README.md).

## Run backend unit tests

Unit tests run without PostgreSQL; API integration tests require a migrated PostgreSQL database. GitHub Actions provisions PostgreSQL, applies migrations, and runs both suites:

```bash
npm run test:unit --workspace=server
npm run db:deploy --workspace=server
npm run test:integration --workspace=server
```

Unit tests cover deterministic/case-insensitive fingerprints and page URL validation. Integration tests exercise health checks, input validation, duplicate issue grouping, listing/filtering, and persisted status changes.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | API and database health (public) |
| POST | `/api/auth/register` | Create an account and workspace |
| POST | `/api/auth/login` | Sign in and receive a 12-hour JWT |
| GET | `/api/auth/me` | Return the authenticated account (Bearer token required) |
| GET | `/api/issues` | List issues; optional `limit`, `status`, `severity`, `projectId` filters |
| POST | `/api/issues` | Report an issue; matching fingerprints increase occurrence count |
| PATCH | `/api/issues/:id/status` | Change an issue's status |

Issue endpoints require `Authorization: Bearer <token>` and are scoped to workspaces where the account is a member. Example issue payload:

```json
{
  "title": "Checkout fails after applying a discount",
  "message": "TypeError: Cannot read properties of undefined",
  "severity": "HIGH",
  "pageUrl": "https://example.com/checkout",
  "projectSlug": "storefront"
}
```

Only include diagnostic data you are authorized to share. Do not send passwords, authentication tokens, or unnecessary personal data.

## Roadmap

- [x] Dashboard and Express API foundation
- [x] Initial Prisma data model
- [x] Issue reporting/listing, status changes, fingerprint grouping
- [x] Unit tests for fingerprint and page URL validation
- [x] CI workflow for schema validation and frontend build
- [ ] Verify the initial migration and API integration suite in PostgreSQL CI
- [x] Authentication and project-level authorization for dashboard issue APIs
- [x] Opt-in Chrome extension capture with best-effort sensitive-data redaction
- [ ] Reproduction guidance, activity timeline, and analytics
- [ ] Unit/API/integration tests and security hardening
- [ ] Deployment, architecture documentation, screenshots, and demo

## Development

All project work is being made directly on `main` as requested. Do not commit secrets or a real `.env` file.
