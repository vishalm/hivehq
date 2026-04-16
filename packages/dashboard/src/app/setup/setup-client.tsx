'use client'

import { useState, useCallback, useEffect } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────
interface Connector {
  id: string
  name: string
  provider: string
  description: string
  icon: string
  hosts: string[]
  envHint: string | null
  detectionMethod: string
  status: string
  category: 'cloud' | 'local'
}

interface SetupConfig {
  deployment: 'solo' | 'node'
  nodeUrl: string
  region: string
  connectors: string[]
  ollamaHost: string
  flushInterval: number
  deptTag: string
  projectTag: string
  retentionDays: number
  regulationTags: string
  nodeRegion: string
  nodeId: string
}

const DEFAULT_CONFIG: SetupConfig = {
  deployment: 'solo',
  nodeUrl: 'http://localhost:3000',
  region: 'AE',
  connectors: ['anthropic', 'ollama'],
  ollamaHost: 'localhost:11434',
  flushInterval: 60,
  deptTag: '',
  projectTag: '',
  retentionDays: 90,
  regulationTags: 'UAE_AI_LAW,GDPR',
  nodeRegion: 'AE',
  nodeId: 'hive-node-01',
}

/* ── SVG Icon Components (no emoji) ────────────────────────────────────── */
function SvgIcon({ icon, size = 24 }: { icon: string; size?: number }) {
  const s = String(size)
  const paths: Record<string, string> = {
    brain: 'M12 2a7 7 0 0 0-4.6 12.3A5 5 0 0 0 4 19a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3 5 5 0 0 0-3.4-4.7A7 7 0 0 0 12 2Zm0 2a5 5 0 0 1 3.5 8.6l-.7.7.4 1A3 3 0 0 1 18 19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1 3 3 0 0 1 2.8-3l.4-.7-.7-.7A5 5 0 0 1 12 4Z',
    server: 'M4 3h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 10h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Zm2-6h2v2H6V7Zm0 10h2v2H6v-2Z',
    zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8Z',
    globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2c1.1 0 2.5 1.5 3.3 4H8.7C9.5 5.5 10.9 4 12 4ZM4.3 10h3.4c-.1.6-.2 1.3-.2 2s.1 1.4.2 2H4.3a8 8 0 0 1 0-4Zm4.4 6c.8 2.5 2.2 4 3.3 4s2.5-1.5 3.3-4H8.7Zm7.6-2c.1-.6.2-1.3.2-2s-.1-1.4-.2-2h3.4a8 8 0 0 1 0 4h-3.4Z',
    wind: 'M9.6 4.5a2.5 2.5 0 0 1 4.9.5H3m14.1 2a2.5 2.5 0 0 1-1.6 4.4H3m10.1 2.5a2.5 2.5 0 0 1-1.6 4.5H3',
    cloud: 'M18 10a6 6 0 0 0-11.3-2A4 4 0 0 0 4 16h14a4 4 0 0 0 0-8v4',
    database: 'M12 2C8 2 4 3.3 4 5v14c0 1.7 4 3 8 3s8-1.3 8-3V5c0-1.7-4-3-8-3ZM4 9c0 1.7 4 3 8 3s8-1.3 8-3m-16 5c0 1.7 4 3 8 3s8-1.3 8-3',
  }
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[icon] ?? paths.zap!} />
    </svg>
  )
}

const NODE_URL = typeof window !== 'undefined'
  ? (process.env['NEXT_PUBLIC_NODE_URL'] ?? (window.location.port === '3001' ? 'http://localhost:3000' : window.location.origin))
  : 'http://localhost:3000'

// ── Component ───────────────────────────────────────────────────────────────
export default function SetupClient({
  connectors: initialConnectors,
}: {
  connectors: Connector[]
}) {
  const [step, setStep] = useState(1)
  const [config, setConfig] = useState<SetupConfig>(DEFAULT_CONFIG)
  const [connectors] = useState(initialConnectors)
  const [nodeStatus, setNodeStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const update = useCallback(
    <K extends keyof SetupConfig>(key: K, value: SetupConfig[K]) => {
      setConfig((c) => ({ ...c, [key]: value }))
    },
    [],
  )

  const toggleConnector = useCallback((id: string) => {
    setConfig((c) => ({
      ...c,
      connectors: c.connectors.includes(id)
        ? c.connectors.filter((x) => x !== id)
        : [...c.connectors, id],
    }))
  }, [])

  // Load saved config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch(`${NODE_URL}/api/v1/config`, { signal: AbortSignal.timeout(3000) })
        if (res.ok) {
          const saved = await res.json()
          if (saved?.scout) {
            setConfig({
              deployment: saved.scout.deployment ?? 'solo',
              nodeUrl: saved.dashboard?.nodeUrl ?? 'http://localhost:3000',
              region: saved.scout.dataResidency ?? 'AE',
              connectors: saved.scout.connectors ?? ['anthropic', 'ollama'],
              ollamaHost: saved.scout.ollamaHost ?? 'localhost:11434',
              flushInterval: (saved.scout.flushIntervalMs ?? 60000) / 1000,
              deptTag: saved.scout.deptTag ?? '',
              projectTag: saved.scout.projectTag ?? '',
              retentionDays: saved.scout.retentionDays ?? 90,
              regulationTags: (saved.scout.regulationTags ?? ['UAE_AI_LAW', 'GDPR']).join(','),
              nodeRegion: saved.node?.region ?? 'AE',
              nodeId: saved.node?.nodeId ?? 'hive-node-01',
            })
          }
        }
      } catch { /* use defaults */ }
    }
    loadConfig()
  }, [])

  // Auto-check Node status
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${NODE_URL}/health`, { signal: AbortSignal.timeout(3000) })
        setNodeStatus(res.ok ? 'online' : 'offline')
      } catch {
        setNodeStatus('offline')
      }
    }
    check()
    const timer = setInterval(check, 10000)
    return () => clearInterval(timer)
  }, [])

  // Auto-check Ollama status
  useEffect(() => {
    if (!config.connectors.includes('ollama')) { setOllamaStatus('offline'); return }
    const check = async () => {
      try {
        const res = await fetch(`http://${config.ollamaHost}/api/tags`, { signal: AbortSignal.timeout(3000) })
        setOllamaStatus(res.ok ? 'online' : 'offline')
      } catch {
        setOllamaStatus('offline')
      }
    }
    check()
    const timer = setInterval(check, 10000)
    return () => clearInterval(timer)
  }, [config.ollamaHost, config.connectors])

  // Save config to vault via Node API
  const saveConfig = async () => {
    setSaveStatus('saving')
    try {
      const body = {
        scout: {
          deployment: config.deployment,
          connectors: config.connectors,
          dataResidency: config.region,
          retentionDays: config.retentionDays,
          regulationTags: config.regulationTags.split(',').map((t) => t.trim()).filter(Boolean),
          flushIntervalMs: config.flushInterval * 1000,
          ...(config.deptTag && { deptTag: config.deptTag }),
          ...(config.projectTag && { projectTag: config.projectTag }),
          ...(config.ollamaHost !== 'localhost:11434' && { ollamaHost: config.ollamaHost }),
          ...(config.nodeRegion && { nodeRegion: config.nodeRegion }),
        },
        node: {
          port: 3000,
          region: config.nodeRegion,
          nodeId: config.nodeId,
        },
        dashboard: {
          port: 3001,
          nodeUrl: config.nodeUrl,
        },
        providers: Object.fromEntries(
          connectors.map((c) => [c.id, {
            enabled: config.connectors.includes(c.id),
            ...(c.id === 'ollama' && { hosts: [config.ollamaHost] }),
          }]),
        ),
      }
      const res = await fetch(`${NODE_URL}/api/v1/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setSaveStatus(res.ok ? 'saved' : 'error')
      if (res.ok) setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
    }
  }

  return (
    <div>
      {/* ── Architecture Flow ────────────────────────────────────────── */}
      <div className="arch-flow">
        <div className="node highlight">Connectors</div>
        <span className="arrow">&rarr;</span>
        <div className="node highlight">Scout</div>
        <span className="arrow">&rarr;</span>
        <div className="node">Node</div>
        <span className="arrow">&rarr;</span>
        <div className="node">HIVE Dashboard</div>
      </div>

      {/* ── Status Bar ───────────────────────────────────────────────── */}
      <div className={`status-bar ${nodeStatus === 'online' ? 'ok' : 'waiting'}`}>
        <span className="dot" />
        {nodeStatus === 'online'
          ? `Node server online at ${NODE_URL}`
          : nodeStatus === 'checking'
            ? 'Checking Node server...'
            : 'Node server offline — start it to enable config saving'}
      </div>

      {/* ── Step Wizard ──────────────────────────────────────────────── */}
      <div className="wizard-tabs">
        {['Connectors', 'Configuration', 'Activate'].map((label, i) => (
          <button
            key={label}
            className={`wizard-tab ${step === i + 1 ? 'active' : ''} ${i + 1 < step ? 'done' : ''}`}
            onClick={() => setStep(i + 1)}
          >
            <span className="tab-num">{i + 1 < step ? '\u2713' : i + 1}</span>
            {label}
          </button>
        ))}
      </div>

      {/* ── Step 1: Choose Connectors ────────────────────────────────── */}
      {step === 1 && (
        <div>
          <div className="step-title">
            <h2>Choose Your AI Providers</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              Select which AI services you use. HIVE will automatically intercept
              and measure token consumption. <strong>Zero content captured. Ever.</strong>
            </p>
          </div>

          <div className="connector-grid">
            {connectors.map((c) => {
              const active = config.connectors.includes(c.id)
              return (
                <div
                  key={c.id}
                  className={`connector-card ${active ? 'active' : ''}`}
                  onClick={() => toggleConnector(c.id)}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={`icon ${c.category}`}>
                    <SvgIcon icon={c.icon} size={28} />
                  </div>
                  <h3>{c.name}</h3>
                  <p className="desc">{c.description}</p>
                  <div className="hosts">
                    {c.hosts.map((h) => (
                      <code key={h} style={{ marginRight: 6 }}>{h}</code>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={`badge ${c.category}`}>{c.category}</span>
                    <span style={{ fontSize: 12, color: active ? 'var(--accent)' : 'var(--muted)' }}>
                      {active ? '\u2713 enabled' : 'click to enable'}
                    </span>
                  </div>
                  {c.id === 'ollama' && active && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e5ea' }}>
                      <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                        Ollama Host
                      </label>
                      <input
                        type="text"
                        className="setup-input"
                        value={config.ollamaHost}
                        onChange={(e) => update('ollamaHost', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="localhost:11434"
                      />
                      <div style={{ fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                          background: ollamaStatus === 'online' ? '#4caf50' : ollamaStatus === 'checking' ? '#ff9800' : '#f44336',
                        }} />
                        {ollamaStatus === 'online' ? 'Ollama connected' : ollamaStatus === 'checking' ? 'Checking...' : 'Not detected — is Ollama running?'}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <button className="btn primary" onClick={() => setStep(2)}>
              Next: Configuration &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Configuration ────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <div className="step-title">
            <h2>Configure HIVE</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              All fields are pre-filled with sensible defaults. No .env files needed —
              your config is saved securely in the HIVE vault.
            </p>
          </div>

          <div className="config-grid">
            <div className="config-section">
              <h3>Deployment Mode</h3>
              <div className="radio-group">
                <label className={`radio-card ${config.deployment === 'solo' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="deployment"
                    value="solo"
                    checked={config.deployment === 'solo'}
                    onChange={() => update('deployment', 'solo')}
                  />
                  <div>
                    <strong>Solo Mode</strong>
                    <span>Events stay local. Personal dashboard. Perfect for getting started.</span>
                  </div>
                </label>
                <label className={`radio-card ${config.deployment === 'node' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="deployment"
                    value="node"
                    checked={config.deployment === 'node'}
                    onChange={() => update('deployment', 'node')}
                  />
                  <div>
                    <strong>Node Mode</strong>
                    <span>Events flow to your org&apos;s HIVE Node Hub for team-wide visibility.</span>
                  </div>
                </label>
              </div>
            </div>

            {config.deployment === 'node' && (
              <div className="config-section">
                <h3>Node Hub Connection</h3>
                <label className="field-label">Node Server URL</label>
                <input
                  type="text"
                  className="setup-input"
                  value={config.nodeUrl}
                  onChange={(e) => update('nodeUrl', e.target.value)}
                  placeholder="http://localhost:3000"
                />
              </div>
            )}

            <div className="config-section">
              <h3>Governance &amp; Compliance</h3>
              <div className="field-row">
                <div>
                  <label className="field-label">Data Residency</label>
                  <input
                    type="text"
                    className="setup-input small"
                    value={config.region}
                    onChange={(e) => update('region', e.target.value.toUpperCase())}
                    placeholder="AE"
                    maxLength={8}
                  />
                </div>
                <div>
                  <label className="field-label">Retention (days)</label>
                  <input
                    type="number"
                    className="setup-input small"
                    value={config.retentionDays}
                    onChange={(e) => update('retentionDays', Number(e.target.value))}
                    min={-1}
                  />
                </div>
                <div>
                  <label className="field-label">Flush Interval (sec)</label>
                  <input
                    type="number"
                    className="setup-input small"
                    value={config.flushInterval}
                    onChange={(e) => update('flushInterval', Number(e.target.value))}
                    min={5}
                  />
                </div>
              </div>
              <label className="field-label" style={{ marginTop: 12 }}>Regulation Tags</label>
              <input
                type="text"
                className="setup-input"
                value={config.regulationTags}
                onChange={(e) => update('regulationTags', e.target.value)}
                placeholder="UAE_AI_LAW,GDPR"
              />
            </div>

            <div className="config-section">
              <h3>Classification (optional)</h3>
              <div className="field-row">
                <div>
                  <label className="field-label">Department</label>
                  <input
                    type="text"
                    className="setup-input"
                    value={config.deptTag}
                    onChange={(e) => update('deptTag', e.target.value)}
                    placeholder="e.g. engineering"
                  />
                </div>
                <div>
                  <label className="field-label">Project</label>
                  <input
                    type="text"
                    className="setup-input"
                    value={config.projectTag}
                    onChange={(e) => update('projectTag', e.target.value)}
                    placeholder="e.g. copilot-assist"
                  />
                </div>
              </div>
            </div>

            <div className="config-section">
              <h3>Node Identity</h3>
              <div className="field-row">
                <div>
                  <label className="field-label">Node ID</label>
                  <input
                    type="text"
                    className="setup-input"
                    value={config.nodeId}
                    onChange={(e) => update('nodeId', e.target.value)}
                    placeholder="hive-node-01"
                  />
                </div>
                <div>
                  <label className="field-label">Node Region</label>
                  <input
                    type="text"
                    className="setup-input small"
                    value={config.nodeRegion}
                    onChange={(e) => update('nodeRegion', e.target.value.toUpperCase())}
                    placeholder="AE"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button className="btn" onClick={() => setStep(1)}>&larr; Back</button>
            <button className="btn primary" onClick={() => { void saveConfig(); setStep(3) }}>
              Save &amp; Activate &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Activate ─────────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <div className="step-title">
            <h2>HIVE is Ready</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              Your configuration has been saved to the HIVE vault. No .env files needed.
            </p>
          </div>

          {/* Save status */}
          <div className={`status-bar ${saveStatus === 'saved' ? 'ok' : saveStatus === 'error' ? 'waiting' : 'waiting'}`}>
            <span className="dot" />
            {saveStatus === 'saving' && 'Saving configuration to vault...'}
            {saveStatus === 'saved' && 'Configuration saved successfully to .hive/config.json'}
            {saveStatus === 'error' && 'Failed to save — is the Node server running?'}
            {saveStatus === 'idle' && 'Configuration saved.'}
          </div>

          {/* Summary */}
          <div className="config-section" style={{ marginTop: 16 }}>
            <h3>Your HIVE Configuration</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 14 }}>
              <div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>Deployment</div>
                <strong>{config.deployment === 'solo' ? 'Solo (local)' : 'Node (org hub)'}</strong>
              </div>
              <div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>Region</div>
                <strong>{config.region}</strong>
              </div>
              <div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>Connectors</div>
                <strong>{config.connectors.join(', ')}</strong>
              </div>
              <div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>Retention</div>
                <strong>{config.retentionDays} days</strong>
              </div>
              <div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>Regulation</div>
                <strong>{config.regulationTags}</strong>
              </div>
              <div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>Flush Interval</div>
                <strong>{config.flushInterval}s</strong>
              </div>
            </div>
          </div>

          {/* Quick start */}
          <div className="launch-steps" style={{ marginTop: 24 }}>
            <div className="launch-step">
              <div className="launch-num">1</div>
              <div className="launch-body">
                <h3>Start the Scout</h3>
                <p>
                  The Scout reads its config from the vault automatically.
                  Just run this one command:
                </p>
                <div className="code-block">
                  <button
                    className="copy-btn"
                    onClick={() => navigator.clipboard?.writeText('npx @hive/scout start')}
                    title="Copy"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                  <pre>npx @hive/scout start</pre>
                </div>
              </div>
            </div>

            <div className="launch-step">
              <div className="launch-num">2</div>
              <div className="launch-body">
                <h3>Use AI Normally</h3>
                <p>
                  The Scout intercepts <code>fetch()</code> transparently.
                  Use Claude, Ollama, OpenAI — anything you enabled.
                  HIVE captures <strong>metadata only</strong>: bytes, latency, tokens, provider.
                </p>
                <p>
                  <strong style={{ color: '#34c759' }}>Zero prompts. Zero completions. Zero content. Ever.</strong>
                </p>
              </div>
            </div>

            <div className="launch-step">
              <div className="launch-num">3</div>
              <div className="launch-body">
                <h3>See Your Dashboard</h3>
                <p>
                  Events will appear in real-time on the dashboard. Filter by provider,
                  time range, direction, and more.
                </p>
              </div>
            </div>
          </div>

          {/* Docker option */}
          <div className="card" style={{ marginTop: 24, padding: 24 }}>
            <h3 style={{ margin: '0 0 8px' }}>Or: Docker Compose (Full Stack)</h3>
            <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 12px' }}>
              Run the entire HIVE stack with one command:
            </p>
            <div className="code-block">
              <pre>docker compose up --build</pre>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: '8px 0 0' }}>
              Includes: Node Server + Dashboard + TimescaleDB + Redis + Ollama
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button className="btn" onClick={() => setStep(2)}>&larr; Back</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => void saveConfig()}>
                {saveStatus === 'saving' ? 'Saving...' : 'Re-save Config'}
              </button>
              <a href="/" className="btn primary">
                Open Dashboard &rarr;
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
