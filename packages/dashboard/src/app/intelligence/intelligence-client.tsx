'use client'

import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter,
  Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

/* ── SVG Icon helpers (zero emoji) ──────────────────────────────────────── */
const icons = {
  dollar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  alert: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.7 16.5-7.1-12.3a3 3 0 0 0-5.2 0L2.3 16.5A3 3 0 0 0 4.9 21h14.2a3 3 0 0 0 2.6-4.5Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  trend: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  cluster: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><circle cx="5" cy="19" r="2"/><line x1="14.5" y1="9.5" x2="17.5" y2="6.5"/><line x1="9.5" y1="9.5" x2="6.5" y2="6.5"/><line x1="14.5" y1="14.5" x2="17.5" y2="17.5"/><line x1="9.5" y1="14.5" x2="6.5" y2="17.5"/></svg>,
  flow: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  fingerprint: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/><path d="M5 19.5C5.5 18 6 15 6 12c0-3.3 2.7-6 6-6s6 2.7 6 6c0 1-.2 2-.5 3"/><path d="M12 10a2 2 0 0 0-2 2c0 2 .5 4 1 6"/><path d="M12 10a2 2 0 0 1 2 2c0 1.5-.3 3-.8 4.5"/></svg>,
  refresh: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15.5A9 9 0 1 1 21 7l2 3"/></svg>,
}

const PALETTE = ['#ffd60a', '#007aff', '#34c759', '#ff9500', '#af52de', '#ff3b30', '#5ac8fa', '#ffcc00', '#a2845e', '#30d158']
const ACCENT = '#ffd60a'

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Props {
  cost: any
  anomalies: any
  forecast: any
  clusters: any
  fingerprints: any
}

export default function IntelligenceClient({ cost, anomalies, forecast, clusters, fingerprints }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'cost' | 'anomalies' | 'forecast' | 'clusters' | 'flows' | 'fingerprints'>('overview')

  // ── Derived data ────────────────────────────────────────────────────────
  const costByProvider = useMemo(() => {
    if (!cost?.byProvider) return []
    return Object.entries(cost.byProvider as Record<string, any>).map(([name, v]: [string, any]) => ({
      name,
      cost: +(v.totalCost ?? 0).toFixed(4),
      tokens: v.totalTokens ?? 0,
      calls: v.callCount ?? 0,
    })).sort((a, b) => b.cost - a.cost)
  }, [cost])

  const costByModel = useMemo(() => {
    if (!cost?.byModel) return []
    return Object.entries(cost.byModel as Record<string, any>).map(([name, v]: [string, any]) => ({
      name: name.length > 20 ? name.slice(0, 18) + '..' : name,
      cost: +(v.totalCost ?? 0).toFixed(4),
      tokens: v.totalTokens ?? 0,
    })).sort((a, b) => b.cost - a.cost).slice(0, 12)
  }, [cost])

  const costByDept = useMemo(() => {
    if (!cost?.byDept) return []
    return Object.entries(cost.byDept as Record<string, any>).map(([name, v]: [string, any]) => ({
      name: name || 'untagged',
      cost: +(v.totalCost ?? 0).toFixed(4),
    })).sort((a, b) => b.cost - a.cost)
  }, [cost])

  const anomalyList = useMemo(() => anomalies?.anomalies ?? [], [anomalies])

  const forecastData = useMemo(() => forecast ?? null, [forecast])

  const clusterList = useMemo(() => clusters?.clusters ?? [], [clusters])
  const flowData = useMemo(() => clusters?.flows ?? null, [clusters])

  const fpList = useMemo(() => fingerprints?.fingerprints ?? [], [fingerprints])

  // ── KPIs ────────────────────────────────────────────────────────────────
  const totalCost = cost?.totalCost ?? 0
  const totalTokens = cost?.totalTokens ?? 0
  const totalCalls = cost?.totalCalls ?? 0
  const anomalyCount = anomalyList.length
  const projectedSpend = forecastData?.projectedSpend ?? 0
  const confidence = forecastData?.confidence ?? 'low'
  const clusterCount = clusterList.length
  const r2 = forecastData?.trend?.r2 ?? 0

  const noData = !cost && !anomalies && !forecast && !clusters

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: icons.trend },
    { key: 'cost' as const, label: 'Cost Analysis', icon: icons.dollar },
    { key: 'anomalies' as const, label: 'Anomalies', icon: icons.alert },
    { key: 'forecast' as const, label: 'Forecast', icon: icons.trend },
    { key: 'clusters' as const, label: 'Clusters', icon: icons.cluster },
    { key: 'flows' as const, label: 'Flows', icon: icons.flow },
    { key: 'fingerprints' as const, label: 'Fingerprints', icon: icons.fingerprint },
  ]

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <section className="card no-lift" style={{ background: 'var(--gradient-hero)', borderTop: '2px solid rgba(255,214,10,0.15)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '35%', height: '100%', background: 'radial-gradient(ellipse at 100% 0%, rgba(255,214,10,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, position: 'relative' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,214,10,0.5)', marginBottom: 8 }}>Token Economy Intelligence</div>
            <h1 style={{ marginTop: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              <span style={{ color: ACCENT }}>HIVE</span> Intelligence
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14, lineHeight: 1.7, maxWidth: 520 }}>
              Talk to your data. Define your value. See where your AI budget goes,
              detect waste, and prove governance compliance.
            </p>
          </div>
          <a href="/" className="btn" style={{ fontSize: 12, padding: '8px 16px', gap: 6, minHeight: 'auto' }}>
            {icons.refresh} Refresh
          </a>
        </div>

        {/* ── KPI Row — Token Economy Metrics ──────────────────────────── */}
        <div className="kpi stagger" style={{ marginTop: 24 }}>
          <KpiCard label="Token Spend" value={`$${totalCost.toFixed(2)}`} accent />
          <KpiCard label="Tokens Processed" value={compact(totalTokens)} />
          <KpiCard label="API Calls" value={compact(totalCalls)} />
          <KpiCard label="Anomalies" value={String(anomalyCount)} alert={anomalyCount > 0} />
          <KpiCard label="90d Forecast" value={`$${projectedSpend.toFixed(2)}`} />
          <KpiCard label="ROI Confidence" value={confidence.toUpperCase()} />
          <KpiCard label="Behavior Clusters" value={String(clusterCount)} />
          <KpiCard label="R\u00B2 Fit" value={r2.toFixed(3)} />
        </div>
      </section>

      {/* ── Tab Navigation ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 16, scrollbarWidth: 'none' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', border: 'none', borderRadius: 'var(--r-md, 10px)',
              background: activeTab === t.key ? 'rgba(255,214,10,0.08)' : 'transparent',
              color: activeTab === t.key ? ACCENT : 'var(--text-secondary, rgba(255,255,255,0.55))',
              fontWeight: 500,
              fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              minHeight: 44,
              position: 'relative',
              fontFamily: 'inherit',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {noData && (
        <section className="card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ color: 'var(--muted)', fontSize: 16 }}>
            No intelligence data yet. Start ingesting TTP events to unlock insights.
          </div>
          <a href="/setup" style={{ color: ACCENT, fontSize: 14, marginTop: 12, display: 'inline-block' }}>Set up connectors</a>
        </section>
      )}

      {!noData && activeTab === 'overview' && <OverviewTab cost={cost} costByProvider={costByProvider} costByModel={costByModel} anomalyList={anomalyList} forecastData={forecastData} clusterList={clusterList} />}
      {!noData && activeTab === 'cost' && <CostTab cost={cost} costByProvider={costByProvider} costByModel={costByModel} costByDept={costByDept} />}
      {!noData && activeTab === 'anomalies' && <AnomaliesTab anomalyList={anomalyList} />}
      {!noData && activeTab === 'forecast' && <ForecastTab data={forecastData} />}
      {!noData && activeTab === 'clusters' && <ClustersTab clusterList={clusterList} />}
      {!noData && activeTab === 'flows' && <FlowsTab data={flowData} />}
      {!noData && activeTab === 'fingerprints' && <FingerprintsTab fpList={fpList} />}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   OVERVIEW TAB — Executive summary with mixed visualization types
   ══════════════════════════════════════════════════════════════════════════ */
function OverviewTab({ cost, costByProvider, costByModel, anomalyList, forecastData, clusterList }: any) {
  return (
    <>
      {/* Row 1: Cost Treemap + Anomaly Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="two-col">
        <section className="card">
          <SectionHeader icon={icons.dollar} title="Cost by Provider" subtitle="Treemap — proportional spend" />
          {costByProvider.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <Treemap
                data={costByProvider.map((d: any, i: number) => ({ ...d, fill: PALETTE[i % PALETTE.length] }))}
                dataKey="cost"
                nameKey="name"
                aspectRatio={4 / 3}
                stroke="rgba(255,255,255,0.1)"
                content={<TreemapContent />}
              />
            </ResponsiveContainer>
          ) : <NoData />}
        </section>

        <section className="card">
          <SectionHeader icon={icons.alert} title="Anomaly Severity" subtitle={`${anomalyList.length} anomalies detected`} />
          {anomalyList.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => new Date(v).toLocaleDateString()} name="Time" />
                <YAxis dataKey="severity" type="category" name="Severity" />
                <Tooltip content={<AnomalyTooltip />} />
                <Scatter data={anomalyList.map((a: any) => ({
                  ...a,
                  timestamp: a.timestamp ?? Date.now(),
                  severityScore: a.severity === 'critical' ? 4 : a.severity === 'high' ? 3 : a.severity === 'medium' ? 2 : 1,
                }))} fill="#ff3b30">
                  {anomalyList.map((_: any, i: number) => (
                    <Cell key={i} fill={anomalyList[i].severity === 'critical' ? '#ff3b30' : anomalyList[i].severity === 'high' ? '#ff9500' : '#ffd60a'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : <div style={{ padding: 40, textAlign: 'center', color: '#34c759', fontWeight: 600 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 8px' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            All clear. No anomalies detected.
          </div>}
        </section>
      </div>

      {/* Row 2: Spend Forecast Area + Model Cost Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }} className="two-col">
        <section className="card">
          <SectionHeader icon={icons.trend} title="Spend Forecast" subtitle={forecastData ? `${forecastData.confidence} confidence — R\u00B2 ${(forecastData.trend?.r2 ?? 0).toFixed(3)}` : 'Insufficient data'} />
          {forecastData?.dataPoints ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={[
                ...forecastData.dataPoints.map((d: any) => ({ date: d.date, actual: d.cost, forecast: null })),
                ...((forecastData.monthlyProjections ?? []) as any[]).map((m: any) => ({ date: m.month, actual: null, forecast: +(m.spend / 30).toFixed(4) })),
              ]}>
                <defs>
                  <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#007aff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#007aff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
                <Legend />
                <Area type="monotone" dataKey="actual" stroke={ACCENT} fill="url(#gradActual)" strokeWidth={2} name="Historical" dot={false} connectNulls={false} />
                <Area type="monotone" dataKey="forecast" stroke="#007aff" fill="url(#gradForecast)" strokeWidth={2} strokeDasharray="5 3" name="Forecast" dot={false} connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <NoData message="Need 3+ days of data for forecasting." />}
        </section>

        <section className="card">
          <SectionHeader icon={icons.dollar} title="Top Models by Cost" subtitle="Horizontal bar — descending" />
          {costByModel.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costByModel} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={70} />
                <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
                <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                  {costByModel.map((_: any, i: number) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <NoData />}
        </section>
      </div>

      {/* Row 3: Cluster Radar + Insight text */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="two-col">
        <section className="card">
          <SectionHeader icon={icons.cluster} title="Behavioral Clusters" subtitle="Radar profile comparison" />
          {clusterList.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={clusterList.slice(0, 5).map((c: any) => ({
                label: c.label,
                actors: c.actors,
                events: Math.log10(Math.max(c.events, 1)) * 10,
                costPer: c.costProfile?.avgCostPerEvent ? Math.min(c.costProfile.avgCostPerEvent * 1000, 100) : 0,
              }))}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis tick={{ fontSize: 9 }} />
                <Radar name="Actors" dataKey="actors" stroke="#007aff" fill="#007aff" fillOpacity={0.2} />
                <Radar name="Volume (log)" dataKey="events" stroke={ACCENT} fill={ACCENT} fillOpacity={0.2} />
                <Radar name="Cost/Event" dataKey="costPer" stroke="#ff3b30" fill="#ff3b30" fillOpacity={0.1} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          ) : <NoData />}
        </section>

        <section className="card">
          <SectionHeader icon={icons.trend} title="Intelligence Summary" subtitle="Key insights from your data" />
          <div style={{ padding: '8px 0', fontSize: 14, lineHeight: 1.8 }}>
            {forecastData?.insight && (
              <div style={{ padding: '12px 16px', background: 'rgba(255,214,10,0.08)', borderRadius: 8, marginBottom: 12, borderLeft: `3px solid ${ACCENT}` }}>
                <strong style={{ fontSize: 12, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Forecast Insight</strong>
                <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.7)' }}>{forecastData.insight}</div>
              </div>
            )}
            {anomalyList.length > 0 && (
              <div style={{ padding: '12px 16px', background: 'rgba(255,59,48,0.08)', borderRadius: 8, marginBottom: 12, borderLeft: '3px solid #ff3b30' }}>
                <strong style={{ fontSize: 12, color: '#ff3b30', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Anomalies</strong>
                <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.7)' }}>
                  {anomalyList.length} anomal{anomalyList.length === 1 ? 'y' : 'ies'} detected.{' '}
                  {anomalyList.filter((a: any) => a.severity === 'critical' || a.severity === 'high').length > 0 &&
                    `${anomalyList.filter((a: any) => a.severity === 'critical' || a.severity === 'high').length} require immediate attention.`}
                </div>
              </div>
            )}
            {clusterList.length > 0 && (
              <div style={{ padding: '12px 16px', background: 'rgba(0,122,255,0.08)', borderRadius: 8, marginBottom: 12, borderLeft: '3px solid #007aff' }}>
                <strong style={{ fontSize: 12, color: '#007aff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Behavior</strong>
                <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.7)' }}>
                  {clusterList.length} behavioral cluster{clusterList.length === 1 ? '' : 's'} identified across{' '}
                  {clusterList.reduce((s: number, c: any) => s + (c.actors ?? 0), 0)} actors.
                  {clusterList.find((c: any) => c.tags?.includes('high-error-rate')) &&
                    ' Warning: error-heavy cluster detected.'}
                </div>
              </div>
            )}
            {!forecastData?.insight && anomalyList.length === 0 && clusterList.length === 0 && (
              <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>
                Ingest more events to generate intelligence insights.
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   COST TAB — Deep cost analysis
   ══════════════════════════════════════════════════════════════════════════ */
function CostTab({ cost, costByProvider, costByModel, costByDept }: any) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="two-col">
        <section className="card">
          <SectionHeader icon={icons.dollar} title="Cost Distribution by Provider" subtitle="Pie chart — proportional spend" />
          {costByProvider.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={costByProvider} dataKey="cost" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#999' }}>
                  {costByProvider.map((_: any, i: number) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : <NoData />}
        </section>

        <section className="card">
          <SectionHeader icon={icons.dollar} title="Cost by Department" subtitle="Bar chart — spend allocation" />
          {costByDept.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costByDept}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
                <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                  {costByDept.map((_: any, i: number) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <NoData />}
        </section>
      </div>

      {/* Cost detail table */}
      <section className="card">
        <SectionHeader icon={icons.dollar} title="Model-Level Cost Breakdown" subtitle="Detailed per-model economics" />
        {costByModel.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th style={{ textAlign: 'right' }}>Tokens</th>
                  <th style={{ textAlign: 'right' }}>Est. Cost</th>
                  <th style={{ textAlign: 'right' }}>% of Total</th>
                  <th>Cost Bar</th>
                </tr>
              </thead>
              <tbody>
                {costByModel.map((m: any, i: number) => {
                  const pct = cost?.totalCost > 0 ? (m.cost / cost.totalCost) * 100 : 0
                  return (
                    <tr key={i}>
                      <td><code>{m.name}</code></td>
                      <td style={{ textAlign: 'right' }}>{compact(m.tokens)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>${m.cost.toFixed(4)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{pct.toFixed(1)}%</td>
                      <td style={{ width: '30%' }}>
                        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: PALETTE[i % PALETTE.length], borderRadius: 4 }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <NoData />}
      </section>

      {/* Token treemap */}
      <section className="card">
        <SectionHeader icon={icons.dollar} title="Token Volume Treemap" subtitle="Proportional token consumption by model" />
        {costByModel.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <Treemap
              data={costByModel.map((d: any, i: number) => ({ ...d, fill: PALETTE[i % PALETTE.length] }))}
              dataKey="tokens"
              nameKey="name"
              aspectRatio={4 / 3}
              stroke="rgba(255,255,255,0.1)"
              content={<TreemapContent />}
            />
          </ResponsiveContainer>
        ) : <NoData />}
      </section>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   ANOMALIES TAB
   ══════════════════════════════════════════════════════════════════════════ */
function AnomaliesTab({ anomalyList }: { anomalyList: any[] }) {
  const severityCounts = useMemo(() => {
    const map: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const a of anomalyList) map[a.severity] = (map[a.severity] ?? 0) + 1
    return Object.entries(map).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  }, [anomalyList])

  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of anomalyList) map[a.type] = (map[a.type] ?? 0) + 1
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [anomalyList])

  const severityColors: Record<string, string> = { critical: '#ff3b30', high: '#ff9500', medium: '#ffd60a', low: '#34c759' }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="two-col">
        <section className="card">
          <SectionHeader icon={icons.alert} title="Anomaly Severity Distribution" subtitle="Pie chart" />
          {severityCounts.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={severityCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {severityCounts.map((d, i) => (
                    <Cell key={i} fill={severityColors[d.name] ?? PALETTE[i]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ padding: 40, textAlign: 'center', color: '#34c759', fontWeight: 600 }}>No anomalies detected.</div>}
        </section>

        <section className="card">
          <SectionHeader icon={icons.alert} title="Anomaly Types" subtitle="Bar chart — category frequency" />
          {typeCounts.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={typeCounts}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#ff9500" />
              </BarChart>
            </ResponsiveContainer>
          ) : <NoData />}
        </section>
      </div>

      {/* Anomaly detail table */}
      <section className="card">
        <SectionHeader icon={icons.alert} title="Anomaly Details" subtitle={`${anomalyList.length} anomalies`} />
        {anomalyList.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Entity</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {anomalyList.map((a: any, i: number) => (
                  <tr key={i}>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: `${severityColors[a.severity] ?? '#999'}22`,
                        color: severityColors[a.severity] ?? '#999',
                      }}>
                        {(a.severity ?? 'unknown').toUpperCase()}
                      </span>
                    </td>
                    <td><code>{a.type}</code></td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.description}</td>
                    <td><code style={{ fontSize: 11 }}>{a.entity ?? '\u2014'}</code></td>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{typeof a.value === 'number' ? a.value.toFixed(2) : a.value ?? '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div style={{ padding: 40, textAlign: 'center', color: '#34c759', fontWeight: 600 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 8px' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          All systems nominal. No anomalies detected across {anomalyList.length || 'all'} events analyzed.
        </div>}
      </section>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   FORECAST TAB
   ══════════════════════════════════════════════════════════════════════════ */
function ForecastTab({ data }: { data: any }) {
  if (!data || data.error) {
    return (
      <section className="card" style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ color: 'var(--muted)' }}>
          {data?.message ?? 'Need at least 3 days of data for forecasting. Keep collecting!'}
        </div>
      </section>
    )
  }

  const dailyData = data.dataPoints ?? []
  const monthlyData = data.monthlyProjections ?? []
  const trend = data.trend ?? {}

  return (
    <>
      {/* Insight banner */}
      {data.insight && (
        <section className="card" style={{ background: 'rgba(255,214,10,0.08)', borderLeft: `4px solid ${ACCENT}`, padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Forecast Insight</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 1.6 }}>{data.insight}</div>
        </section>
      )}

      {/* Forecast metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, margin: '16px 0' }} className="two-col">
        <MetricBox label="Projected Spend" value={`$${data.projectedSpend?.toFixed(2) ?? '0'}`} color={ACCENT} />
        <MetricBox label="Daily Growth" value={`${((data.dailyGrowthRate ?? 0) * 100).toFixed(2)}%`} color={data.dailyGrowthRate > 0 ? '#ff3b30' : '#34c759'} />
        <MetricBox label="Annualized" value={`${((data.annualizedGrowthRate ?? 0) * 100).toFixed(1)}%`} color={data.annualizedGrowthRate > 0.5 ? '#ff3b30' : '#007aff'} />
        <MetricBox label="R\u00B2 Fit" value={trend.r2?.toFixed(4) ?? '0'} color="#007aff" />
      </div>

      {/* Historical + Trend line */}
      <section className="card">
        <SectionHeader icon={icons.trend} title="Historical Spend with Trend Line" subtitle={`slope: $${trend.slope?.toFixed(4) ?? 0}/day, intercept: $${trend.intercept?.toFixed(4) ?? 0}`} />
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={dailyData.map((d: any, i: number) => ({
            ...d,
            trendline: +(trend.slope * i + trend.intercept).toFixed(4),
          }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
            <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
            <Legend />
            <Line type="monotone" dataKey="cost" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} name="Daily Cost" />
            <Line type="monotone" dataKey="trendline" stroke="#ff3b30" strokeWidth={1.5} strokeDasharray="6 3" dot={false} name="Trend Line" />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Monthly projections */}
      <section className="card">
        <SectionHeader icon={icons.trend} title="Monthly Projections" subtitle="Forecasted spend for the next quarter" />
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }} className="two-col">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
              <Bar dataKey="spend" fill="#007aff" radius={[4, 4, 0, 0]} name="Projected Spend" />
            </BarChart>
          </ResponsiveContainer>
          <div>
            <table>
              <thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Spend</th><th style={{ textAlign: 'right' }}>Tokens</th><th style={{ textAlign: 'right' }}>Calls</th></tr></thead>
              <tbody>
                {monthlyData.map((m: any) => (
                  <tr key={m.month}>
                    <td><strong>{m.month}</strong></td>
                    <td style={{ textAlign: 'right' }}>${m.spend?.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{compact(m.tokens)}</td>
                    <td style={{ textAlign: 'right' }}>{compact(m.calls)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Daily volume chart */}
      <section className="card">
        <SectionHeader icon={icons.dollar} title="Daily Token Volume + Providers" subtitle="Stacked area" />
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="tokens" stroke={ACCENT} fill={ACCENT} fillOpacity={0.2} name="Tokens" />
            <Area type="monotone" dataKey="calls" stroke="#007aff" fill="#007aff" fillOpacity={0.15} name="Calls" />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   CLUSTERS TAB
   ══════════════════════════════════════════════════════════════════════════ */
function ClustersTab({ clusterList }: { clusterList: any[] }) {
  return (
    <>
      {/* Cluster overview bar */}
      <section className="card">
        <SectionHeader icon={icons.cluster} title="Behavioral Cluster Distribution" subtitle="Events per cluster" />
        {clusterList.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={clusterList}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="events" fill={ACCENT} name="Events" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actors" fill="#007aff" name="Actors" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <NoData />}
      </section>

      {/* Hourly heatmap-style per cluster */}
      <section className="card">
        <SectionHeader icon={icons.cluster} title="Cluster Hourly Activity Profile" subtitle="24-hour activity distribution per cluster" />
        {clusterList.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="hour" type="number" domain={[0, 23]} tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}:00`} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(v: number) => `${v}:00`} />
              <Legend />
              {clusterList.slice(0, 5).map((c: any, i: number) => (
                <Line
                  key={c.label}
                  data={(c.hourlyProfile ?? []).map((v: number, h: number) => ({ hour: h, value: v }))}
                  dataKey="value"
                  name={c.label}
                  stroke={PALETTE[i]}
                  strokeWidth={2}
                  dot={false}
                  type="monotone"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : <NoData />}
      </section>

      {/* Cluster detail cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {clusterList.map((c: any, i: number) => (
          <section key={i} className="card" style={{ borderTop: `3px solid ${PALETTE[i % PALETTE.length]}` }}>
            <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 700 }}>{c.label}</h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{c.fingerprint}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, fontSize: 13 }}>
              <div><span style={{ color: 'var(--muted)' }}>Actors:</span> <strong>{c.actors}</strong></div>
              <div><span style={{ color: 'var(--muted)' }}>Events:</span> <strong>{c.events}</strong></div>
              <div><span style={{ color: 'var(--muted)' }}>Provider:</span> <strong>{c.dominantProvider}</strong></div>
              <div><span style={{ color: 'var(--muted)' }}>Model:</span> <strong>{c.dominantModel}</strong></div>
              <div><span style={{ color: 'var(--muted)' }}>Avg Cost:</span> <strong>${(c.costProfile?.avgCostPerEvent ?? 0).toFixed(4)}</strong></div>
              <div><span style={{ color: 'var(--muted)' }}>Total Cost:</span> <strong>${(c.costProfile?.totalCost ?? 0).toFixed(2)}</strong></div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(c.tags ?? []).map((t: string) => (
                <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: t.includes('error') ? 'rgba(255,59,48,0.15)' : t.includes('high-cost') ? 'rgba(255,149,0,0.15)' : 'rgba(0,122,255,0.15)', color: t.includes('error') ? '#ff3b30' : t.includes('high-cost') ? '#ff9500' : '#007aff', fontWeight: 600 }}>
                  {t}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   FLOWS TAB — Provider transitions & session analysis
   ══════════════════════════════════════════════════════════════════════════ */
function FlowsTab({ data }: { data: any }) {
  if (!data) return <section className="card"><NoData message="No flow data available." /></section>

  const flows = data.flows ?? []
  const depths = data.sessionDepths ?? {}

  return (
    <>
      {/* Session depth metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, margin: '0 0 16px' }} className="two-col">
        <MetricBox label="Total Sessions" value={String(data.totalSessions ?? 0)} color="#007aff" />
        <MetricBox label="Multi-Provider" value={String(data.multiProviderSessions ?? 0)} color="#af52de" />
        <MetricBox label="Avg Depth" value={(depths.avg ?? 0).toFixed(1)} color={ACCENT} />
        <MetricBox label="P95 Depth" value={String(depths.p95 ?? 0)} color="#ff9500" />
      </div>

      {/* Provider flow chart */}
      <section className="card">
        <SectionHeader icon={icons.flow} title="Provider Transition Flows" subtitle="How users move between providers within sessions" />
        {flows.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={flows.slice(0, 15)} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey={(d: any) => `${d.from} \u2192 ${d.to}`} type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {flows.slice(0, 15).map((_: any, i: number) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Sankey-style flow visualization using custom SVG */}
            <div style={{ marginTop: 24 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--muted)' }}>Flow Diagram</h4>
              <FlowDiagram flows={flows.slice(0, 8)} />
            </div>
          </>
        ) : <NoData message="No cross-provider flows detected yet." />}
      </section>

      {/* Session depth distribution */}
      <section className="card">
        <SectionHeader icon={icons.flow} title="Session Depth Stats" subtitle="Min / Max / Avg / P95" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, padding: 16, fontSize: 14 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#007aff' }}>{depths.min ?? 0}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Min</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: ACCENT }}>{(depths.avg ?? 0).toFixed(1)}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Average</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#ff9500' }}>{depths.p95 ?? 0}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>P95</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#ff3b30' }}>{depths.max ?? 0}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Max</div>
          </div>
        </div>
      </section>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   FINGERPRINTS TAB
   ══════════════════════════════════════════════════════════════════════════ */
function FingerprintsTab({ fpList }: { fpList: any[] }) {
  return (
    <>
      {/* Provider mix scatter plot */}
      <section className="card">
        <SectionHeader icon={icons.fingerprint} title="Usage Fingerprints" subtitle="Department/Project profiles" />
        {fpList.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="totalTokens" type="number" name="Tokens" tick={{ fontSize: 11 }} tickFormatter={(v: number) => compact(v)} />
              <YAxis dataKey="totalCost" type="number" name="Cost" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip content={<FingerprintTooltip />} />
              <Scatter data={fpList} name="Entities">
                {fpList.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} r={Math.max(6, Math.min(20, Math.sqrt(fpList[i].eventCount)))} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : <NoData />}
      </section>

      {/* Fingerprint detail cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
        {fpList.map((fp: any, i: number) => (
          <section key={i} className="card" style={{ borderTop: `3px solid ${PALETTE[i % PALETTE.length]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 700 }}>{fp.entity}</h3>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>{fp.entityType}</span>
              </div>
              <span style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 600,
                background: fp.classification?.includes('Unstable') ? 'rgba(255,59,48,0.15)' : fp.classification?.includes('power') ? 'rgba(175,82,222,0.15)' : 'rgba(52,199,89,0.15)',
                color: fp.classification?.includes('Unstable') ? '#ff3b30' : fp.classification?.includes('power') ? '#af52de' : '#34c759',
              }}>
                {fp.classification}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, fontSize: 13 }}>
              <div><span style={{ color: 'var(--muted)' }}>Events:</span> <strong>{fp.eventCount}</strong></div>
              <div><span style={{ color: 'var(--muted)' }}>Cost:</span> <strong>${fp.totalCost?.toFixed(4)}</strong></div>
              <div><span style={{ color: 'var(--muted)' }}>Tokens:</span> <strong>{compact(fp.totalTokens)}</strong></div>
              <div><span style={{ color: 'var(--muted)' }}>Avg Latency:</span> <strong>{fp.avgLatency}ms</strong></div>
              <div><span style={{ color: 'var(--muted)' }}>Error Rate:</span> <strong style={{ color: fp.errorRate > 0.1 ? '#ff3b30' : 'inherit' }}>{(fp.errorRate * 100).toFixed(1)}%</strong></div>
            </div>

            {/* Provider mix mini bar */}
            {fp.providerMix && Object.keys(fp.providerMix).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Provider Mix</div>
                <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', height: 8 }}>
                  {Object.entries(fp.providerMix as Record<string, number>).map(([p, count], j) => {
                    const pct = (count / fp.eventCount) * 100
                    return <div key={p} title={`${p}: ${pct.toFixed(0)}%`} style={{ width: `${pct}%`, background: PALETTE[j % PALETTE.length], minWidth: 2 }} />
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {Object.entries(fp.providerMix as Record<string, number>).map(([p, count], j) => (
                    <span key={p} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[j % PALETTE.length], display: 'inline-block' }} />
                      {p} ({((count / fp.eventCount) * 100).toFixed(0)}%)
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Hourly mini sparkline */}
            {fp.hourlyDistribution && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>24h Activity</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 30 }}>
                  {(fp.hourlyDistribution as number[]).map((v: number, h: number) => {
                    const max = Math.max(...fp.hourlyDistribution, 1)
                    return <div key={h} style={{ flex: 1, background: v > 0 ? PALETTE[i % PALETTE.length] : 'rgba(255,255,255,0.04)', height: `${(v / max) * 100}%`, minHeight: 2, borderRadius: '2px 2px 0 0' }} title={`${h}:00 — ${v} events`} />
                  })}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ══════════════════════════════════════════════════════════════════════════ */

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0, fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary, rgba(255,255,255,0.92))' }}>
        {icon} {title}
      </h2>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary, rgba(255,255,255,0.55))' }}>{subtitle}</p>
    </div>
  )
}

function KpiCard({ label, value, accent, alert }: { label: string; value: string; accent?: boolean; alert?: boolean }) {
  return (
    <div className="kpi-item" style={accent ? { borderTop: '2px solid var(--hive-yellow, #ffd60a)' } : undefined}>
      <div className="label">{label}</div>
      <div className="value" style={{ color: alert ? 'var(--hive-red, #ff3b30)' : accent ? ACCENT : 'var(--text-primary, rgba(255,255,255,0.92))' }}>{value}</div>
    </div>
  )
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 16 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function NoData({ message }: { message?: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
      {message ?? 'No data available yet.'}
    </div>
  )
}

/* ── Custom Treemap Content ─────────────────────────────────────────────── */
function TreemapContent(props: any) {
  const { x, y, width, height, name, fill } = props
  if (width < 40 || height < 30) return null
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="rgba(0,0,0,0.3)" strokeWidth={2} rx={4} />
      <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={Math.min(12, width / 6)} fontWeight={600}>
        {name}
      </text>
    </g>
  )
}

/* ── Custom Tooltips ────────────────────────────────────────────────────── */
function AnomalyTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{ background: '#1a1a28', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12, fontSize: 12, maxWidth: 250, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: 'rgba(255,255,255,0.92)' }}>{d?.type}</div>
      <div style={{ color: 'rgba(255,255,255,0.55)' }}>{d?.description}</div>
      <div style={{ marginTop: 4, fontWeight: 600, color: d?.severity === 'critical' ? '#ff3b30' : '#ff9500' }}>{d?.severity?.toUpperCase()}</div>
    </div>
  )
}

function FingerprintTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{ background: '#1a1a28', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.92)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d?.entity} ({d?.entityType})</div>
      <div>Tokens: {compact(d?.totalTokens ?? 0)}</div>
      <div>Cost: ${d?.totalCost?.toFixed(4)}</div>
      <div>Classification: {d?.classification}</div>
    </div>
  )
}

/* ── Flow Diagram (custom SVG Sankey-style) ─────────────────────────────── */
function FlowDiagram({ flows }: { flows: Array<{ from: string; to: string; count: number }> }) {
  const providers = [...new Set(flows.flatMap(f => [f.from, f.to]))]
  const maxCount = Math.max(...flows.map(f => f.count), 1)
  const h = Math.max(providers.length * 40, 120)
  const providerY = (p: string) => (providers.indexOf(p) + 0.5) * (h / providers.length)

  return (
    <svg width="100%" height={h} viewBox={`0 0 600 ${h}`} style={{ overflow: 'visible' }}>
      {/* Provider labels — left */}
      {providers.map((p, i) => (
        <g key={`left-${p}`}>
          <rect x={0} y={providerY(p) - 14} width={120} height={28} rx={6} fill={PALETTE[i % PALETTE.length]} opacity={0.15} />
          <text x={60} y={providerY(p) + 1} textAnchor="middle" fontSize={11} fontWeight={600} fill={PALETTE[i % PALETTE.length]}>{p}</text>
        </g>
      ))}
      {/* Provider labels — right */}
      {providers.map((p, i) => (
        <g key={`right-${p}`}>
          <rect x={480} y={providerY(p) - 14} width={120} height={28} rx={6} fill={PALETTE[i % PALETTE.length]} opacity={0.15} />
          <text x={540} y={providerY(p) + 1} textAnchor="middle" fontSize={11} fontWeight={600} fill={PALETTE[i % PALETTE.length]}>{p}</text>
        </g>
      ))}
      {/* Flow paths */}
      {flows.map((f, i) => {
        const y1 = providerY(f.from)
        const y2 = providerY(f.to)
        const thickness = Math.max(2, (f.count / maxCount) * 16)
        return (
          <g key={i} opacity={0.6}>
            <path
              d={`M 130 ${y1} C 300 ${y1}, 300 ${y2}, 470 ${y2}`}
              fill="none"
              stroke={PALETTE[providers.indexOf(f.from) % PALETTE.length]}
              strokeWidth={thickness}
              strokeLinecap="round"
            />
            <text x={300} y={(y1 + y2) / 2 - 4} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.55)">{f.count}</text>
          </g>
        )
      })}
    </svg>
  )
}

/* ── Utility ────────────────────────────────────────────────────────────── */
function compact(n: number): string {
  if (n < 1_000) return String(n)
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  return `${(n / 1_000_000_000).toFixed(1)}B`
}
