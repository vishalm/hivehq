/**
 * HIVE Behavioral Clustering — Fingerprints your spreadsheet can't show.
 *
 * Groups usage into behavioral clusters based on:
 *   - Provider affinity (who uses what)
 *   - Temporal patterns (when they use it)
 *   - Model sophistication (cheap vs premium)
 *   - Volume patterns (heavy vs light)
 *   - Use-case distribution
 *
 * All analysis runs on TTP metadata only. Zero content.
 */

import type { TTPEvent } from '@hive/shared'
import { estimateEventCost } from './cost-model.js'

// ── Types ───────────────────────────────────────────────────────────────────

export interface BehavioralCluster {
  /** Cluster label (auto-generated). */
  label: string
  /** Descriptive fingerprint. */
  fingerprint: string
  /** Number of unique emitter_ids in this cluster. */
  actors: number
  /** Total events in this cluster. */
  events: number
  /** Dominant provider. */
  dominantProvider: string
  /** Dominant model. */
  dominantModel: string
  /** Average hourly activity distribution (24 slots). */
  hourlyProfile: number[]
  /** Cost characteristics. */
  costProfile: { avgCostPerEvent: number; totalCost: number }
  /** Behavioral tags. */
  tags: string[]
}

export interface FlowAnalysis {
  /** Provider → Provider flow (how many events go provider A → provider B in same session). */
  flows: Array<{ from: string; to: string; count: number }>
  /** Session depth distribution (how many events per session_hash). */
  sessionDepths: { min: number; max: number; avg: number; p95: number }
  /** Multi-provider sessions (sessions that touch more than one provider). */
  multiProviderSessions: number
  /** Total unique sessions. */
  totalSessions: number
}

export interface UsageFingerprint {
  /** Entity (dept, project, or emitter). */
  entity: string
  entityType: 'dept' | 'project' | 'emitter'
  /** Provider distribution. */
  providerMix: Record<string, number>
  /** Model distribution. */
  modelMix: Record<string, number>
  /** Hour-of-day distribution. */
  hourlyDistribution: number[]
  /** Average latency. */
  avgLatency: number
  /** Error rate. */
  errorRate: number
  /** Total cost. */
  totalCost: number
  /** Total tokens. */
  totalTokens: number
  /** Events analyzed. */
  eventCount: number
  /** Behavioral classification. */
  classification: string
}

// ── Clustering Engine ───────────────────────────────────────────────────────

export function clusterBehavior(events: TTPEvent[]): BehavioralCluster[] {
  if (events.length === 0) return []

  // Group by emitter_id first
  const byEmitter = new Map<string, TTPEvent[]>()
  for (const e of events) {
    const arr = byEmitter.get(e.emitter_id) ?? []
    arr.push(e)
    byEmitter.set(e.emitter_id, arr)
  }

  // Feature extraction per emitter
  const emitterFeatures = new Map<string, {
    providers: Map<string, number>
    models: Map<string, number>
    hours: number[]
    costs: number[]
    latencies: number[]
    errorRate: number
  }>()

  for (const [emitterId, emitterEvents] of byEmitter) {
    const providers = new Map<string, number>()
    const models = new Map<string, number>()
    const hours = new Array(24).fill(0) as number[]
    const costs: number[] = []
    let errors = 0

    for (const e of emitterEvents) {
      providers.set(e.provider, (providers.get(e.provider) ?? 0) + 1)
      models.set(e.model_hint, (models.get(e.model_hint) ?? 0) + 1)
      hours[new Date(e.timestamp).getHours()]!++
      costs.push(estimateEventCost(e).totalCost)
      if (e.direction === 'error' || e.status_code >= 400) errors++
    }

    const latencies = emitterEvents
      .filter((e) => e.latency_ms !== undefined)
      .map((e) => e.latency_ms!)

    emitterFeatures.set(emitterId, {
      providers,
      models,
      hours,
      costs,
      latencies,
      errorRate: emitterEvents.length > 0 ? errors / emitterEvents.length : 0,
    })
  }

  // Simple k-means-style clustering on dominant provider + time profile
  // For v0.1: rule-based clustering
  const clusters = new Map<string, {
    emitters: Set<string>
    events: TTPEvent[]
    label: string
    tags: string[]
  }>()

  for (const [emitterId, features] of emitterFeatures) {
    const dominantProvider = maxKey(features.providers)
    const peakHour = features.hours.indexOf(Math.max(...features.hours))
    const avgCost = features.costs.reduce((a, b) => a + b, 0) / Math.max(features.costs.length, 1)

    // Classify
    let clusterKey: string
    const tags: string[] = []

    if (features.errorRate > 0.3) {
      clusterKey = 'error-heavy'
      tags.push('high-error-rate', 'needs-attention')
    } else if (avgCost > 0.01) {
      clusterKey = `premium-${dominantProvider}`
      tags.push('high-cost', 'premium-models')
    } else if (peakHour < 8 || peakHour >= 20) {
      clusterKey = `off-hours-${dominantProvider}`
      tags.push('off-hours', 'automated')
    } else {
      clusterKey = `standard-${dominantProvider}`
      tags.push('normal-usage')
    }

    const cluster = clusters.get(clusterKey) ?? {
      emitters: new Set(),
      events: [],
      label: clusterKey,
      tags,
    }
    cluster.emitters.add(emitterId)
    cluster.events.push(...(byEmitter.get(emitterId) ?? []))
    clusters.set(clusterKey, cluster)
  }

  // Build output
  return [...clusters.values()].map((c) => {
    const providers = new Map<string, number>()
    const models = new Map<string, number>()
    const hours = new Array(24).fill(0) as number[]
    let totalCost = 0

    for (const e of c.events) {
      providers.set(e.provider, (providers.get(e.provider) ?? 0) + 1)
      models.set(e.model_hint, (models.get(e.model_hint) ?? 0) + 1)
      hours[new Date(e.timestamp).getHours()]!++
      totalCost += estimateEventCost(e).totalCost
    }

    return {
      label: formatClusterLabel(c.label),
      fingerprint: generateFingerprint(providers, c.events.length),
      actors: c.emitters.size,
      events: c.events.length,
      dominantProvider: maxKey(providers),
      dominantModel: maxKey(models),
      hourlyProfile: hours,
      costProfile: {
        avgCostPerEvent: c.events.length > 0 ? totalCost / c.events.length : 0,
        totalCost,
      },
      tags: c.tags,
    }
  }).sort((a, b) => b.events - a.events)
}

// ── Flow Analysis ───────────────────────────────────────────────────────────

export function analyzeFlows(events: TTPEvent[]): FlowAnalysis {
  // Group by session_hash
  const sessions = new Map<string, TTPEvent[]>()
  for (const e of events) {
    const arr = sessions.get(e.session_hash) ?? []
    arr.push(e)
    sessions.set(e.session_hash, arr)
  }

  // Flow analysis (provider transitions within sessions)
  const flowMap = new Map<string, number>()
  let multiProviderCount = 0

  for (const [, sessionEvents] of sessions) {
    const sorted = sessionEvents.sort((a, b) => a.timestamp - b.timestamp)
    const sessionProviders = new Set(sorted.map((e) => e.provider))
    if (sessionProviders.size > 1) multiProviderCount++

    for (let i = 1; i < sorted.length; i++) {
      const from = sorted[i - 1]!.provider
      const to = sorted[i]!.provider
      if (from !== to) {
        const key = `${from}→${to}`
        flowMap.set(key, (flowMap.get(key) ?? 0) + 1)
      }
    }
  }

  const flows = [...flowMap.entries()]
    .map(([key, count]) => {
      const [from, to] = key.split('→')
      return { from: from!, to: to!, count }
    })
    .sort((a, b) => b.count - a.count)

  // Session depth stats
  const depths = [...sessions.values()].map((v) => v.length)
  const sortedDepths = depths.sort((a, b) => a - b)

  return {
    flows,
    sessionDepths: {
      min: sortedDepths[0] ?? 0,
      max: sortedDepths[sortedDepths.length - 1] ?? 0,
      avg: depths.length > 0 ? depths.reduce((a, b) => a + b, 0) / depths.length : 0,
      p95: sortedDepths[Math.floor(sortedDepths.length * 0.95)] ?? 0,
    },
    multiProviderSessions: multiProviderCount,
    totalSessions: sessions.size,
  }
}

// ── Usage Fingerprints ──────────────────────────────────────────────────────

export function fingerprintByDept(events: TTPEvent[]): UsageFingerprint[] {
  return fingerprintBy(events, (e) => e.dept_tag ?? 'untagged', 'dept')
}

export function fingerprintByProject(events: TTPEvent[]): UsageFingerprint[] {
  return fingerprintBy(events, (e) => e.project_tag ?? 'untagged', 'project')
}

function fingerprintBy(
  events: TTPEvent[],
  groupFn: (e: TTPEvent) => string,
  entityType: 'dept' | 'project' | 'emitter',
): UsageFingerprint[] {
  const groups = new Map<string, TTPEvent[]>()
  for (const e of events) {
    const key = groupFn(e)
    const arr = groups.get(key) ?? []
    arr.push(e)
    groups.set(key, arr)
  }

  return [...groups.entries()].map(([entity, groupEvents]) => {
    const providerMix: Record<string, number> = {}
    const modelMix: Record<string, number> = {}
    const hours = new Array(24).fill(0) as number[]
    let totalCost = 0
    let totalTokens = 0
    let errors = 0
    const latencies: number[] = []

    for (const e of groupEvents) {
      providerMix[e.provider] = (providerMix[e.provider] ?? 0) + 1
      modelMix[e.model_hint] = (modelMix[e.model_hint] ?? 0) + 1
      hours[new Date(e.timestamp).getHours()]!++
      totalCost += estimateEventCost(e).totalCost
      totalTokens += e.estimated_tokens
      if (e.direction === 'error' || e.status_code >= 400) errors++
      if (e.latency_ms !== undefined) latencies.push(e.latency_ms)
    }

    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0
    const errorRate = groupEvents.length > 0 ? errors / groupEvents.length : 0

    // Classification
    const classification = classifyUsagePattern(providerMix, totalCost, errorRate, hours, groupEvents.length)

    return {
      entity,
      entityType,
      providerMix,
      modelMix,
      hourlyDistribution: hours,
      avgLatency: Math.round(avgLatency),
      errorRate: +errorRate.toFixed(4),
      totalCost: +totalCost.toFixed(4),
      totalTokens,
      eventCount: groupEvents.length,
      classification,
    }
  }).sort((a, b) => b.totalCost - a.totalCost)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function maxKey(map: Map<string, number>): string {
  let max = 0, result = 'unknown'
  for (const [k, v] of map) if (v > max) { max = v; result = k }
  return result
}

function formatClusterLabel(key: string): string {
  return key.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function generateFingerprint(providers: Map<string, number>, total: number): string {
  const parts = [...providers.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([p, c]) => `${p}:${Math.round((c / total) * 100)}%`)
  return parts.join(' | ')
}

function classifyUsagePattern(
  providerMix: Record<string, number>,
  totalCost: number,
  errorRate: number,
  hours: number[],
  eventCount: number,
): string {
  const providers = Object.keys(providerMix)
  const peakHour = hours.indexOf(Math.max(...hours))
  const hasOllama = 'ollama' in providerMix
  const hasClaude = 'anthropic' in providerMix
  const hasOpenAI = 'openai' in providerMix

  if (errorRate > 0.3) return 'Unstable — high error rate'
  if (providers.length >= 3) return 'Multi-provider power user'
  if (hasOllama && providers.length === 1) return 'Local-first (Ollama exclusive)'
  if (hasClaude && !hasOpenAI) return 'Claude-native workflow'
  if (hasOpenAI && !hasClaude) return 'OpenAI-native workflow'
  if (hasClaude && hasOpenAI) return 'Cross-platform (Claude + OpenAI)'
  if (totalCost > 10 && eventCount > 100) return 'Heavy consumer'
  if (peakHour < 8 || peakHour >= 20) return 'Off-hours automated'
  return 'Standard usage'
}
