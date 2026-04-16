/**
 * Prometheus-format metrics, handwritten — no prom-client dependency.
 *
 * Metrics exposed at `/metrics`:
 *   hatp_ingest_events_total{result, provider}       — counter
 *   hatp_ingest_bytes_total{provider}                — counter
 *   hatp_ingest_tokens_total{provider}               — counter
 *   hatp_ingest_latency_ms_sum / _count              — histogram-lite
 *   hatp_ingest_errors_total{reason}                 — counter
 *   hatp_covenant_violations_total{kind}             — counter (PII/content/residency rejects)
 *   hatp_node_up                                     — gauge, always 1
 */

import type { HATPEvent } from '@hive/shared'

type Counter = Map<string, number>
type Labels = Record<string, string>

function labelString(labels: Labels): string {
  const keys = Object.keys(labels).sort()
  if (keys.length === 0) return ''
  return keys.map((k) => `${k}="${escape(labels[k]!)}"`).join(',')
}

function escape(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')
}

function inc(metric: Metric, labels: Labels, amount = 1): void {
  const k = labelString(labels)
  metric.values.set(k, (metric.values.get(k) ?? 0) + amount)
}

// ── Registry ─────────────────────────────────────────────────────────────────

interface Metric {
  name: string
  help: string
  type: 'counter' | 'gauge' | 'summary'
  values: Counter
}

const m = (name: string, help: string, type: Metric['type']): Metric => ({
  name,
  help,
  type,
  values: new Map(),
})

export const metricsRegistry = {
  ingestEvents: m('hatp_ingest_events_total', 'HATP events accepted by this node', 'counter'),
  ingestBytes: m(
    'hatp_ingest_bytes_total',
    'Total observed payload bytes by provider',
    'counter',
  ),
  ingestTokens: m(
    'hatp_ingest_tokens_total',
    'Total estimated tokens by provider',
    'counter',
  ),
  ingestErrors: m(
    'hatp_ingest_errors_total',
    'HATP batches rejected, by reason',
    'counter',
  ),
  covenantViolations: m(
    'hatp_covenant_violations_total',
    'Protocol covenant violations intercepted at the boundary',
    'counter',
  ),
  latencySum: m(
    'hatp_ingest_latency_ms_sum',
    'Sum of observed call latencies in ms',
    'summary',
  ),
  latencyCount: m(
    'hatp_ingest_latency_ms_count',
    'Count of latency observations',
    'summary',
  ),
  nodeUp: m('hatp_node_up', 'Node hub liveness', 'gauge'),
}

// Seed the liveness gauge.
metricsRegistry.nodeUp.values.set('', 1)

// ── Recording ───────────────────────────────────────────────────────────────

export function recordIngest(events: HATPEvent[]): void {
  for (const e of events) {
    inc(metricsRegistry.ingestEvents, { provider: e.provider, result: 'accepted' })
    inc(metricsRegistry.ingestBytes, { provider: e.provider }, e.payload_bytes)
    inc(metricsRegistry.ingestTokens, { provider: e.provider }, e.estimated_tokens)
    if (e.latency_ms !== undefined) {
      inc(metricsRegistry.latencySum, {}, e.latency_ms)
      inc(metricsRegistry.latencyCount, {}, 1)
    }
  }
}

export function recordError(reason: string): void {
  inc(metricsRegistry.ingestErrors, { reason })
}

export function recordCovenantViolation(kind: string): void {
  inc(metricsRegistry.covenantViolations, { kind })
}

// ── Rendering ───────────────────────────────────────────────────────────────

export function renderMetrics(): string {
  const out: string[] = []
  for (const metric of Object.values(metricsRegistry)) {
    out.push(`# HELP ${metric.name} ${metric.help}`)
    out.push(`# TYPE ${metric.name} ${metric.type}`)
    if (metric.values.size === 0) {
      out.push(`${metric.name} 0`)
      continue
    }
    for (const [labels, value] of metric.values.entries()) {
      out.push(labels ? `${metric.name}{${labels}} ${value}` : `${metric.name} ${value}`)
    }
  }
  return out.join('\n') + '\n'
}
