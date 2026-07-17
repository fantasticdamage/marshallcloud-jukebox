from pathlib import Path
import re
import shutil
import sys

path = Path("server.js")
backup = Path("server.js.before-enrichment-fix.bak")

if not path.exists():
    sys.exit("ERROR: server.js was not found.")

text = path.read_text(encoding="utf-8")
shutil.copy2(path, backup)

start_match = re.search(
    r"^async function enrichQueueItems\(items\)\s*\{",
    text,
    flags=re.MULTILINE,
)

if not start_match:
    sys.exit("ERROR: enrichQueueItems() was not found.")

start = start_match.start()

next_function = re.search(
    r"^(?:async\s+)?function\s+(?!enrichQueueItems\b)\w+\s*\(",
    text[start_match.end():],
    flags=re.MULTILINE,
)

if not next_function:
    sys.exit("ERROR: Could not locate the function following enrichQueueItems().")

end = start_match.end() + next_function.start()

replacement = r'''let spotifyEnrichmentBlockedUntil = 0;
let spotifyEnrichmentLastLogAt = 0;

const SPOTIFY_ENRICHMENT_COOLDOWN_MS = 5 * 60 * 1000;
const SPOTIFY_ENRICHMENT_LOG_INTERVAL_MS = 60 * 1000;

async function enrichQueueItems(items) {
  if (Date.now() < spotifyEnrichmentBlockedUntil) {
    return items;
  }

  const ids = items.map((item) =>
    extractSpotifyTrackId(item.content_id)
  );

  const uniqueIds = [...new Set(ids.filter(Boolean))];
  let tracksById = new Map();

  if (uniqueIds.length) {
    try {
      const trackIds = uniqueIds.slice(0, 50).join(",");

      const data = await spotifyApi(
        `/tracks?ids=${encodeURIComponent(trackIds)}`
      );

      tracksById = new Map(
        (data?.tracks || [])
          .filter(Boolean)
          .map((track) => [track.id, track])
      );
    } catch (error) {
      const message = String(error?.message || "");
      const isForbidden = /\b403\b|forbidden/i.test(message);
      const isRateLimited = /\b429\b|too many requests/i.test(message);

      if (isForbidden || isRateLimited) {
        spotifyEnrichmentBlockedUntil =
          Date.now() + SPOTIFY_ENRICHMENT_COOLDOWN_MS;

        if (
          Date.now() - spotifyEnrichmentLastLogAt >=
          SPOTIFY_ENRICHMENT_LOG_INTERVAL_MS
        ) {
          console.warn(
            `Spotify queue enrichment temporarily disabled: ${message}`
          );

          spotifyEnrichmentLastLogAt = Date.now();
        }
      } else {
        console.warn("Spotify queue enrichment failed:", message);
      }
    }
  }

  return items.map((item, index) => {
    const spotifyId = ids[index];
    const track = tracksById.get(spotifyId);

    return {
      ...item,
      spotify_id: spotifyId,
      image:
        track?.album?.images?.[1]?.url ||
        track?.album?.images?.[0]?.url ||
        "",
      duration_ms: Number(track?.duration_ms || 0),
      explicit: Boolean(track?.explicit),
      spotify_url: track?.external_urls?.spotify || ""
    };
  });
}

'''

new_text = text[:start] + replacement + text[end:]
path.write_text(new_text, encoding="utf-8")

print("Spotify enrichment patch applied.")
print(f"Backup created: {backup}")
