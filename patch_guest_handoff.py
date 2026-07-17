from pathlib import Path
import re
import shutil
import sys

path = Path("server.js")
backup = Path("server.js.before-guest-handoff.bak")

if not path.exists():
    sys.exit("ERROR: server.js was not found.")

text = path.read_text(encoding="utf-8")
shutil.copy2(path, backup)

pattern = re.compile(
    r'''
    (?P<indent>[ \t]*)
    await\s+homeAssistantRequest\(
        "/api/services/media_player/play_media",
        \s*\{
        \s*method:\s*"POST",
        \s*body:\s*JSON\.stringify\(\{
        \s*entity_id:\s*HA_MEDIA_PLAYER,
        \s*media_content_id:\s*body\.uri,
        \s*media_content_type:\s*"music",
        \s*enqueue:\s*"add"
        \s*\}\)
        \s*\}
    \s*\);
    ''',
    re.VERBOSE,
)

match = pattern.search(text)

if not match:
    sys.exit("ERROR: Could not find the guest queue play_media block.")

indent = match.group("indent")

replacement = f'''{indent}const isPartyModeHandoff =
{indent}  autoDjState === AUTO_DJ_STATE.BACKGROUND;

{indent}if (isPartyModeHandoff) {{
{indent}  setAutoDjState(AUTO_DJ_STATE.HANDOFF);
{indent}}}

{indent}await homeAssistantRequest("/api/services/media_player/play_media", {{
{indent}  method: "POST",
{indent}  body: JSON.stringify({{
{indent}    entity_id: HA_MEDIA_PLAYER,
{indent}    media_content_id: body.uri,
{indent}    media_content_type: "music",
{indent}    enqueue: isPartyModeHandoff ? "replace" : "add"
{indent}  }})
{indent}}});'''

new_text = text[:match.start()] + replacement + text[match.end():]
path.write_text(new_text, encoding="utf-8")

print("Guest handoff patch applied.")
print(f"Backup created: {backup}")
