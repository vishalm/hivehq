import { FetchHook, type TTPCollector } from '@hive/connector'

export interface AzureOpenAIConnectorOptions {
  collector: TTPCollector
  defaultModelHint?: string
}

/**
 * Azure OpenAI connector. Matches any *.openai.azure.com endpoint.
 * Azure deployment name is often richer than the upstream model — we
 * read `azureml-model-deployment` first, then fall back to `openai-model`.
 */
export class AzureOpenAIConnector extends FetchHook {
  constructor(opts: AzureOpenAIConnectorOptions) {
    super(
      {
        provider: 'azure_openai',
        label: 'Azure OpenAI',
        matches: (url) => url.includes('.openai.azure.com'),
        modelFromResponse: (res) =>
          res.headers.get('azureml-model-deployment') ??
          res.headers.get('openai-model') ??
          res.headers.get('x-ms-deployment'),
      },
      opts.collector,
      { defaultModelHint: opts.defaultModelHint },
    )
  }
}
