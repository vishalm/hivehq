---
sidebar_position: 2
title: "Intelligence & Anomalies"
description: "Cost modeling, anomaly detection, forecasting, and behavioral clustering"
---

# Intelligence & Anomalies

HIVE's intelligence engine automatically analyzes consumption patterns to detect anomalies, forecast spending, and identify optimization opportunities.

## Cost Modeling

Cost estimation for every provider and model:

```
Event arrives
  ├─ Extract: provider, model, tokens_prompt, tokens_completion
  ├─ Lookup pricing: HIVE has current rates for 50+ models
  ├─ Compute: (tokens / 1000) * rate_per_1k = cost
  └─ Store: cost_usd in events table
```

**Supported models and pricing** (updated monthly):

- OpenAI: gpt-4, gpt-4-turbo, gpt-3.5-turbo, text-embedding-3-small, etc.
- Anthropic: claude-opus, claude-sonnet, claude-haiku
- Google: PaLM, Gemini
- Mistral: Mistral 7B, Mixtral
- Ollama: local models ($0 cost)

View cost breakdown:

```
Dashboard → Costs by Provider
```

Drill down to model level:

```
OpenAI Costs (Last 30 days)
├─ gpt-4: $1,056 (45,000 calls, 18M tokens)
├─ gpt-3.5-turbo: $469 (315,000 calls, 156M tokens)
└─ text-embedding-3-small: $0.02 (1M tokens)
```

## Anomaly Detection

Real-time detection of unusual patterns using statistical analysis.

### Types of Anomalies

**Spend Spike**
- Threshold: > 2 standard deviations from 7-day rolling mean
- Sensitivity: configurable (0-1 slider)
- Alert: "Engineering spend +40% in 1 hour"

Example:
```
Normal spend: $50/hour
Alert threshold: $75/hour (2σ)
Detected: $90/hour
Status: ALERT
```

**Error Rate Spike**
- Threshold: > 2x baseline error rate
- Baseline: computed from last 24 hours
- Alert: "OpenAI errors 15% vs 2% baseline"

**Shadow AI**
- Detection: New provider detected (not in configured list)
- Alert: "Cohere detected (unsanctioned provider)"
- Severity: HIGH

**Latency Anomaly**
- Threshold: p95 latency > baseline + 2σ
- Alert: "OpenAI p95 latency 5s vs 2s baseline"

### Anomaly Dashboard

```
Active Anomalies (Last 7 days)
─────────────────────────────

1. SPEND SPIKE (Engineering) [HIGH]
   └─ 2026-04-16 14:00 UTC
   └─ Spike: +40% (+$20/hour)
   └─ Action: Investigate automated workloads

2. ERROR RATE SPIKE (OpenAI) [MEDIUM]
   └─ 2026-04-16 13:30 UTC
   └─ Rate: 15% vs 2% baseline
   └─ Action: Check OpenAI service status

3. SHADOW AI (Cohere) [HIGH]
   └─ 2026-04-16 12:00 UTC
   └─ Unsanctioned provider detected
   └─ Action: Review access controls, approve or block
```

Click to drill down into details:
- Timeline of metric
- Affected departments/teams
- Recommended actions

### Configuring Sensitivity

Dashboard → Settings → Anomalies:

```
Anomaly Sensitivity: [====●======] 0.75

Lower (0.5):
  ├─ More alerts
  ├─ More false positives
  └─ For strict monitoring

Higher (0.95):
  ├─ Fewer alerts
  ├─ Fewer false positives
  └─ For relaxed monitoring
```

Or via environment:

```bash
ANOMALY_SENSITIVITY=0.85 npm run start
```

## Spend Forecasting

Predicts monthly spend based on historical trends.

### Forecast Model

Uses 60-day lookback window to:
1. Extract daily spend
2. Fit trend line (linear regression)
3. Extrapolate next 30 days
4. Compute confidence interval (95%)

Example:

```
Forecast: April 2026
─────────────────

Provider: OpenAI
Predicted: $5,200
Confidence interval: $4,800 - $5,600
Trend: +3% week-over-week

Provider: Anthropic
Predicted: $1,500
Confidence interval: $1,200 - $1,800
Trend: +10% week-over-week (accelerating)
```

### View Forecasts

Dashboard → Forecasts tab

Shows:
- Predicted cost by provider
- Confidence intervals (shaded regions)
- Trend direction (↑ increasing, → stable, ↓ decreasing)

### Department-Level Forecasts

```
Engineering Forecast (April)
────────────────────────────
Predicted spend: $3,200
Upper bound: $3,600
Lower bound: $2,800
Trend: stable

Research Forecast (April)
─────────────────────────
Predicted spend: $1,200
Upper bound: $1,500
Lower bound: $900
Trend: increasing (+8%/week)

Marketing Forecast (April)
──────────────────────────
Predicted spend: $600
Upper bound: $800
Lower bound: $400
Trend: stable
```

## Behavioral Clustering

Groups API calls by behavioral patterns.

### Clustering Dimensions

- **Prompt length**: Short (< 100 tokens) vs. long (> 1000 tokens)
- **Latency**: Fast (< 500ms) vs. slow (> 2s)
- **Error rate**: Low (0-1%) vs. high (> 5%)
- **Model diversity**: Single model vs. multiple models
- **Time pattern**: Bursty (peaks) vs. smooth

Example clusters:

```
Cluster A: "Interactive Chat"
  ├─ Avg prompt: 50 tokens
  ├─ Avg completion: 200 tokens
  ├─ Latency: 1.5s
  ├─ Error rate: < 1%
  ├─ Call count: 10,000/day
  └─ Cost: $45/day
  └─ Models: gpt-3.5-turbo

Cluster B: "Batch Analysis"
  ├─ Avg prompt: 500 tokens
  ├─ Avg completion: 1,500 tokens
  ├─ Latency: 5s
  ├─ Error rate: 2%
  ├─ Call count: 500/day
  └─ Cost: $120/day
  └─ Models: gpt-4

Cluster C: "Embeddings"
  ├─ Avg prompt: 100 tokens
  ├─ Avg completion: 0 tokens (embedding vectors)
  ├─ Latency: 200ms
  ├─ Error rate: < 0.5%
  ├─ Call count: 50,000/day
  └─ Cost: $0.50/day
  └─ Models: text-embedding-3-small
```

### Optimization Insights

For each cluster, HIVE suggests optimizations:

```
Cluster A: "Interactive Chat"
────────────────────────────

Current setup:
  ├─ Model: gpt-4
  ├─ Cost: $45/day
  └─ Volume: 10,000 calls

Suggestion:
  ├─ Use gpt-3.5-turbo (90% cheaper)
  ├─ Projected savings: $40/day ($14,600/year)
  └─ Quality loss: minimal (95% similar responses)

Action: Review 10 sample calls for quality impact
```

## Intelligence API

Access intelligence data programmatically:

```bash
# Cost breakdown
curl http://localhost:3001/api/v1/intelligence/cost \
  ?from=2026-04-01&to=2026-04-30

# Anomalies
curl http://localhost:3001/api/v1/intelligence/anomalies \
  ?severity=high,medium&limit=20

# Forecasts
curl http://localhost:3001/api/v1/intelligence/forecast \
  ?horizon=month

# Clusters
curl http://localhost:3001/api/v1/intelligence/clusters
```

---

Next: [Notifications](/dashboard/notifications) or [Chat Widget](/dashboard/chat-widget).
