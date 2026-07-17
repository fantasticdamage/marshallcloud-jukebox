from pathlib import Path
import shutil
import sys

path = Path("server.js")
backup = Path("server.js.before-handoff-state-fix.bak")

if not path.exists():
    sys.exit("ERROR: server.js was not found.")

text = path.read_text(encoding="utf-8")
shutil.copy2(path, backup)

start_marker = "const isPartyModeHandoff ="
end_marker = 'await homeAssistantRequest("/api/services/media_player/play_media"'

start = text.find(start_marker)
if start == -1:
    sys.exit("ERROR: Could not find isPartyModeHandoff.")

end = text.find(end_marker, start)
if end == -1:
    sys.exit("ERROR: Could not find the following play_media call.")

replacement = '''const existingRequests = readRequests();
    const requestedSpotifyIds = new Set(
      existingRequests
        .map((request) => request.spotify_id)
        .filter(Boolean)
    );

    const guestTrackAlreadyQueued = rawItems.some((item) => {
      const queuedSpotifyId = extractSpotifyTrackId(
        item.media_content_id || item.content_id || ""
      );

      return (
        queuedSpotifyId &&
        requestedSpotifyIds.has(queuedSpotifyId)
      );
    });

    const isPartyModeHandoff =
      Boolean(readSettings().auto_dj?.enabled) &&
      !guestTrackAlreadyQueued;

    console.log(
      `[AutoDJ] Guest request: handoff=${isPartyModeHandoff}, ` +
      `existingGuestQueue=${guestTrackAlreadyQueued}, ` +
      `state=${autoDjState}`
    );

    if (isPartyModeHandoff) {
      setAutoDjState(AUTO_DJ_STATE.HANDOFF);
    }

    '''

new_text = text[:start] + replacement + text[end:]
path.write_text(new_text, encoding="utf-8")

print("Guest handoff state patch applied.")
print(f"Backup created: {backup}")
