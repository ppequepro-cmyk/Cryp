const ALLOWED_ORIGINS = new Set([
  "https://ppequepro-cmyk.github.io",
  "https://nore-music-api.ppequepro.workers.dev"
]);

const ARCHIVE_SEARCH = "https://archive.org/advancedsearch.php";
const ARCHIVE_METADATA = "https://archive.org/metadata/";
const LICENSE_OK = [
  /creativecommons\.org\/licenses\/(by|by-sa)\//i,
  /creativecommons\.org\/publicdomain\//i,
  /creativecommons\.org\/publicdomain\/zero\//i,
  /creativecommons\.org\/licenses\/zero\//i
];

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://ppequepro-cmyk.github.io",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status, origin, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra
    }
  });
}

function licensed(meta) {
  const license = String(meta?.licenseurl || "");
  return LICENSE_OK.some(pattern => pattern.test(license));
}

function safeId(value) {
  return /^[a-zA-Z0-9._-]{1,160}$/.test(value);
}

async function cachedFetch(url, ctx, ttl = 300) {
  const cache = caches.default;
  const key = new Request(url, { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;

  const response = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "NORE-MUSIC/1.0 (catalog search)" }
  });
  if (response.ok) {
    const copy = new Response(response.body, response);
    copy.headers.set("Cache-Control", `public, max-age=${ttl}`);
    ctx.waitUntil(cache.put(key, copy.clone()));
    return copy;
  }
  return response;
}

async function archiveItem(id, ctx) {
  const response = await cachedFetch(
    ARCHIVE_METADATA + encodeURIComponent(id),
    ctx,
    600
  );
  if (!response.ok) throw new Error(`Internet Archive respondió HTTP ${response.status}`);
  return response.json();
}

function audioFiles(files) {
  const allowed = new Set(["mp3", "flac", "ogg", "m4a", "wav"]);
  return (files || []).filter(file => {
    const name = String(file.name || "");
    const ext = name.split(".").pop().toLowerCase();
    return allowed.has(ext) &&
      !file.source?.includes("metadata") &&
      !/sample|spectrogram|thumbnail|cover|_archive\.org/i.test(name) &&
      file.private !== "true";
  });
}

function trackFromItem(item) {
  return {
    id: String(item.identifier),
    title: String(item.title || item.identifier),
    artist: String(item.creator || "Artista desconocido"),
    album: String(item.collection || ""),
    duration: Number(item.runtime) || 0,
    artworkURL: `https://archive.org/services/img/${encodeURIComponent(item.identifier)}`,
    audioQuality: "STANDARD",
    provider: "Internet Archive"
  };
}

async function searchArchive(query, ctx) {
  const params = new URLSearchParams({
    q: `mediatype:audio AND title:("${query.replace(/["\\\\]/g, " ")}")`,
    fl: "identifier,title,creator,collection,runtime,licenseurl",
    rows: "30",
    page: "1",
    output: "json"
  });
  const response = await cachedFetch(`${ARCHIVE_SEARCH}?${params}`, ctx, 300);
  if (!response.ok) throw new Error(`Internet Archive Search HTTP ${response.status}`);
  const payload = await response.json();
  const docs = payload?.response?.docs || [];
  return docs
    .filter(item => safeId(String(item.identifier || "")) && licensed(item))
    .slice(0, 20);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "GET") {
      return json({ error: "Método no permitido" }, 405, origin, { Allow: "GET, OPTIONS" });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        ok: true,
        service: "NORE MUSIC API",
        provider: "Internet Archive",
        addonProtocol: "BitChord HTTP addon"
      }, 200, origin);
    }

    if (url.pathname === "/manifest.json") {
      return json({
        id: "com.nore.music.archive",
        name: "NORE MUSIC · Internet Archive",
        version: "1.0.0",
        resources: ["search", "stream"],
        allowDownloads: 0,
        checkValidLossless: 0
      }, 200, origin);
    }

    const query = (url.searchParams.get("q") || "").trim();
    if (url.pathname === "/search" || url.pathname === "/api/search") {
      if (query.length < 2 || query.length > 100) {
        return json({ error: "La búsqueda debe tener entre 2 y 100 caracteres." }, 400, origin);
      }
      try {
        const docs = await searchArchive(query, ctx);
        const tracks = docs.map(trackFromItem);
        if (url.pathname === "/api/search") {
          return json({
            items: tracks.map(track => ({
              id: track.id,
              title: track.title,
              artist: track.artist,
              album: track.album,
              thumbnail: track.artworkURL,
              previewUrl: "",
              durationMs: track.duration ? track.duration * 1000 : null,
              trackUrl: `https://archive.org/details/${encodeURIComponent(track.id)}`
            }))
          }, 200, origin, { "Cache-Control": "public, max-age=300" });
        }
        return json({ tracks }, 200, origin, { "Cache-Control": "public, max-age=300" });
      } catch (error) {
        return json({
          error: "No se pudo consultar Internet Archive.",
          detail: String(error?.message || error).slice(0, 160)
        }, 502, origin);
      }
    }

    if (url.pathname.startsWith("/stream/")) {
      const id = decodeURIComponent(url.pathname.slice("/stream/".length));
      if (!safeId(id)) return json({ error: "Identificador no válido." }, 400, origin);
      try {
        const item = await archiveItem(id, ctx);
        if (!licensed(item?.metadata)) {
          return json({ error: "Este material no tiene una licencia compatible verificada." }, 404, origin);
        }
        const file = audioFiles(item.files).find(entry => /\.(mp3|m4a|ogg|flac|wav)$/i.test(entry.name));
        if (!file) return json({ error: "No se encontró un archivo de audio compatible." }, 404, origin);

        const ext = file.name.split(".").pop().toLowerCase();
        const codec = ext === "mp3" ? "mp3" : ext === "flac" ? "flac" : ext === "ogg" ? "vorbis" : ext === "wav" ? "pcm" : "aac";
        const mediaUrl = `https://archive.org/download/${encodeURIComponent(id)}/${file.name.split("/").map(encodeURIComponent).join("/")}`;
        return json({
          url: mediaUrl,
          format: ext,
          codec,
          container: ext,
          manifest: "none",
          encrypted: false,
          error: ""
        }, 200, origin, { "Cache-Control": "public, max-age=300" });
      } catch (error) {
        return json({
          error: "No se pudo resolver el audio.",
          detail: String(error?.message || error).slice(0, 160)
        }, 502, origin);
      }
    }

    return json({ error: "Ruta no encontrada" }, 404, origin);
  }
};
