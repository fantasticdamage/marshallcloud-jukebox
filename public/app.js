const searchInput = document.getElementById("search");
const searchMessage = document.getElementById("searchMessage");
const searchModeAll = document.getElementById("searchModeAll");
const searchModeSong = document.getElementById("searchModeSong");
const searchModeArtist = document.getElementById("searchModeArtist");
const searchModeAlbum = document.getElementById("searchModeAlbum");
const results = document.getElementById("results");
const searchPagination = document.getElementById("searchPagination");
const searchMore = document.getElementById("searchMore");
const searchStartOver = document.getElementById("searchStartOver");
const loginButton = document.getElementById("spotifyLogin");
const connectionBadge = document.getElementById("connectionBadge");
const health = document.getElementById("health");
const queueList = document.getElementById("queueList");
const queueCount = document.getElementById("queueCount");
const guestButton = document.getElementById("guestButton");
const guestModal = document.getElementById("guestModal");
const guestForm = document.getElementById("guestForm");
const guestNameInput = document.getElementById("guestNameInput");

let guestName = localStorage.getItem("jukebox_guest_name") || "";
let requestsLocked = false;

function openGuestModal() {
  guestNameInput.value = guestName;
  guestModal.classList.remove("hidden");
  setTimeout(() => guestNameInput.focus(), 0);
}

function updateGuestUi() {
  guestButton.textContent = `Requesting as ${guestName || "Guest"}`;
}

guestButton.addEventListener("click", openGuestModal);
guestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = guestNameInput.value.trim().replace(/\s+/g, " ").slice(0, 30);
  if (!value) return;
  guestName = value;
  localStorage.setItem("jukebox_guest_name", guestName);
  updateGuestUi();
  guestModal.classList.add("hidden");
});

updateGuestUi();
if (!guestName) openGuestModal();
const toast = document.createElement("div"); toast.className = "toast"; document.body.appendChild(toast);
function showToast(message, type = "success") { toast.textContent = message; toast.className = `toast show ${type}`; clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.className = "toast", 3200); }
async function queueTrack(track, button) { if (requestsLocked) { showToast("The host has temporarily locked requests.", "error"); return; } const original = button.textContent; button.disabled = true; button.textContent = "Adding…"; try { const response = await fetch("/api/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uri: track.uri, guest_name: guestName || "Guest" }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to add track"); button.textContent = "Added"; button.classList.add("added"); showToast(`${track.name} requested by ${guestName || "Guest"}`); loadQueue(); } catch (error) { button.disabled = false; button.textContent = original; showToast(error.message, "error"); } }

let searchTimer;
let searchMode = "all";
let searchOffset = 0;
let lastSearchQuery = "";
let lastSearchMode = "all";

function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function formatWait(seconds) {
  const minutes = Math.max(0, Math.round(Number(seconds || 0) / 60));
  if (minutes <= 1) return "Up next";
  return `About ${minutes} minutes`;
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
  searchMessage.textContent = `${tracks.length} result${tracks.length === 1 ? "" : "s"}`;

  for (const [index, track] of tracks.entries()) {
    const item = document.createElement("article");
    item.className = "result";
    item.style.setProperty("--result-index", index);

    const artist = escapeHtml(track.artists || "Unknown artist");
    const album = escapeHtml(track.album || "");
    const title = escapeHtml(track.name || "Unknown track");
    const artwork = track.image
      ? `<img src="${track.image}" alt="${title} artwork" loading="lazy">`
      : '<span class="result-art-fallback" aria-hidden="true">♫</span>';

    item.innerHTML = `
      <div class="result-art ${track.image ? "" : "result-art-empty"}">
        ${artwork}
      </div>

      <div class="result-copy">
        <div class="result-title-row">
          <p class="result-title">
            ${title}
            ${track.explicit ? '<span class="explicit">E</span>' : ""}
          </p>
        </div>

        <p class="result-meta result-artist">${artist}</p>
        ${album ? `<p class="result-meta result-album">${album}</p>` : ""}

        <div class="result-details">
          ${track.duration_ms ? `<span class="result-duration">${formatDuration(track.duration_ms)}</span>` : ""}
          <span class="result-source">Spotify</span>
        </div>
      </div>

      <button class="add-button" type="button" aria-label="Add ${title} to the queue">
        <span class="add-button-label">Add</span>
      </button>
    `;

    const addButton = item.querySelector(".add-button");

    addButton.addEventListener("click", async () => {
      if (addButton.disabled) return;

      const label = addButton.querySelector(".add-button-label");
      addButton.disabled = true;
      addButton.classList.add("is-adding");
      if (label) label.textContent = "Adding…";

      try {
        await queueTrack(track, addButton);
        addButton.classList.remove("is-adding");
        addButton.classList.add("is-added");
        if (label) label.textContent = "Added";

        window.setTimeout(() => {
          addButton.classList.remove("is-added");
          addButton.disabled = false;
          if (label) label.textContent = "Add";
        }, 1800);
      } catch (error) {
        addButton.classList.remove("is-adding");
        addButton.classList.add("is-error");
        if (label) label.textContent = "Retry";

        window.setTimeout(() => {
          addButton.classList.remove("is-error");
          addButton.disabled = false;
          if (label) label.textContent = "Add";
        }, 1800);
      }
    });

    results.appendChild(item);
  }
}

results.addEventListener("error", (event) => {
  const image = event.target.closest(".result-art img");
  if (!image) return;

  const artwork = image.closest(".result-art");
  if (!artwork) return;

  artwork.classList.add("result-art-empty");
  artwork.innerHTML = '<span class="result-art-fallback" aria-hidden="true">♫</span>';
}, true);

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

    requestsLocked = Boolean(status.requestsLocked);
    if (status.spotifyConnected) {
      connectionBadge.textContent = status.spotifyUser?.display_name
        ? `Spotify: ${status.spotifyUser.display_name}`
        : "Spotify connected";
      connectionBadge.classList.add("connected");
      loginButton.classList.add("hidden");
      searchInput.disabled = false;
      searchMessage.textContent = requestsLocked ? "The host has temporarily locked requests." : "Search for a track or artist.";
      searchInput.disabled = requestsLocked;
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

function setSearchMode(mode) {
  const allowedModes = new Set(["all", "song", "artist", "album"]);
  searchMode = allowedModes.has(mode) ? mode : "all";
  searchOffset = 0;

  searchModeAll.classList.toggle("active", searchMode === "all");
  searchModeSong.classList.toggle("active", searchMode === "song");
  searchModeArtist.classList.toggle("active", searchMode === "artist");
  searchModeAlbum.classList.toggle("active", searchMode === "album");

  const prompts = {
    all: {
      placeholder: "Search songs, artists, or albums",
      helper: "Search across songs, artists, and albums."
    },
    song: {
      placeholder: "Search by song title",
      helper: "Enter a song title."
    },
    artist: {
      placeholder: "Search by artist name",
      helper: "Enter an artist name."
    },
    album: {
      placeholder: "Search by album title",
      helper: "Enter an album title."
    }
  };

  searchInput.placeholder = prompts[searchMode].placeholder;
  const query = searchInput.value.trim();
  if (query.length >= 2) {
    performSearch(0);
  } else {
    results.innerHTML = "";
    searchPagination.classList.add("hidden");
    searchMessage.className = "helper";
    searchMessage.textContent = prompts[searchMode].helper;
  }
}

searchModeAll.addEventListener("click", () => setSearchMode("all"));
searchModeSong.addEventListener("click", () => setSearchMode("song"));
searchModeArtist.addEventListener("click", () => setSearchMode("artist"));
searchModeAlbum.addEventListener("click", () => setSearchMode("album"));
setSearchMode("all");

async function performSearch(offset = 0) {
  clearTimeout(searchTimer);
  const query = searchInput.value.trim();

  if (query.length < 2) {
    results.innerHTML = "";
    searchPagination.classList.add("hidden");
    searchMessage.className = "helper";
    searchMessage.textContent = "Type at least two characters.";
    return;
  }

  searchOffset = Math.max(0, offset);
  lastSearchQuery = query;
  lastSearchMode = searchMode;
  searchMessage.className = "helper";
  searchMessage.textContent = "Searching…";
  searchMore.disabled = true;
  searchStartOver.disabled = true;

  try {
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(query)}` +
      `&mode=${encodeURIComponent(searchMode)}` +
      `&offset=${searchOffset}`,
      { cache: "no-store" }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Search failed");

    renderTracks(data.tracks || []);

    const firstResult = data.tracks?.length ? searchOffset + 1 : 0;
    const lastResult = searchOffset + (data.tracks?.length || 0);
    searchMessage.className = "helper";
    searchMessage.textContent = data.tracks?.length
      ? `Showing results ${firstResult}–${lastResult}`
      : "No more results found.";

    searchPagination.classList.toggle(
      "hidden",
      searchOffset === 0 && !data.has_more
    );
    searchStartOver.classList.toggle("hidden", searchOffset === 0);
    searchMore.classList.toggle("hidden", !data.has_more);
    searchMore.disabled = false;
    searchStartOver.disabled = false;
  } catch (error) {
    results.innerHTML = "";
    searchPagination.classList.add("hidden");
    searchMessage.textContent = error.message;
    searchMessage.className = "helper error";
  }
}

async function performSearch(offset = 0) {
  clearTimeout(searchTimer);
  const query = searchInput.value.trim();

  if (query.length < 2) {
    results.innerHTML = "";
    searchPagination.classList.add("hidden");
    searchMessage.className = "helper";
    searchMessage.textContent = "Type at least two characters.";
    return;
  }

  searchOffset = Math.max(0, offset);
  lastSearchQuery = query;
  lastSearchMode = searchMode;
  searchMessage.className = "helper";
  searchMessage.textContent = "Searching…";
  searchMore.disabled = true;
  searchStartOver.disabled = true;

  try {
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(query)}` +
      `&mode=${encodeURIComponent(searchMode)}` +
      `&offset=${searchOffset}`,
      { cache: "no-store" }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Search failed");

    renderTracks(data.tracks || []);

    const firstResult = data.tracks?.length ? searchOffset + 1 : 0;
    const lastResult = searchOffset + (data.tracks?.length || 0);
    searchMessage.className = "helper";
    searchMessage.textContent = data.tracks?.length
      ? `Showing results ${firstResult}–${lastResult}`
      : "No more results found.";

    searchPagination.classList.toggle(
      "hidden",
      searchOffset === 0 && !data.has_more
    );
    searchStartOver.classList.toggle("hidden", searchOffset === 0);
    searchMore.classList.toggle("hidden", !data.has_more);
    searchMore.disabled = false;
    searchStartOver.disabled = false;
  } catch (error) {
    results.innerHTML = "";
    searchPagination.classList.add("hidden");
    searchMessage.textContent = error.message;
    searchMessage.className = "helper error";
  }
}

async function performSearch(offset = 0) {
  clearTimeout(searchTimer);
  const query = searchInput.value.trim();

  if (query.length < 2) {
    results.innerHTML = "";
    searchPagination.classList.add("hidden");
    searchMessage.className = "helper";
    searchMessage.textContent = "Type at least two characters.";
    return;
  }

  searchOffset = Math.max(0, offset);
  lastSearchQuery = query;
  lastSearchMode = searchMode;
  searchMessage.className = "helper";
  searchMessage.textContent = "Searching…";
  searchMore.disabled = true;
  searchStartOver.disabled = true;

  try {
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(query)}` +
      `&mode=${encodeURIComponent(searchMode)}` +
      `&offset=${searchOffset}`,
      { cache: "no-store" }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Search failed");

    renderTracks(data.tracks || []);

    const firstResult = data.tracks?.length ? searchOffset + 1 : 0;
    const lastResult = searchOffset + (data.tracks?.length || 0);
    searchMessage.className = "helper";
    searchMessage.textContent = data.tracks?.length
      ? `Showing results ${firstResult}–${lastResult}`
      : "No more results found.";

    searchPagination.classList.toggle(
      "hidden",
      searchOffset === 0 && !data.has_more
    );
    searchStartOver.classList.toggle("hidden", searchOffset === 0);
    searchMore.classList.toggle("hidden", !data.has_more);
    searchMore.disabled = false;
    searchStartOver.disabled = false;
  } catch (error) {
    results.innerHTML = "";
    searchPagination.classList.add("hidden");
    searchMessage.textContent = error.message;
    searchMessage.className = "helper error";
  }
}

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => performSearch(0), 350);
});

searchMore.addEventListener("click", () => {
  const query = searchInput.value.trim();
  if (query !== lastSearchQuery || searchMode !== lastSearchMode) {
    performSearch(0);
    return;
  }
  performSearch(searchOffset + 15);
});

searchStartOver.addEventListener("click", () => {
  performSearch(0);
});
searchStartOver.addEventListener("click", () => {
  performSearch(0);
});
const params = new URLSearchParams(window.location.search);
if (params.has("spotify") || params.has("spotify_error")) {
  history.replaceState({}, "", "/");
}

checkHealth();
loadStatus();


function renderQueue(items) {
  queueCount.textContent = `${items.length} ${items.length === 1 ? "song" : "songs"}`;

  if (!items.length) {
    queueList.innerHTML = `
      <div class="empty-state card">
        <div class="empty-icon">♫</div>
        <h3>The queue is empty</h3>
        <p>Requested songs will appear here automatically.</p>
      </div>
    `;
    return;
  }

  queueList.innerHTML = items.map((item, index) => {
    const position = Number(item.position) || index + 1;
    const waitLabel = index === 0 ? "Playing next" : formatWaitTime(item.estimated_wait_seconds);

    return `
      <article class="queue-item ${index === 0 ? "next-track" : ""}" style="--queue-index:${index}">
        <div class="queue-position" aria-label="Queue position ${position}">${position}</div>
        <div class="queue-artwork ${item.image ? "" : "queue-artwork-empty"}">
          ${item.image
            ? `<img src="${item.image}" alt="${escapeHtml(item.title || "Track")} artwork" loading="lazy">`
            : '<span aria-hidden="true">♫</span>'}
        </div>
        <div class="queue-copy">
          <div class="queue-title-row">
            <p class="queue-title">
              ${escapeHtml(item.title)}
              ${item.explicit ? '<span class="explicit">E</span>' : ""}
            </p>
            ${index === 0 ? '<span class="next-badge">Up next</span>' : ""}
          </div>
          <p class="queue-meta">
            <span>${escapeHtml(item.artist || "Unknown artist")}</span>
            ${item.album ? `<span class="queue-album"> · ${escapeHtml(item.album)}</span>` : ""}
          </p>
          <div class="queue-details">
            ${item.duration_ms ? `<span class="queue-duration">${formatDuration(item.duration_ms)}</span>` : ""}
            ${waitLabel ? `<span class="queue-wait">${escapeHtml(waitLabel)}</span>` : ""}
            ${item.requested_by ? `<span class="queue-requester">Requested by ${escapeHtml(item.requested_by)}</span>` : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

queueList.addEventListener("error", (event) => {
  const image = event.target.closest(".queue-artwork img");
  if (!image) return;
  const artwork = image.closest(".queue-artwork");
  if (!artwork) return;
  artwork.classList.add("queue-artwork-empty", "queue-artwork-error");
  artwork.innerHTML = '<span aria-hidden="true">♫</span>';
}, true);

async function loadQueue() {
  try {
    const response = await fetch("/api/queue", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load queue");
    renderQueue(data.items || []);
  } catch (error) {
    queueList.innerHTML = `
      <div class="queue-error card">
        <strong>Queue unavailable</strong>
        <span>${escapeHtml(error.message)}</span>
      </div>
    `;
  }
}

loadQueue();
setInterval(loadQueue, 120000);


let relaySocket;
let relayReconnectTimer;

function connectRelayWebSocket() {
  clearTimeout(relayReconnectTimer);
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  relaySocket = new WebSocket(`${protocol}//${window.location.host}/ws`);

  relaySocket.addEventListener("open", () => {
    console.info("Relay real-time connection established");
    document.documentElement.dataset.realtime = "connected";
  });

  relaySocket.addEventListener("message", (message) => {
    try {
      const data = JSON.parse(message.data);
      if (data.event === "connected") {
        console.info("Relay WebSocket ready", data.payload);
      }

      if (data.event === "queue_updated") {
        console.info("Relay queue snapshot received", data.payload);
        if (Array.isArray(data.payload?.items)) {
          renderQueue(data.payload.items);
        } else {
          loadQueue();
        }
      }

      if (data.event === "now_playing_updated") {
        console.info("Relay playback snapshot received", data.payload);
        if (typeof renderNowPlaying === "function") {
          renderNowPlaying(data.payload);
        } else if (typeof updateNowPlaying === "function") {
          updateNowPlaying(data.payload);
        } else if (typeof loadNowPlaying === "function") {
          loadNowPlaying();
        }
      }
    } catch (error) {
      console.warn("Invalid Relay WebSocket message", error);
    }
  });

  relaySocket.addEventListener("close", () => {
    document.documentElement.dataset.realtime = "disconnected";
    relayReconnectTimer = setTimeout(connectRelayWebSocket, 3000);
  });

  relaySocket.addEventListener("error", () => relaySocket.close());
}

connectRelayWebSocket();
