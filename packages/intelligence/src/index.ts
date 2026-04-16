/**
 * @hive/intelligence — The queryable intelligence layer.
 *
 * TTP telemetry is not a log file. It's a queryable intelligence layer.
 * Surface clustering, anomaly patterns, flows, and behavioral fingerprints
 * your spreadsheet will never show you.
 */

// Cost modeling
export {
  estimateEventCost,
  estimateBatchCost,
  MODEL_PRICING,
  PROVIDER_AVG_PRICING,
} from './cost-model.js'
export type { CostBreakdown, ModelPricing } from './cost-model.js'

// Anomaly detection
export { detectAnomalies } from './anomaly.js'
export type { Anomaly, AnomalyConfig, AnomalySeverity, AnomalyCategory } from './anomaly.js'

// Spend forecasting
export { forecastSpend } from './forecast.js'
export type { Forecast, DailySpend, MonthProjection, ForecastConfig } from './forecast.js'

// Behavioral clustering
export {
  clusterBehavior,
  analyzeFlows,
  fingerprintByDept,
  fingerprintByProject,
} from './clustering.js'
export type {
  BehavioralCluster,
  FlowAnalysis,
  UsageFingerprint,
} from './clustering.js'
