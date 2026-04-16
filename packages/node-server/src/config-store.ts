/**
 * ConfigStore — Persistent configuration storage for HIVE.
 *
 * Replaces .env files entirely. All config is managed via the Setup UI
 * and stored encrypted in the vault directory. The Node server and Scout
 * read config from here at startup and on hot-reload.
 *
 * Phase 1: JSON file storage (config.json in vault dir)
 * Phase 2: Encrypted at rest via @hive/vault keyring
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

export interface HiveConfig {
  /** Last updated timestamp */
  updatedAt: number

  /** Scout configuration */
  scout: {
    deployment: 'solo' | 'node' | 'federated' | 'open'
    connectors: string[]
    dataResidency: string
    retentionDays: number
    regulationTags: string[]
    flushIntervalMs: number
    deptTag?: string
    projectTag?: string
    ollamaHost?: string
    nodeRegion?: string
  }

  /** Node server configuration */
  node: {
    port: number
    region: string
    nodeId: string
    ingestToken?: string
  }

  /** Dashboard configuration */
  dashboard: {
    port: number
    nodeUrl: string
  }

  /** Provider-specific config (no secrets — those go to vault) */
  providers: Record<string, {
    enabled: boolean
    hosts?: string[]
    customLabel?: string
  }>
}

const DEFAULT_CONFIG: HiveConfig = {
  updatedAt: Date.now(),
  scout: {
    deployment: 'solo',
    connectors: ['anthropic', 'ollama'],
    dataResidency: 'AE',
    retentionDays: 90,
    regulationTags: ['UAE_AI_LAW', 'GDPR'],
    flushIntervalMs: 60_000,
    ollamaHost: 'localhost:11434',
  },
  node: {
    port: 3000,
    region: 'AE',
    nodeId: 'hive-node-01',
  },
  dashboard: {
    port: 3001,
    nodeUrl: 'http://localhost:3000',
  },
  providers: {
    anthropic: { enabled: true },
    ollama: { enabled: true, hosts: ['localhost:11434'] },
    openai: { enabled: false },
    google: { enabled: false },
    mistral: { enabled: false },
    azure_openai: { enabled: false },
    bedrock: { enabled: false },
  },
}

export class ConfigStore {
  private config: HiveConfig
  private readonly configPath: string

  constructor(vaultDir?: string) {
    const dir = vaultDir ?? join(process.cwd(), '.hive')
    this.configPath = join(dir, 'config.json')
    this.config = { ...DEFAULT_CONFIG }
  }

  /** Load config from disk. Falls back to defaults. */
  async load(): Promise<HiveConfig> {
    try {
      if (existsSync(this.configPath)) {
        const raw = await readFile(this.configPath, 'utf-8')
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
      }
    } catch {
      // Fall back to defaults
    }
    return this.config
  }

  /** Save config to disk. */
  async save(config: Partial<HiveConfig>): Promise<HiveConfig> {
    this.config = {
      ...this.config,
      ...config,
      updatedAt: Date.now(),
    }
    const dir = this.configPath.replace(/\/[^/]+$/, '')
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
    await writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
    return this.config
  }

  /** Get current config (in-memory). */
  get(): HiveConfig {
    return this.config
  }

  /** Get default config. */
  static defaults(): HiveConfig {
    return { ...DEFAULT_CONFIG }
  }
}
