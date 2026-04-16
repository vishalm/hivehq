---
sidebar_position: 1
title: "Authentication Roadmap"
description: "Plan for adding authentication across the HIVE platform"
---

# Authentication Roadmap

HIVE Phase 4 will add authentication and authorization across the platform. This document outlines the plan.

## Architecture Decision

### Recommended: NextAuth.js (Auth.js v5)

NextAuth.js is the natural choice for HIVE's Next.js dashboard:

- **Zero-dependency auth** for Next.js App Router
- **Built-in providers**: Email/password, Google, GitHub, Microsoft, SAML/SSO
- **JWT + session strategy** — works with HIVE's existing Node server
- **Database adapters** — can use the existing Postgres/Timescale store

### Alternative: Clerk or Auth0

For Enterprise tier, consider Clerk or Auth0 for managed SSO/SAML. These can be swapped in later via the same middleware pattern.

## Implementation Plan

### Phase 4a: Core Auth (2-3 days)

1. **Install NextAuth.js v5**
   - `npm install next-auth@beta` in `packages/dashboard`
   - Configure `auth.ts` at the dashboard root
   - Set `AUTH_SECRET` environment variable

2. **Credentials Provider** (email + password)
   - Add `users` table to Node server (id, email, password_hash, role, created_at)
   - Use bcrypt for password hashing
   - Login API: `POST /api/auth/callback/credentials`

3. **Middleware Protection**
   - `middleware.ts` at dashboard root
   - Protect all routes except `/landing`, `/login`, `/signup`, `/api/auth/*`
   - Redirect unauthenticated users to `/login`

4. **Session Management**
   - JWT strategy (stateless, no session DB needed initially)
   - Token includes: user_id, email, role, organization_id
   - 24-hour expiry with silent refresh

### Phase 4b: Pages & UI (1-2 days)

1. **Login Page** (`/login`) — Already built (placeholder)
   - Wire up to NextAuth `signIn()` method
   - Add error states and loading indicators
   - Add "Remember me" checkbox

2. **Signup Page** (`/signup`)
   - Email + password registration form
   - Email verification (optional, via Resend or Nodemailer)
   - Terms acceptance checkbox

3. **User Menu in NavShell**
   - Replace version tag with user avatar/initial
   - Dropdown: Profile, Organization, Sign Out
   - Show role badge (admin, viewer, operator)

4. **Protected Route Wrapper**
   - `useSession()` hook in client components
   - Loading skeleton while session resolves
   - Automatic redirect on session expiry

### Phase 4c: Authorization & Roles (2-3 days)

1. **Role-Based Access Control (RBAC)**

   | Role | Dashboard | Intelligence | Settings | Setup | Admin |
   |------|-----------|-------------|----------|-------|-------|
   | Viewer | Read | Read | - | - | - |
   | Operator | Read | Read | Read | Read | - |
   | Admin | Full | Full | Full | Full | Full |

2. **Organization Scoping**
   - Each user belongs to an organization
   - Events are scoped to organization_id
   - Node server validates org_id on ingest

3. **API Key Authentication**
   - For Node server ingest API (machine-to-machine)
   - `Authorization: Bearer <api-key>` header
   - API keys are organization-scoped
   - Managed in Settings > API Keys

### Phase 4d: SSO / Enterprise (1 week)

1. **SAML Provider** via NextAuth
   - Configure IdP metadata URL
   - Attribute mapping (email, name, groups)
   - JIT (Just-In-Time) user provisioning

2. **Google Workspace / Microsoft Entra**
   - OAuth2 providers in NextAuth config
   - Domain restriction (only allow `@company.com`)

3. **Multi-Tenant Isolation**
   - Separate data stores per organization
   - Tenant-aware middleware
   - Admin console for tenant management

## Route Protection Map

```
/landing          → Public (no auth)
/login            → Public (redirect if authenticated)
/signup           → Public (redirect if authenticated)
/                 → Protected (any role)
/intelligence     → Protected (any role)
/graphs           → Protected (any role)
/setup            → Protected (operator, admin)
/settings         → Protected (admin)
/admin/*          → Protected (admin only)
/api/auth/*       → NextAuth handlers
/api/v1/ttp/*     → API key auth (machine-to-machine)
```

## Database Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table (optional, for DB sessions)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## File Structure

```
packages/dashboard/
├── auth.ts                    # NextAuth configuration
├── middleware.ts               # Route protection middleware
├── src/app/
│   ├── login/
│   │   ├── page.tsx           # Already created
│   │   └── login-client.tsx   # Already created (wire up signIn)
│   ├── signup/
│   │   ├── page.tsx
│   │   └── signup-client.tsx
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts   # NextAuth API routes
│   └── components/
│       ├── user-menu.tsx      # Nav user dropdown
│       └── auth-guard.tsx     # Client-side auth wrapper
```

## Environment Variables

```bash
# Required
AUTH_SECRET=<random-32-char-string>
AUTH_URL=http://localhost:3001

# Optional (SSO)
AUTH_GOOGLE_ID=<google-oauth-client-id>
AUTH_GOOGLE_SECRET=<google-oauth-secret>
AUTH_MICROSOFT_TENANT_ID=<azure-tenant-id>
```

## Security Considerations

- Passwords hashed with bcrypt (cost factor 12)
- CSRF protection via NextAuth's built-in tokens
- Rate limiting on login endpoint (5 attempts per minute)
- API keys are hashed in the database (never stored in plaintext)
- Session tokens are HttpOnly, Secure, SameSite=Lax cookies
- All auth operations go through the HIVE Vault for key storage

---

**Status**: Planned for Phase 4. Login and Signup UI scaffolding already in place.
