const loginPanel = document.getElementById("loginPanel");
const controls = document.getElementById("controls");
const loginForm = document.getElementById("loginForm");
const pin = document.getElementById("pin");
const loginMessage = document.getElementById("loginMessage");
const adminMessage = document.getElementById("adminMessage");
const volume = document.getElementById("volume");
const volumeLabel = document.getElementById("volumeLabel");
const lockButton = document.getElementById("lockButton");
const lockCopy = document.getElementById("lockCopy");
const adminQueue = document.getElementById("adminQueue");
const adminQueueCount = document.getElementById("adminQueueCount");
const playbackState = document.getElementById("adminPlaybackState");
const playButton = document.querySelector('[data-action="play"]');
const pauseButton = document.querySelector('[data-action="pause"]');

let locked = false;
let volumeTimer;
let relaySocket;
let relayReconnectTimer;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function message(text, error = false) {
  adminMessage.textContent = text;
  adminMessage.className = `helper ${error ? "error" : ""}`;
}

function setAuthenticated(ok) {
  loginPanel.classList.toggle("hidden", ok);
  controls.classList.toggle("hidden", !ok);
}

function updateLock(value) {
  locked = Boolean(value);
  lockButton.textContent = locked ? "Open requests" : "Lock requests";
  lockButton.className = `button ${locked ? "primary" : "danger"}`;
  lockCopy.textContent = locked
    ? "Requests are currently locked."
    : "Requests are open.";
}

function renderNowPlaying(data) {
  document.getElementById("adminTitle").textContent = data.title || "Nothing playing";
  document.getElementById("adminArtist").textContent = [data.artist, data.album]
    .filter(Boolean)
    .join(" · ");

  const art = document.getElementById("adminArt");
  if (data.artwork) {
    art.src = data.artwork;
    art.alt = data.title ? `${data.title} artwork` : "Now playing artwork";
    art.style.display = "block";
    art.parentElement?.classList.add("has-artwork");
  } else {
    art.removeAttribute("src");
    art.style.display = "none";
    art.parentElement?.classList.remove("has-artwork");
  }

  volume.value = Math.round((Number(data.volume) || 0) * 100);
  volumeLabel.textContent = `${volume.value}%`;

  const state = String(data.state || "idle").toLowerCase();
  const isPlaying = state === "playing";
  const isPaused = state === "paused";
  if (playbackState) {
    playbackState.textContent = isPlaying ? "Playing" : isPaused ? "Paused" : "Idle";
    playbackState.dataset.state = state;
  }
  if (playButton && pauseButton) {
    playButton.classList.toggle("is-current", !isPlaying);
    pauseButton.classList.toggle("is-current", isPlaying);
  }
}

function renderAdminQueue(items) {
  adminQueueCount.textContent = `${items.length} ${items.length === 1 ? "song" : "songs"}`;

  if (!items.length) {
    adminQueue.innerHTML = '<p class="muted admin-queue-empty">The upcoming queue is empty.</p>';
    return;
  }

  adminQueue.innerHTML = items.map((item) => `
    <article class="admin-queue-item">
      ${item.image
        ? `<img class="admin-queue-art" src="${escapeHtml(item.image)}" alt="">`
        : '<div class="admin-queue-art admin-queue-art-placeholder">♫</div>'}
      <div class="admin-queue-copy">
        <strong>${escapeHtml(item.title || "Unknown title")}</strong>
        <span>${escapeHtml(item.artist || "Unknown artist")}</span>
        ${item.requested_by ? `<small>Requested by ${escapeHtml(item.requested_by)}</small>` : ""}
      </div>
      <button
        class="button danger admin-remove-button"
        type="button"
        data-queue-position="${Number(item.queue_position)}"
        data-spotify-id="${escapeHtml(item.spotify_id || "")}" 
        data-track-title="${escapeHtml(item.title || "this song")}"
        aria-label="Remove ${escapeHtml(item.title || "this song")} from queue"
        title="Remove from queue">
        Remove
      </button>
    </article>
  `).join("");
}

async function loadQueue() {
  const response = await fetch("/api/queue", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load queue");
  renderAdminQueue(data.items || []);
}

async function removeQueueItem(button) {
  const queuePosition = Number(button.dataset.queuePosition);
  const trackTitle = button.dataset.trackTitle || "this song";
  if (!window.confirm(`Remove ${trackTitle} from the queue?`)) return;

  button.disabled = true;
  button.textContent = "Removing…";

  try {
    const response = await fetch("/api/admin/queue/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queue_position: queuePosition,
        spotify_id: button.dataset.spotifyId || ""
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to remove song");
    message(`${trackTitle} removed from the queue.`);
    setTimeout(loadQueue, 350);
  } catch (error) {
    button.disabled = false;
    button.textContent = "Remove";
    message(error.message, true);
  }
}

adminQueue.addEventListener("click", (event) => {
  const button = event.target.closest(".admin-remove-button");
  if (button) removeQueueItem(button);
});

async function status() {
  const response = await fetch("/api/admin/status", { cache: "no-store" });
  const data = await response.json();
  setAuthenticated(data.authenticated);
  updateLock(data.requestsLocked);
  if (data.authenticated) refresh();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: pin.value })
  });
  const data = await response.json();
  if (!response.ok) {
    loginMessage.textContent = data.error || "Login failed";
    loginMessage.className = "helper error";
    return;
  }
  setAuthenticated(true);
  refresh();
});

async function control(action, extra = {}) {
  const response = await fetch("/api/admin/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Control failed");
  return data;
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await control(button.dataset.action);
      message("Command sent.");
      setTimeout(refresh, 500);
    } catch (error) {
      message(error.message, true);
    }
  });
});

volume.addEventListener("input", () => {
  volumeLabel.textContent = `${volume.value}%`;
  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(async () => {
    try {
      await control("volume", { volume: Number(volume.value) / 100 });
      message("Volume updated.");
    } catch (error) {
      message(error.message, true);
    }
  }, 250);
});

lockButton.addEventListener("click", async () => {
  try {
    const data = await control("lock", { locked: !locked });
    updateLock(data.requestsLocked);
    message(data.requestsLocked ? "Guest requests locked." : "Guest requests opened.");
  } catch (error) {
    message(error.message, true);
  }
});

async function refresh() {
  try {
    const [playerResponse, queueResponse] = await Promise.all([
      fetch("/api/now-playing", { cache: "no-store" }),
      fetch("/api/queue", { cache: "no-store" })
    ]);
    const player = await playerResponse.json();
    const queue = await queueResponse.json();
    if (!playerResponse.ok) throw new Error(player.error || "Unable to load player");
    if (!queueResponse.ok) throw new Error(queue.error || "Unable to load queue");
    renderNowPlaying(player);
    renderAdminQueue(queue.items || []);
  } catch (error) {
    message(error.message, true);
  }
}

function connectAdminWebSocket() {
  clearTimeout(relayReconnectTimer);
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  relaySocket = new WebSocket(`${protocol}//${window.location.host}/ws`);

  relaySocket.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.event === "queue_updated") {
        if (Array.isArray(data.payload?.items)) {
          renderAdminQueue(data.payload.items);
        } else {
          loadQueue().catch((error) => message(error.message, true));
        }
      }
      if (data.event === "now_playing_updated" && data.payload) {
        renderNowPlaying(data.payload);
      }
    } catch (error) {
      console.warn("Relay admin WebSocket message failed:", error);
    }
  });

  relaySocket.addEventListener("close", () => {
    relayReconnectTimer = setTimeout(connectAdminWebSocket, 2500);
  });

  relaySocket.addEventListener("error", () => relaySocket.close());
}

status();
connectAdminWebSocket();
setInterval(() => {
  if (!controls.classList.contains("hidden")) refresh();
}, 120000);
