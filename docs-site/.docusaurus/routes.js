import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/',
    component: ComponentCreator('/', 'c40'),
    routes: [
      {
        path: '/',
        component: ComponentCreator('/', '83a'),
        routes: [
          {
            path: '/',
            component: ComponentCreator('/', '422'),
            routes: [
              {
                path: '/api/config',
                component: ComponentCreator('/api/config', '495'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/api/events',
                component: ComponentCreator('/api/events', 'd95'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/api/ingest',
                component: ComponentCreator('/api/ingest', 'd3d'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/api/intelligence',
                component: ComponentCreator('/api/intelligence', '0fe'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/architecture/data-model',
                component: ComponentCreator('/architecture/data-model', '4cf'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/architecture/governance',
                component: ComponentCreator('/architecture/governance', '80a'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/architecture/overview',
                component: ComponentCreator('/architecture/overview', 'f3c'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/architecture/ttp-protocol',
                component: ComponentCreator('/architecture/ttp-protocol', 'ad7'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/connectors/anthropic',
                component: ComponentCreator('/connectors/anthropic', 'd4a'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/connectors/custom',
                component: ComponentCreator('/connectors/custom', 'a7d'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/connectors/ollama',
                component: ComponentCreator('/connectors/ollama', '185'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/connectors/openai',
                component: ComponentCreator('/connectors/openai', '2a8'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/connectors/overview',
                component: ComponentCreator('/connectors/overview', 'd94'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/contributing',
                component: ComponentCreator('/contributing', '159'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dashboard/chat-widget',
                component: ComponentCreator('/dashboard/chat-widget', 'e7a'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dashboard/intelligence',
                component: ComponentCreator('/dashboard/intelligence', '8de'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dashboard/notifications',
                component: ComponentCreator('/dashboard/notifications', 'dd6'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dashboard/overview',
                component: ComponentCreator('/dashboard/overview', 'd62'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/deployment/docker-compose',
                component: ComponentCreator('/deployment/docker-compose', '015'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/deployment/modes',
                component: ComponentCreator('/deployment/modes', '54f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/deployment/production',
                component: ComponentCreator('/deployment/production', 'ecc'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/getting-started/configuration',
                component: ComponentCreator('/getting-started/configuration', '641'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/getting-started/docker',
                component: ComponentCreator('/getting-started/docker', '8ac'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/getting-started/quickstart',
                component: ComponentCreator('/getting-started/quickstart', 'c60'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/intro',
                component: ComponentCreator('/intro', '32d'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/roadmap/authentication',
                component: ComponentCreator('/roadmap/authentication', '1c2'),
                exact: true
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
