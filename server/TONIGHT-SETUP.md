# REDVUE — Tonight's preparation checklist (14 November 2026)

**Purpose:** Get media and a test ErsatzTV channel ready on Windows before
the Beelink arrives tomorrow. The REDVUE Live TV guide remains a separate
future feature (see [REDVUE-LIVE-TV-PLAN.md](./REDVUE-LIVE-TV-PLAN.md)).

## On Windows tonight

1. Create the REDVUE media directories with
   [prepare-media.ps1](./prepare-media.ps1). Put authorised copies of
   episodes under `Shows/<Show>/Season 01/<Show> - S01E01.mp4`.
2. For a smoke test, add one H.264 + AAC MP4 you can legally stream to
   `C:\REDVUE\Media\Other Videos`. A 60-second original REDVUE test
   video is bundled in the downloadable conversation ZIP.
3. Download the **ErsatzTV Legacy Windows x64** release from
   https://github.com/ErsatzTV/legacy/releases/latest and extract it
   to `C:\REDVUE\ErsatzTV`.
4. Run `ErsatzTV-Windows.exe`. Open its management UI from the tray
   menu (normally `http://localhost:8409`).
5. In **Media Sources → Local**, edit **Other Videos**, add the path
   `C:\REDVUE\Media\Other Videos`, save and scan.
6. Find the test video in Search. Add it to a **manual Collection**
   named `REDVUE Test`.
7. Under **Channels** add `100 REDVUE Test`. Use **HLS Direct**
   initially if the source's codecs are compatible; HLS Segmenter is
   available as a transcoding option.
8. Under **Schedules** create `REDVUE Test Loop`, edit schedule items
   and select the `REDVUE Test` collection.
9. Under **Playouts** link the schedule to Channel 100. Verify its
   M3U and XMLTV URLs in the top-right of ErsatzTV.
10. Play the resulting stream in an IPTV-capable player such as VLC.
   A single 60-second clip repeated in a loop is a functional test,
   not a permanent programming library.

**Important:** Windows ErsatzTV config paths and Linux Docker paths
are different. Tomorrow we plan to import the same media and recreate
the channel schedule on Linux, rather than claim a one-click
cross-platform config migration.

## Prepare your Linux installer USB tonight

- Recommended mature base: **Ubuntu Server 24.04.5 LTS, amd64**,
  via https://ubuntu.com/download/server
- Flash the ISO using https://rufus.ie/ on an 8GB+ USB stick.
- Rufus **erases the selected USB drive**. Verify it is the correct one.
- **Do not install on your gaming PC.** Only boot the USB on the Beelink
  tomorrow after verifying its actual SSD, RAM and power adapter.
- Plan to enable OpenSSH, a stable router DHCP reservation, and Docker
  Engine with the Compose plugin.

## Beelink tomorrow

Our pinned server compose lives at [compose.yaml](./compose.yaml)
using official ErsatzTV Legacy `v26.12.0`:

```bash
sudo mkdir -p /srv/redvue/{config,media}
sudo chown -R "$USER:$USER" /srv/redvue
# Put compose.yaml in /srv/redvue.
# Transfer the CONTENTS of C:\REDVUE\Media into /srv/redvue/media.
cd /srv/redvue
docker compose up -d
```

Then open `http://BEELINK-LAN-IP:8409` from the Windows PC.
Inside ErsatzTV Linux paths must be **/media/Other Videos** and
**/media/Shows**, not a Windows `C:\` folder.

The first milestone is a single stable channel. Stremio integration,
the REDVUE fullscreen guide, and native live playback come after that.

## References

- [Official ErsatzTV Legacy Windows install](https://ersatztv.org/docs/installation/windows/)
- [Official ErsatzTV Legacy Docker install](https://ersatztv.org/docs/installation/docker/)
- [Local libraries](https://ersatztv.org/docs/media/local/)
- [Collections](https://ersatztv.org/docs/collections/)
- [Channels](https://ersatztv.org/docs/channels/)
- [Schedules](https://ersatztv.org/docs/scheduling/classic/)
- [Playouts](https://ersatztv.org/docs/scheduling/playouts/)
- [Ubuntu Server](https://ubuntu.com/download/server)
