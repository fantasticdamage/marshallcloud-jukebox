# MarshallCloud Jukebox v0.4.0

Adds a live Home Assistant/Sonos Now Playing card with album artwork, title, artist, album, playback state, and a smoothly advancing progress bar.

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
