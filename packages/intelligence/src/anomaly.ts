/**
 * HIVE Anomaly Detection — Surface patterns your spreadsheet will never show.
 *
 * Runs entirely on TTP metadata. No content, no prompts, no completions.
 * Detects:
 *   - Usage spikes (z-score on hourly volumes)
 *   - Off-hours activity (configurable work-hours window)
 *   - New/unseen providers or models
 *   - Error rate anomalies
 *   - Latency outliers (IQR method)
 *   - Shadow AI emergence
 *   - Cost velocity changes
 */

import type { TTPEvent } from '@hive/shared'
import { estimateEventCost } from './cost-model.js'

// ── Types ───────────────────────────────────────────────────────────────────

export type AnomalySeverity = 'info' | 'warning' | 'critical'
export type AnomalyCategory =
  | 'usage_spike'
  | 'off_hours'
  | 'new_provider'
  | 'new_model'
  | 'error_burst'
  | 'latency_outlier'
  | 'shadow_ai'
  | 'cost_velocity'
  | 'dormant_reactivation'

export interface Anomaly {
  id: string
  category: AnomalyCategory
  severity: AnomalySeverity
  title: string
  description: string
  detectedAt: number
  /** The events that contributed to this anomaly. */
  eventCount: number
  /** Affected provider(s). */
  providers: string[]
  /** Numeric signal value (e.g., z-score, error rate). */
  signal: number
  /** Human-readable context. */
  context: Record<string, string | number>
}

export interface AnomalyConfig {
  /** Z-score threshold for usage spikes (default: 2.5). */
  spikeZThreshold?: number
  /** Work hours in 24h format [start, end] (default: [8, 18]). */
  workHours?: [number, number]
  /** Error rate threshold to flag (default: 0.15 = 15%). */
  errorRateThreshold?: number
  /** Known/sanctioned providers. */
  sanctionedProviders?: Set<string>
  /** Previously seen models — anything new triggers an alert. */
  knownModels?: Set<string>
}

const DEFAULTS: Required<AnomalyConfig> = {
  spikeZThreshold: 2.5,
  workHours: [8, 18],
  errorRateThreshold: 0.15,
  sanctionedProviders: new Set([
    'openai', 'anthropic', 'google', 'azure_openai', 'bedrock',
    'mistral', 'cohere', 'groq', 'together', 'ollama',
  ]),
  knownModels: new Set(),
}

// ── Detection Engine ────────────────────────────────────────────────────────

export function detectAnomalies(
  events: TTPEvent[],
  config: AnomalyConfig = {},
): Anomaly[] {
  const cfg = { ...DEFAULTS, ...config }
  const anomalies: Anomaly[] = []
  let seq = 0
  const id = () => `anomaly-${++seq}`

  if (events.length === 0) return anomalies

  // ── 1. Usage spikes (hourly z-score) ──────────────────────────────────
  const hourlyBuckets = new Map<number, TTPEvent[]>()
  for (const e of events) {
    const h = Math.floor(e.timestamp / 3_600_000)
    const arr = hourlyBuckets.get(h) ?? []
    arr.push(e)
    hourlyBuckets.set(h, arr)
  }
  const hourlyCounts = [...hourlyBuckets.values()].map((v) => v.length)
  const mean = hourlyCounts.reduce((a, b) => a + b, 0) / hourlyCounts.length
  const stddev = Math.sqrt(hourlyCounts.reduce((a, b) => a + (b - mean) ** 2, 0) / hourlyCounts.length)
  if (stddev > 0) {
    for (const [hour, bucket] of hourlyBuckets) {
      const z = (bucket.length - mean) / stddev
      if (z > cfg.spikeZThreshold) {
        anomalies.push({
          id: id(),
          category: 'usage_spike',
          severity: z > 4 ? 'critical' : 'warning',
          title: 'Usage Spike Detected',
          description: `${bucket.length} events in one hour (z-score: ${z.toFixed(1)}). Normal average: ${mean.toFixed(0)}/hr.`,
          detectedAt: hour * 3_600_000,
          eventCount: bucket.length,
          providers: [...new Set(bucket.map((e) => e.provider))],
          signal: z,
          context: { hour_bucket: new Date(hour * 3_600_000).toISOString(), count: bucket.length, z_score: +z.toFixed(2) },
        })
      }
    }
  }

  // ── 2. Off-hours activity ─────────────────────────────────────────────
  const offHoursEvents = events.filter((e) => {
    const hour = new Date(e.timestamp).getHours()
    return hour < cfg.workHours[0] || hour >= cfg.workHours[1]
  })
  if (offHoursEvents.length > 5) {
    const offProviders = [...new Set(offHoursEvents.map((e) => e.provider))]
    anomalies.push({
      id: id(),
      category: 'off_hours',
      severity: offHoursEvents.length > 50 ? 'warning' : 'info',
      title: 'Off-Hours AI Usage',
      description: `${offHoursEvents.length} events outside work hours (${cfg.workHours[0]}:00–${cfg.workHours[1]}:00).`,
      detectedAt: offHoursEvents[offHoursEvents.length - 1]!.timestamp,
      eventCount: offHoursEvents.length,
      providers: offProviders,
      signal: offHoursEvents.length / events.length,
      context: { off_hours_pct: +((offHoursEvents.length / events.length) * 100).toFixed(1) },
    })
  }

  // ── 3. Shadow AI / New providers ──────────────────────────────────────
  const providerCounts = new Map<string, number>()
  for (const e of events) providerCounts.set(e.provider, (providerCounts.get(e.provider) ?? 0) + 1)
  for (const [provider, count] of providerCounts) {
    if (!cfg.sanctionedProviders.has(provider)) {
      anomalies.push({
        id: id(),
        category: 'shadow_ai',
        severity: count > 20 ? 'critical' : 'warning',
        title: `Shadow AI: ${provider}`,
        description: `${count} events from unsanctioned provider "${provider}". This may indicate unauthorized AI usage.`,
        detectedAt: Date.now(),
        eventCount: count,
        providers: [provider],
        signal: count,
        context: { total_events: count, pct_of_traffic: +((count / events.length) * 100).toFixed(1) },
      })
    }
  }

  // ── 4. New models (never-before-seen) ─────────────────────────────────
  if (cfg.knownModels.size > 0) {
    const modelCounts = new Map<string, number>()
    for (const e of events) modelCounts.set(e.model_hint, (modelCounts.get(e.model_hint) ?? 0) + 1)
    for (const [model, count] of modelCounts) {
      if (!cfg.knownModels.has(model)) {
        anomalies.push({
          id: id(),
          category: 'new_model',
          severity: 'info',
          title: `New Model: ${model}`,
          description: `${count} events using previously unseen model "${model}".`,
          detectedAt: Date.now(),
          eventCount: count,
          providers: [...new Set(events.filter((e) => e.model_hint === model).map((e) => e.provider))],
          signal: count,
          context: { model, count },
        })
      }
    }
  }

  // ── 5. Error rate anomalies ───────────────────────────────────────────
  const byProvider = new Map<string, { total: number; errors: number }>()
  for (const e of events) {
    const prev = byProvider.get(e.provider) ?? { total: 0, errors: 0 }
    prev.total++
    if (e.direction === 'error' || (e.status_code >= 400 && e.status_code < 600)) prev.errors++
    byProvider.set(e.provider, prev)
  }
  for (const [provider, { total, errors }] of byProvider) {
    if (total < 10) continue
    const rate = errors / total
    if (rate > cfg.errorRateThreshold) {
      anomalies.push({
        id: id(),
        category: 'error_burst',
        severity: rate > 0.5 ? 'critical' : 'warning',
        title: `High Error Rate: ${provider}`,
        description: `${(rate * 100).toFixed(1)}% error rate on ${provider} (${errors}/${total} events).`,
        detectedAt: Date.now(),
        eventCount: errors,
        providers: [provider],
        signal: rate,
        context: { error_rate: +(rate * 100).toFixed(1), total_calls: total, errors },
      })
    }
  }

  // ── 6. Latency outliers (IQR method) ──────────────────────────────────
  const latencies = events
    .filter((e) => e.latency_ms !== undefined && e.latency_ms > 0)
    .map((e) => ({ provider: e.provider, latency: e.latency_ms! }))

  if (latencies.length > 20) {
    const sorted = latencies.map((l) => l.latency).sort((a, b) => a - b)
    const q1 = sorted[Math.floor(sorted.length * 0.25)]!
    const q3 = sorted[Math.floor(sorted.length * 0.75)]!
    const iqr = q3 - q1
    const upperFence = q3 + 2.5 * iqr
    const outliers = latencies.filter((l) => l.latency > upperFence)
    if (outliers.length > 3) {
      const worstProvider = mode(outliers.map((o) => o.provider))
      anomalies.push({
        id: id(),
        category: 'latency_outlier',
        severity: outliers.length > 20 ? 'warning' : 'info',
        title: 'Latency Outliers Detected',
        description: `${outliers.length} events exceed the upper fence (${Math.round(upperFence)} ms). Most affected: ${worstProvider}.`,
        detectedAt: Date.now(),
        eventCount: outliers.length,
        providers: [...new Set(outliers.map((o) => o.provider))],
        signal: upperFence,
        context: { upper_fence_ms: Math.round(upperFence), outlier_count: outliers.length, q1: Math.round(q1), q3: Math.round(q3) },
      })
    }
  }

  // ── 7. Cost velocity change ───────────────────────────────────────────
  if (events.length > 50) {
    const midpoint = Math.floor(events.length / 2)
    const firstHalf = events.slice(0, midpoint)
    const secondHalf = events.slice(midpoint)
    const costFirst = firstHalf.reduce((s, e) => s + estimateEventCost(e).totalCost, 0)
    const costSecond = secondHalf.reduce((s, e) => s + estimateEventCost(e).totalCost, 0)
    if (costFirst > 0) {
      const velocity = (costSecond - costFirst) / costFirst
      if (velocity > 0.5) { // >50% increase
        anomalies.push({
          id: id(),
          category: 'cost_velocity',
          severity: velocity > 1.0 ? 'critical' : 'warning',
          title: 'Cost Acceleration',
          description: `Spend increased ${(velocity * 100).toFixed(0)}% between first and second half of the window.`,
          detectedAt: Date.now(),
          eventCount: events.length,
          providers: [...new Set(events.map((e) => e.provider))],
          signal: velocity,
          context: { first_half_usd: +costFirst.toFixed(2), second_half_usd: +costSecond.toFixed(2), velocity_pct: +(velocity * 100).toFixed(1) },
        })
      }
    }
  }

  return anomalies.sort((a, b) => {
    const sevOrder = { critical: 0, warning: 1, info: 2 }
    return (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2)
  })
}

function mode(arr: string[]): string {
  const counts = new Map<string, number>()
  for (const s of arr) counts.set(s, (counts.get(s) ?? 0) + 1)
  let max = 0, result = arr[0]!
  for (const [k, v] of counts) if (v > max) { max = v; result = k }
  return result
}
