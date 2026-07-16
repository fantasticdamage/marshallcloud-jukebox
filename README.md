# MarshallCloud Jukebox v0.5.0

This release adds secure Spotify Authorization Code authentication and live track search.

## Configure

Create a private `.env` file in the project directory:

```bash
cp .env.example .env
nano .env
```

Enter the rotated Spotify client ID and client secret. Never commit `.env`.

The Spotify app must include this exact redirect URI:

```text
https://jukebox.marshallcloud.net/auth/callback
```

## Deploy

```bash
docker compose down
docker compose up -d --build
```

Open:

```text
https://jukebox.marshallcloud.net
```

Select **Connect Spotify**, authorize the app, then search for tracks.

## Current scope

- Spotify OAuth and refresh-token persistence
- Live Spotify track search
- Album artwork, artist, duration, and explicit indicator
- Persistent Docker volume for the Spotify token
- Sonos/Home Assistant queue controls are the next milestone


## Live Sonos queue

This release adds:

- Live queue retrieval through `sonos.get_queue`
- Automatic refresh every 5 seconds
- Queue numbering
- Highlighting for the next track
- Empty and error states


## Queue metadata enrichment

- Spotify album artwork
- Track duration and explicit indicator
- Estimated wait time based on the current track and queued durations
- Automatic asset cache-busting for v0.4.2


## Guest requests

- Guests choose a display name stored in their browser.
- Requested songs show the guest name in the live queue.
- Duplicate tracks already present in the Sonos queue are rejected.
- Request metadata is stored in the persistent Docker data volume.
