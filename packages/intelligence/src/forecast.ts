/**
 * HIVE Spend Forecaster — Project next quarter at current growth.
 *
 * Uses simple linear regression on daily spend to project forward.
 * More sophisticated models (ARIMA, exponential smoothing) can be
 * plugged in later — the interface is the same.
 *
 * All calculations use TTP metadata only. No content.
 */

import type { TTPEvent } from '@hive/shared'
import { estimateEventCost } from './cost-model.js'

// ── Types ───────────────────────────────────────────────────────────────────

export interface DailySpend {
  date: string     // YYYY-MM-DD
  tokens: number
  cost: number     // USD
  calls: number
  providers: number
}

export interface Forecast {
  /** Projected total spend for the forecast period (USD). */
  projectedSpend: number
  /** Projected total tokens. */
  projectedTokens: number
  /** Daily growth rate (compounding). */
  dailyGrowthRate: number
  /** Annualized growth rate. */
  annualizedGrowthRate: number
  /** Monthly projections. */
  monthlyProjections: MonthProjection[]
  /** Confidence based on data volume. */
  confidence: 'high' | 'medium' | 'low'
  /** Daily data points used. */
  dataPoints: DailySpend[]
  /** Trend line: y = slope * x + intercept */
  trend: { slope: number; intercept: number; r2: number }
  /** Summary insight. */
  insight: string
}

export interface MonthProjection {
  month: string  // YYYY-MM
  spend: number
  tokens: number
  calls: number
}

export interface ForecastConfig {
  /** Number of days to forecast (default: 90 = one quarter). */
  horizonDays?: number
  /** Min data points for a valid forecast (default: 3). */
  minDataPoints?: number
}

// ── Engine ──────────────────────────────────────────────────────────────────

export function forecastSpend(
  events: TTPEvent[],
  config: ForecastConfig = {},
): Forecast | null {
  const horizon = config.horizonDays ?? 90
  const minPoints = config.minDataPoints ?? 3

  // ── Build daily spend series ──────────────────────────────────────────
  const dailyMap = new Map<string, { tokens: number; cost: number; calls: number; providers: Set<string> }>()

  for (const event of events) {
    const date = new Date(event.timestamp).toISOString().slice(0, 10)
    const entry = dailyMap.get(date) ?? { tokens: 0, cost: 0, calls: 0, providers: new Set() }
    const cost = estimateEventCost(event)
    entry.tokens += event.estimated_tokens
    entry.cost += cost.totalCost
    entry.calls += 1
    entry.providers.add(event.provider)
    dailyMap.set(date, entry)
  }

  const daily: DailySpend[] = [...dailyMap.entries()]
    .map(([date, v]) => ({ date, tokens: v.tokens, cost: v.cost, calls: v.calls, providers: v.providers.size }))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (daily.length < minPoints) return null

  // ── Linear regression on daily cost ───────────────────────────────────
  const xs = daily.map((_, i) => i)
  const ys = daily.map((d) => d.cost)
  const { slope, intercept, r2 } = linearRegression(xs, ys)

  // Token regression
  const tokenYs = daily.map((d) => d.tokens)
  const tokenReg = linearRegression(xs, tokenYs)

  // Call regression
  const callYs = daily.map((d) => d.calls)
  const callReg = linearRegression(xs, callYs)

  // ── Project forward ───────────────────────────────────────────────────
  const lastDay = daily.length - 1
  let projectedSpend = 0
  let projectedTokens = 0

  // Monthly buckets
  const monthlyMap = new Map<string, { spend: number; tokens: number; calls: number }>()
  const lastDate = new Date(daily[lastDay]!.date)

  for (let d = 1; d <= horizon; d++) {
    const x = lastDay + d
    const dayCost = Math.max(0, slope * x + intercept)
    const dayTokens = Math.max(0, tokenReg.slope * x + tokenReg.intercept)
    const dayCalls = Math.max(0, callReg.slope * x + callReg.intercept)
    projectedSpend += dayCost
    projectedTokens += dayTokens

    const futureDate = new Date(lastDate)
    futureDate.setDate(futureDate.getDate() + d)
    const monthKey = futureDate.toISOString().slice(0, 7)
    const entry = monthlyMap.get(monthKey) ?? { spend: 0, tokens: 0, calls: 0 }
    entry.spend += dayCost
    entry.tokens += dayTokens
    entry.calls += dayCalls
    monthlyMap.set(monthKey, entry)
  }

  const monthlyProjections: MonthProjection[] = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      spend: +v.spend.toFixed(2),
      tokens: Math.round(v.tokens),
      calls: Math.round(v.calls),
    }))

  // ── Growth rate ───────────────────────────────────────────────────────
  const firstCost = Math.max(0.001, ys[0] ?? 0.001)
  const lastCost = Math.max(0.001, ys[ys.length - 1] ?? 0.001)
  const dailyGrowth = daily.length > 1
    ? Math.pow(lastCost / firstCost, 1 / (daily.length - 1)) - 1
    : 0
  const annualGrowth = Math.pow(1 + dailyGrowth, 365) - 1

  // ── Confidence ────────────────────────────────────────────────────────
  const confidence = daily.length >= 14 ? 'high' : daily.length >= 7 ? 'medium' : 'low'

  // ── Insight generation ────────────────────────────────────────────────
  const totalHistorical = ys.reduce((a, b) => a + b, 0)
  const insight = generateInsight(totalHistorical, projectedSpend, slope, dailyGrowth, daily.length, horizon)

  return {
    projectedSpend: +projectedSpend.toFixed(2),
    projectedTokens: Math.round(projectedTokens),
    dailyGrowthRate: +dailyGrowth.toFixed(6),
    annualizedGrowthRate: +annualGrowth.toFixed(4),
    monthlyProjections,
    confidence,
    dataPoints: daily,
    trend: { slope: +slope.toFixed(6), intercept: +intercept.toFixed(4), r2: +r2.toFixed(4) },
    insight,
  }
}

// ── Linear Regression ───────────────────────────────────────────────────────

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number; r2: number } {
  const n = xs.length
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 }

  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i]!, 0)
  const sumX2 = xs.reduce((a, x) => a + x * x, 0)

  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 }

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  // R² calculation
  const meanY = sumY / n
  const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0)
  const ssRes = ys.reduce((a, y, i) => a + (y - (slope * xs[i]! + intercept)) ** 2, 0)
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0

  return { slope, intercept, r2 }
}

// ── Insight Generation ──────────────────────────────────────────────────────

function generateInsight(
  _historical: number,
  projected: number,
  slope: number,
  dailyGrowth: number,
  dataPoints: number,
  horizon: number,
): string {
  const parts: string[] = []

  if (slope > 0.01) {
    parts.push(`Spend is trending upward at $${slope.toFixed(2)}/day.`)
  } else if (slope < -0.01) {
    parts.push(`Spend is trending downward at $${Math.abs(slope).toFixed(2)}/day.`)
  } else {
    parts.push('Spend is stable with minimal daily change.')
  }

  if (projected > 0) {
    parts.push(`At current trajectory, next ${horizon} days will cost ~$${projected.toFixed(2)}.`)
  }

  if (dailyGrowth > 0.02) {
    parts.push(`Growth rate of ${(dailyGrowth * 100).toFixed(1)}%/day compounds to ${((Math.pow(1 + dailyGrowth, 90) - 1) * 100).toFixed(0)}% over one quarter.`)
  }

  if (dataPoints < 7) {
    parts.push('Low confidence — less than 7 days of data. Forecast will improve with more history.')
  }

  return parts.join(' ')
}
