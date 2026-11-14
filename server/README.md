# REDVUE 24/7 Server — preparation and deployment

We are using **ErsatzTV Legacy** for its graphical web-based library,
schedule and channel management, and because it can run natively on
Windows for testing before deploying as a Linux Docker container.

## Tonight: prepare your media on Windows

Create folders by opening PowerShell and running:

```powershell
New-Item -ItemType Directory -Force -Path "C:\REDVUE\Media\Shows\The Simpsons\Season 01","C:\REDVUE\Media\Shows\Family Guy\Season 01","C:\REDVUE\Media\Shows\South Park\Season 01","C:\REDVUE\Media\Shows\Viva La Bam\Season 01","C:\REDVUE\Media\Music Videos\MTV Chaos","C:\REDVUE\Media\Other Videos\CKY Era","C:\REDVUE\Media\Movies","C:\REDVUE\Media\Test Videos"
```

Or download and run `prepare-media.ps1` locally.

ErsatzTV expects show folders and season folders, e.g.
`Shows/The Simpsons/Season 01/The Simpsons - S01E01.mkv`.
Copy media files that you are authorised to store and stream.
Do **not** upload actual media files into the public REDVUE GitHub repo.

For a temporary Windows test, follow the official Windows install guide:
https://ersatztv.org/docs/installation/windows/

The native Windows release comes with its own FFmpeg and FFprobe.
The classic UI normally listens at `http://localhost:8409`.
Add library paths in `Media Sources > Local`.

**Do not run ErsatzTV in Docker Desktop on Windows.**
The project does not support that installation method.

## Beelink: planned Linux deployment

After checking the Beelink's included SSD and installing Ubuntu Server
and Docker, prepare the following on the Beelink:

```bash
sudo mkdir -p /srv/redvue/{config,media}
sudo chown -R "$USER:$USER" /srv/redvue
cd /srv/redvue
# Copy this compose.yaml file here, and transfer media under ./media.
docker compose up -d
```

Your video library inside the container is **/media**, e.g.
`/media/Shows/The Simpsons/Season 01`. Do not use Windows `C:\`
paths in Linux. If a Windows instance had already imported the files,
it may be simpler to recreate its libraries and schedules after transfer,
because host filesystem paths are different.

Default management UI: `http://BEELINK-LAN-IP:8409`.
Do not port-forward port 8409 to the public internet. Use Tailscale
for remote administration and verify hardware acceleration only after
`/dev/dri` exists and ErsatzTV's encoder diagnostics pass.

### Sources

- https://ersatztv.org/docs/installation/windows/
- https://ersatztv.org/docs/installation/docker/
- https://ersatztv.org/docs/media/local/shows/
- https://ersatztv.org/docs/media/local/
