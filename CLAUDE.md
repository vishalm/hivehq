# HIVE — Project Instructions

## UI / Dashboard Rules

- **No emojis.** Never use emoji characters in the dashboard, UI components, or any user-facing code. This is a hard rule.
- **SVG icons only.** All icons must be inline SVG or imported from a curated SVG icon set. No emoji substitutes, no Unicode symbols used as icons.
- **HIVE branding.** The dashboard is branded as "HIVE". Use the dark gradient header. Accent color is `#ffd60a` (HIVE yellow).
- **No .env files for user config.** All configuration happens through the Setup UI and is persisted to the vault (`ConfigStore`). The `.env.example` exists only as documentation.

## Architecture

- **Connectors → Scout → Node → HIVE (Dashboard)**
- Scout is the only messenger to Node. Connectors wire through Scout.
- Config stored in `.hive/config.json` via the ConfigStore API.
- Intelligence layer (`@hive/intelligence`) provides cost modeling, anomaly detection, spend forecasting, and behavioral clustering.

## Code Style

- TypeScript strict mode. ESM modules.
- Zod for all schema validation.
- `z.literal(false)` for frozen governance fields (`pii_asserted`, `content_asserted`).
- Zero content principle: never read prompts, completions, or API keys. Metadata only.

## Testing

- All packages must have tests. Use vitest.
- Node server tests use supertest.
- Connector tests mock fetch.

## Naming

- Protocol: TTP (Token Telemetry Protocol), not HATP.
- API routes: lowercase `/api/v1/ttp/ingest`, never uppercase.
- Package scope: `@hive/*` for packages, `@hive/connector-*` for connectors.
