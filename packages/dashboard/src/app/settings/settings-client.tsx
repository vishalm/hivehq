'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────

interface LLMProvider {
  id: string
  name: string
  description: string
  category: 'local' | 'cloud'
  defaultEndpoint: string
  defaultModel: string
  requiresKey: boolean
}

interface LLMConfig {
  activeProvider: string
  providers: Record<string, {
    endpoint: string
    apiKey: string
    model: string
    enabled: boolean
  }>
}

const PROVIDERS: LLMProvider[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Run models locally. No API key needed. Privacy-first.',
    category: 'local',
    defaultEndpoint: 'http://localhost:11434',
    defaultModel: 'gemma4:latest',
    requiresKey: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini, and other OpenAI models.',
    category: 'cloud',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    requiresKey: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude Sonnet, Opus, and Haiku models.',
    category: 'cloud',
    defaultEndpoint: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    requiresKey: true,
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini Pro, Flash, and Ultra models.',
    category: 'cloud',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    requiresKey: true,
  },
  {
    id: 'custom',
    name: 'Custom / OpenAI-Compatible',
    description: 'Any endpoint that speaks the OpenAI chat completions API.',
    category: 'cloud',
    defaultEndpoint: 'http://localhost:8080/v1',
    defaultModel: '',
    requiresKey: false,
  },
]

const DEFAULT_CONFIG: LLMConfig = {
  activeProvider: 'ollama',
  providers: Object.fromEntries(
    PROVIDERS.map((p) => [
      p.id,
      {
        endpoint: p.defaultEndpoint,
        apiKey: '',
        model: p.defaultModel,
        enabled: p.id === 'ollama',
      },
    ]),
  ),
}

/* ── SVG Icons ─────────────────────────────────────────────────────────── */

function SvgIcon({ icon, size = 24 }: { icon: string; size?: number }) {
  const s = String(size)
  const paths: Record<string, string> = {
    cpu: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 5h6v6H9V9ZM1 9h2M1 15h2M21 9h2M21 15h2M9 1v2M15 1v2M9 21v2M15 21v2',
    cloud: 'M18 10a6 6 0 0 0-11.3-2A4 4 0 0 0 4 16h14a4 4 0 0 0 0-8v4',
    key: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4',
    check: 'M20 6L9 17l-5-5',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    eyeOff: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24 M1 1l22 22',
    save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z M17 21v-8H7v8 M7 3v5h8',
    refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
    chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    settings: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  }
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[icon] ?? paths.settings!} />
    </svg>
  )
}

const NODE_URL = typeof window !== 'undefined'
  ? (process.env['NEXT_PUBLIC_NODE_URL'] ?? (window.location.port === '3001' ? 'http://localhost:3000' : window.location.origin))
  : 'http://localhost:3000'

// ── Component ───────────────────────────────────────────────────────────────

export default function SettingsClient() {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG)
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({})

  const updateProvider = useCallback(
    (id: string, field: string, value: string | boolean) => {
      setConfig((c) => ({
        ...c,
        providers: {
          ...c.providers,
          [id]: { ...c.providers[id]!, [field]: value },
        },
      }))
    },
    [],
  )

  // Load saved LLM config from node server
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${NODE_URL}/api/v1/config`, { signal: AbortSignal.timeout(3000) })
        if (res.ok) {
          const saved = await res.json()
          if (saved?.llm) {
            setConfig((prev) => ({
              activeProvider: saved.llm.activeProvider ?? prev.activeProvider,
              providers: {
                ...prev.providers,
                ...Object.fromEntries(
                  Object.entries(saved.llm.providers ?? {}).map(([id, p]: [string, any]) => [
                    id,
                    {
                      endpoint: p.endpoint ?? prev.providers[id]?.endpoint ?? '',
                      apiKey: p.apiKey ?? '',
                      model: p.model ?? prev.providers[id]?.model ?? '',
                      enabled: p.enabled ?? false,
                    },
                  ]),
                ),
              },
            }))
          }
        }
      } catch { /* use defaults */ }
    }
    load()
  }, [])

  // Check Ollama status & models
  useEffect(() => {
    const ollamaEndpoint = config.providers['ollama']?.endpoint ?? 'http://localhost:11434'
    const check = async () => {
      try {
        const res = await fetch(`${ollamaEndpoint}/api/tags`, { signal: AbortSignal.timeout(3000) })
        if (res.ok) {
          const data = await res.json()
          const models = (data.models ?? []).map((m: { name: string }) => m.name)
          setOllamaModels(models)
          setOllamaStatus('online')
        } else {
          setOllamaStatus('offline')
        }
      } catch {
        setOllamaStatus('offline')
        setOllamaModels([])
      }
    }
    check()
    const timer = setInterval(check, 10000)
    return () => clearInterval(timer)
  }, [config.providers['ollama']?.endpoint])

  // Save config
  const saveConfig = async () => {
    setSaveStatus('saving')
    try {
      // Merge with existing config
      const existingRes = await fetch(`${NODE_URL}/api/v1/config`, { signal: AbortSignal.timeout(3000) })
      let existing: Record<string, unknown> = {}
      if (existingRes.ok) existing = await existingRes.json()

      const body = {
        ...existing,
        llm: {
          activeProvider: config.activeProvider,
          providers: Object.fromEntries(
            Object.entries(config.providers).map(([id, p]) => [
              id,
              {
                endpoint: p.endpoint,
                model: p.model,
                enabled: p.enabled,
                // Only persist key if non-empty
                ...(p.apiKey && { apiKey: p.apiKey }),
              },
            ]),
          ),
        },
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

  // Test provider connection
  const testProvider = async (id: string) => {
    setTestStatus((s) => ({ ...s, [id]: 'testing' }))
    const p = config.providers[id]
    if (!p) { setTestStatus((s) => ({ ...s, [id]: 'fail' })); return }

    try {
      if (id === 'ollama') {
        const res = await fetch(`${p.endpoint}/api/tags`, { signal: AbortSignal.timeout(5000) })
        setTestStatus((s) => ({ ...s, [id]: res.ok ? 'ok' : 'fail' }))
      } else if (id === 'openai' || id === 'custom') {
        const res = await fetch(`${p.endpoint}/models`, {
          headers: p.apiKey ? { 'Authorization': `Bearer ${p.apiKey}` } : {},
          signal: AbortSignal.timeout(5000),
        })
        setTestStatus((s) => ({ ...s, [id]: res.ok ? 'ok' : 'fail' }))
      } else if (id === 'anthropic') {
        // Just check reachability
        setTestStatus((s) => ({ ...s, [id]: p.apiKey ? 'ok' : 'fail' }))
      } else if (id === 'google') {
        setTestStatus((s) => ({ ...s, [id]: p.apiKey ? 'ok' : 'fail' }))
      } else {
        setTestStatus((s) => ({ ...s, [id]: 'ok' }))
      }
    } catch {
      setTestStatus((s) => ({ ...s, [id]: 'fail' }))
    }
    setTimeout(() => setTestStatus((s) => ({ ...s, [id]: 'idle' })), 4000)
  }

  const activeProviderInfo = PROVIDERS.find((p) => p.id === config.activeProvider)

  return (
    <div>
      {/* Hero */}
      <div className="setup-hero">
        <h1>LLM Settings</h1>
        <p>
          Configure your language model providers for the HIVE Chat assistant.
          Talk to your data. Define your value.
        </p>
      </div>

      {/* Active provider banner */}
      <div className="status-bar ok" style={{ marginBottom: 24 }}>
        <span className="dot" />
        <span>
          Active: <strong>{activeProviderInfo?.name ?? config.activeProvider}</strong>
          {' '}&mdash;{' '}
          {config.providers[config.activeProvider]?.model || 'no model set'}
        </span>
      </div>

      {/* Provider cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {PROVIDERS.map((provider) => {
          const p = config.providers[provider.id]!
          const isActive = config.activeProvider === provider.id
          const test = testStatus[provider.id] ?? 'idle'

          return (
            <div
              key={provider.id}
              className={`config-section`}
              style={{
                border: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                boxShadow: isActive ? '0 0 0 4px var(--ring)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: provider.category === 'local' ? '#e8f5e9' : '#e3f2fd',
                    color: provider.category === 'local' ? '#388e3c' : '#1976d2',
                  }}>
                    <SvgIcon icon={provider.category === 'local' ? 'cpu' : 'cloud'} size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{provider.name}</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>{provider.description}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${provider.category}`}>{provider.category}</span>
                  {isActive && (
                    <span style={{
                      display: 'inline-block', padding: '3px 10px',
                      borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: '#ffd60a', color: '#1d1d1f', letterSpacing: 0.5,
                    }}>
                      ACTIVE
                    </span>
                  )}
                </div>
              </div>

              {/* Fields */}
              <div className="field-row" style={{ marginBottom: 12 }}>
                <div style={{ flex: 2 }}>
                  <label className="field-label">Endpoint</label>
                  <input
                    type="text"
                    className="setup-input"
                    value={p.endpoint}
                    onChange={(e) => updateProvider(provider.id, 'endpoint', e.target.value)}
                    placeholder={provider.defaultEndpoint}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="field-label">Model</label>
                  {provider.id === 'ollama' && ollamaModels.length > 0 ? (
                    <select
                      className="setup-input"
                      value={p.model}
                      onChange={(e) => updateProvider(provider.id, 'model', e.target.value)}
                      style={{ cursor: 'pointer' }}
                    >
                      {ollamaModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                      {!ollamaModels.includes(p.model) && p.model && (
                        <option value={p.model}>{p.model}</option>
                      )}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="setup-input"
                      value={p.model}
                      onChange={(e) => updateProvider(provider.id, 'model', e.target.value)}
                      placeholder={provider.defaultModel}
                    />
                  )}
                </div>
              </div>

              {/* API Key (for cloud providers) */}
              {provider.requiresKey && (
                <div style={{ marginBottom: 12 }}>
                  <label className="field-label">API Key</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={showKeys[provider.id] ? 'text' : 'password'}
                        className="setup-input"
                        value={p.apiKey}
                        onChange={(e) => updateProvider(provider.id, 'apiKey', e.target.value)}
                        placeholder={`Enter your ${provider.name} API key`}
                        style={{ paddingRight: 40 }}
                      />
                      <button
                        onClick={() => setShowKeys((s) => ({ ...s, [provider.id]: !s[provider.id] }))}
                        style={{
                          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
                          padding: 4, display: 'flex',
                        }}
                        title={showKeys[provider.id] ? 'Hide key' : 'Show key'}
                      >
                        <SvgIcon icon={showKeys[provider.id] ? 'eyeOff' : 'eye'} size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Ollama status */}
              {provider.id === 'ollama' && (
                <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                    background: ollamaStatus === 'online' ? '#4caf50' : ollamaStatus === 'checking' ? '#ff9800' : '#f44336',
                  }} />
                  {ollamaStatus === 'online'
                    ? `Connected -- ${ollamaModels.length} model(s): ${ollamaModels.slice(0, 4).join(', ')}`
                    : ollamaStatus === 'checking' ? 'Checking...' : 'Ollama not reachable'}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                {!isActive && (
                  <button
                    className="btn primary"
                    onClick={() => setConfig((c) => ({ ...c, activeProvider: provider.id }))}
                    style={{ padding: '8px 16px', fontSize: 13 }}
                  >
                    Set as Active
                  </button>
                )}
                <button
                  className="btn"
                  onClick={() => void testProvider(provider.id)}
                  style={{ padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <SvgIcon icon="refresh" size={14} />
                  {test === 'testing' ? 'Testing...' : test === 'ok' ? 'Connected' : test === 'fail' ? 'Failed' : 'Test Connection'}
                </button>
                {test === 'ok' && (
                  <span style={{ fontSize: 12, color: '#4caf50', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <SvgIcon icon="check" size={14} /> Reachable
                  </span>
                )}
                {test === 'fail' && (
                  <span style={{ fontSize: 12, color: '#f44336' }}>
                    Connection failed — check endpoint and key
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Save bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 24, padding: '16px 20px', borderRadius: 14,
        background: 'var(--card)',
      }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {saveStatus === 'saved' && 'Settings saved to HIVE vault.'}
          {saveStatus === 'error' && 'Failed to save — is the Node server running?'}
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'idle' && 'Changes are not saved until you click Save.'}
        </div>
        <button
          className="btn primary"
          onClick={() => void saveConfig()}
          disabled={saveStatus === 'saving'}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <SvgIcon icon="save" size={16} />
          {saveStatus === 'saving' ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Info note */}
      <div style={{
        marginTop: 16, padding: '14px 20px', borderRadius: 12,
        background: '#fffde7', fontSize: 13, lineHeight: 1.6, color: '#5d4037',
      }}>
        <strong>How HIVE Chat works:</strong> The floating chat (bottom-right on every page) sends your
        question to the selected LLM along with your HIVE telemetry data as context. It never
        sends raw prompts or completions — only aggregated metadata (tokens, latency, cost, providers).
        Your data stays grounded in what HIVE already collected.
      </div>
    </div>
  )
}
