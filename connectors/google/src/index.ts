import { FetchHook, type HATPCollector } from '@hive/connector'

export interface GoogleConnectorOptions {
  collector: HATPCollector
  defaultModelHint?: string
}

/**
 * Google Gemini / Vertex AI connector.
 * Matches both generativelanguage.googleapis.com and *-aiplatform.googleapis.com.
 */
export class GoogleConnector extends FetchHook {
  constructor(opts: GoogleConnectorOptions) {
    super(
      {
        provider: 'google',
        label: 'Google Gemini / Vertex',
        matches: (url) =>
          url.includes('generativelanguage.googleapis.com') ||
          url.includes('aiplatform.googleapis.com'),
        modelFromResponse: (res) => res.headers.get('x-goog-model'),
      },
      opts.collector,
      { defaultModelHint: opts.defaultModelHint },
    )
  }
}
