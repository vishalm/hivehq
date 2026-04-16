/**
 * @hive/connector-openai — drop-in OpenAI SDK wrapper.
 *
 * Usage:
 *   import { OpenAIConnector } from '@hive/connector-openai'
 *   const connector = new OpenAIConnector({ collector, apiKey: process.env.OPENAI_API_KEY })
 *   const response = await connector.client.chat.completions.create({ ... })
 *
 * Philosophy:
 *   - Never reads prompt or completion content.
 *   - Only observes request-size, latency, status, model hint from headers.
 *   - Emits one HiveConnectorEvent per request+response pair.
 */

export { OpenAIConnector } from './connector.js'
export type { OpenAIConnectorOptions } from './connector.js'
