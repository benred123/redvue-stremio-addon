# REDVUE Live TV — Full-Screen Guide Integration Plan

**Decision:** The latest user preference is a **separate full-screen traditional
television guide inside the REDVUE Fire TV app**. Do not put live-channel rows
on the Netflix-style discovery homepage in v1. No separate television viewing
app should be required when the integration is complete.

**Status:** Design only. No working Live TV guide, backend bridge, or native
stream player is implemented yet. Beelink delivery and media ingestion are
prerequisites for end-to-end testing.

## 1. Responsibilities

| Component | Responsibility |
| --- | --- |
| Beelink ME Mini (Intel N95, 12GB RAM, seller-advertised 1TB SSD) | 24/7 host on wired LAN |
| ErsatzTV Legacy, Docker | Media scans, collections, schedules, playouts, streaming, channel playlist and electronic programme guide |
| REDVUE Live bridge (to build) | Read ErsatzTV's M3U and XMLTV feeds and transform them into a safe JSON EPG API |
| REDVUE Android TV / Fire TV app (to update) | Dedicated guide screen, D-pad focus, stream playback, errors, Back to guide |
| Existing REDVUE catalog site | Remains the movies/series experience; Stremio still handles on-demand detail links |

Do not put the media itself or the Beelink's private network addresses in
this public GitHub repository. Configuration that varies by household belongs
in local files on the server, not in hardcoded source.

## 2. Data flow

```text
Beelink: episodes / directly playable remote media
          |
          v
ErsatzTV Legacy :8409 [schedule + stream output]
       |                     |
       | M3U and XMLTV      | HLS / MPEG-TS channel stream
       v                     |
REDVUE Live bridge :8787     |
 - parses M3U and XMLTV      |
 - normalizes channels       |
 - cache + status            |
 - serves EPG JSON           |
       |                     |
       v                     v
REDVUE Fire TV guide --> native Android player (Media3 / ExoPlayer)
        |
        +--> Back: guide --> REDVUE Home
```

ErsatzTV's UI exposes the M3U and XMLTV URLs in its top-right corner;
**copy the actual URLs from the installed instance** rather than assuming
their paths. ErsatzTV Legacy's documented default port is 8409. The bridge
must match channel identity using the `tvg-id` / XMLTV channel ID; channel
number alone may not be sufficient.

## 3. Television UX

On the existing REDVUE home navigation add a single **LIVE TV** action
that opens a **full-screen EPG** (not a homepage channel rail).

- Left side: channel number, logo, name.
- Top: horizontal current-time timeline, with a prominent NOW marker.
- Grid: programme blocks with start/end, title, live progress.
- Up/Down: previous/next channel.
- Left/Right: earlier/later programme in the same channel.
- OK: tune into the *currently airing* channel via REDVUE native player;
  when a future programme is selected show programme details (not a
  misleading start-now action).
- Back from player: EPG at same channel/time.
- Back from EPG: REDVUE home.
- Guide auto-refresh: every ~60 seconds for Now/Next and periodically
  reload full XMLTV data, handling DST in `Europe/London`.
- Visible loading, offline, no-library, and no-programme states.
- Tuning feedback: spinner, timeout/retry and direct channel switch.
- Display can scale from the starter 4 channels to 20+ scheduled channels.

Initial planned channel names and numbers (content only where user has
suitable legally obtained playable media):

- 101 REDVUE MTV Chaos
- 102 REDVUE Simpsons
- 103 REDVUE Family Guy
- 104 REDVUE South Park

Use original REDVUE branding for our own channel identities. Series and
network logos/posters require appropriate rights.

## 4. REDVUE Live bridge: internal contract (planned)

The following are **proposed REDVUE endpoints**, not existing ErsatzTV routes:

- `GET /health` — application health and feed freshness (no secrets).
- `GET /api/channels` — number, name, tvgId, logo, group, playable URL
  validated against the configured ErsatzTV server.
- `GET /api/guide?start=ISO_TIMESTAMP&hours=6` — channel/time-matched EPG;
  `start` and `stop` parsed into UTC instants, render in UK local time.
- `GET /api/status` — channel count, guide timestamp, remote endpoint
  health; never return environment secrets.

Bridge responsibilities:

1. Fetch M3U and XMLTV using configured upstream URLs.
2. Parse XMLTV robustly, including timezone offsets and XML escapes.
3. Match playlist `tvg-id` with XMLTV `channel id`; retain channels
   with no EPG and label them "Schedule unavailable".
4. Protect against XML entity expansion, oversized feeds, malformed
   content and untrusted stream URLs. Do not proxy arbitrary target URLs.
5. Cache parsable feeds to avoid hammering ErsatzTV.
6. Reconcile new channels without requiring an app upgrade.
7. Keep all service and streaming ports private to the home LAN /
   authenticated Tailscale as appropriate.

## 5. Android TV integration (important)

Our existing REDVUE Android activity displays an HTTPS GitHub Pages WebView.
Android currently has `usesCleartextTraffic=false`. Simply fetching an
`http://192.168.x.y:8409` stream or XMLTV feed from that WebView is NOT a
reliable solution: HTTPS mixed-content rules, Android cleartext restrictions
and origin/CORS policies may block it.

Prefer a **native guide data client and Media3 ExoPlayer for playback**, and
render the EPG in a dedicated full-screen Activity/Fragment. If the guide
UI is implemented in a WebView, use a narrow, audited bridge or serve the
whole guide from one trusted local origin; do not globally allow arbitrary
mixed content or add an unrestricted JavaScript interface.

Local HTTP playback must be explicitly addressed in network-security
configuration; secure a narrowly scoped local network path, keep upstream
hosts allowlisted and do not accept arbitrary HTTP URLs from the guide.
If a user later wants away-from-home access, design it through Tailscale,
not public router port-forwarding.

The existing Stremio handoff for movies/series remains independent of REDVUE
Live's player. Live TV should not need to launch Stremio at all.

## 6. Media and performance

- Local show folders should follow ErsatzTV's `Shows/Name/Season 01/Name -
  S01E01.ext` layout. No existing Stremio add-on automatically supplies
  ErsatzTV with a schedulable episode library.
- Start with one known playable/licensed test video on a single test channel
  (e.g. Blender Foundation open media) before loading a large collection.
- Test ErsatzTV's **HLS Direct** for compatible files (less CPU; may have
  awkward transitions). Test **HLS Segmenter** for more reliable programme
  boundaries, with transcoding and Intel acceleration measured empirically.
- Intel N95 is not an unlimited transcode engine. Scheduled channel count
  differs from simultaneous viewers/encoders. Test 1 stream, then 2, then
  more while observing CPU, temperatures, buffering and FFmpeg logs.
- Keep free SSD space for the OS, caches, temporary transcodes and updates.
- Configure Docker restart policy and test reboot/network outage recovery.

## 7. Implementation milestones and test gates

### Milestone A: Beelink and first channel
- Verify actual RAM and storage on arrival and wired Ethernet.
- Install and update Ubuntu Server, SSH and Docker.
- Deploy existing `server/compose.yaml` to `/srv/redvue`.
- Add a known playable test video, scan into ErsatzTV.
- Create Collection -> Channel -> Schedule -> Playout.
- Confirm playlist URL, guide URL and live stream play in a known
  working IPTV client (TiviMate/Kodi or VLC) on the LAN.
- **Exit gate:** 1 uninterrupted channel plays on Fire Stick and survives
  a Beelink restart.

### Milestone B: Guide API
- Implement and test XMLTV/M3U bridge on Beelink.
- Mock feeds for unit tests: zero channels, overlapping shows, XMLTV
  timezones, missing artwork, future programmes.
- **Exit gate:** `/api/channels` and `/api/guide` return correct JSON
  with real ErsatzTV data, local-only.

### Milestone C: REDVUE EPG screen
- Implement dedicated TV screen with fixed D-pad focus rules and
  horizontally scrolling time windows.
- Add offline and loading states and now-marker.
- **Exit gate:** 4 channels navigable via remote without controlling the
  on-demand homepage underneath.

### Milestone D: Native playback
- Integrate AndroidX Media3 / ExoPlayer HLS playback.
- Validate actual stream URLs/types, connection failures, subtitles and
  audio in Fire OS. Add in-guide channel switching.
- **Exit gate:** OK -> live programme; Back -> same EPG cell; Back -> Home.

### Milestone E: Growth and reliability
- Expand lineup to 10-20+ channels as media becomes available.
- Test RAM/CPU/Intel video acceleration, two simultaneous viewers,
  24-hour stability, automatic restart, backups and drive health.
- Keep private services LAN-only; add Tailscale if wanted.

## Key references (verified 2026-11-14)

- https://ersatztv.org/docs/installation/docker/
- https://ersatztv.org/docs/clients/
- https://ersatztv.org/docs/networking/
- https://ersatztv.org/docs/channels/
- https://ersatztv.org/docs/scheduling/playouts/
- https://ersatztv.org/docs/media/local/shows/
- https://developer.android.com/media/media3/exoplayer/hls
- https://developer.android.com/reference/android/webkit/WebSettings

This is an implementation design, not a declaration that the components
have been built or tested.
