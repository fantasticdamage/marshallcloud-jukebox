# MarshallCloud Jukebox

Milestone 1 foundation for a self-hosted Spotify/Home Assistant/Sonos party jukebox.

## What works in v0.1.0

- Mobile-friendly landing page
- Now-playing placeholder
- Spotify-search placeholder
- Queue placeholder
- Health endpoint at `/api/health`
- Docker deployment on port `3000`

Spotify OAuth and Home Assistant/Sonos control are intentionally left for the next milestones.

## Deploy from the Ubuntu Docker host

1. Copy this project folder to the Ubuntu server.
2. From inside the folder, run:

   ```bash
   docker compose up -d --build
   ```

3. Test locally:

   ```text
   http://192.168.1.73:3000
   ```

4. Your existing Nginx Proxy Manager host should forward:

   ```text
   jukebox.marshallcloud.net -> http://192.168.1.73:3000
   ```

5. Test:

   ```text
   https://jukebox.marshallcloud.net
   ```

## Stop or update

```bash
docker compose down
docker compose up -d --build
```

## Important security note

Do not commit `.env` or expose the Spotify client secret or Home Assistant token. The screenshot shared during setup exposed a Spotify secret, so rotate that secret before using it in this project.
