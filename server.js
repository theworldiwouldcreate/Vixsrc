
const http = require("http");

const PORT = process.env.PORT || 7000;
const VIXSRC = "https://vixsrc.to";

const manifest = {
  id: "community.vixsrc",
  version: "1.0.0",
  name: "VixSrc",
  description: "Watch movies and TV episodes using VixSrc",
  resources: ["stream"],
  types: ["movie", "series"],
  catalogs: [],
  idPrefixes: ["tt"]
};

function sendJSON(res, data) {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  });

  res.end(JSON.stringify(data));
}

function getStream(type, rawId) {
  const id = decodeURIComponent(rawId)
    .replace(/\.json$/, "");

  if (type === "movie") {
    if (!/^(tt\d+|\d+)$/.test(id)) return [];

    return [{
      name: "VixSrc",
      title: "Open movie in VixSrc",
      externalUrl: `${VIXSRC}/movie/${id}`
    }];
  }

  if (type === "series") {
    const match = id.match(/^(.+):(\d+):(\d+)$/);

    if (!match) return [];

    const [, showId, season, episode] = match;

    if (!/^(tt\d+|\d+)$/.test(showId)) return [];

    return [{
      name: "VixSrc",
      title: `Open S${season} E${episode} in VixSrc`,
      externalUrl:
        `${VIXSRC}/tv/${showId}/${season}/${episode}`
    }];
  }

  return [];
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    });
    return res.end();
  }

  const path = new URL(req.url, "http://localhost").pathname;

  if (path === "/") {
    return sendJSON(res, {
      addon: "VixSrc",
      status: "running",
      manifest: "/manifest.json"
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

    return sendJSON(res, {
      streams: getStream(type, id)
    });
  }

  res.writeHead(404, {
    "Content-Type": "application/json"
  });

  res.end(JSON.stringify({
    error: "Not found"
  }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`VixSrc addon running on port ${PORT}`);
});
                                 
