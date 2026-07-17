from pathlib import Path
import shutil
import sys

path = Path("public/app.js")
backup = Path("public/app.js.before-format-wait-time.bak")

if not path.exists():
    sys.exit("ERROR: public/app.js was not found.")

text = path.read_text(encoding="utf-8")
shutil.copy2(path, backup)

if "function formatWaitTime(" in text:
    print("formatWaitTime() already exists. No changes made.")
    sys.exit(0)

marker = "function formatDuration"
insert = """
function formatWaitTime(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);

  if (seconds < 60) {
    return "Less than 1 min";
  }

  const totalMinutes = Math.ceil(seconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

"""

index = text.find(marker)

if index == -1:
    sys.exit("ERROR: Could not find function formatDuration in public/app.js.")

new_text = text[:index] + insert + text[index:]
path.write_text(new_text, encoding="utf-8")

print("formatWaitTime() patch applied.")
print(f"Backup created: {backup}")
