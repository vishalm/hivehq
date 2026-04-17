'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/* ═══════════════════════════════════════════════════════════════════════════
   HIVE Landing Page — World-Class SPA
   Token Economy · Token Governance · Zero Content · Full Visibility
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Inline SVG Icons (no emoji, per CLAUDE.md) ──────────────────────────── */
function HiveLogoLarge({ size = 64 }: { size?: number }) {
  const id = 'hive-landing-logo'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        <linearGradient id={`${id}-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="50%" stopColor="#ffd60a" />
          <stop offset="100%" stopColor="#e6b800" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id={`${id}-inner`}>
          <feFlood floodColor="#000000" floodOpacity="0.25" result="flood" />
          <feComposite in="flood" in2="SourceAlpha" operator="in" result="shadow" />
          <feOffset dx="0" dy="1" result="offset" />
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="none" stroke="rgba(255,214,10,0.12)" strokeWidth="1" filter={`url(#${id}-glow)`} />
      <polygon points="32,6 54,19 54,45 32,58 10,45 10,19" fill={`url(#${id}-gold)`} opacity="0.95" filter={`url(#${id}-inner)`} />
      <polygon points="32,22 39,26 39,34 32,38 25,34 25,26" fill="#0a0a0f" opacity="0.85" />
      <polygon points="41,14 48,18 48,26 41,30 34,26 34,18" fill="#0a0a0f" opacity="0.6" />
      <polygon points="23,34 30,38 30,46 23,50 16,46 16,38" fill="#0a0a0f" opacity="0.6" />
      <line x1="10" y1="19" x2="32" y2="6" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
      <line x1="32" y1="6" x2="54" y2="19" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
      <line x1="10" y1="19" x2="10" y2="45" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
    </svg>
  )
}

const IconShield = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)
const IconEye = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
)
const IconZap = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)
const IconLayers = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
)
const IconBarChart = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
  </svg>
)
const IconLock = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)
const IconGlobe = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
)
const IconArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
)
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const IconPlay = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
)
const IconChevronLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const IconChevronRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

/* ── Animated Counter ─────────────────────────────────────────────────── */
function AnimatedCounter({ end, duration = 2000, prefix = '', suffix = '' }: { end: number; duration?: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const animated = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !animated.current) {
        animated.current = true
        const start = performance.now()
        const step = (now: number) => {
          const progress = Math.min((now - start) / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setCount(Math.floor(eased * end))
          if (progress < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }
    }, { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [end, duration])

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>
}

/* ── Scroll-reveal wrapper ────────────────────────────────────────────── */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { threshold: 0.15 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

/* ── Floating particles background ────────────────────────────────────── */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    interface Particle { x: number; y: number; vx: number; vy: number; r: number; alpha: number }
    const particles: Particle[] = []
    const count = Math.min(60, Math.floor(window.innerWidth / 25))
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.3 + 0.05,
      })
    }

    const draw = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.clearRect(0, 0, w, h)

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,214,10,${p.alpha})`
        ctx.fill()
      }

      // Connection lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(255,214,10,${0.06 * (1 - dist / 120)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animId)
    }
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
}

/* ── Inline Dashboard Mockups ─────────────────────────────────────────── */
function MockKPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 10,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.6 }} />
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

function MockChart({ type, color }: { type: 'line' | 'bar' | 'pie'; color: string }) {
  if (type === 'line') {
    return (
      <svg viewBox="0 0 300 100" style={{ width: '100%', height: 80 }}>
        <defs><linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <path d="M0,80 L30,65 60,70 90,45 120,50 150,30 180,35 210,20 240,25 270,15 300,10" fill="none" stroke={color} strokeWidth="2" opacity="0.8" />
        <path d="M0,80 L30,65 60,70 90,45 120,50 150,30 180,35 210,20 240,25 270,15 300,10 L300,100 L0,100 Z" fill="url(#lg1)" />
      </svg>
    )
  }
  if (type === 'bar') {
    const bars = [65, 80, 45, 90, 55, 70, 40, 85]
    return (
      <svg viewBox="0 0 300 100" style={{ width: '100%', height: 80 }}>
        {bars.map((h, i) => (
          <rect key={i} x={i * 37 + 4} y={100 - h} width="28" height={h} rx="3" fill={color} opacity={0.15 + (i * 0.1)} />
        ))}
      </svg>
    )
  }
  // pie
  return (
    <svg viewBox="0 0 100 100" style={{ width: 80, height: 80 }}>
      <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#ffd60a" strokeWidth="8" strokeDasharray="150 251" strokeDashoffset="0" transform="rotate(-90 50 50)" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#007aff" strokeWidth="8" strokeDasharray="60 251" strokeDashoffset="-150" transform="rotate(-90 50 50)" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#34c759" strokeWidth="8" strokeDasharray="41 251" strokeDashoffset="-210" transform="rotate(-90 50 50)" />
    </svg>
  )
}

function MockDashboard() {
  return (
    <div style={{ padding: 20, background: '#0a0a0f', height: '100%', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
      {/* Mock header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HiveLogoLarge size={18} />
          <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 2, color: '#ffd60a' }}>HIVE</span>
          <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
            {['Dashboard', 'Intelligence', 'Graphs', 'Setup', 'Settings'].map((n, i) => (
              <span key={n} style={{ fontSize: 9, padding: '4px 10px', borderRadius: 6, color: i === 0 ? '#ffd60a' : 'rgba(255,255,255,0.35)', background: i === 0 ? 'rgba(255,214,10,0.08)' : 'transparent' }}>{n}</span>
            ))}
          </div>
        </div>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', padding: '3px 8px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 99 }}>pre-alpha</span>
      </div>
      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <MockKPI label="Token Spend" value="1.2M" color="#ffd60a" />
        <MockKPI label="Est. Cost" value="$3.60" color="#007aff" />
        <MockKPI label="API Events" value="847" color="#34c759" />
        <MockKPI label="Providers" value="4" color="#af52de" />
      </div>
      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 500 }}>Activity Timeline</div>
          <MockChart type="line" color="#ffd60a" />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 500, alignSelf: 'flex-start' }}>Provider Mix</div>
          <MockChart type="pie" color="#ffd60a" />
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {[{ c: '#ffd60a', l: 'OpenAI' }, { c: '#007aff', l: 'Anthropic' }, { c: '#34c759', l: 'Ollama' }].map(p => (
              <div key={p.l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
                <div style={{ width: 6, height: 6, borderRadius: 2, background: p.c }} />{p.l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MockIntelligence() {
  return (
    <div style={{ padding: 20, background: '#0a0a0f', height: '100%', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <HiveLogoLarge size={18} />
        <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 2, color: '#ffd60a' }}>HIVE</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>Intelligence Engine</span>
      </div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['Overview', 'Cost', 'Anomalies', 'Forecast', 'Clusters', 'Flows'].map((t, i) => (
          <span key={t} style={{ fontSize: 9, padding: '5px 12px', borderRadius: 6, background: i === 0 ? 'rgba(255,214,10,0.08)' : 'rgba(255,255,255,0.02)', color: i === 0 ? '#ffd60a' : 'rgba(255,255,255,0.35)', border: `1px solid ${i === 0 ? 'rgba(255,214,10,0.2)' : 'rgba(255,255,255,0.04)'}` }}>{t}</span>
        ))}
      </div>
      {/* Mixed grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 500 }}>Spend Forecast</div>
          <MockChart type="line" color="#007aff" />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 500 }}>Cost by Provider</div>
          <MockChart type="bar" color="#af52de" />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 500 }}>Anomaly Severity</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {[{ l: 'Critical', c: '#ff3b30', v: 2 }, { l: 'High', c: '#ff9500', v: 5 }, { l: 'Medium', c: '#ffd60a', v: 8 }, { l: 'Low', c: '#34c759', v: 3 }].map(a => (
              <div key={a.l} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: a.c }}>{a.v}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{a.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 500 }}>Behavioral Clusters</div>
          <svg viewBox="0 0 200 80" style={{ width: '100%', height: 60 }}>
            {/* Simplified radar/scatter */}
            <circle cx="60" cy="40" r="20" fill="rgba(175,82,222,0.15)" stroke="rgba(175,82,222,0.3)" strokeWidth="1" />
            <circle cx="120" cy="30" r="15" fill="rgba(255,214,10,0.15)" stroke="rgba(255,214,10,0.3)" strokeWidth="1" />
            <circle cx="150" cy="55" r="12" fill="rgba(0,122,255,0.15)" stroke="rgba(0,122,255,0.3)" strokeWidth="1" />
            <circle cx="40" cy="60" r="8" fill="rgba(52,199,89,0.15)" stroke="rgba(52,199,89,0.3)" strokeWidth="1" />
          </svg>
        </div>
      </div>
    </div>
  )
}

function MockGraphs() {
  return (
    <div style={{ padding: 20, background: '#0a0a0f', height: '100%', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <HiveLogoLarge size={18} />
        <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 2, color: '#ffd60a' }}>HIVE</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>Advanced Visualizations</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Chord diagram mock */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, aspectRatio: '1' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 500 }}>Provider Flow Chord</div>
          <svg viewBox="0 0 200 180" style={{ width: '100%' }}>
            <circle cx="100" cy="90" r="70" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            {/* Arcs */}
            <path d="M100,20 A70,70 0 0,1 165,65" fill="none" stroke="#ffd60a" strokeWidth="8" opacity="0.6" strokeLinecap="round" />
            <path d="M165,65 A70,70 0 0,1 165,115" fill="none" stroke="#007aff" strokeWidth="8" opacity="0.6" strokeLinecap="round" />
            <path d="M165,115 A70,70 0 0,1 100,160" fill="none" stroke="#34c759" strokeWidth="8" opacity="0.6" strokeLinecap="round" />
            <path d="M100,160 A70,70 0 0,1 35,115" fill="none" stroke="#af52de" strokeWidth="8" opacity="0.6" strokeLinecap="round" />
            <path d="M35,115 A70,70 0 0,1 35,65" fill="none" stroke="#ff9500" strokeWidth="8" opacity="0.6" strokeLinecap="round" />
            <path d="M35,65 A70,70 0 0,1 100,20" fill="none" stroke="#ff3b30" strokeWidth="8" opacity="0.6" strokeLinecap="round" />
            {/* Internal chords */}
            <path d="M100,20 Q100,90 165,115" fill="none" stroke="rgba(255,214,10,0.15)" strokeWidth="2" />
            <path d="M165,65 Q100,90 35,115" fill="none" stroke="rgba(0,122,255,0.15)" strokeWidth="2" />
            <path d="M35,65 Q100,90 165,65" fill="none" stroke="rgba(175,82,222,0.15)" strokeWidth="2" />
          </svg>
        </div>
        {/* Heatmap mock */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 500 }}>Usage Heatmap</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: 42 }, (_, i) => {
              const intensity = Math.random()
              return (
                <div key={i} style={{
                  aspectRatio: '1',
                  borderRadius: 2,
                  background: intensity > 0.7 ? `rgba(255,214,10,${intensity * 0.5})` : intensity > 0.3 ? `rgba(0,122,255,${intensity * 0.4})` : 'rgba(255,255,255,0.03)',
                }} />
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <span key={d} style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)' }}>{d}</span>
            ))}
          </div>
        </div>
        {/* Force network mock */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, gridColumn: 'span 2' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 500 }}>Provider Network Graph</div>
          <svg viewBox="0 0 400 120" style={{ width: '100%', height: 100 }}>
            {/* Nodes */}
            {[
              { x: 80, y: 60, r: 18, c: '#ffd60a', l: 'OpenAI' },
              { x: 200, y: 40, r: 22, c: '#007aff', l: 'Anthropic' },
              { x: 320, y: 60, r: 14, c: '#34c759', l: 'Ollama' },
              { x: 140, y: 95, r: 10, c: '#af52de', l: 'Google' },
              { x: 260, y: 95, r: 12, c: '#ff9500', l: 'Azure' },
            ].map((n, i) => (
              <g key={i}>
                {/* Connections */}
                {i > 0 && <line x1={n.x} y1={n.y} x2={[80, 80, 200, 200][i - 1]} y2={[60, 60, 40, 40][i - 1]} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />}
                <circle cx={n.x} cy={n.y} r={n.r} fill={`${n.c}20`} stroke={`${n.c}60`} strokeWidth="1.5" />
                <text x={n.x} y={n.y + 3} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="7" fontWeight="500">{n.l}</text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}

function MockSetup() {
  return (
    <div style={{ padding: 20, background: '#0a0a0f', height: '100%', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.3px' }}>HIVE Setup</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Configure your deployment in minutes</div>
      </div>
      {/* Wizard steps */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
        {['Deploy', 'Connectors', 'LLM', 'Governance'].map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: i === 1 ? 'rgba(255,214,10,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${i === 1 ? 'rgba(255,214,10,0.2)' : 'rgba(255,255,255,0.04)'}` }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: i < 1 ? '#34c759' : i === 1 ? '#ffd60a' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: i <= 1 ? '#0a0a0f' : 'rgba(255,255,255,0.3)' }}>
              {i < 1 ? <IconCheck /> : i + 1}
            </div>
            <span style={{ fontSize: 9, fontWeight: 500, color: i === 1 ? '#ffd60a' : 'rgba(255,255,255,0.35)' }}>{s}</span>
          </div>
        ))}
      </div>
      {/* Connector grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { name: 'OpenAI', cat: 'cloud', color: '#007aff', on: true },
          { name: 'Anthropic', cat: 'cloud', color: '#007aff', on: true },
          { name: 'Ollama', cat: 'local', color: '#34c759', on: true },
          { name: 'Google', cat: 'cloud', color: '#007aff', on: false },
          { name: 'Azure', cat: 'cloud', color: '#007aff', on: false },
          { name: 'Mistral', cat: 'cloud', color: '#007aff', on: false },
        ].map(c => (
          <div key={c.name} style={{
            padding: 12, borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${c.on ? 'rgba(255,214,10,0.2)' : 'rgba(255,255,255,0.04)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{c.name}</span>
              <div style={{ width: 28, height: 14, borderRadius: 7, background: c.on ? 'rgba(52,199,89,0.3)' : 'rgba(255,255,255,0.06)', position: 'relative' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.on ? '#34c759' : 'rgba(255,255,255,0.15)', position: 'absolute', top: 2, left: c.on ? 16 : 2, transition: 'left 0.2s' }} />
              </div>
            </div>
            <span style={{ fontSize: 8, color: c.color, padding: '1px 6px', borderRadius: 99, background: `${c.color}15`, marginTop: 6, display: 'inline-block' }}>{c.cat}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MockSettings() {
  return (
    <div style={{ padding: 20, background: '#0a0a0f', height: '100%', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 4, letterSpacing: '-0.3px' }}>LLM Provider Settings</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>Configure endpoints and API keys for each provider</div>
      {/* Provider cards */}
      {[
        { name: 'Ollama', status: 'online', color: '#34c759', cat: 'local', models: '3 models loaded' },
        { name: 'OpenAI', status: 'connected', color: '#007aff', cat: 'cloud', models: 'gpt-4o' },
        { name: 'Anthropic', status: 'active', color: '#007aff', cat: 'cloud', models: 'claude-sonnet-4-6' },
      ].map(p => (
        <div key={p.name} style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{p.name}</span>
              <span style={{ fontSize: 8, padding: '2px 8px', borderRadius: 99, background: `${p.color}15`, color: p.color }}>{p.cat}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, boxShadow: `0 0 6px ${p.color}80` }} />
              <span style={{ fontSize: 9, color: p.color }}>{p.status}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 3 }}>Model</div>
              <div style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{p.models}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 3 }}>API Key</div>
              <div style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>sk-***...***</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Demo Deck Carousel ───────────────────────────────────────────────── */
const demoSlides = [
  { id: 'dashboard', title: 'Token Economy Dashboard', desc: 'Real-time spend, provider breakdown, shadow AI detection, governance compliance — all in one view.', href: '/', render: MockDashboard },
  { id: 'intelligence', title: 'Intelligence Engine', desc: 'Cost analysis, anomaly detection, spend forecasting, behavioral clustering, and usage fingerprints.', href: '/intelligence', render: MockIntelligence },
  { id: 'graphs', title: 'Advanced Visualizations', desc: 'Chord diagrams, 3D scatter plots, force networks, heatmaps, treemaps, and parallel coordinates.', href: '/graphs', render: MockGraphs },
  { id: 'setup', title: 'One-Click Setup', desc: 'Guided wizard for deployment, connectors, LLM providers, regulation tags, and governance policies.', href: '/setup', render: MockSetup },
  { id: 'settings', title: 'Provider Settings', desc: 'Configure Ollama, OpenAI, Anthropic, Google, and custom endpoints. Encrypted vault for API keys.', href: '/settings', render: MockSettings },
]

function DemoDeck() {
  const [active, setActive] = useState(0)

  const next = useCallback(() => setActive(i => (i + 1) % demoSlides.length), [])
  const prev = useCallback(() => setActive(i => (i - 1 + demoSlides.length) % demoSlides.length), [])

  useEffect(() => {
    const timer = setInterval(next, 6000)
    return () => clearInterval(timer)
  }, [next])

  const slide = demoSlides[active]
  const SlideRender = slide.render

  return (
    <div style={{ position: 'relative' }}>
      {/* Main showcase */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
      }}>
        {/* Mockup area */}
        <div style={{
          position: 'relative',
          aspectRatio: '16/9',
          background: '#0a0a0f',
          overflow: 'hidden',
        }}>
          <SlideRender />

          {/* Navigation arrows */}
          <button onClick={prev} aria-label="Previous slide" style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', zIndex: 2,
          }}>
            <IconChevronLeft />
          </button>
          <button onClick={next} aria-label="Next slide" style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', zIndex: 2,
          }}>
            <IconChevronRight />
          </button>
        </div>

        {/* Slide info bar */}
        <div style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{slide.title}</span>
              <a href={slide.href} style={{
                fontSize: 11, color: '#ffd60a', textDecoration: 'none', fontWeight: 500,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                View live <IconArrowRight />
              </a>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{slide.desc}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {demoSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                aria-label={`Slide ${i + 1}`}
                style={{
                  width: i === active ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  border: 'none',
                  background: i === active ? '#ffd60a' : 'rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Feature cards ────────────────────────────────────────────────────── */
const features = [
  {
    icon: <IconBarChart />,
    title: 'Token Economy',
    desc: 'Every token is a unit of spend. Turn invisible API calls into visible ROI with real-time cost tracking across every provider, model, and department.',
    color: '#ffd60a',
  },
  {
    icon: <IconShield />,
    title: 'Token Governance',
    desc: 'Structural compliance — not optional. Every event carries a GovernanceBlock with frozen privacy guarantees, regulation tags, data residency, and retention policy.',
    color: '#007aff',
  },
  {
    icon: <IconLock />,
    title: 'Zero Content',
    desc: 'HIVE never reads prompts, completions, or API keys. Metadata only. This is the trust foundation that makes enterprise adoption possible.',
    color: '#34c759',
  },
  {
    icon: <IconEye />,
    title: 'Shadow AI Detection',
    desc: 'Unsanctioned providers are a governance risk. HIVE makes shadow AI immediately visible and quantified with real-time anomaly detection.',
    color: '#ff3b30',
  },
  {
    icon: <IconZap />,
    title: 'Intelligence Engine',
    desc: 'Cost modeling, anomaly detection, spend forecasting, behavioral clustering, and usage fingerprinting — all powered by the intelligence layer.',
    color: '#af52de',
  },
  {
    icon: <IconGlobe />,
    title: 'Universal Connectors',
    desc: 'OpenAI, Anthropic, Google, Ollama, Azure, Bedrock, Mistral — transparent telemetry capture from every provider with zero configuration.',
    color: '#ff9500',
  },
]

/* ── Architecture flow ────────────────────────────────────────────────── */
const archSteps = [
  { label: 'AI Providers', sub: 'OpenAI, Anthropic, Ollama...' },
  { label: 'Connectors', sub: 'Transparent intercept' },
  { label: 'Scout', sub: 'Telemetry agent' },
  { label: 'Node Server', sub: 'TTP ingest & store' },
  { label: 'HIVE Dashboard', sub: 'Full visibility' },
]

/* ── Pricing / tiers ──────────────────────────────────────────────────── */
const tiers = [
  {
    name: 'Open Source',
    price: 'Free',
    desc: 'Self-hosted. Full power.',
    features: ['Unlimited events', 'All connectors', 'Full dashboard', 'Intelligence engine', 'Docker one-command deploy', 'Community support'],
    cta: 'Get Started',
    href: '/',
    highlight: false,
  },
  {
    name: 'Enterprise',
    price: 'Contact Us',
    desc: 'For organizations at scale.',
    features: ['Everything in Open Source', 'SSO / SAML authentication', 'Multi-tenant isolation', 'Custom retention policies', 'SLA-backed support', 'Dedicated success engineer'],
    cta: 'Talk to Sales',
    href: 'mailto:enterprise@hive.io',
    highlight: true,
  },
]

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function LandingClient() {
  const [scrollY, setScrollY] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    padding: '0 24px',
    background: scrollY > 50 ? 'rgba(10,10,15,0.85)' : 'transparent',
    backdropFilter: scrollY > 50 ? 'blur(24px) saturate(180%)' : 'none',
    borderBottom: scrollY > 50 ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
    transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
  }

  return (
    <div style={{ background: '#0a0a0f', color: 'rgba(255,255,255,0.92)', minHeight: '100vh', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, sans-serif", fontSize: 14, lineHeight: 1.6, overflowX: 'hidden' }}>

      {/* ── Sticky Navigation ─────────────────────────────────────────── */}
      <nav style={navStyle}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <HiveLogoLarge size={28} />
            <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: 2, color: '#ffd60a', textShadow: '0 0 24px rgba(255,214,10,0.3)' }}>HIVE</span>
          </a>

          {/* Desktop nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="landing-nav-desktop">
            {['Features', 'Platform', 'Architecture', 'Pricing'].map(label => (
              <a key={label} href={`#${label.toLowerCase()}`} style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 13, fontWeight: 500, transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.92)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
              >{label}</a>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/login" style={{
              padding: '8px 20px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.8)',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}>Sign In</a>
            <a href="/" style={{
              padding: '8px 20px',
              borderRadius: 10,
              background: '#ffd60a',
              color: '#0a0a0f',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s',
              boxShadow: '0 0 20px rgba(255,214,10,0.15)',
            }}>Open Dashboard</a>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <section style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #0f1923 40%, #16213e 100%)',
        overflow: 'hidden',
      }}>
        <ParticleField />

        {/* Radial glow */}
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,214,10,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 800, padding: '120px 24px 80px' }}>
          {/* Badge */}
          <Reveal>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 9999,
              background: 'rgba(255,214,10,0.08)',
              border: '1px solid rgba(255,214,10,0.15)',
              fontSize: 12,
              fontWeight: 500,
              color: '#ffd60a',
              marginBottom: 32,
              letterSpacing: 0.5,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffd60a', boxShadow: '0 0 8px rgba(255,214,10,0.5)' }} />
              The Global AI Consumption Network
            </div>
          </Reveal>

          {/* Headline */}
          <Reveal delay={100}>
            <h1 style={{
              fontSize: 'clamp(36px, 6vw, 72px)',
              fontWeight: 800,
              letterSpacing: '-1.5px',
              lineHeight: 1.1,
              margin: '0 0 24px',
              background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Every token is a decision.
              <br />
              <span style={{
                background: 'linear-gradient(135deg, #ffd60a, #ff9500)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                HIVE makes them visible.
              </span>
            </h1>
          </Reveal>

          {/* Subtitle */}
          <Reveal delay={200}>
            <p style={{
              fontSize: 'clamp(16px, 2vw, 20px)',
              color: 'rgba(255,255,255,0.5)',
              maxWidth: 560,
              margin: '0 auto 40px',
              lineHeight: 1.7,
            }}>
              See where your AI tokens go, what they cost, and who controls them.
              Token economy. Token governance. Zero content. Full visibility.
            </p>
          </Reveal>

          {/* CTA Buttons */}
          <Reveal delay={300}>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '14px 32px',
                borderRadius: 12,
                background: '#ffd60a',
                color: '#0a0a0f',
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s',
                boxShadow: '0 0 30px rgba(255,214,10,0.2), 0 4px 16px rgba(0,0,0,0.3)',
              }}>
                Open Dashboard <IconArrowRight />
              </a>
              <a href="#platform" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '14px 32px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.8)',
                fontSize: 15,
                fontWeight: 500,
                textDecoration: 'none',
                backdropFilter: 'blur(12px)',
                transition: 'all 0.2s',
              }}>
                <IconPlay /> See it in Action
              </a>
            </div>
          </Reveal>

          {/* Stats bar */}
          <Reveal delay={400}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 48,
              marginTop: 64,
              flexWrap: 'wrap',
            }}>
              {[
                { value: 7, suffix: '+', label: 'AI Providers' },
                { value: 247, label: 'Tests Passing' },
                { value: 25, suffix: '+', label: 'Doc Pages' },
                { value: 0, prefix: '$', label: 'Forever Free' },
              ].map((stat, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#ffd60a', fontVariantNumeric: 'tabular-nums' }}>
                    <AnimatedCounter end={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          opacity: scrollY > 100 ? 0 : 0.4,
          transition: 'opacity 0.3s',
        }}>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Scroll</span>
          <div style={{ width: 1, height: 32, background: 'linear-gradient(to bottom, rgba(255,214,10,0.3), transparent)' }} />
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '120px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#ffd60a' }}>CAPABILITIES</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.5px', margin: '12px 0 16px', lineHeight: 1.2 }}>
              Built for AI-native enterprises
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
              Your spreadsheet cannot show you what HIVE can. From invisible API calls to visible ROI.
            </p>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {features.map((f, i) => (
            <Reveal key={i} delay={i * 80}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 18,
                padding: 32,
                height: '100%',
                transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                cursor: 'default',
                position: 'relative',
                overflow: 'hidden',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = `${f.color}33`
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.3), 0 0 30px ${f.color}11`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Accent line */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${f.color}, transparent)`, opacity: 0.5 }} />

                <div style={{
                  width: 48, height: 48,
                  borderRadius: 12,
                  background: `${f.color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: f.color,
                  marginBottom: 20,
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 10px', letterSpacing: '-0.2px' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Platform Demo Deck ────────────────────────────────────────── */}
      <section id="platform" style={{
        padding: '120px 24px',
        background: 'linear-gradient(180deg, transparent, rgba(255,214,10,0.02) 50%, transparent)',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#ffd60a' }}>PLATFORM</span>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.5px', margin: '12px 0 16px', lineHeight: 1.2 }}>
                Talk to your data. Define your value.
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
                A glassmorphic dark dashboard built for operators who need answers, not dashboards.
              </p>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <DemoDeck />
          </Reveal>
        </div>
      </section>

      {/* ── Architecture Section ──────────────────────────────────────── */}
      <section id="architecture" style={{ padding: '120px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#ffd60a' }}>ARCHITECTURE</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.5px', margin: '12px 0 16px', lineHeight: 1.2 }}>
              Connectors to Dashboard in one pipeline
            </h2>
          </div>
        </Reveal>

        {/* Flow diagram */}
        <Reveal delay={100}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0,
            flexWrap: 'wrap',
            padding: '40px 0',
          }}>
            {archSteps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  padding: '16px 24px',
                  borderRadius: 14,
                  background: i === archSteps.length - 1 ? 'rgba(255,214,10,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${i === archSteps.length - 1 ? 'rgba(255,214,10,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  textAlign: 'center',
                  minWidth: 140,
                  boxShadow: i === archSteps.length - 1 ? '0 0 20px rgba(255,214,10,0.1)' : 'none',
                  transition: 'all 0.3s',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: i === archSteps.length - 1 ? '#ffd60a' : 'rgba(255,255,255,0.9)' }}>{step.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{step.sub}</div>
                </div>
                {i < archSteps.length - 1 && (
                  <svg width="32" height="16" viewBox="0 0 32 16" style={{ margin: '0 4px', flexShrink: 0 }}>
                    <line x1="0" y1="8" x2="24" y2="8" stroke="rgba(255,214,10,0.3)" strokeWidth="1.5" />
                    <polygon points="24,4 32,8 24,12" fill="rgba(255,214,10,0.4)" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </Reveal>

        {/* Protocol highlight */}
        <Reveal delay={200}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
            marginTop: 40,
          }}>
            {[
              {
                icon: <IconLayers />,
                title: 'Token Telemetry Protocol',
                desc: 'TTP is the wire format. Every event carries provider, model, tokens, latency, cost, department, and a signed GovernanceBlock.',
                color: '#ffd60a',
              },
              {
                icon: <IconLock />,
                title: 'Ed25519 Batch Signatures',
                desc: 'Every telemetry batch is cryptographically signed. Audit chain with Merkle proofs. Tamper-evident by design.',
                color: '#007aff',
              },
              {
                icon: <IconShield />,
                title: 'GovernanceBlock',
                desc: 'pii_asserted: false, content_asserted: false — frozen at protocol level. Regulation tags and retention policies enforced structurally.',
                color: '#34c759',
              },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 18,
                padding: 28,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 11,
                  background: `${item.color}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: item.color,
                  marginBottom: 16,
                }}>
                  {item.icon}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Social proof / trust ──────────────────────────────────────── */}
      <section style={{
        padding: '80px 24px',
        background: 'rgba(255,255,255,0.01)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <blockquote style={{
              fontSize: 'clamp(20px, 3vw, 28px)',
              fontWeight: 600,
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.85)',
              margin: '0 0 24px',
              letterSpacing: '-0.3px',
              fontStyle: 'italic',
            }}>
              "From invisible API calls to visible ROI. Zero content. Full visibility. Total accountability."
            </blockquote>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
              The HIVE Manifesto
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Pricing Section ───────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: '120px 24px', maxWidth: 900, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#ffd60a' }}>PRICING</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.5px', margin: '12px 0 16px', lineHeight: 1.2 }}>
              Open source. No strings attached.
            </h2>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {tiers.map((tier, i) => (
            <Reveal key={i} delay={i * 100}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                backdropFilter: 'blur(20px)',
                border: `1px solid ${tier.highlight ? 'rgba(255,214,10,0.25)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 20,
                padding: 36,
                position: 'relative',
                overflow: 'hidden',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {tier.highlight && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #ffd60a, #ff9500)' }} />
                )}
                <div style={{ fontSize: 12, fontWeight: 600, color: tier.highlight ? '#ffd60a' : 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{tier.name}</div>
                <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>{tier.price}</div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 28, lineHeight: 1.6 }}>{tier.desc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32, flex: 1 }}>
                  {tier.features.map((f, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
                      <span style={{ color: '#34c759', flexShrink: 0 }}><IconCheck /></span>
                      {f}
                    </div>
                  ))}
                </div>
                <a href={tier.href} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 24px',
                  borderRadius: 12,
                  background: tier.highlight ? '#ffd60a' : 'rgba(255,255,255,0.04)',
                  border: tier.highlight ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  color: tier.highlight ? '#0a0a0f' : 'rgba(255,255,255,0.8)',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}>
                  {tier.cta} <IconArrowRight />
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────── */}
      <section style={{
        padding: '120px 24px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,214,10,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <Reveal>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <HiveLogoLarge size={56} />
            <h2 style={{
              fontSize: 'clamp(28px, 4vw, 48px)',
              fontWeight: 800,
              letterSpacing: '-0.5px',
              margin: '24px 0 16px',
              lineHeight: 1.2,
            }}>
              Ready to see where your tokens go?
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.7 }}>
              Deploy in minutes. Open source forever. Your data, your infrastructure, your visibility.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '16px 36px',
                borderRadius: 14,
                background: '#ffd60a',
                color: '#0a0a0f',
                fontSize: 16,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 0 40px rgba(255,214,10,0.2)',
                transition: 'all 0.2s',
              }}>
                Open Dashboard <IconArrowRight />
              </a>
              <a href="/setup" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '16px 36px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.8)',
                fontSize: 16,
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}>
                Quick Setup
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '48px 24px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 40 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <HiveLogoLarge size={24} />
              <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 2, color: '#ffd60a' }}>HIVE</span>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', maxWidth: 280, lineHeight: 1.7 }}>
              The Global AI Consumption Network. Token Economy. Token Governance. Zero Content.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>Platform</div>
              {[
                { label: 'Dashboard', href: '/' },
                { label: 'Intelligence', href: '/intelligence' },
                { label: 'Graphs', href: '/graphs' },
                { label: 'Setup', href: '/setup' },
                { label: 'Settings', href: '/settings' },
              ].map(link => (
                <a key={link.href} href={link.href} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', padding: '4px 0', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                >{link.label}</a>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>Resources</div>
              {[
                { label: 'Documentation', href: '/docs' },
                { label: 'API Reference', href: '/docs/api' },
                { label: 'Architecture', href: '/docs/architecture' },
              ].map(link => (
                <a key={link.href} href={link.href} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', padding: '4px 0', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                >{link.label}</a>
              ))}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', paddingTop: 32, marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
            HIVE — Token Economy. Token Governance.
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
            Zero content. Full visibility. Total accountability.
          </span>
        </div>
      </footer>

      {/* ── Responsive CSS ────────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .landing-nav-desktop { display: none !important; }
        }
      `}</style>
    </div>
  )
}
