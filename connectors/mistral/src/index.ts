import { FetchHook, type HATPCollector } from '@hive/connector'

export interface MistralConnectorOptions {
  collector: HATPCollector
  defaultModelHint?: string
}

export class MistralConnector extends FetchHook {
  constructor(opts: MistralConnectorOptions) {
    super(
      {
        provider: 'mistral',
        label: 'Mistral AI',
        matches: (url) => url.includes('api.mistral.ai'),
        modelFromResponse: (res) =>
          res.headers.get('mistral-model') ?? res.headers.get('x-model'),
      },
      opts.collector,
      { defaultModelHint: opts.defaultModelHint },
    )
  }
}
