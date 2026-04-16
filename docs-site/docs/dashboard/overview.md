---
sidebar_position: 1
title: "Dashboard Overview"
description: "HIVE Dashboard features, KPIs, charts, and UI components"
---

# Dashboard Overview

The HIVE Dashboard is a glassmorphic, real-time interface for AI token consumption monitoring and intelligence.

## Features

### KPI Cards

Top-of-page metrics giving immediate visibility:

| Card | Metric | Timeframe |
|------|--------|-----------|
| Total Tokens | Sum of prompt + completion tokens | Last 30 days |
| Total Cost | USD spend across all providers | Last 30 days |
| Avg Cost per Token | Total cost / total tokens | Last 30 days |
| Models Used | Unique models tracked | Last 30 days |
| Providers | Count of active providers | Last 30 days |

Example:
```
┌──────────────────────────────────────────────────────┐
│ HIVE Dashboard                                       │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Total Tokens        Total Cost         Avg Cost/Token
│ 15.2M              $2,345.67          $0.000154
│                                                      │
│ Models Used        Providers                        
│ 12                 7                                 
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Cost Breakdown Charts

Multi-dimensional cost visualization:

**By Provider**
```
OpenAI:       65% ($1,524)
Anthropic:    20% ($469)
Ollama:       10% ($235)
Google:       5% ($117)
```

**By Model**
```
gpt-4:        45% ($1,056)
claude-opus:  25% ($586)
gpt-3.5:      20% ($469)
mistral:      10% ($234)
```

**By Department**
```
Engineering:  55% ($1,290)
Research:     25% ($586)
Marketing:    15% ($352)
Sales:        5% ($117)
```

### Events Table

Searchable, filterable table of recent API calls:

| Time | Provider | Model | Tokens | Cost | Latency | Department | Actions |
|------|----------|-------|--------|------|---------|------------|---------|
| 14:32:11 | openai | gpt-4 | 150 | $0.009 | 1,234ms | engineering | View |
| 14:31:58 | anthropic | claude-opus | 280 | $0.021 | 2,100ms | research | View |
| 14:31:45 | ollama | mistral | 200 | $0.000 | 500ms | engineering | View |

**Filters:**
- Provider (checkbox)
- Date range (calendar picker)
- Department (dropdown)
- Min/max cost
- Search by request_id or user_id

### Anomaly Alerts

Real-time detection of unusual patterns:

| Type | Severity | Alert | Status |
|------|----------|-------|--------|
| Spend Spike | High | Engineering spend +40% in 1h | New |
| Error Rate | Medium | OpenAI errors 15% vs 2% baseline | Acknowledged |
| Shadow AI | High | Cohere detected (unsanctioned) | Investigating |
| Latency | Low | p95 latency 5s vs 2s baseline | Resolved |

Click to drill down:

```
Spend Spike Alert
─────────────────
Engineering department
Spike detected: 2026-04-16 14:00 UTC

Baseline spend: $50/hour
Actual spend: $70/hour
Difference: +40% ($20)

Calls during spike:
├─ gpt-4: 500 calls (25 calls/min vs 15 normal)
├─ claude-opus: 300 calls (15 calls/min vs 8 normal)
└─ Recommendation: Check for automated workloads
```

### Settings Panel

Configure governance, providers, and departments:

**Governance**
- Regulation tag (HIPAA, GDPR, SOX, etc.)
- Data residency (us-east-1, eu-west-1, etc.)
- Retention days (30-365)

**Providers**
- OpenAI API key
- Anthropic API key
- Ollama endpoint
- (etc. for all supported providers)

**Departments**
- Add/edit department names and cost centers
- Maps department ID → display name

**Alerts**
- Anomaly sensitivity (0-1 slider)
- Notification channels (Slack, email, webhook)
- Alert rules (spend threshold, error rate, etc.)

## Glassmorphic Design

The dashboard uses a dark, frosted-glass aesthetic:

```
Background: Deep gradient
  └─ #0a0a0f (darkest) to #16213e (deep blue)

Cards: Frosted glass
  ├─ Background: rgba(255,255,255,0.04)
  ├─ Border: 1px rgba(255,255,255,0.08)
  ├─ Backdrop blur: 20px
  └─ Shadow: 0 8px 32px rgba(0,0,0,0.3)

Accent colors:
  ├─ Primary: #ffd60a (HIVE yellow)
  ├─ Secondary: #007aff (blue)
  ├─ Success: #34c759 (green)
  ├─ Warning: #ff9500 (orange)
  └─ Error: #ff3b30 (red)
```

## Responsive Design

Dashboard adapts to all screen sizes:

**Mobile (< 768px)**
- Single column layout
- Stacked cards
- Collapsed filters
- Bottom navigation

**Tablet (768px - 1024px)**
- Two column layout
- Side-by-side KPI cards
- Dropdown menus

**Desktop (> 1024px)**
- Three column layout
- Expanded charts
- Inline filters
- Sidebar navigation

## Real-Time Updates

Dashboard data refreshes:
- KPI cards: every 30 seconds
- Charts: every 60 seconds
- Events table: every 10 seconds (append new rows)
- Anomalies: real-time (WebSocket)

You can manually refresh any section with the refresh icon.

## Export and Reporting

Export data:
- **CSV**: Events table, costs by provider/model/department
- **PDF**: Dashboard snapshot with charts and KPIs
- **JSON**: Raw event data for custom analysis

Example CSV:
```
timestamp,provider,model,tokens_prompt,tokens_completion,cost_usd,department,latency_ms
2026-04-16T14:32:11Z,openai,gpt-4,150,50,0.009,engineering,1234
2026-04-16T14:31:58Z,anthropic,claude-opus,200,80,0.021,research,2100
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search |
| `?` | Show help |
| `j/k` | Next/prev event in table |
| `r` | Refresh all |
| `s` | Open settings |

## Dark Mode

Dashboard is dark mode only (as per HIVE branding).

No light mode toggle (design decision: dark is the brand).

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation
- Screen reader support
- High contrast text (text-primary on dark background)
- Focus indicators on all interactive elements

Test with:
```bash
npm run test:accessibility
```

---

Next: [Intelligence & Anomalies](/dashboard/intelligence), [Notifications](/dashboard/notifications), or [Chat Widget](/dashboard/chat-widget).
