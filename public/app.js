const albumArt = document.getElementById("albumArt");
const trackTitle = document.getElementById("trackTitle");
const trackArtist = document.getElementById("trackArtist");
const trackAlbum = document.getElementById("trackAlbum");
const progressFill = document.getElementById("progressFill");
const elapsedTime = document.getElementById("elapsedTime");
const durationTime = document.getElementById("durationTime");

let nowPlaying = { position: 0, duration: 0, state: "unknown", receivedAt: Date.now() };
let currentArtwork = "";

function formatSeconds(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function renderProgress() {
  let position = nowPlaying.position;
  if (nowPlaying.state === "playing") {
    position += (Date.now() - nowPlaying.receivedAt) / 1000;
  }
  if (nowPlaying.duration > 0) position = Math.min(position, nowPlaying.duration);
  progressFill.style.width = nowPlaying.duration > 0 ? `${(position / nowPlaying.duration) * 100}%` : "0%";
  elapsedTime.textContent = formatSeconds(position);
  durationTime.textContent = formatSeconds(nowPlaying.duration);
}

async function loadNowPlaying() {
  try {
    const response = await fetch("/api/now-playing", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to read Sonos");

    nowPlaying = {
      position: Number(data.position || 0),
      duration: Number(data.duration || 0),
      state: data.state || "unknown",
      receivedAt: Date.now()
    };
    trackTitle.textContent = data.title || "Nothing playing";
    trackArtist.textContent = data.artist || (data.state === "idle" ? "Sonos is idle" : "");
    trackAlbum.textContent = data.album || "";

    if (data.artwork && data.artwork !== currentArtwork) {
      currentArtwork = data.artwork;
      albumArt.innerHTML = `<img src="${data.artwork}" alt="Album artwork">`;
    } else if (!data.artwork) {
      currentArtwork = "";
      albumArt.textContent = "♫";
    }
    renderProgress();
  } catch (error) {
    trackArtist.textContent = error.message;
  }
}

const searchInput = document.getElementById("search");
const searchMessage = document.getElementById("searchMessage");
const results = document.getElementById("results");
const loginButton = document.getElementById("spotifyLogin");
const connectionBadge = document.getElementById("connectionBadge");
const health = document.getElementById("health");
const toast = document.createElement("div"); toast.className = "toast"; document.body.appendChild(toast);
function showToast(message, type = "success") { toast.textContent = message; toast.className = `toast show ${type}`; clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.className = "toast", 3200); }
async function queueTrack(track, button) { const original = button.textContent; button.disabled = true; button.textContent = "Adding…"; try { const response = await fetch("/api/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uri: track.uri }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to add track"); button.textContent = "Added"; button.classList.add("added"); showToast(`${track.name} added to the Sonos queue`); } catch (error) { button.disabled = false; button.textContent = original; showToast(error.message, "error"); } }

let searchTimer;

function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function renderTracks(tracks) {
  results.innerHTML = "";

  if (!tracks.length) {
    searchMessage.textContent = "No tracks found.";
    return;
  }

  searchMessage.className = "helper";
  searchMessage.textContent = `${tracks.length} results`;

  for (const track of tracks) {
    const item = document.createElement("article");
    item.className = "result";
    item.innerHTML = `
      <img src="${track.image}" alt="">
      <div>
        <p class="result-title">
          ${escapeHtml(track.name)}
          ${track.explicit ? '<span class="explicit">E</span>' : ""}
        </p>
        <p class="result-meta">
          ${escapeHtml(track.artists)} · ${formatDuration(track.duration_ms)}
        </p>
      </div>
      <button class="add-button" type="button">Add</button>
    `;
    const addButton = item.querySelector(".add-button");
    addButton.addEventListener("click", () => queueTrack(track, addButton));
    results.appendChild(item);
  }
}

async function loadStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    const status = await response.json();

    if (!status.spotifyConfigured) {
      connectionBadge.textContent = "Spotify not configured";
      loginButton.classList.add("hidden");
      searchMessage.textContent = "Add Spotify credentials to the server .env file.";
      return;
    }

    if (status.spotifyConnected) {
      connectionBadge.textContent = status.spotifyUser?.display_name
        ? `Spotify: ${status.spotifyUser.display_name}`
        : "Spotify connected";
      connectionBadge.classList.add("connected");
      loginButton.classList.add("hidden");
      searchInput.disabled = false;
      searchMessage.textContent = "Search for a track or artist.";
    } else {
      connectionBadge.textContent = "Spotify disconnected";
      loginButton.classList.remove("hidden");
      searchMessage.textContent = "Connect Spotify to start searching.";
    }
  } catch {
    connectionBadge.textContent = "Server unavailable";
  }
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) throw new Error();
    health.textContent = "Server online";
    health.className = "health-ok";
  } catch {
    health.textContent = "Server unavailable";
    health.className = "health-error";
  }
}

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const query = searchInput.value.trim();

  if (query.length < 2) {
    results.innerHTML = "";
    searchMessage.className = "helper";
    searchMessage.textContent = "Type at least two characters.";
    return;
  }

  searchMessage.className = "helper";
  searchMessage.textContent = "Searching…";

  searchTimer = setTimeout(async () => {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      renderTracks(data.tracks || []);
    } catch (error) {
      results.innerHTML = "";
      searchMessage.textContent = error.message;
      searchMessage.className = "helper error";
    }
  }, 350);
});

const params = new URLSearchParams(window.location.search);
if (params.has("spotify") || params.has("spotify_error")) {
  history.replaceState({}, "", "/");
}

checkHealth();
loadStatus();
loadNowPlaying();
setInterval(loadNowPlaying, 5000);
setInterval(renderProgress, 1000);
