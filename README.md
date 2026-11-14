# REDVUE — Stremio catalog add-on

Five curated movie and TV shelves for Stremio. Catalog-only: does not provide streams or change the app's interface.

## Hosting
Publish the `docs/` directory with GitHub Pages (`Settings > Pages > Deploy from a branch > main > /docs`). Install the resulting `https://benred123.github.io/redvue-stremio-addon/manifest.json` URL in Stremio.

Source lists live in `catalogs.js`, and `node build.js` generates `docs/`.
