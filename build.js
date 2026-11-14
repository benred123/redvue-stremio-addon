// REDVUE static catalog generator. Run: node build.js
const fs = require('node:fs');
const path = require('node:path');
const catalogs = require('./catalogs');
const output = path.join(__dirname, 'docs');
const site = (process.env.REDVUE_SITE_URL || 'https://benred123.github.io/redvue-stremio-addon').replace(/\/+$/, '');
const put = (filename, value) => {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
};
const keys = new Set();
for (const catalog of catalogs) {
  if (!['movie', 'series'].includes(catalog.type) || !/^[a-z0-9-]+$/.test(catalog.id)) throw Error('Invalid catalog: ' + catalog.id);
  const key = catalog.type + '/' + catalog.id;
  if (keys.has(key)) throw Error('Duplicate catalog ' + key);
  keys.add(key);
  const metas = catalog.titles.map(([id, name]) => {
    if (!/^tt\d+$/.test(id) || !name) throw Error('Invalid title ' + id);
    return { id, type: catalog.type, name, poster: 'https://images.metahub.space/poster/medium/' + id + '/img' };
  });
  put(path.join(output, 'catalog', catalog.type, catalog.id + '.json'), { metas });
}
const manifest = {
  id: 'com.redvue.curated-catalogs', version: '1.0.0', name: 'REDVUE',
  description: 'Premium curated movie and series collections for Stremio. Catalogs only; no streams provided.',
  logo: site + '/assets/redvue-mark.png',
  resources: ['catalog'], types: ['movie', 'series'],
  catalogs: catalogs.map(({ id, type, name }) => ({ id, type, name })),
};
put(path.join(output, 'manifest.json'), manifest);
console.log('REDVUE: ' + catalogs.length + ' catalogs built.');
