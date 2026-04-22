/**
 * Prometheus-format metrics for Scout — handwritten, zero deps.
 * Mirrors the style of packages/node-server/src/metrics.ts so the fleet
 * has a consistent scrape shape.
 *
 * Metrics exposed at `/metrics` on the admin server:
 *   scout_events_recorded_total{provider}
 *   scout_events_shipped_total{provider}
 *   scout_events_dropped_total{reason}
 *   scout_queue_depth                    (gauge, in-memory collector queue)
 *   scout_wal_files                      (gauge, number of pending WAL batches)
 *   scout_wal_bytes                      (gauge, total WAL size on disk)
 *   scout_ship_attempts_total{result}
 *   scout_ship_latency_ms_sum / _count
 *   scout_last_ship_timestamp_seconds    (gauge, unix seconds of last success)
 *   scout_node_reachable                 (gauge, 0/1)
 *   scout_info{version,deployment,residency,scout_id}
 *   scout_up                             (gauge, always 1)
 */

type Labels = Record<string, string>

interface Metric {
  name: string
  help: string
  type: 'counter' | 'gauge' | 'summary'
  values: Map<string, number>
}

function labelString(labels: Labels): string {
  const keys = Object.keys(labels).sort()
  if (keys.length === 0) return ''
  return keys.map((k) => `${k}="${escape(labels[k]!)}"`).join(',')
}

function escape(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')
}

const m = (name: string, help: string, type: Metric['type']): Metric => ({
  name,
  help,
  type,
  values: new Map(),
})

export const scoutMetrics = {
  eventsRecorded: m(
    'scout_events_recorded_total',
    'TTP events handed to Scout from connectors',
    'counter',
  ),
  eventsShipped: m(
    'scout_events_shipped_total',
    'TTP events successfully shipped to the Node hub',
    'counter',
  ),
  eventsDropped: m(
    'scout_events_dropped_total',
    'TTP events dropped (WAL full, parse, governance, etc.)',
    'counter',
  ),
  queueDepth: m(
    'scout_queue_depth',
    'In-memory collector queue depth',
    'gauge',
  ),
  walFiles: m(
    'scout_wal_files',
    'Pending WAL batch files on disk',
    'gauge',
  ),
  walBytes: m(
    'scout_wal_bytes',
    'Total bytes used by the WAL directory',
    'gauge',
  ),
  shipAttempts: m(
    'scout_ship_attempts_total',
    'Attempts to ship a batch (by result)',
    'counter',
  ),
  shipLatencySum: m(
    'scout_ship_latency_ms_sum',
    'Sum of ship round-trip latencies in ms',
    'summary',
  ),
  shipLatencyCount: m(
    'scout_ship_latency_ms_count',
    'Count of ship latency observations',
    'summary',
  ),
  lastShipTimestamp: m(
    'scout_last_ship_timestamp_seconds',
    'Unix seconds of last successful ship',
    'gauge',
  ),
  nodeReachable: m(
    'scout_node_reachable',
    'Whether the Node hub was reachable on the last attempt (0/1)',
    'gauge',
  ),
  info: m('scout_info', 'Build/identity info for this Scout (value always 1)', 'gauge'),
  up: m('scout_up', 'Scout liveness', 'gauge'),
}

scoutMetrics.up.values.set('', 1)
scoutMetrics.nodeReachable.values.set('', 0)

export function counterInc(metric: Metric, labels: Labels = {}, amount = 1): void {
  const k = labelString(labels)
  metric.values.set(k, (metric.values.get(k) ?? 0) + amount)
}

export function gaugeSet(metric: Metric, value: number, labels: Labels = {}): void {
  const k = labelString(labels)
  metric.values.set(k, value)
}

export function setInfo(labels: Labels): void {
  scoutMetrics.info.values.clear()
  scoutMetrics.info.values.set(labelString(labels), 1)
}

export function renderProm(): string {
  const out: string[] = []
  for (const metric of Object.values(scoutMetrics)) {
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

/** Reset all metrics (tests only). */
export function _resetForTest(): void {
  for (const metric of Object.values(scoutMetrics)) {
    metric.values.clear()
  }
  scoutMetrics.up.values.set('', 1)
  scoutMetrics.nodeReachable.values.set('', 0)
}
