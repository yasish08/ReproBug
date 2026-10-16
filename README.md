# ReproBug

**Smart browser error reporting and reproduction platform.**

ReproBug is a developer-focused workspace for collecting browser errors, grouping repeated failures, tracking issue status, and helping teams reproduce bugs with useful context.

## Current capabilities

- React + Vite issue dashboard with search, severity/status filters, responsive layout, and a report-issue form
- Express API with security headers, restricted CORS, JSON request limits, and a database-aware health endpoint
- Prisma/PostgreSQL data model for users, projects, memberships, issues, and issue events
- Issue API to list/filter issues, report errors, change status, and group matching reports by fingerprint
- Built-in Node.js unit tests for issue fingerprints and safe page URL validation
- GitHub Actions workflow to run backend unit tests, validate the Prisma schema, generate Prisma Client, and build the frontend

> **Development status:** The UI has clearly labeled sample data when the API/database cannot supply live issues. The production database still needs to be configured and migrated; authentication, browser extension capture, comprehensive tests, and deployment remain in progress.

## Stack

- **Frontend:** React 18, JavaScript, Vite, Lucide
- **Backend:** Node.js, Express
- **Database:** PostgreSQL, Prisma
- **Browser capture (planned):** Chrome Extension Manifest V3
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

3. Edit `server/.env` and set `DATABASE_URL` to your local PostgreSQL database. Create the database first if it does not exist.

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

## Run backend unit tests

The pure utility tests run without PostgreSQL or external services:

```bash
npm test --workspace=server
```

They cover deterministic/case-insensitive fingerprints and validation of optional, malformed, non-HTTP, and overlong page URLs.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | API and database health |
| GET | `/api/issues` | List issues; optional `limit`, `status`, `severity`, `projectId` filters |
| POST | `/api/issues` | Report an issue; matching fingerprints increase occurrence count |
| PATCH | `/api/issues/:id/status` | Change an issue's status |

Example issue payload:

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
- [ ] Configure PostgreSQL and commit a verified migration
- [ ] Authentication and project-level authorization
- [ ] Chrome extension capture with sensitive-data redaction
- [ ] Reproduction guidance, activity timeline, and analytics
- [ ] Unit/API/integration tests and security hardening
- [ ] Deployment, architecture documentation, screenshots, and demo

## Development

All project work is being made directly on `main` as requested. Do not commit secrets or a real `.env` file.
