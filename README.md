# REDVUE — Stremio catalog add-on

**Everything worth watching.**

Five curated movie and TV shelves (50 titles) in your existing Stremio interface. No playback streams supplied. Lists are hand-picked and not updated automatically.

## Install on a Fire Stick / Android TV

1. In this repository, go to **Settings > Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, **main**, **/docs**, and click **Save**.
3. Once GitHub Pages is published, open: `https://benred123.github.io/redvue-stremio-addon/manifest.json`.
4. In Stremio on your computer or at https://web.stremio.com, sign in to the **same account** as your TV, open **Add-ons**, and paste that complete manifest URL into the add-on installation field.
5. Install REDVUE, then restart Stremio on the TV if the new rows have not appeared. Their positions depend on Stremio and existing add-ons.

You can also visit https://benred123.github.io/redvue-stremio-addon/ for a branded landing page.

## Change the titles

Edit `catalogs.js` using IMDb IDs and labels. With Node.js 18+ installed, run:

```sh
node build.js
```

Commit the regenerated `docs/` files to publish changes. For local testing, run `node preview.js` and visit http://127.0.0.1:7107/manifest.json.

Note: GitHub Pages and this repository are public. Don't put API keys or personal information in the code.

Built using Stremio's [add-on protocol](https://stremio.github.io/stremio-addon-sdk/protocol.html) and [static example](https://github.com/Stremio/stremio-static-addon-example).
