# HIVE — Project Instructions

## Soul of the Project: Token Economy & Token Governance

HIVE exists to answer one question: **Where do your AI tokens go, what do they cost, and who controls them?**

- **Token Economy** is the financial layer — every token is a unit of spend. HIVE turns invisible API calls into visible ROI. The dashboard must always surface: total token spend, cost per department, cost per model, waste detection, and projected burn rate. Every page should reinforce that tokens = money = accountability.
- **Token Governance** is the compliance layer — every event carries a GovernanceBlock with frozen privacy guarantees (`pii_asserted: false`, `content_asserted: false`), regulation tags, data residency, and retention policy. Governance is structural, not optional. The UI must make governance visible and prominent — not buried in a settings page.
- **Zero Content Principle** is sacred — HIVE never reads prompts, completions, or API keys. Metadata only. This is the trust foundation that makes enterprise adoption possible. Surface this guarantee prominently.
- **Shadow AI Detection** — unsanctioned providers are a governance risk. The dashboard must make shadow AI immediately visible and quantified.
- **ROI Messaging** — every dashboard view should help the user answer: "What is our AI investment returning?" Show cost efficiency, waste, optimization opportunities, and projected savings.

## UI / Dashboard Rules

- **No emojis.** Never use emoji characters in the dashboard, UI components, or any user-facing code. This is a hard rule.
- **SVG icons only.** All icons must be inline SVG or imported from a curated SVG icon set. No emoji substitutes, no Unicode symbols used as icons.
- **HIVE branding.** The dashboard is branded as "HIVE". Accent color is `#ffd60a` (HIVE yellow). Secondary accent `#007aff` (blue).

## Design System — Glassmorphic Dark

HIVE uses a glassmorphic dark design language. Every surface should feel like frosted glass floating over a deep gradient. This is not optional — it is the brand identity.

### Color Palette

```
--hive-yellow:      #ffd60a       (primary accent, CTAs, highlights, brand mark)
--hive-blue:        #007aff       (secondary accent, links, approved status)
--hive-green:       #34c759       (success, healthy, governance compliant)
--hive-red:         #ff3b30       (errors, shadow AI, anomalies, warnings)
--hive-orange:      #ff9500       (medium risk, pending states)
--hive-purple:      #af52de       (clusters, behavioral patterns)

--glass-bg:         rgba(255,255,255,0.04)   (glass card background)
--glass-border:     rgba(255,255,255,0.08)   (glass card border)
--glass-hover:      rgba(255,255,255,0.06)   (glass card hover state)
--glass-blur:       blur(20px)               (backdrop blur for depth)

--surface-dark:     #0a0a0f       (deepest background)
--surface-card:     #12121a       (card/panel background)
--surface-elevated: #1a1a28       (elevated surface, modals)

--text-primary:     rgba(255,255,255,0.92)
--text-secondary:   rgba(255,255,255,0.55)
--text-tertiary:    rgba(255,255,255,0.30)

--gradient-hero:    linear-gradient(135deg, #0a0a0f 0%, #0f1923 40%, #16213e 100%)
--gradient-card:    linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))
```

### Glass Card Recipe

Every card/panel/section must use this glass treatment:
```css
.glass {
  background: var(--gradient-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
}
```

### Typography

- Font stack: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, sans-serif`
- Mono: `'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace`
- Hero headings: 32px, weight 800, letter-spacing -0.5px
- Section headings: 20px, weight 700
- Body: 14px, weight 400, line-height 1.6
- Labels/meta: 12px, weight 500, uppercase tracking 0.5px
- KPI values: 28–36px, weight 700, tabular-nums

### Component Patterns

- **KPI Cards**: Glass card with accent-colored top border (2px), large value, small label above
- **Charts**: Always on dark backgrounds (`#0f0f1a`), grid lines at 0.06 opacity, axes at 0.3 opacity
- **Tables**: Glass row hover with `rgba(255,255,255,0.03)`, no full borders — only bottom separators at 0.06 opacity
- **Buttons**: Glass treatment for secondary, solid `--hive-yellow` for primary CTAs
- **Status pills**: Rounded pill with translucent background matching status color at 0.15 opacity
- **Filters/chips**: Glass chips with 1px glass-border, active state uses accent color
- **Inputs**: Glass background, 1px glass-border, focus ring in accent color at 0.3 opacity

### Responsive Design

- Mobile-first breakpoints: 480px (phone), 768px (tablet), 1024px (small desktop), 1280px (wide)
- Grid: `repeat(auto-fit, minmax(X, 1fr))` patterns — never fixed column counts
- Charts: `ResponsiveContainer width="100%"` always
- Navigation: horizontal scroll on mobile, no hamburger menu needed
- Cards: single column below 768px, fluid grid above
- Touch targets: minimum 44px for interactive elements
- KPI grids: 2 columns on phone, auto-fit above

### Animation & Transitions

- All transitions: `0.2s ease` minimum for interactive state changes
- Hover: subtle brightness increase or border glow
- Glass shimmer on cards: optional, via `background-position` animation
- Chart animations: `animationDuration={800}` for Recharts
- No janky layout shifts — use `will-change` for animated elements

## Architecture

- **Connectors -> Scout -> Node -> HIVE (Dashboard)**
- Scout is the only messenger to Node. Connectors wire through Scout.
- Config stored in `.hive/config.json` via the ConfigStore API.
- Intelligence layer (`@hive/intelligence`) provides cost modeling, anomaly detection, spend forecasting, and behavioral clustering.
- **No .env files for user config.** All configuration happens through the Setup UI and is persisted to the vault (`ConfigStore`). The `.env.example` exists only as documentation.

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

## Key Messaging (use in UI headers, hero sections, empty states)

- "Talk to your data. Define your value."
- "Every token is a decision. HIVE makes them visible."
- "Token Economy: See where your AI budget goes."
- "Token Governance: Compliance is structural, not optional."
- "Zero content. Full visibility. Total accountability."
- "Your spreadsheet cannot show you what HIVE can."
- "From invisible API calls to visible ROI."
