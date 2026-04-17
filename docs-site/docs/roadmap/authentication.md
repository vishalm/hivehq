---
sidebar_position: 1
title: "Authentication & Authorization"
description: "Keycloak OIDC/SSO authentication with RBAC and multi-tenant isolation"
---

# Authentication & Authorization

HIVE uses Keycloak as the identity provider, delivering enterprise-grade OIDC/SSO authentication with role-based access control and multi-tenant isolation.

## Architecture

```
Browser                  Keycloak                 Node Server
  │                        │                         │
  ├── /login ──────────────►  Authorization Endpoint  │
  │                        │                         │
  ◄── redirect + code ─────┤                         │
  │                        │                         │
  ├── code + verifier ─────►  Token Endpoint          │
  │                        │                         │
  ◄── access_token + ──────┤                         │
  │   refresh_token        │                         │
  │                        │                         │
  ├── API call + Bearer ───────────────────────────────►  JWKS verify
  │                        │                         │    Role check
  ◄── response ─────────────────────────────────────────  Tenant scope
```

The browser flow uses OIDC Authorization Code with PKCE (S256). The Node server verifies JWTs using Keycloak's JWKS endpoint with native Node.js crypto (no external JWT libraries).

## Auth Strategies

The Node server accepts three authentication methods in priority order:

1. **API Key** (`Authorization: Bearer hive_ak_...`) — Machine-to-machine ingest. Keys are SHA-256 hashed in the database, with a 12-character prefix for fast lookup.
2. **Legacy Token** (`Authorization: Bearer <token>`) — Backward-compatible with existing Scout/proxy deployments using `NODE_INGEST_TOKEN`.
3. **OIDC JWT** (`Authorization: Bearer <jwt>`) — Browser sessions from Keycloak. Verified via JWKS with 10-minute cache TTL.

## Roles

HIVE defines five roles with a composite hierarchy:

| Role | Inherits | Purpose |
|------|----------|---------|
| `viewer` | — | Read-only access to dashboards and events |
| `operator` | `viewer` | Manage connectors, setup, configuration reads |
| `admin` | `operator` | Full control: users, API keys, settings, configuration writes |
| `super_admin` | `admin` | Platform-level: tenant hierarchy management (SaaS mode) |
| `gov_auditor` | — | Cross-tenant read-only access to audit logs (separate hierarchy) |

### Route Protection

```
Public (no auth):
  /health, /version, /metrics, /landing, /login, /signup

TTP Ingest (any auth method):
  POST /api/v1/ttp/ingest

Viewer+:
  GET /api/v1/events, /api/v1/rollups, /api/v1/intelligence/*

Operator+:
  GET /api/v1/config, /setup

Admin+:
  PUT /api/v1/config, /admin/users, /admin/api-keys, /admin/audit

Super Admin:
  /admin/tenants
```

## Multi-Tenant Isolation

HIVE supports a six-level tenant hierarchy:

```
Country
  └─ Government
       └─ Group
            └─ Enterprise
                 └─ Company
                      └─ Individual
```

Tenant isolation is enforced at the database level. Every TTP event, user, and API key is scoped to a tenant. Recursive CTEs handle ancestor/descendant traversal for hierarchical access.

### Deployment Modes

| Mode | Tenancy | Description |
|------|---------|-------------|
| `bespoke` | Single root tenant | On-premises deployment. Full hierarchy under one root. |
| `saas` | Multiple root tenants | Shared infrastructure with strict data isolation between roots. |

Set via `HIVE_DEPLOYMENT_MODE` environment variable.

## Keycloak Configuration

HIVE auto-imports a pre-configured realm on first boot:

**Realm**: `hive`

**Clients**:
- `hive-dashboard` — Public OIDC client (PKCE, browser flow)
- `hive-api` — Confidential client (server-to-server, service account)

**Default Users** (development):

| Email | Password | Roles |
|-------|----------|-------|
| `admin@hive.local` | `admin` | `admin`, `operator`, `viewer` |
| `operator@hive.local` | `operator` | `operator`, `viewer` |
| `viewer@hive.local` | `viewer` | `viewer` |

**Realm roles**: `viewer`, `operator`, `admin`, `super_admin`, `gov_auditor`

## API Keys

For machine-to-machine authentication (Scout, connectors, CI/CD):

```
Format: hive_ak_XXXXXXXXXXXX_YYYYYYYYYYYYYYYYYYYYYYYYYYYY
         └─ prefix (12 chars)  └─ secret (28 chars)
```

API keys are generated in the Admin UI or via the API. The full key is shown once at creation. Only the SHA-256 hash is stored. Prefix lookup enables fast resolution without scanning all hashes.

Each API key is scoped to a tenant and carries assigned roles.

## Audit Log

Every authentication event, role change, API key operation, and configuration modification is recorded in an append-only, immutable audit log. Fields include:

- Actor (email, role, tenant)
- Action type (e.g., `auth.login`, `api_key.created`, `user.role_changed`)
- Severity (info, warn, error, critical)
- Resource type and ID
- IP address and timestamp

The audit log cannot be edited or deleted. Users with the `gov_auditor` role have cross-tenant read access.

## Database Schema

```sql
-- Tenant hierarchy
CREATE TABLE hive_tenants (
  id UUID PRIMARY KEY,
  parent_id UUID REFERENCES hive_tenants(id),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL, -- country|government|group|enterprise|company|individual
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (synced from Keycloak on login)
CREATE TABLE hive_users (
  id UUID PRIMARY KEY,
  keycloak_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  roles TEXT[] NOT NULL DEFAULT '{viewer}',
  tenant_id UUID REFERENCES hive_tenants(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- API Keys (hashed, prefix-indexed)
CREATE TABLE hive_api_keys (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  prefix VARCHAR(12) UNIQUE NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{viewer}',
  tenant_id UUID REFERENCES hive_tenants(id),
  created_by UUID REFERENCES hive_users(id),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Immutable audit log
CREATE TABLE hive_audit_log (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  actor_id UUID,
  actor_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  detail JSONB,
  ip_address INET,
  tenant_id UUID REFERENCES hive_tenants(id)
);
```

## Admin UI Pages

The dashboard includes a full admin section behind `AuthGuard` (admin+ role required):

- **/admin/users** — User list with role pills, invite capability
- **/admin/api-keys** — Generate, view (prefix only), and revoke API keys
- **/admin/audit** — Filterable, searchable audit log viewer
- **/admin/tenants** — Interactive tenant hierarchy tree (super_admin only)

## Environment Variables

### Node Server

| Variable | Default | Description |
|----------|---------|-------------|
| `HIVE_AUTH_MODE` | `keycloak` | Auth mode: `keycloak` (production) or `none` (dev bypass) |
| `HIVE_DEPLOYMENT_MODE` | `bespoke` | Tenancy: `bespoke` (single-tenant) or `saas` (multi-tenant) |
| `KEYCLOAK_URL` | — | Keycloak base URL (e.g., `http://keycloak:8080`) |
| `KEYCLOAK_REALM` | `hive` | Keycloak realm name |
| `KEYCLOAK_CLIENT_ID` | `hive-api` | Confidential client ID |
| `KEYCLOAK_CLIENT_SECRET` | — | Client secret for service account |
| `HIVE_DEFAULT_TENANT_ID` | `00000000-...0001` | Default tenant UUID |

### Dashboard

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_KEYCLOAK_URL` | — | Keycloak URL accessible from browser |
| `NEXT_PUBLIC_KEYCLOAK_REALM` | `hive` | Realm name |
| `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` | `hive-dashboard` | Public OIDC client ID |

## Security Design

- **Zero content principle** — Auth layer never reads prompts or completions. Metadata only.
- **In-memory token storage** — Access/refresh tokens stored in module-level variables, never in `localStorage` or `sessionStorage`.
- **PKCE (S256)** — Proof Key for Code Exchange prevents authorization code interception.
- **JWKS verification** — RS256 JWT verification using native Node.js `crypto.createPublicKey` and `crypto.verify`. No `jsonwebtoken` dependency.
- **Key hashing** — API keys stored as SHA-256 hashes. Full key shown once at creation.
- **Immutable audit** — Append-only log with no UPDATE or DELETE operations.
- **Tenant isolation** — Every query is scoped to the user's accessible tenant tree.

---

**Status**: Implemented in Phase 4. Keycloak realm, auth middleware, RBAC, multi-tenant hierarchy, admin UI, and API key system are all operational.
