/**
 * site-audit.mjs — checks the BUILT site (./dist) for the launch checklist:
 * broken internal links, images without alt text or sizes, missing titles and descriptions,
 * third-party resources, page weight and large files. Reads files only; changes nothing.
 *
 * Usage: npm run build && node scripts/site-audit.mjs
 * Exit code 1 when a broken link, a missing alt/title/description or a third-party resource is found.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const DIST = 'dist';
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(DIST);
const pages = files.filter((f) => f.endsWith('.html'));
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const url = (f) => '/' + relative(DIST, f).replace(/\\/g, '/').replace(/index\.html$/, '').replace(/\.html$/, '');

/** Does an internal path resolve to a file in dist? */
function resolves(path) {
  const clean = decodeURIComponent(path.split('#')[0].split('?')[0]).replace(/\/+$/, '');
  if (!clean || clean === '/') return true;
  if (clean.startsWith('/api/')) return true; // served by the Worker
  const base = join(DIST, clean);
  return [base, `${base}.html`, join(base, 'index.html')].some((p) => existsSync(p) && statSync(p).isFile());
}

const problems = [];
const external = new Map();
const weights = [];
for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const page = url(file);
  // Scripts and JSON blocks are not markup: drop them before looking for tags.
  const markup = html.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, '');
  if (!/<title>[^<]{5,}<\/title>/.test(html)) problems.push(`${page}: no <title>`);
  if (!/<meta name="description" content="[^"]{20,}"/.test(html)) problems.push(`${page}: no meta description`);
  if (!/<html[^>]* lang=/.test(html)) problems.push(`${page}: <html> has no lang`);
  for (const m of markup.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    if (!/\balt="/.test(tag)) problems.push(`${page}: image without alt: ${tag.slice(0, 90)}`);
    if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag)) problems.push(`${page}: image without width/height: ${tag.slice(0, 90)}`);
  }
  for (const m of markup.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const ref = m[1];
    if (/^(mailto:|tel:|data:|blob:|#|javascript:)/.test(ref)) continue;
    if (/^https?:\/\//.test(ref)) {
      const host = new URL(ref).host;
      if (host !== 'beatmy11.com' && host !== 'www.beatmy11.com') external.set(ref, (external.get(ref) ?? 0) + 1);
      else if (!resolves(new URL(ref).pathname)) problems.push(`${page}: broken link ${ref}`);
      continue;
    }
    if (ref.startsWith('/') && !resolves(ref)) problems.push(`${page}: broken link ${ref}`);
  }
  // Third-party resources actually loaded by the page (scripts, styles, images, frames).
  for (const m of html.matchAll(/<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)="(https?:\/\/[^"]+)"[^>]*>/g)) {
    const host = new URL(m[1]).host;
    const isLoad = !/rel="(canonical|alternate)"/.test(m[0]) && !/<a\b/.test(m[0]);
    if (isLoad && host !== 'beatmy11.com' && host !== 'www.beatmy11.com' && !/rel="(canonical|sitemap)"/.test(m[0])) problems.push(`${page}: loads third-party resource ${m[1]}`);
  }
  // Page weight: the HTML plus the scripts and stylesheets it references.
  const assets = [...html.matchAll(/\b(?:href|src)="(\/_astro\/[^"]+)"/g)].map((m) => m[1]);
  const total = statSync(file).size + [...new Set(assets)].reduce((s, a) => s + (existsSync(join(DIST, a)) ? statSync(join(DIST, a)).size : 0), 0);
  weights.push({ page, html: statSync(file).size, total });
}

console.log(`pages: ${pages.length}`);
console.log(`\nheaviest pages (HTML + referenced /_astro files, uncompressed):`);
for (const w of weights.sort((a, b) => b.total - a.total).slice(0, 8)) console.log(`  ${w.page.padEnd(28)} html ${kb(w.html).padStart(10)}  total ${kb(w.total).padStart(10)}`);
console.log(`\nlargest files in dist:`);
for (const f of files.map((f) => ({ f, s: statSync(f).size })).sort((a, b) => b.s - a.s).slice(0, 10)) console.log(`  ${kb(f.s).padStart(10)}  ${relative(DIST, f.f).replace(/\\/g, '/')}`);
const images = files.filter((f) => ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.avif', '.gif'].includes(extname(f).toLowerCase()));
console.log(`\nimages: ${images.length}, total ${kb(images.reduce((s, f) => s + statSync(f).size, 0))}, largest ${kb(Math.max(...images.map((f) => statSync(f).size)))}`);
console.log(`\nlinks to other sites (${external.size}):`);
for (const [ref, n] of external) console.log(`  ${n}x ${ref}`);
console.log(`\nproblems: ${problems.length}`);
for (const p of problems) console.log(`  ${p}`);
process.exit(problems.length ? 1 : 0);
