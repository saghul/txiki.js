import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'txiki.js',
  tagline: 'The tiny JavaScript runtime',
  favicon: 'img/favicon.png',

  future: {
    v4: true,
  },

  url: 'https://txikijs.org',
  baseUrl: '/',

  organizationName: 'saghul',
  projectName: 'txiki.js',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/saghul/txiki.js/tree/master/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/logo-heartonly.png',
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'txiki.js',
      logo: {
        alt: 'txiki.js',
        src: 'img/logo-heartonly-32.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'apiSidebar',
          position: 'left',
          label: 'API',
        },
        {
          href: 'https://github.com/saghul/txiki.js',
          position: 'right',
          className: 'header-github-link',
          'aria-label': 'GitHub repository',
        },
      ],
    },
    algolia: {
      appId: 'MK980B6DQ4',
      apiKey: 'fc3c320f8ce2f39489a9aec68e3960df',
      indexName: 'Txiki Crawler',
    },
    footer: undefined,
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'powershell', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
