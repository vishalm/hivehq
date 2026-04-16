const NODE_URL = process.env['DASHBOARD_NODE_URL'] ?? 'http://localhost:3000'

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

async function fetchConnectors(): Promise<Connector[]> {
  try {
    const res = await fetch(`${NODE_URL}/api/v1/connectors`, {
      cache: 'no-store',
    })
    if (!res.ok) return getDefaultConnectors()
    const data = await res.json()
    return data.connectors ?? getDefaultConnectors()
  } catch {
    return getDefaultConnectors()
  }
}

function getDefaultConnectors(): Connector[] {
  return [
    {
      id: 'anthropic',
      name: 'Claude (Anthropic)',
      provider: 'anthropic',
      description: 'Intercepts Anthropic Claude API calls — Messages, Completions, Embeddings.',
      icon: 'brain',
      hosts: ['api.anthropic.com'],
      envHint: 'ANTHROPIC_API_KEY',
      detectionMethod: 'fetch-intercept',
      status: 'available',
      category: 'cloud',
    },
    {
      id: 'ollama',
      name: 'Ollama (Local)',
      provider: 'ollama',
      description: 'Monitors local Ollama instance — Llama, CodeLlama, Mistral, Gemma, and all models.',
      icon: 'server',
      hosts: ['localhost:11434'],
      envHint: null,
      detectionMethod: 'fetch-intercept',
      status: 'available',
      category: 'local',
    },
    {
      id: 'openai',
      name: 'OpenAI',
      provider: 'openai',
      description: 'Captures OpenAI GPT-4, GPT-3.5, Embeddings, and DALL-E usage.',
      icon: 'zap',
      hosts: ['api.openai.com'],
      envHint: 'OPENAI_API_KEY',
      detectionMethod: 'fetch-intercept',
      status: 'available',
      category: 'cloud',
    },
    {
      id: 'google',
      name: 'Google Gemini',
      provider: 'google',
      description: 'Tracks Google Gemini Pro, Flash, and Vertex AI calls.',
      icon: 'globe',
      hosts: ['generativelanguage.googleapis.com'],
      envHint: 'GOOGLE_API_KEY',
      detectionMethod: 'fetch-intercept',
      status: 'available',
      category: 'cloud',
    },
    {
      id: 'mistral',
      name: 'Mistral AI',
      provider: 'mistral',
      description: 'Monitors Mistral Large, Small, and Codestral endpoints.',
      icon: 'wind',
      hosts: ['api.mistral.ai'],
      envHint: 'MISTRAL_API_KEY',
      detectionMethod: 'fetch-intercept',
      status: 'available',
      category: 'cloud',
    },
    {
      id: 'azure_openai',
      name: 'Azure OpenAI',
      provider: 'azure_openai',
      description: 'Captures Azure-hosted OpenAI endpoints and deployments.',
      icon: 'cloud',
      hosts: ['*.openai.azure.com'],
      envHint: 'AZURE_OPENAI_API_KEY',
      detectionMethod: 'fetch-intercept',
      status: 'available',
      category: 'cloud',
    },
    {
      id: 'bedrock',
      name: 'AWS Bedrock',
      provider: 'bedrock',
      description: 'Monitors Amazon Bedrock model invocations (Claude, Titan, Llama).',
      icon: 'database',
      hosts: ['*.bedrock-runtime.amazonaws.com'],
      envHint: 'AWS_ACCESS_KEY_ID',
      detectionMethod: 'fetch-intercept',
      status: 'available',
      category: 'cloud',
    },
  ]
}

import SetupClient from './setup-client'

export default async function SetupPage() {
  const connectors = await fetchConnectors()
  return (
    <div style={{ paddingBottom: 60 }}>
      <div className="setup-hero">
        <h1>HIVE Setup</h1>
        <p>
          Connect your AI providers in three steps. HIVE captures metadata
          only — zero content, zero prompts, zero completions.
        </p>
      </div>
      <SetupClient connectors={connectors} />
    </div>
  )
}
