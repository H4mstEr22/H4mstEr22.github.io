// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { githubAlerts } from './src/lib/markdown-alerts.mjs';

export default defineConfig({
  site: 'https://h4mster22.github.io',
  integrations: [sitemap()],
  markdown: {
    processor: satteri({ hastPlugins: [githubAlerts] }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      wrap: false,
    },
  },
});
