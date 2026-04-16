'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
  Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'

/* Plotly — dynamic import to avoid SSR issues */
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false }) as any

/* ── Constants ──────────────────────────────────────────────────────────── */
const ACCENT = '#ffd60a'
const PALETTE = ['#ffd60a', '#007aff', '#34c759', '#ff9500', '#af52de', '#ff3b30', '#5ac8fa', '#ffcc00', '#a2845e', '#30d158']
const DARK_BG = 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)'
const CARD_DARK = '#0f0f1a'

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ── Helpers ────────────────────────────────────────────────────────────── */
function compact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}

/* ── Types ──────────────────────────────────────────────────────────────── */
interface Props {
  events: any[]
  cost: any
  anomalies: any
  forecast: any
  clusters: any
  fingerprints: any
}

type VizKey = 'chord' | 'scatter3d' | 'force' | 'heatmap' | 'anomaly' | 'treemap' | 'parallel'

const VIZ_META: { key: VizKey; title: string; subtitle: string }[] = [
  { key: 'chord', title: 'Model -- Department Token Flow', subtitle: 'Chord diagram -- ribbon width = token volume' },
  { key: 'scatter3d', title: 'Department Clustering -- 3D Behavior Space', subtitle: 'X: Token Volume -- Y: Cost/Token -- Z: Model Diversity' },
  { key: 'force', title: 'Org AI Ecosystem -- Force Network', subtitle: 'Approved tools (blue) -- Shadow AI detected (red) -- edge weight = usage' },
  { key: 'heatmap', title: 'Usage Activity -- Hour x Weekday', subtitle: 'Heatmap -- blue intensity = token rate' },
  { key: 'anomaly', title: 'Token Rate -- Anomaly Detection', subtitle: 'Daily usage -- 1-sigma and 2-sigma bands -- spikes auto-flagged' },
  { key: 'treemap', title: 'Token Budget -- Treemap', subtitle: 'Dept > Model > volume -- area = tokens' },
  { key: 'parallel', title: 'Multi-Dim Comparison -- Parallel Coordinates', subtitle: '5 axes -- Volume -- Cost/Token -- Models -- Latency -- Sessions -- one line per dept' },
]

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */

export default function GraphsClient({ events, cost, anomalies, forecast, clusters, fingerprints }: Props) {
  const [activeViz, setActiveViz] = useState<VizKey>('chord')
  const noData = events.length === 0

  return (
    <>
      {/* ── Hero Header ──────────────────────────────────────────────── */}
      <section className="card no-lift" style={{ background: 'var(--gradient-hero)', borderTop: '2px solid rgba(255,214,10,0.15)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '35%', height: '100%', background: 'radial-gradient(ellipse at 100% 0%, rgba(255,214,10,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, position: 'relative' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,214,10,0.5)', marginBottom: 8 }}>Token Economy Visualizations</div>
            <h1 style={{ marginTop: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              <span style={{ color: ACCENT }}>HIVE</span> Graphs
            </h1>
            <p style={{ color: 'var(--text-secondary, rgba(255,255,255,0.55))', marginTop: 8, fontSize: 14, maxWidth: 600, lineHeight: 1.7 }}>
              Your spreadsheet cannot show you what HIVE can. Surface clustering,
              anomaly patterns, flows, and behavioral fingerprints.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <span style={{ padding: '5px 14px', borderRadius: 'var(--r-full, 9999px)', background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.15)', color: ACCENT, fontSize: 10, fontWeight: 500, letterSpacing: 0.5 }}>
              GOVERNANCE-NATIVE
            </span>
            <span style={{ padding: '5px 14px', borderRadius: 'var(--r-full, 9999px)', background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.15)', color: '#007aff', fontSize: 10, fontWeight: 500, letterSpacing: 0.5 }}>
              ZERO CONTENT
            </span>
          </div>
        </div>
      </section>

      {/* ── Viz Selector ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 20, scrollbarWidth: 'none' as const }}>
        {VIZ_META.map((v) => (
          <button
            key={v.key}
            onClick={() => setActiveViz(v.key)}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 'var(--r-md, 10px)',
              background: activeViz === v.key ? 'rgba(255,214,10,0.08)' : 'transparent',
              color: activeViz === v.key ? ACCENT : 'var(--text-secondary, rgba(255,255,255,0.55))',
              fontWeight: 500,
              fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              minHeight: 44, fontFamily: 'inherit',
            }}
          >
            {v.key === 'scatter3d' ? '3D Scatter' : v.key === 'parallel' ? 'Parallel' : v.key.charAt(0).toUpperCase() + v.key.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Viz Title ────────────────────────────────────────────────── */}
      {VIZ_META.filter((v) => v.key === activeViz).map((v) => (
        <div key={v.key} style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>{v.title}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary, rgba(255,255,255,0.55))', fontSize: 13 }}>{v.subtitle}</p>
        </div>
      ))}

      {noData && (
        <section className="card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ color: 'var(--muted)', fontSize: 16 }}>
            No telemetry data yet. Ingest TTP events to unlock visualizations.
          </div>
          <a href="/setup" style={{ color: ACCENT, fontSize: 14, marginTop: 12, display: 'inline-block' }}>Set up connectors</a>
        </section>
      )}

      {/* ── Active Chart ─────────────────────────────────────────────── */}
      {!noData && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 500 }}>
          {activeViz === 'chord' && <ChordDiagram events={events} />}
          {activeViz === 'scatter3d' && <Scatter3D events={events} fingerprints={fingerprints} cost={cost} />}
          {activeViz === 'force' && <ForceNetwork events={events} />}
          {activeViz === 'heatmap' && <HeatmapChart events={events} />}
          {activeViz === 'anomaly' && <AnomalyChart events={events} anomalies={anomalies} />}
          {activeViz === 'treemap' && <TokenTreemap events={events} />}
          {activeViz === 'parallel' && <ParallelCoords events={events} fingerprints={fingerprints} cost={cost} />}
        </div>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   1. CHORD DIAGRAM — Model x Department Token Flow (pure SVG)
   ══════════════════════════════════════════════════════════════════════════ */

function ChordDiagram({ events }: { events: any[] }) {
  const { models, depts, matrix, totalTokens } = useMemo(() => {
    const modelSet = new Map<string, number>()
    const deptSet = new Map<string, number>()
    const flows = new Map<string, number>()

    for (const e of events) {
      const m = e.model_hint ?? 'unknown'
      const d = e.dept_tag ?? 'untagged'
      const t = e.estimated_tokens ?? 0
      modelSet.set(m, (modelSet.get(m) ?? 0) + t)
      deptSet.set(d, (deptSet.get(d) ?? 0) + t)
      const key = `${m}|||${d}`
      flows.set(key, (flows.get(key) ?? 0) + t)
    }

    const models = [...modelSet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n)
    const depts = [...deptSet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n)
    const all = [...models, ...depts]
    const n = all.length
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0))

    for (const [key, val] of flows) {
      const [m, d] = key.split('|||')
      const mi = all.indexOf(m!)
      const di = all.indexOf(d!)
      if (mi >= 0 && di >= 0) {
        matrix[mi]![di] = val
        matrix[di]![mi] = val
      }
    }

    const totalTokens = events.reduce((s, e) => s + (e.estimated_tokens ?? 0), 0)
    return { models, depts, matrix, totalTokens }
  }, [events])

  const all = [...models, ...depts]
  const n = all.length
  if (n < 2) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Need at least 2 groups for chord diagram</div>

  // Compute chord layout
  const groupTotals = matrix.map((row) => row.reduce((s, v) => s + v, 0))
  const total = groupTotals.reduce((s, v) => s + v, 0)
  const padAngle = 0.04
  const totalPad = padAngle * n
  const availAngle = 2 * Math.PI - totalPad

  const arcs: { start: number; end: number; idx: number }[] = []
  let angle = 0
  for (let i = 0; i < n; i++) {
    const sweep = total > 0 ? (groupTotals[i]! / total) * availAngle : availAngle / n
    arcs.push({ start: angle, end: angle + sweep, idx: i })
    angle += sweep + padAngle
  }

  const cx = 260, cy = 260, outerR = 220, innerR = 200, labelR = 240
  const modelColors = PALETTE.slice(0, models.length)
  const deptColors = ['#e0e0e0', '#c0c0c0', '#a0a0a0', '#909090', '#808080', '#707070', '#606060', '#505050'].slice(0, depts.length)
  const colors = [...modelColors, ...deptColors]

  // Build ribbons
  const ribbons: { source: any; target: any; value: number; color: string }[] = []
  const arcOffsets = arcs.map((a) => a.start)

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const val = matrix[i]![j]!
      if (val === 0) continue
      const srcSweep = groupTotals[i]! > 0 ? (val / groupTotals[i]!) * (arcs[i]!.end - arcs[i]!.start) : 0
      const tgtSweep = groupTotals[j]! > 0 ? (val / groupTotals[j]!) * (arcs[j]!.end - arcs[j]!.start) : 0
      const srcStart = arcOffsets[i]!
      const tgtStart = arcOffsets[j]!
      arcOffsets[i]! += srcSweep
      arcOffsets[j]! += tgtSweep
      ribbons.push({
        source: { start: srcStart, end: srcStart + srcSweep },
        target: { start: tgtStart, end: tgtStart + tgtSweep },
        value: val,
        color: colors[i] ?? PALETTE[0],
      })
    }
  }

  function arcPath(startAngle: number, endAngle: number, r: number): string {
    const x1 = cx + r * Math.cos(startAngle - Math.PI / 2)
    const y1 = cy + r * Math.sin(startAngle - Math.PI / 2)
    const x2 = cx + r * Math.cos(endAngle - Math.PI / 2)
    const y2 = cy + r * Math.sin(endAngle - Math.PI / 2)
    const large = endAngle - startAngle > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  function ribbonPath(src: { start: number; end: number }, tgt: { start: number; end: number }): string {
    const r = innerR
    const sx1 = cx + r * Math.cos(src.start - Math.PI / 2)
    const sy1 = cy + r * Math.sin(src.start - Math.PI / 2)
    const sx2 = cx + r * Math.cos(src.end - Math.PI / 2)
    const sy2 = cy + r * Math.sin(src.end - Math.PI / 2)
    const tx1 = cx + r * Math.cos(tgt.start - Math.PI / 2)
    const ty1 = cy + r * Math.sin(tgt.start - Math.PI / 2)
    const tx2 = cx + r * Math.cos(tgt.end - Math.PI / 2)
    const ty2 = cy + r * Math.sin(tgt.end - Math.PI / 2)
    const largeS = src.end - src.start > Math.PI ? 1 : 0
    const largeT = tgt.end - tgt.start > Math.PI ? 1 : 0
    return [
      `M ${sx1} ${sy1}`,
      `A ${r} ${r} 0 ${largeS} 1 ${sx2} ${sy2}`,
      `Q ${cx} ${cy} ${tx1} ${ty1}`,
      `A ${r} ${r} 0 ${largeT} 1 ${tx2} ${ty2}`,
      `Q ${cx} ${cy} ${sx1} ${sy1}`,
      'Z',
    ].join(' ')
  }

  return (
    <div style={{ padding: 20, background: CARD_DARK }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{compact(totalTokens)} tokens/period</span>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{models.length} models x {depts.length} departments</span>
      </div>
      <svg viewBox="0 0 520 520" style={{ width: '100%', maxWidth: 520, margin: '0 auto', display: 'block' }}>
        {/* Ribbons */}
        {ribbons.map((r, i) => (
          <path key={`r${i}`} d={ribbonPath(r.source, r.target)} fill={r.color} fillOpacity={0.35} stroke={r.color} strokeOpacity={0.5} strokeWidth={0.5} />
        ))}
        {/* Arcs */}
        {arcs.map((a, i) => (
          <path key={`a${i}`} d={arcPath(a.start, a.end, outerR)} fill="none" stroke={colors[i]} strokeWidth={outerR - innerR} strokeOpacity={0.85} />
        ))}
        {/* Labels */}
        {arcs.map((a, i) => {
          const mid = (a.start + a.end) / 2 - Math.PI / 2
          const lx = cx + labelR * Math.cos(mid)
          const ly = cy + labelR * Math.sin(mid)
          const isRight = Math.cos(mid) >= 0
          return (
            <text
              key={`l${i}`} x={lx} y={ly}
              fill={i < models.length ? (colors[i] ?? '#ffd60a') : 'rgba(255,255,255,0.7)'}
              fontSize={10} fontWeight={600}
              textAnchor={isRight ? 'start' : 'end'}
              dominantBaseline="central"
              transform={`rotate(${mid * 180 / Math.PI + (isRight ? 0 : 180)}, ${lx}, ${ly})`}
            >
              {(all[i] ?? '').length > 14 ? (all[i] ?? '').slice(0, 12) + '..' : all[i]}
            </text>
          )
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
        {models.map((m, i) => (
          <span key={m} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: modelColors[i], display: 'inline-block' }} />
            {m}
          </span>
        ))}
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>|</span>
        {depts.map((d, i) => (
          <span key={d} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: deptColors[i], display: 'inline-block' }} />
            {d}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   2. 3D SCATTER — Department Clustering (Plotly)
   ══════════════════════════════════════════════════════════════════════════ */

function Scatter3D({ events, fingerprints, cost }: { events: any[]; fingerprints: any; cost: any }) {
  const data = useMemo(() => {
    const deptMap = new Map<string, { tokens: number; calls: number; models: Set<string>; totalLatency: number; latCount: number }>()
    for (const e of events) {
      const d = e.dept_tag ?? 'untagged'
      const entry = deptMap.get(d) ?? { tokens: 0, calls: 0, models: new Set<string>(), totalLatency: 0, latCount: 0 }
      entry.tokens += e.estimated_tokens ?? 0
      entry.calls += 1
      if (e.model_hint) entry.models.add(e.model_hint)
      if (typeof e.latency_ms === 'number' && e.latency_ms > 0) {
        entry.totalLatency += e.latency_ms
        entry.latCount += 1
      }
      deptMap.set(d, entry)
    }

    const depts: string[] = []
    const x: number[] = []
    const y: number[] = []
    const z: number[] = []
    const sizes: number[] = []
    const colors: string[] = []

    let i = 0
    for (const [dept, v] of deptMap) {
      depts.push(dept)
      x.push(v.tokens)
      const costPerToken = v.tokens > 0 ? (v.calls * 0.001) / v.tokens * 1000 : 0
      y.push(+costPerToken.toFixed(4))
      z.push(v.models.size)
      sizes.push(Math.max(8, Math.min(30, Math.sqrt(v.calls) * 3)))
      colors.push(PALETTE[i % PALETTE.length]!)
      i++
    }

    return { depts, x, y, z, sizes, colors }
  }, [events])

  if (data.depts.length < 1) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Need data for 3D scatter</div>

  return (
    <div style={{ background: CARD_DARK, padding: 10 }}>
      <Plot
        data={[{
          type: 'scatter3d',
          mode: 'markers+text',
          x: data.x,
          y: data.y,
          z: data.z,
          text: data.depts,
          textposition: 'top center',
          textfont: { size: 10, color: 'rgba(255,255,255,0.8)' },
          marker: {
            size: data.sizes,
            color: data.colors,
            opacity: 0.85,
            line: { color: 'rgba(255,255,255,0.3)', width: 1 },
          },
          hovertemplate: '%{text}<br>Tokens: %{x}<br>Cost/Token: %{y}<br>Models: %{z}<extra></extra>',
        }]}
        layout={{
          autosize: true,
          height: 520,
          paper_bgcolor: CARD_DARK,
          plot_bgcolor: CARD_DARK,
          font: { color: 'rgba(255,255,255,0.7)', family: '-apple-system, sans-serif', size: 11 },
          scene: {
            xaxis: { title: 'Token Volume', gridcolor: 'rgba(255,255,255,0.08)', zerolinecolor: 'rgba(255,255,255,0.1)' },
            yaxis: { title: 'Cost / Token', gridcolor: 'rgba(255,255,255,0.08)', zerolinecolor: 'rgba(255,255,255,0.1)' },
            zaxis: { title: 'Model Diversity', gridcolor: 'rgba(255,255,255,0.08)', zerolinecolor: 'rgba(255,255,255,0.1)' },
            bgcolor: CARD_DARK,
            camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } },
          },
          margin: { l: 0, r: 0, t: 10, b: 10 },
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%' }}
      />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   3. FORCE NETWORK — Org AI Ecosystem (Canvas)
   ══════════════════════════════════════════════════════════════════════════ */

const SANCTIONED = new Set(['openai', 'anthropic', 'google', 'azure_openai', 'bedrock', 'mistral', 'cohere', 'groq', 'together', 'ollama'])

function ForceNetwork({ events }: { events: any[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const graph = useMemo(() => {
    const providers = new Map<string, { calls: number; tokens: number; shadow: boolean }>()
    const depts = new Map<string, { calls: number }>()
    const edges = new Map<string, number>()

    for (const e of events) {
      const p = e.provider ?? 'unknown'
      const d = e.dept_tag ?? 'untagged'
      const pe = providers.get(p) ?? { calls: 0, tokens: 0, shadow: !SANCTIONED.has(p) && !p.startsWith('custom:') }
      pe.calls += 1
      pe.tokens += e.estimated_tokens ?? 0
      providers.set(p, pe)

      const de = depts.get(d) ?? { calls: 0 }
      de.calls += 1
      depts.set(d, de)

      const ek = `${d}|||${p}`
      edges.set(ek, (edges.get(ek) ?? 0) + 1)
    }

    return { providers, depts, edges }
  }, [events])

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2

    ctx.fillStyle = CARD_DARK
    ctx.fillRect(0, 0, W, H)

    const providerArr = [...graph.providers.entries()]
    const deptArr = [...graph.depts.entries()]
    const pCount = providerArr.length
    const dCount = deptArr.length

    // Position departments in inner ring, providers in outer ring
    const innerR = Math.min(W, H) * 0.18
    const outerR = Math.min(W, H) * 0.36

    const deptPos = new Map<string, { x: number; y: number }>()
    deptArr.forEach(([name], i) => {
      const a = (2 * Math.PI * i) / dCount - Math.PI / 2
      deptPos.set(name, { x: cx + innerR * Math.cos(a), y: cy + innerR * Math.sin(a) })
    })

    const provPos = new Map<string, { x: number; y: number }>()
    providerArr.forEach(([name], i) => {
      const a = (2 * Math.PI * i) / pCount - Math.PI / 2
      provPos.set(name, { x: cx + outerR * Math.cos(a), y: cy + outerR * Math.sin(a) })
    })

    // Draw edges
    const maxEdge = Math.max(...graph.edges.values(), 1)
    for (const [key, weight] of graph.edges) {
      const [d, p] = key.split('|||')
      const dp = deptPos.get(d!)
      const pp = provPos.get(p!)
      if (!dp || !pp) continue
      const shadow = graph.providers.get(p!)?.shadow ?? false
      ctx.strokeStyle = shadow ? 'rgba(255,59,48,0.2)' : 'rgba(0,122,255,0.15)'
      ctx.lineWidth = Math.max(0.5, (weight / maxEdge) * 4)
      ctx.beginPath()
      ctx.moveTo(dp.x, dp.y)
      // Bezier through center for curvature
      const midX = (dp.x + pp.x) / 2 + (cy - (dp.y + pp.y) / 2) * 0.15
      const midY = (dp.y + pp.y) / 2 + ((dp.x + pp.x) / 2 - cx) * 0.15
      ctx.quadraticCurveTo(midX, midY, pp.x, pp.y)
      ctx.stroke()
    }

    // Draw dept nodes
    for (const [name, pos] of deptPos) {
      const calls = graph.depts.get(name)?.calls ?? 1
      const r = Math.max(12, Math.min(28, Math.sqrt(calls) * 1.5))
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, r, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = '600 10px -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(name.length > 10 ? name.slice(0, 9) + '..' : name, pos.x, pos.y)
    }

    // Draw provider nodes
    for (const [name, { shadow }] of graph.providers) {
      const pos = provPos.get(name)
      if (!pos) continue
      const calls = graph.providers.get(name)?.calls ?? 1
      const r = Math.max(14, Math.min(32, Math.sqrt(calls) * 1.8))
      const color = shadow ? '#ff3b30' : '#007aff'
      ctx.fillStyle = color
      ctx.globalAlpha = 0.2
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, r, 0, 2 * Math.PI)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, r, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = '700 10px -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(name.length > 10 ? name.slice(0, 9) + '..' : name, pos.x, pos.y)
    }

    // Legend
    ctx.globalAlpha = 1
    const legendY = H - 30
    ctx.fillStyle = '#007aff'
    ctx.beginPath(); ctx.arc(20, legendY, 5, 0, 2 * Math.PI); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '11px -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Approved', 30, legendY + 1)
    ctx.fillStyle = '#ff3b30'
    ctx.beginPath(); ctx.arc(100, legendY, 5, 0, 2 * Math.PI); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillText('Shadow AI', 110, legendY + 1)
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath(); ctx.arc(195, legendY, 5, 0, 2 * Math.PI); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillText('Department', 205, legendY + 1)
  }, [graph])

  useEffect(() => {
    drawGraph()
  }, [drawGraph])

  return (
    <div style={{ background: CARD_DARK, padding: 10 }}>
      <canvas ref={canvasRef} width={720} height={520} style={{ width: '100%', maxWidth: 720, display: 'block', margin: '0 auto' }} />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   4. HEATMAP — Hour x Weekday Usage Activity (Plotly)
   ══════════════════════════════════════════════════════════════════════════ */

function HeatmapChart({ events }: { events: any[] }) {
  const data = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
    const grid = Array.from({ length: 7 }, () => new Array(24).fill(0))

    for (const e of events) {
      const ts = e.timestamp ?? e.observed_at
      if (!ts) continue
      const d = new Date(ts)
      const day = d.getDay()
      const hour = d.getHours()
      grid[day]![hour]! += e.estimated_tokens ?? 1
    }

    return { days, hours, grid }
  }, [events])

  return (
    <div style={{ background: CARD_DARK, padding: 10 }}>
      <Plot
        data={[{
          type: 'heatmap',
          z: data.grid,
          x: data.hours,
          y: data.days,
          colorscale: [
            [0, '#0a0a2e'],
            [0.25, '#162447'],
            [0.5, '#1f4068'],
            [0.75, '#007aff'],
            [1, '#ffd60a'],
          ],
          hovertemplate: '%{y} %{x}<br>Tokens: %{z}<extra></extra>',
          showscale: true,
          colorbar: {
            title: 'Tokens',
            titlefont: { color: 'rgba(255,255,255,0.6)' },
            tickfont: { color: 'rgba(255,255,255,0.5)' },
          },
        }]}
        layout={{
          autosize: true,
          height: 340,
          paper_bgcolor: CARD_DARK,
          plot_bgcolor: CARD_DARK,
          font: { color: 'rgba(255,255,255,0.7)', family: '-apple-system, sans-serif', size: 11 },
          xaxis: { title: 'Hour', side: 'bottom', gridcolor: 'rgba(255,255,255,0.05)' },
          yaxis: { title: '', autorange: 'reversed' },
          margin: { l: 60, r: 80, t: 20, b: 50 },
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%' }}
      />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   5. ANOMALY DETECTION — Token Rate with Sigma Bands (Recharts)
   ══════════════════════════════════════════════════════════════════════════ */

function AnomalyChart({ events, anomalies: anomalyData }: { events: any[]; anomalies: any }) {
  const { chartData, mean, sigma, spikes } = useMemo(() => {
    // Bucket by day
    const dayMap = new Map<string, number>()
    for (const e of events) {
      const ts = e.timestamp ?? e.observed_at
      if (!ts) continue
      const day = new Date(ts).toISOString().slice(0, 10)
      dayMap.set(day, (dayMap.get(day) ?? 0) + (e.estimated_tokens ?? 0))
    }

    const sorted = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const values = sorted.map(([, v]) => v)
    const mean = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
    const variance = values.length > 1 ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1) : 0
    const sigma = Math.sqrt(variance)

    const spikes: string[] = []
    const chartData = sorted.map(([day, tokens]) => {
      const isSpike = tokens > mean + 2 * sigma
      if (isSpike) spikes.push(day)
      return {
        day: day.slice(5), // MM-DD
        tokens,
        mean,
        sigma1_upper: mean + sigma,
        sigma1_lower: Math.max(0, mean - sigma),
        sigma2_upper: mean + 2 * sigma,
        sigma2_lower: Math.max(0, mean - 2 * sigma),
        spike: isSpike ? tokens : undefined,
      }
    })

    return { chartData, mean, sigma, spikes }
  }, [events])

  if (chartData.length < 2) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Need at least 2 days of data</div>

  return (
    <div style={{ background: CARD_DARK, padding: 20 }}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Mean: {compact(mean)} tokens/day</span>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Sigma: {compact(sigma)}</span>
        <span style={{ color: '#ff3b30', fontSize: 12 }}>{spikes.length} spike(s) auto-flagged</span>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="band2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff3b30" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#ff3b30" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="band1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff9500" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#ff9500" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
          <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} tickFormatter={(v: number) => compact(v)} />
          <Tooltip
            contentStyle={{ background: '#1d1d2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12 }}
            formatter={(v: number) => [compact(v), '']}
          />
          {/* 2-sigma band */}
          <Area type="monotone" dataKey="sigma2_upper" stroke="none" fill="url(#band2)" fillOpacity={1} dot={false} />
          <Area type="monotone" dataKey="sigma2_lower" stroke="none" fill={CARD_DARK} fillOpacity={0} dot={false} />
          {/* 1-sigma band */}
          <Area type="monotone" dataKey="sigma1_upper" stroke="none" fill="url(#band1)" fillOpacity={1} dot={false} />
          <Area type="monotone" dataKey="sigma1_lower" stroke="none" fill={CARD_DARK} fillOpacity={0} dot={false} />
          {/* Actual line */}
          <Line type="monotone" dataKey="tokens" stroke={ACCENT} strokeWidth={2} dot={false} />
          {/* Spikes */}
          <Line type="monotone" dataKey="spike" stroke="#ff3b30" strokeWidth={0} dot={{ r: 6, fill: '#ff3b30', stroke: '#fff', strokeWidth: 2 }} />
          {/* Mean line */}
          <ReferenceLine y={mean} stroke="rgba(255,255,255,0.25)" strokeDasharray="5 5" label={{ value: 'mean', fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
          <Legend formatter={(value: string) => {
            const map: Record<string, string> = { tokens: 'Daily Tokens', spike: 'Anomaly Spike', sigma1_upper: '1-sigma', sigma2_upper: '2-sigma' }
            return <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{map[value] ?? value}</span>
          }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   6. TREEMAP — Token Budget by Dept > Model (Recharts)
   ══════════════════════════════════════════════════════════════════════════ */

function TreemapCell(props: any) {
  const { x, y, width, height, name, tokens, fill } = props
  if (!width || !height || width < 20 || height < 20) return null
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.75} rx={4} />
      {width > 50 && height > 30 && (
        <>
          <text x={x + 8} y={y + 16} fill="#fff" fontSize={11} fontWeight={700}>
            {(name ?? '').length > Math.floor(width / 7) ? (name ?? '').slice(0, Math.floor(width / 7) - 2) + '..' : name}
          </text>
          <text x={x + 8} y={y + 30} fill="rgba(255,255,255,0.65)" fontSize={10}>
            {compact(tokens ?? 0)}
          </text>
        </>
      )}
    </g>
  )
}

function TokenTreemap({ events }: { events: any[] }) {
  const treeData = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const e of events) {
      const d = e.dept_tag ?? 'untagged'
      const m = e.model_hint ?? 'unknown'
      const t = e.estimated_tokens ?? 0
      if (!map.has(d)) map.set(d, new Map())
      const inner = map.get(d)!
      inner.set(m, (inner.get(m) ?? 0) + t)
    }

    const children: any[] = []
    let colorIdx = 0
    for (const [dept, models] of map) {
      const color = PALETTE[colorIdx % PALETTE.length]!
      for (const [model, tokens] of models) {
        children.push({
          name: `${dept} / ${model}`,
          tokens,
          fill: color,
          dept,
          model,
        })
      }
      colorIdx++
    }

    return children.sort((a, b) => b.tokens - a.tokens)
  }, [events])

  if (treeData.length < 1) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No data for treemap</div>

  return (
    <div style={{ background: CARD_DARK, padding: 20 }}>
      <ResponsiveContainer width="100%" height={480}>
        <Treemap
          data={treeData}
          dataKey="tokens"
          nameKey="name"
          stroke="#1a1a2e"
          aspectRatio={4 / 3}
          content={<TreemapCell />}
        />
      </ResponsiveContainer>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   7. PARALLEL COORDINATES — Multi-Dim Department Comparison (Plotly)
   ══════════════════════════════════════════════════════════════════════════ */

function ParallelCoords({ events, fingerprints, cost }: { events: any[]; fingerprints: any; cost: any }) {
  const data = useMemo(() => {
    const deptMap = new Map<string, {
      tokens: number; calls: number; models: Set<string>; totalLatency: number; latCount: number; sessions: Set<string>
    }>()

    for (const e of events) {
      const d = e.dept_tag ?? 'untagged'
      const entry = deptMap.get(d) ?? { tokens: 0, calls: 0, models: new Set<string>(), totalLatency: 0, latCount: 0, sessions: new Set<string>() }
      entry.tokens += e.estimated_tokens ?? 0
      entry.calls += 1
      if (e.model_hint) entry.models.add(e.model_hint)
      if (e.session_hash) entry.sessions.add(e.session_hash)
      if (typeof e.latency_ms === 'number' && e.latency_ms > 0) {
        entry.totalLatency += e.latency_ms
        entry.latCount += 1
      }
      deptMap.set(d, entry)
    }

    const depts: string[] = []
    const volume: number[] = []
    const costPerToken: number[] = []
    const modelCount: number[] = []
    const avgLatency: number[] = []
    const sessionCount: number[] = []
    const colorVals: number[] = []

    let i = 0
    for (const [dept, v] of deptMap) {
      depts.push(dept)
      volume.push(v.tokens)
      costPerToken.push(v.tokens > 0 ? +((v.calls * 0.001 / v.tokens) * 1000).toFixed(4) : 0)
      modelCount.push(v.models.size)
      avgLatency.push(v.latCount > 0 ? Math.round(v.totalLatency / v.latCount) : 0)
      sessionCount.push(v.sessions.size)
      colorVals.push(i)
      i++
    }

    return { depts, volume, costPerToken, modelCount, avgLatency, sessionCount, colorVals }
  }, [events])

  if (data.depts.length < 2) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Need at least 2 departments</div>

  return (
    <div style={{ background: CARD_DARK, padding: 10 }}>
      <Plot
        data={[{
          type: 'parcoords',
          line: {
            color: data.colorVals,
            colorscale: PALETTE.slice(0, data.depts.length).map((c, i) => [i / Math.max(1, data.depts.length - 1), c] as [number, string]),
            showscale: false,
          },
          dimensions: [
            {
              label: 'Volume (tokens)',
              values: data.volume,
              range: [0, Math.max(...data.volume) * 1.1],
            },
            {
              label: 'Cost/Token (x1000)',
              values: data.costPerToken,
              range: [0, Math.max(...data.costPerToken, 0.001) * 1.1],
            },
            {
              label: 'Models Used',
              values: data.modelCount,
              range: [0, Math.max(...data.modelCount) + 1],
            },
            {
              label: 'Avg Latency (ms)',
              values: data.avgLatency,
              range: [0, Math.max(...data.avgLatency, 1) * 1.1],
            },
            {
              label: 'Sessions',
              values: data.sessionCount,
              range: [0, Math.max(...data.sessionCount) + 1],
            },
          ],
          tickfont: { size: 10, color: 'rgba(255,255,255,0.5)' },
          labelfont: { size: 11, color: 'rgba(255,255,255,0.7)' },
          rangefont: { size: 9, color: 'rgba(255,255,255,0.4)' },
        }]}
        layout={{
          autosize: true,
          height: 460,
          paper_bgcolor: CARD_DARK,
          plot_bgcolor: CARD_DARK,
          font: { color: 'rgba(255,255,255,0.7)', family: '-apple-system, sans-serif', size: 11 },
          margin: { l: 80, r: 80, t: 30, b: 30 },
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%' }}
      />
      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '12px 0', flexWrap: 'wrap' }}>
        {data.depts.map((d, i) => (
          <span key={d} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            <span style={{ width: 10, height: 3, borderRadius: 2, background: PALETTE[i % PALETTE.length], display: 'inline-block' }} />
            {d}
          </span>
        ))}
      </div>
    </div>
  )
}
