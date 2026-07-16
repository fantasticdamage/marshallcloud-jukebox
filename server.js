const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = (process.env.PUBLIC_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || `${PUBLIC_URL}/auth/callback`;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const HA_URL = (process.env.HA_URL || "").replace(/\/$/, "");
const HA_TOKEN = process.env.HA_TOKEN || "";
const HA_MEDIA_PLAYER = process.env.HA_MEDIA_PLAYER || "media_player.connect";
const TOKEN_FILE = path.join(DATA_DIR, "spotify-token.json");
const publicDir = path.join(__dirname, "public");

fs.mkdirSync(DATA_DIR, { recursive: true });

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

const oauthStates = new Map();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  res.end();
}

function readToken() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeToken(token) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2), { mode: 0o600 });
}

function spotifyConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
}

async function spotifyTokenRequest(params) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(params)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || `Spotify token error ${response.status}`);
  }
  return data;
}

async function getAccessToken() {
  let token = readToken();
  if (!token) return null;

  if (Date.now() < (token.expires_at || 0) - 60000) {
    return token.access_token;
  }

  if (!token.refresh_token) return null;

  const refreshed = await spotifyTokenRequest({
    grant_type: "refresh_token",
    refresh_token: token.refresh_token
  });

  token = {
    ...token,
    ...refreshed,
    refresh_token: refreshed.refresh_token || token.refresh_token,
    expires_at: Date.now() + refreshed.expires_in * 1000
  };
  writeToken(token);
  return token.access_token;
}

async function spotifyApi(endpoint) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    const error = new Error("Spotify is not connected");
    error.statusCode = 401;
    throw error;
  }

  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (response.status === 204) return null;

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Spotify API error ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return data;
}


async function readJsonBody(req) {
  const chunks = []; let total = 0;
  for await (const chunk of req) { total += chunk.length; if (total > 100000) { const e = new Error("Request body is too large"); e.statusCode = 413; throw e; } chunks.push(chunk); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { const e = new Error("Invalid JSON body"); e.statusCode = 400; throw e; }
}
function homeAssistantConfigured() { return Boolean(HA_URL && HA_TOKEN && HA_MEDIA_PLAYER); }
async function homeAssistantRequest(endpoint, options = {}) {
  if (!homeAssistantConfigured()) { const e = new Error("Home Assistant is not configured"); e.statusCode = 503; throw e; }
  const response = await fetch(`${HA_URL}${endpoint}`, { ...options, headers: { Authorization: `Bearer ${HA_TOKEN}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  const text = await response.text(); let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!response.ok) { const e = new Error(data?.message || data?.error?.message || `Home Assistant request failed (${response.status})`); e.statusCode = response.status; throw e; }
  return data;
}
function validateSpotifyTrackUri(value) { return typeof value === "string" && /^spotify:track:[A-Za-z0-9]+$/.test(value); }

async function handleApi(req, res, url) {
  if (url.pathname === "/api/health") {
    return sendJson(res, 200, {
      status: "ok",
      app: "MarshallCloud Jukebox",
      version: "0.3.0",
      spotifyConfigured: spotifyConfigured(),
      spotifyConnected: Boolean(readToken()),
      homeAssistantConfigured: homeAssistantConfigured()
    });
  }

  if (url.pathname === "/api/status") {
    let profile = null;
    if (readToken()) {
      try {
        profile = await spotifyApi("/me");
      } catch {
        profile = null;
      }
    }

    return sendJson(res, 200, {
      spotifyConfigured: spotifyConfigured(),
      spotifyConnected: Boolean(profile),
      spotifyUser: profile ? {
        id: profile.id,
        display_name: profile.display_name
      } : null
    });
  }

  if (url.pathname === "/api/search") {
    const query = (url.searchParams.get("q") || "").trim();
    if (query.length < 2) {
      return sendJson(res, 400, { error: "Enter at least two characters." });
    }

    try {
      const params = new URLSearchParams({
        q: query,
        type: "track",
        limit: "10"
      });
      const data = await spotifyApi(`/search?${params}`);

      const tracks = (data.tracks?.items || []).map((track) => ({
        id: track.id,
        uri: track.uri,
        name: track.name,
        artists: track.artists.map((artist) => artist.name).join(", "),
        album: track.album.name,
        image: track.album.images?.[1]?.url || track.album.images?.[0]?.url || "",
        duration_ms: track.duration_ms,
        explicit: track.explicit,
        external_url: track.external_urls?.spotify || ""
      }));

      return sendJson(res, 200, { tracks });
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { error: error.message });
    }
  }

  if (url.pathname === "/api/queue" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (!validateSpotifyTrackUri(body.uri)) return sendJson(res, 400, { error: "A valid Spotify track URI is required." });
      await homeAssistantRequest("/api/services/media_player/play_media", { method: "POST", body: JSON.stringify({ entity_id: HA_MEDIA_PLAYER, media_content_id: body.uri, media_content_type: "music", enqueue: "add" }) });
      return sendJson(res, 200, { status: "queued", entity_id: HA_MEDIA_PLAYER, uri: body.uri });
    } catch (error) { console.error("Queue request failed:", error.message); return sendJson(res, error.statusCode || 500, { error: error.message }); }
  }

  return false;
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/auth/login") {
    if (!spotifyConfigured()) {
      return sendJson(res, 503, { error: "Spotify environment variables are not configured." });
    }

    const state = crypto.randomBytes(24).toString("hex");
    oauthStates.set(state, Date.now());
    setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000).unref();

    const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
    authorizeUrl.search = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      state,
      scope: [
        "user-read-private",
        "user-read-email",
        "user-read-playback-state",
        "user-modify-playback-state",
        "user-read-currently-playing"
      ].join(" ")
    }).toString();

    return redirect(res, authorizeUrl.toString());
  }

  if (url.pathname === "/auth/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return redirect(res, `${PUBLIC_URL}/?spotify_error=${encodeURIComponent(error)}`);
    }
    if (!code || !state || !oauthStates.has(state)) {
      return redirect(res, `${PUBLIC_URL}/?spotify_error=invalid_state`);
    }

    oauthStates.delete(state);

    try {
      const token = await spotifyTokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI
      });

      writeToken({
        ...token,
        expires_at: Date.now() + token.expires_in * 1000
      });

      return redirect(res, `${PUBLIC_URL}/?spotify=connected`);
    } catch (tokenError) {
      return redirect(res, `${PUBLIC_URL}/?spotify_error=${encodeURIComponent(tokenError.message)}`);
    }
  }

  if (url.pathname.startsWith("/api/")) {
    const handled = await handleApi(req, res, url);
    if (handled !== false) return;
    return sendJson(res, 404, { error: "Not found" });
  }

  let relativePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  relativePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(publicDir, relativePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isFile()) {
      const extension = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": mimeTypes[extension] || "application/octet-stream",
        "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600"
      });
      return fs.createReadStream(filePath).pipe(res);
    }

    const indexPath = path.join(publicDir, "index.html");
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache"
    });
    fs.createReadStream(indexPath).pipe(res);
  });
}

http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log(`MarshallCloud Jukebox v0.3.0 listening on port ${PORT}`);
});
