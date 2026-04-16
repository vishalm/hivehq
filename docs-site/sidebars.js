/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/quickstart',
        'getting-started/docker',
        'getting-started/configuration',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        'architecture/ttp-protocol',
        'architecture/governance',
        'architecture/data-model',
      ],
    },
    {
      type: 'category',
      label: 'Connectors',
      items: [
        'connectors/overview',
        'connectors/ollama',
        'connectors/openai',
        'connectors/anthropic',
        'connectors/custom',
      ],
    },
    {
      type: 'category',
      label: 'Dashboard',
      items: [
        'dashboard/overview',
        'dashboard/intelligence',
        'dashboard/notifications',
        'dashboard/chat-widget',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/ingest',
        'api/events',
        'api/intelligence',
        'api/config',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'deployment/modes',
        'deployment/docker-compose',
        'deployment/production',
      ],
    },
    'contributing',
  ],
};

module.exports = sidebars;
