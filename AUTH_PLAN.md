# HIVE Phase 4 — Authentication, RBAC & Multi-Tenant Isolation

## Design Principles

1. **Keycloak as Identity Provider** — battle-tested, supports OIDC, SAML, social login, RBAC, and multi-realm tenant isolation out of the box.
2. **Dual deployment mode** — works as bespoke (single-tenant on-prem) AND SaaS (multi-tenant shared infra).
3. **Tenant hierarchy** — Country > Government > Group > Enterprise > Company > Individual.
4. **Zero Content Principle preserved** — auth layer never touches prompts/completions.

---

## 1. Tenant Hierarchy Model

```
Country (AE, US, UK, IN)
  └── Government / Regulator       ← can audit all orgs under their country
        └── Group                   ← holding company / conglomerate
              └── Enterprise        ← business unit
                    └── Company     ← operating entity (= Keycloak Realm)
                          └── User  ← individual with roles
```

### Database Schema: `hive_tenants`

```sql
CREATE TABLE hive_tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id     UUID REFERENCES hive_tenants(id),
  tenant_type   TEXT NOT NULL CHECK (tenant_type IN ('country','government','group','enterprise','company')),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  country_code  CHAR(2) NOT NULL,
  data_residency TEXT NOT NULL DEFAULT 'AE',
  regulation_tags TEXT[] NOT NULL DEFAULT '{}',
  plan          TEXT NOT NULL DEFAULT 'community' CHECK (plan IN ('community','professional','enterprise','government')),
  keycloak_realm TEXT UNIQUE,
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_parent ON hive_tenants(parent_id);
CREATE INDEX idx_tenants_type   ON hive_tenants(tenant_type);
CREATE INDEX idx_tenants_country ON hive_tenants(country_code);
```

### Isolation Strategy

| Deployment | Isolation | How |
|---|---|---|
| **Bespoke** (on-prem) | Single tenant, single Keycloak realm | `tenant_id` hardcoded in env |
| **SaaS** | Multi-tenant, one Keycloak realm per Company | All queries scoped by `tenant_id`, RLS on Postgres |

---

## 2. Keycloak Setup

### Docker Compose: Separate Postgres for Keycloak

Keycloak gets its own Postgres (not shared with HIVE data — clean separation of auth state from telemetry).

```yaml
keycloak-db:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: keycloak
    POSTGRES_USER: keycloak
    POSTGRES_PASSWORD: ${KEYCLOAK_DB_PASSWORD:-keycloak_dev}
  volumes:
    - keycloak-data:/var/lib/postgresql/data

keycloak:
  image: quay.io/keycloak/keycloak:26.0
  command: start-dev --import-realm
  environment:
    KC_DB: postgres
    KC_DB_URL: jdbc:postgresql://keycloak-db:5432/keycloak
    KC_DB_USERNAME: keycloak
    KC_DB_PASSWORD: ${KEYCLOAK_DB_PASSWORD:-keycloak_dev}
    KC_HOSTNAME: localhost
    KC_HTTP_PORT: 8080
    KEYCLOAK_ADMIN: admin
    KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD:-admin}
  ports:
    - "8080:8080"
  volumes:
    - ./keycloak/realms:/opt/keycloak/data/import
```

### Default Realm: `hive`

Pre-configured via `keycloak/realms/hive-realm.json`:
- Realm: `hive`
- Client: `hive-dashboard` (public OIDC, PKCE, redirect to localhost:3001)
- Client: `hive-api` (confidential, for Node server-to-Keycloak)
- Roles: `viewer`, `operator`, `admin`, `super_admin`, `gov_auditor`
- Default user: `admin@hive.local` / `admin` (for dev)
- User attribute: `tenant_id` (mapped to JWT claim)

---

## 3. Roles & Permissions (RBAC)

| Role | Scope | Can do |
|---|---|---|
| `viewer` | Company | Read dashboard, events, intelligence |
| `operator` | Company | Viewer + setup, connectors, LLM config |
| `admin` | Company | Operator + users, API keys, settings, audit log |
| `super_admin` | Group/Enterprise | Admin + manage child companies, cross-company queries |
| `gov_auditor` | Country | Read-only across all companies in country, audit logs, compliance reports |

### Permission Matrix

| Endpoint | viewer | operator | admin | super_admin | gov_auditor |
|---|---|---|---|---|---|
| Dashboard / Events | Y | Y | Y | Y (cross) | Y (cross) |
| Intelligence | Y | Y | Y | Y (cross) | Y (cross) |
| Settings (read) | - | Y | Y | Y | - |
| Settings (write) | - | - | Y | Y | - |
| Setup | - | Y | Y | Y | - |
| Ingest (API key) | key | key | key | key | - |
| User management | - | - | Y | Y | - |
| Tenant management | - | - | - | Y | - |
| Audit log | - | - | Y | Y | Y |

---

## 4. Backend Architecture

### 4a. New Package: `@hive/auth`

```
packages/auth/
  src/
    index.ts               — public exports
    middleware.ts           — Express: verifyOIDC, verifyApiKey, requireRole, requireTenant
    keycloak-client.ts     — Keycloak admin REST API wrapper
    tenant-service.ts      — Tenant CRUD, hierarchy traversal, recursive child lookup
    api-key-service.ts     — Generate, validate, rotate, revoke
    audit-service.ts       — Immutable audit log writes
    types.ts               — AuthContext, TenantNode, Role, Permission
    migrations.ts          — SQL migration runner for auth tables
```

### 4b. AuthContext (attached to every request)

```typescript
interface AuthContext {
  user_id: string
  email: string
  name: string
  roles: Role[]
  tenant_id: string              // company-level UUID
  tenant_path: TenantNode[]      // full hierarchy path
  tenant_type: TenantType
  deployment_mode: 'bespoke' | 'saas'
  auth_method: 'oidc' | 'api_key' | 'legacy_token'
}
```

### 4c. Three Auth Strategies (checked in order)

1. **OIDC Bearer** — `Authorization: Bearer <JWT>` → validate against Keycloak JWKS endpoint, extract `tenant_id` from claims
2. **API Key** — `Authorization: Bearer hive_ak_...` → lookup prefix in `hive_api_keys`, bcrypt verify, resolve tenant
3. **Legacy Token** — `Authorization: Bearer <NODE_INGEST_TOKEN>` → backward compat for solo/dev mode

### 4d. Database Migrations

```sql
-- Tenant hierarchy
CREATE TABLE hive_tenants ( ... as above ... );

-- Users (synced from Keycloak on login)
CREATE TABLE hive_users (
  id              UUID PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  name            TEXT,
  tenant_id       UUID NOT NULL REFERENCES hive_tenants(id),
  roles           TEXT[] NOT NULL DEFAULT '{viewer}',
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- API Keys (for machine-to-machine ingest)
CREATE TABLE hive_api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES hive_tenants(id),
  name            TEXT NOT NULL,
  key_prefix      CHAR(12) NOT NULL,
  key_hash        TEXT NOT NULL,
  roles           TEXT[] NOT NULL DEFAULT '{operator}',
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutable audit log
CREATE TABLE hive_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES hive_tenants(id),
  actor_id    UUID,
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('user','api_key','system')),
  action      TEXT NOT NULL,
  resource    TEXT,
  details     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant ON hive_audit_log(tenant_id, created_at DESC);

-- Add tenant_id to existing events table
ALTER TABLE TTP_events ADD COLUMN tenant_id UUID REFERENCES hive_tenants(id);
CREATE INDEX idx_events_tenant ON TTP_events(tenant_id, timestamp DESC);

-- Update rollup to include tenant
-- (recreate continuous aggregate with tenant_id in GROUP BY)
```

---

## 5. Frontend Architecture

### 5a. OIDC Flow (Keycloak Redirect)

```
User visits /dashboard
  → Next.js middleware checks cookie/token
  → No token? Redirect to Keycloak login page
  → User authenticates (username/password OR SSO)
  → Keycloak redirects back to /auth/callback
  → Dashboard stores token in httpOnly cookie
  → User lands on /dashboard with full context
```

### 5b. New Files

```
packages/dashboard/
  src/
    lib/
      auth.ts              — token validation, refresh, logout
      auth-context.tsx     — React context: useAuth() hook
      keycloak.ts          — Keycloak OIDC client config
    app/
      auth/
        callback/page.tsx  — OIDC callback handler
        logout/page.tsx    — Logout + redirect
      admin/
        layout.tsx         — Admin-only layout with sidebar
        users/page.tsx     — User CRUD
        api-keys/page.tsx  — API key management
        tenants/page.tsx   — Tenant hierarchy (super_admin)
        audit/page.tsx     — Audit log viewer
  middleware.ts            — Next.js edge middleware for route protection
```

### 5c. NavShell Updates

- User avatar + dropdown (profile, org switcher, sign out)
- Tenant name in header breadcrumb
- Admin nav items visible only for admin+ roles
- Role badge next to username

### 5d. Login/Signup Refactor

Current login/signup pages become thin redirects:
- `/login` → redirect to `Keycloak /auth/realms/hive/protocol/openid-connect/auth`
- `/signup` → redirect to Keycloak registration page (same URL with `registration` action)
- Keep glassmorphic styling on a brief "Redirecting..." interstitial

---

## 6. Route Protection Map

```
/                  → Public (landing page)
/login             → Public → redirects to Keycloak
/signup            → Public → redirects to Keycloak registration
/auth/callback     → Public (OIDC callback)

/dashboard         → Protected: viewer+
/intelligence      → Protected: viewer+
/graphs            → Protected: viewer+
/setup             → Protected: operator+
/settings          → Protected: admin+
/admin/*           → Protected: admin+ (tenants: super_admin+)

/api/v1/ttp/ingest → API key auth
/api/v1/events/*   → OIDC token: viewer+
/api/v1/intelligence/* → OIDC token: viewer+
/api/v1/config     → OIDC token: operator+ (GET), admin+ (PUT)
/api/v1/admin/*    → OIDC token: admin+

/health, /version, /metrics → Public (no auth)
```

---

## 7. Environment Variables

```bash
# Keycloak
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=hive
KEYCLOAK_CLIENT_ID=hive-dashboard
KEYCLOAK_CLIENT_SECRET=<generated>
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin
KEYCLOAK_DB_PASSWORD=keycloak_dev

# HIVE Auth
HIVE_AUTH_MODE=keycloak              # 'keycloak' | 'none' (dev/solo bypass)
HIVE_DEPLOYMENT_MODE=bespoke         # 'bespoke' | 'saas'
HIVE_DEFAULT_TENANT_ID=<uuid>        # used in bespoke mode

# Existing (backward compat)
NODE_INGEST_TOKEN=hive-dev-token-2026  # still works in solo mode
```

---

## 8. Implementation Steps (Build Order)

### Step 1: Keycloak infra (Docker + realm config)
- Add keycloak + keycloak-db to docker-compose.yml
- Create keycloak/realms/hive-realm.json with clients, roles, default user
- Persistent volumes for both databases
- Health checks

### Step 2: Database migrations
- Create hive_tenants, hive_users, hive_api_keys, hive_audit_log tables
- Add tenant_id to TTP_events
- Seed default tenant (for bespoke mode)
- Migration runner in @hive/auth

### Step 3: @hive/auth package
- OIDC middleware (verify JWT against Keycloak JWKS)
- API key middleware
- requireRole() / requireTenant() helpers
- Tenant service (CRUD, hierarchy queries)
- Audit service

### Step 4: Protect Node server
- Apply auth middleware to all routes
- Scope all queries by tenant_id
- Update store-postgres.ts for tenant isolation
- New admin API routes

### Step 5: Frontend auth
- Next.js middleware for route protection
- OIDC login/callback flow
- Auth context provider
- Refactor login/signup pages
- User menu in NavShell

### Step 6: Admin UI
- /admin/users — user list, invite, role assignment
- /admin/api-keys — generate, revoke
- /admin/tenants — hierarchy view (SaaS)
- /admin/audit — searchable audit log

### Step 7: Gov auditor + cross-tenant
- Recursive tenant child queries
- Country-level dashboards
- Compliance reporting
