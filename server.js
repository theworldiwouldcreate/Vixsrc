
const http = require("http");

const PORT = process.env.PORT || 7000;
const VIXSRC = "https://vixsrc.to";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

const manifest = {
  id: "community.vixsrc",
  version: "2.0.0",
  name: "VixSrc",
  description: "VixSrc native HLS streaming for Stremio",
  resources: ["stream"],
  types: ["movie", "series"],
  catalogs: []
};

function sendJSON(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data));
}

function extractPlaylist(html) {
  html = html.replace(/\\\//g, "/");

  const masterIndex = html.indexOf("window.masterPlaylist");

  if (masterIndex !== -1) {
    const section = html.slice(masterIndex, masterIndex + 10000);

    const url = section.match(/\burl\s*:\s*["']([^"']+)["']/);
    const token = section.match(/\btoken\s*:\s*["']([^"']+)["']/);
    const expires = section.match(/\bexpires\s*:\s*["']([^"']+)["']/);

    if (url && token && expires) {
      const playlist = new URL(url[1]);

      playlist.searchParams.set("token", token[1]);
      playlist.searchParams.set("expires", expires[1]);
      playlist.searchParams.set("h", "1");
      playlist.searchParams.set("lang", "en");

      return playlist.href;
    }
  }

  const direct = html.match(
    /https?:\/\/[^"'\\\s]+\.m3u8(?:\?[^"'\\\s]*)?/
  );

  if (direct) {
    return direct[0];
  }

  return null;
}

async function resolveStream(type, rawId) {
  const id = decodeURIComponent(rawId).replace(/\.json$/, "");

  let pageUrl;

  if (type === "movie") {
    if (!/^(tt\d+|\d+)$/.test(id)) return [];

    pageUrl = `${VIXSRC}/movie/${id}/`;
  } else {
    const match = id.match(/^(.+):(\d+):(\d+)$/);

    if (!match) return [];

    const [, showId, season, episode] = match;

    if (!/^(tt\d+|\d+)$/.test(showId)) return [];

    pageUrl = `${VIXSRC}/tv/${showId}/${season}/${episode}/`;
  }

  try {
    console.log("[VixSrc] Resolving:", pageUrl);

    const response = await fetch(pageUrl, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": `${VIXSRC}/`
      },
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      throw new Error(`VixSrc returned HTTP ${response.status}`);
    }

    const html = await response.text();
    const playlist = extractPlaylist(html);

    if (!playlist) {
      console.log("[VixSrc] No HLS playlist found");
      return [];
    }

    console.log("[VixSrc] HLS playlist extracted");

    return [{
      name: "VixSrc",
      title: "Auto Quality • Native HLS",
      url: playlist,
      behaviorHints: {
        notWebReady: true,
        proxyHeaders: {
          request: {
            "Referer": pageUrl,
            "User-Agent": USER_AGENT
          }
        }
      }
    }];

  } catch (error) {
    console.error("[VixSrc] Error:", error.message);
    return [];
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    });
    return res.end();
  }

  const path = new URL(
    req.url,
    "http://localhost"
  ).pathname;

  if (path === "/") {
    return sendJSON(res, {
      addon: "VixSrc",
      status: "running",
      playback: "Native HLS"
    });
  }

  if (path === "/manifest.json") {
    return sendJSON(res, manifest);
  }

  const match = path.match(
    /^\/stream\/(movie|series)\/(.+)$/
  );

  if (match) {
    const [, type, id] = match;
    const streams = await resolveStream(type, id);

    return sendJSON(res, { streams });
  }

  return sendJSON(res, {
    error: "Not found"
  }, 404);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`VixSrc addon running on port ${PORT}`);
});
            
