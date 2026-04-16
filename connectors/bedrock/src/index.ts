import { FetchHook, type TTPCollector } from '@hive/connector'

export interface BedrockConnectorOptions {
  collector: TTPCollector
  defaultModelHint?: string
}

/**
 * AWS Bedrock connector. Matches bedrock-runtime.*.amazonaws.com.
 * Bedrock encodes the model ID in the URL path (/model/<id>/invoke),
 * so we extract it when the header isn't populated.
 */
export class BedrockConnector extends FetchHook {
  constructor(opts: BedrockConnectorOptions) {
    super(
      {
        provider: 'bedrock',
        label: 'AWS Bedrock',
        matches: (url) =>
          url.includes('bedrock-runtime.') && url.includes('.amazonaws.com'),
        endpoint: (url) => {
          try {
            return new URL(url).pathname
          } catch {
            return url.slice(0, 128)
          }
        },
        modelFromResponse: (res) =>
          res.headers.get('x-amzn-bedrock-model') ??
          res.headers.get('x-amz-bedrock-model'),
      },
      opts.collector,
      { defaultModelHint: opts.defaultModelHint },
    )
  }
}
