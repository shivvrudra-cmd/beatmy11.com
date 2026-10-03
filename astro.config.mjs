import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://beatmy11.com',
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      filter: (page) => !page.includes('/404') && !page.includes('/matchup') && !page.includes('/share-demo') && !page.includes('/daily-board') && !page.includes('/r/'),
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  // The dev toolbar overlays the bottom of the page and swallows clicks on
  // the XI dock in browser tests; playwright.config.ts sets BM11_E2E.
  devToolbar: { enabled: !process.env.BM11_E2E },
  compressHTML: true,
  prefetch: {
    prefetchAll: true,
  },
});
