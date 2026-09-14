import { readFileSync } from 'node:fs';

// Catch missing screenshots before a production archive can be created.
const sources = ['PublicSite.jsx', 'LandingHelp.jsx', 'LandingGallery.jsx'];
const names = new Set(sources.flatMap(file => [...readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8').matchAll(/['"]([a-z0-9-]+\.png)['"]/g)].map(match => match[1])));
for (const name of names) {
  const bytes = readFileSync(new URL(`../public/landing/${name}`, import.meta.url));
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Invalid landing screenshot: ${name}`);
}
console.log(`Validated ${names.size} landing screenshots.`);
