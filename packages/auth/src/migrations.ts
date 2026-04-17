/**
 * @hive/auth — Database migrations for authentication tables.
 *
 * Tables:
 *   hive_tenants    — tenant hierarchy (Country > Government > Group > Enterprise > Company)
 *   hive_users      — users synced from Keycloak on login
 *   hive_api_keys   — machine-to-machine API keys for ingest
 *   hive_audit_log  — immutable audit trail
 *
 * Also adds `tenant_id` column to the existing TTP_events table
 * for per-tenant data isolation.
 */

// ── Minimal pg types (lazy import) ──────────────────────────────────────────

interface PgPool {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>
}

interface PgModule {
  Pool: new (config: { connectionString: string }) => PgPool
}

async function loadPg(): Promise<PgModule> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('pg')
    return mod.default ?? mod
  } catch (err) {
    throw new Error(
      '@hive/auth migrations require the `pg` package. Install it with `npm install pg`.',
      { cause: err },
    )
  }
}

// ── Migration statements ────────────────────────────────────────────────────

export const AUTH_MIGRATION_STATEMENTS: string[] = [
  // ── Tenant hierarchy ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS hive_tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id       UUID REFERENCES hive_tenants(id) ON DELETE SET NULL,
    tenant_type     TEXT NOT NULL CHECK (tenant_type IN ('country','government','group','enterprise','company')),
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    country_code    CHAR(2) NOT NULL,
    data_residency  TEXT NOT NULL DEFAULT 'AE',
    regulation_tags TEXT[] NOT NULL DEFAULT '{}',
    plan            TEXT NOT NULL DEFAULT 'community' CHECK (plan IN ('community','professional','enterprise','government')),
    keycloak_realm  TEXT UNIQUE,
    settings        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_tenants_parent  ON hive_tenants(parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tenants_type    ON hive_tenants(tenant_type)`,
  `CREATE INDEX IF NOT EXISTS idx_tenants_country ON hive_tenants(country_code)`,

  // ── Users (synced from Keycloak on first login) ───────────────────────
  `CREATE TABLE IF NOT EXISTS hive_users (
    id              UUID PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    name            TEXT,
    tenant_id       UUID NOT NULL REFERENCES hive_tenants(id) ON DELETE CASCADE,
    roles           TEXT[] NOT NULL DEFAULT '{viewer}',
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_users_tenant ON hive_users(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_email  ON hive_users(email)`,

  // ── API Keys (machine-to-machine ingest) ──────────────────────────────
  `CREATE TABLE IF NOT EXISTS hive_api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES hive_tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    key_prefix      CHAR(12) NOT NULL,
    key_hash        TEXT NOT NULL,
    roles           TEXT[] NOT NULL DEFAULT '{operator}',
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON hive_api_keys(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON hive_api_keys(key_prefix)`,

  // ── Immutable audit log ───────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS hive_audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES hive_tenants(id) ON DELETE CASCADE,
    actor_id    UUID,
    actor_type  TEXT NOT NULL CHECK (actor_type IN ('user','api_key','system')),
    action      TEXT NOT NULL,
    resource    TEXT,
    details     JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_audit_tenant ON hive_audit_log(tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_actor  ON hive_audit_log(actor_id)`,

  // ── Add tenant_id to existing TTP_events (idempotent) ─────────────────
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'ttp_events' AND column_name = 'tenant_id'
     ) THEN
       ALTER TABLE TTP_events ADD COLUMN tenant_id UUID REFERENCES hive_tenants(id);
     END IF;
   END $$`,

  `CREATE INDEX IF NOT EXISTS idx_events_tenant ON TTP_events(tenant_id, timestamp DESC)`,

  // ── Seed default tenant for bespoke deployment ────────────────────────
  `INSERT INTO hive_tenants (id, tenant_type, name, slug, country_code, data_residency, plan, keycloak_realm)
   VALUES (
     '00000000-0000-0000-0000-000000000001',
     'company',
     'Default Company',
     'default',
     'AE',
     'AE',
     'community',
     'hive'
   )
   ON CONFLICT (id) DO NOTHING`,
]

// ── Migration runner ────────────────────────────────────────────────────────

export interface MigrationResult {
  success: boolean
  statementsRun: number
  errors: string[]
}

/**
 * Run all auth migrations. Idempotent — safe to call on every startup.
 */
export async function runAuthMigrations(connectionString: string): Promise<MigrationResult> {
  const pg = await loadPg()
  const pool = new pg.Pool({ connectionString })
  const errors: string[] = []
  let statementsRun = 0

  try {
    for (const stmt of AUTH_MIGRATION_STATEMENTS) {
      try {
        await pool.query(stmt)
        statementsRun++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Migration failed: ${msg}\n  Statement: ${stmt.slice(0, 120)}...`)
      }
    }
  } finally {
    await (pool as unknown as { end(): Promise<void> }).end()
  }

  return {
    success: errors.length === 0,
    statementsRun,
    errors,
  }
}
