// @ts-check
/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'HIVE Documentation',
  tagline: 'Token Economy. Token Governance. Zero Content. Full Visibility.',
  favicon: 'img/favicon.svg',
  url: 'https://docs.hivehq.dev',
  baseUrl: '/',
  organizationName: 'hivehq',
  projectName: 'hive',
  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: true,
        respectPrefersColorScheme: false,
      },
      navbar: {
        title: 'HIVE',
        items: [
          { type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Documentation' },
          { href: 'https://github.com/vishalm/hivehq', label: 'GitHub', position: 'right' },
        ],
      },
      footer: {
        style: 'dark',
        copyright: `HIVE - The Global AI Consumption Network. Token Economy. Token Governance.`,
      },
      prism: {
        theme: require('prism-react-renderer').themes.vsDark,
        additionalLanguages: ['bash', 'json', 'typescript', 'yaml', 'docker'],
      },
    }),
};

module.exports = config;
