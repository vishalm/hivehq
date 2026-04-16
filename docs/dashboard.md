# Dashboard & Data Intelligence
### Talk to Your Data · Define Your Value · Seven Visualization Primitives

> HIVE telemetry is not a log file. It is a queryable intelligence layer. This document specifies the dashboard design, natural language query interface, and the visualizations that surface value from raw telemetry.

---

## The Core Premise

Most AI monitoring tools show you a table of numbers. HIVE shows you behavior.

The difference is meaningful:

| Monitoring table | HIVE Intelligence |
|---|---|
| "Engineering used 90M tokens" | "Engineering is the highest-volume dept and uses 6 different models — healthy diversity" |
| "Legal used 29M tokens" | "Legal has extreme model concentration: 62% Claude 3.5 — single-model dependency risk" |
| "Day 34: 72M tokens" | "Day 34 crossed 3-sigma — root cause: unannounced product launch" |
| "Finance: $2.20/1k tokens avg" | "Finance is the cost efficiency leader — benchmark target for other depts" |

The dashboard makes these insights available without SQL, without pivot tables, and without a data analyst.

---

## Natural Language Query Interface

The HIVE Intelligence panel exposes a natural language query bar. Users type questions; HIVE routes them to the relevant visualization with the correct filter applied.

### Query routing logic

```
User query
  → Intent classification (local model, no data sent)
  → Visualization selector
  → Filter/parameter extraction
  → Render with highlighted result
```

### Query examples by visualization

| Query | Routes to | Action |
|---|---|---|
| "Which team drives the most GPT-4o usage?" | Chord diagram | Highlight GPT-4o ribbon |
| "Show shadow AI by department" | Force network | Filter to shadow nodes only |
| "Which department crossed the anomaly threshold last month?" | Anomaly timeline | Highlight spike + label |
| "Compare teams by cost efficiency" | Parallel coordinates | Highlight Cost/Token axis |
| "Who has the most model diversity?" | 3D Scatter | Highlight Z axis (diversity) |
| "Show Engineering's budget breakdown" | Treemap | Filter to Engineering column |
| "When is peak AI usage?" | Activity heatmap | Highlight max-intensity cells |
| "Forecast next quarter spend" | Anomaly timeline | Extend x-axis with projection |

### What the query interface is NOT

The NL query interface does not send any query text or query results to the Hive constellation or any external service. All processing happens locally on the Node Hub. This is architecturally enforced — the NL query layer is read-only against the local TimescaleDB instance.

---

## Visualization Primitives

All seven visualization types ship with HIVE. Each is designed to answer a specific class of question that raw telemetry cannot answer directly.

### Summary table

| Graph | Data dimensions | Value surfaced | Insight type | Phase |
|---|---|---|---|---|
| Chord diagram | 6 models × 6 departments × token volume | Which teams drive which model costs | Flow · Dependency | Phase 2 |
| 3D Scatter | Volume × Cost/token × Model diversity | Department behavior clusters and outliers | Clustering · Outlier | Phase 2 |
| Force network | Tools × Departments × Edge weight | Full org AI topology including shadow AI | Topology · Shadow AI | Phase 2 |
| Activity heatmap | 24 hours × 7 days × intensity | Peak load windows and after-hours anomalies | Pattern · Temporal | Phase 1 |
| Anomaly timeline | Daily token rate × rolling mean × std dev | Spend spikes before the invoice arrives | Anomaly · Alert | Phase 1 |
| Treemap | Dept → Model → volume nested | Relative budget allocation at a glance | Hierarchy · Proportion | Phase 2 |
| Parallel coordinates | Volume · Cost · Diversity · Latency · Sessions | Multi-dimensional department comparison | Multi-dim · Benchmark | Phase 2 |

---

## 1. Chord Diagram — Model/Department Token Flow

### What it shows

A bipartite chord diagram where models occupy one half of the circle and departments occupy the other. Ribbons connect them, with ribbon width proportional to token volume.

### How to read it

- **Wide ribbon**: large token volume between that model and department pair
- **Wide arc** on model side: that model has high total usage across all departments
- **Wide arc** on dept side: that department is a high-volume AI consumer
- **Concentrated ribbons from one dept**: that department has model preference concentration

### Synthetic example (210M tokens/month, 6 models × 6 departments)

```
Engineering (90M):  GPT-4o 38M + Claude 3.5 22M + Llama 3 12M + ...
Product (46M):      GPT-4o 15M + Gemini 1.5 12M + Gemini Flash 8M + ...
Legal (29M):        Claude 3.5 18M + GPT-4o 8M + ... (high concentration)
Finance (17M):      spread across 5 models (efficiency-driven diversity)
Design (15M):       GPT-4o 4M + Gemini Flash 4M + ...
Operations (13M):   Llama 3 4M + Mistral 3M + ... (cost-conscious)
```

### Value statement

Legal's ribbon shows extreme Claude 3.5 dependency. If Anthropic changes pricing or availability, Legal's workflow is disrupted. This is a vendor concentration risk visible in seconds — invisible in a table.

---

## 2. 3D Scatter — Department Clustering

### What it shows

Departments plotted in 3D behavioral space. Three axes: token volume (X), cost per token (Y), model diversity entropy (Z). Auto-rotating for depth perception.

### How to read it

- **Top-right cluster** (high volume, high cost, high diversity): power users, broad tooling
- **Bottom-left cluster** (low volume, low cost, low diversity): efficient niche use
- **Outlier** far from cluster: department whose AI behavior is unusual — investigate
- **Bubble radius**: proportional to absolute token volume

### What clustering reveals

Departments that cluster together have similar AI behavior profiles. If Finance and Operations cluster tightly with low cost/token ratios, their tooling strategy is replicable. If Legal is isolated (high cost, low diversity), it is an optimization candidate.

### Synthetic data

```
Engineering:  Volume 90M  · Cost 4.2c/1k · Diversity 0.95  (high everything)
Product:      Volume 46M  · Cost 2.8c/1k · Diversity 0.88  (balanced)
Legal:        Volume 29M  · Cost 3.8c/1k · Diversity 0.52  (concentration risk)
Finance:      Volume 17M  · Cost 2.2c/1k · Diversity 0.80  (efficiency leader)
Design:       Volume 15M  · Cost 2.9c/1k · Diversity 0.84  (creative spread)
Operations:   Volume 13M  · Cost 1.9c/1k · Diversity 0.78  (cost-conscious)
```

---

## 3. Force Network — AI Ecosystem Topology

### What it shows

A spring-physics force graph with three node types:
- **Blue circles**: approved, monitored AI tools (GPT-4o, Claude 3.5, etc.)
- **Gray rounded rectangles**: departments
- **Red dashed circles**: shadow AI — detected tools not in the approved list

### How to read it

- **Edge thickness**: proportional to usage volume between department and tool
- **Shadow node position**: floats at the periphery — disconnected from the sanctioned center
- **Dashed edge to shadow node**: unmonitored flow — no telemetry, no cost tracking
- **Cluster density**: departments with thick edges to many models are multi-tool adopters

### The shadow AI signal

Shadow AI nodes appear because HIVE's Scout detects HTTP calls to known AI endpoints that are not in the organization's approved tool list. The Scout does not capture the content of these calls. It captures the fact that the call was made, from which device, to which endpoint, at what volume.

Shadow nodes identified in the synthetic example:
- **ChatGPT Personal** (Engineering): ~3M tokens/month off-platform
- **Groq Free** (Design): ~2M tokens/month
- **Perplexity** (Product): ~2M tokens/month

### Why this matters

Shadow AI is not a security failure — it is a signal. When engineers use ChatGPT Personal, it means the approved tools are not meeting their needs, or the procurement process is too slow. HIVE surfaces the fact. The org decides what to do.

---

## 4. Activity Heatmap — Usage by Hour and Weekday

### What it shows

A 24×7 grid (24 hours on the Y axis, 7 days of the week on the X axis). Color intensity represents token rate — how many tokens per hour during that time window, averaged across the last 12 weeks.

### How to read it

- **Deep blue cells**: peak usage — expect high latency, potential rate limit pressure
- **Near-white cells**: low activity — off-hours or natural dead zones
- **Bright cells on Saturday/Sunday**: after-hours use — autonomous agents or personal projects
- **Asymmetric pattern across days**: department-specific shift patterns

### Operational use cases

1. **Capacity planning**: provision Node Hub resources to match peak windows
2. **Rate limit management**: stagger batch jobs to off-peak windows
3. **Anomaly investigation**: unexpected bright cells on Sunday at 3am = unauthorized agent
4. **Global org comparison**: compare Dubai vs. Singapore shift patterns in Federated mode

### What a healthy heatmap looks like

Peak intensity from 09:00–18:00 Monday–Friday. Mild weekday evening activity (engineers in flow state). Near-zero weekends except for scheduled batch jobs (which should be identifiable by their regular pattern).

---

## 5. Anomaly Timeline — 3-Sigma Spike Detection

### What it shows

A 60-day time series of daily token volume with three layers:
1. **The data line**: actual daily token usage
2. **Sigma bands**: rolling 7-day mean ± 1 standard deviation (inner band) and ± 2 standard deviations (outer band)
3. **Spike markers**: days where usage exceeded the 2-sigma upper bound, auto-labelled with context

### How sigma bands work

```
rolling_mean[day] = avg(days[day-7 : day])
rolling_std[day]  = std(days[day-7 : day]) + 4M base noise floor

1-sigma upper = rolling_mean + rolling_std
2-sigma upper = rolling_mean + 2 × rolling_std
anomaly       = actual > 2-sigma upper
```

The base noise floor of 4M prevents false positives during low-usage weekends.

### Synthetic anomalies

| Day | Volume | Cause | 2-sigma threshold |
|---|---|---|---|
| Day 12 | 68M | Unannounced hackathon — 40 engineers × 8h GPU sprints | ~35M |
| Day 34 | 72M | Product launch — all-hands LLM-assisted content generation | ~38M |
| Day 51 | 55M | Spend surge — Legal running a large contract review batch | ~36M |

### The value

Without anomaly detection, Day 34's 72M usage would appear in the month-end invoice with no explanation. With HIVE, the spike is flagged in real time, and the context annotation ("Product launch") is added by the team lead. The invoice is now explainable.

Future: HIVE correlates spike timing with org calendar events (Phase 3 integration). Planned launches pre-suppress the anomaly alert. Unplanned spikes remain flagged.

---

## 6. Treemap — Budget Hierarchy

### What it shows

A nested rectangle visualization where area represents token volume. Top level: departments (columns, width = dept total tokens). Within each column: model cells (height = model's share of dept tokens).

### How to read it

- **Largest rectangle**: highest token volume for that dept/model pair (Engineering × GPT-4o = 38M)
- **Column width**: total dept usage — Engineering column is the widest
- **Row height within column**: that model's share of the dept's budget
- **Color**: model color, so the full model distribution is visible instantly

### What the treemap reveals at a glance

The treemap makes concentration visible. If one dept's column is dominated by one model color, that dept has single-model dependency. If a dept's column has many roughly equal cells, that dept has healthy diversity.

In the synthetic data: Legal's column is >60% Claude 3.5 purple. Finance's column has five roughly equal cells. The difference is visible before reading any numbers.

### Operational use case

During a vendor negotiation with Anthropic: pull the treemap, filter to Claude 3.5. Instantly see which departments are most exposed to Claude pricing changes. That is your negotiating leverage or your mitigation plan.

---

## 7. Parallel Coordinates — Multi-Dimensional Comparison

### What it shows

Five vertical axes, each representing a different KPI. Each department is a line connecting its value on each axis. Lines that cross each other on adjacent axes indicate trade-offs — gaining on one dimension by sacrificing another.

### The five axes

| Axis | Unit | What high means |
|---|---|---|
| Token Volume | M tokens/month | High usage department |
| Cost/Token | cents/1k | Premium model preference |
| Model Count | distinct models used | Broad tooling strategy |
| Avg Latency | ms end-to-end | Complex prompt chains |
| Daily Sessions | thousands | High interaction frequency |

### How to read crossing lines

If Engineering's line goes from high Volume to high Cost/Token, and Finance's line goes from low Volume to low Cost/Token, the lines will not cross — they are consistent. If Legal's line starts high on Cost/Token but drops to low on Model Count, it crosses with a dept that does the opposite — that crossing reveals the trade-off between quality and diversity.

### The benchmark question

Parallel coordinates answer: "Which department is best across all five dimensions simultaneously?" There is no single answer — it depends on which dimensions matter to you. But if you want to find the gold-standard team (high volume, low cost, high diversity, low latency, high sessions), you can see immediately which line comes closest to all five optimal positions.

---

## Dashboard Architecture

### Data flow to dashboard

```
TimescaleDB (telemetry_events)
  → Materialized views (pre-aggregated per dept, model, day, hour)
  → Dashboard API (Node Hub Express, local only)
  → Canvas-rendered charts (browser, no external dependencies)
```

### Pre-aggregated views

The dashboard does not run raw SQL against telemetry_events on every render. All visualizations are backed by pre-aggregated materialized views:

```sql
-- Refreshed every 5 minutes
CREATE MATERIALIZED VIEW mv_dept_model_hourly AS
SELECT
  time_bucket('1 hour', timestamp) AS bucket,
  dept_tag,
  provider,
  model_hint,
  SUM(estimated_tokens) AS tokens,
  COUNT(*) AS calls,
  AVG(latency_ms) AS avg_latency_ms
FROM telemetry_events
WHERE timestamp > NOW() - INTERVAL '90 days'
GROUP BY 1,2,3,4;
```

### Render pipeline

All charts are rendered on HTML Canvas using the browser's 2D context. No external chart libraries are bundled. This keeps the dashboard load to a single HTML file and eliminates third-party supply chain risk from chart vendor dependencies.

---

## Phase Delivery Schedule

| Feature | Phase | Description |
|---|---|---|
| Activity heatmap | Phase 1 | Real-time 24×7 grid from TimescaleDB hourly buckets |
| Anomaly timeline | Phase 1 | Rolling sigma calculation in materialized view |
| Chord diagram | Phase 2 | Cross-dimensional flow from mv_dept_model_hourly |
| Treemap | Phase 2 | Hierarchical aggregation from materialized view |
| 3D scatter | Phase 2 | Per-department KPI calculation |
| Force network | Phase 2 | Shadow AI detection + approved tool topology |
| Parallel coordinates | Phase 2 | Multi-KPI comparison view |
| NL query routing | Phase 3 | Local intent classification, no external API |
| Calendar correlation | Phase 3 | Spike annotation from org calendar integration |
| Forecast projection | Phase 4 | ARIMA/Holt-Winters on daily series |

---

*See also: [Architecture](./architecture.md) · [Data Model](./data-model.md) · [Observability](./observability.md) · [TTP Protocol](./protocol.md)*

---

<sub>HIVE &nbsp;·&nbsp; هايف &nbsp;·&nbsp; הייב &nbsp;·&nbsp; हाइव &nbsp;·&nbsp; 蜂巢 &nbsp;·&nbsp; ハイブ &nbsp;·&nbsp; 하이브 &nbsp;·&nbsp; Хайв &nbsp;·&nbsp; Colmena &nbsp;·&nbsp; Ruche</sub>
