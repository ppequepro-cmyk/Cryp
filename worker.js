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
    album: String(item.album || item.collection || ""),
    duration: Number(item.runtime) || 0,
    artworkURL: `https://archive.org/services/img/${encodeURIComponent(item.identifier)}`,
    audioQuality: "STANDARD",
    provider: "Internet Archive"
  };
}

function normalizeMusicText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^\\p{L}\\p{N}]+/gu, " ")
    .trim();
}

async function searchMusicMetadata(query, ctx) {
  const terms = query.normalize("NFKC").replace(/[\\\\\\"]/g, " ").trim();
  const normalizedQuery = normalizeMusicText(terms);
  const params = new URLSearchParams();
  // No buscamos por recording: ese campo provocaba coincidencias irrelevantes.
  params.set("query", `artist:"${terms}" OR release:"${terms}"`);
  params.set("fmt", "json");
  params.set("limit", "50");
  const response = await cachedFetch(`https://musicbrainz.org/ws/2/release/?${params}`, ctx, 3600);
  if (!response.ok) throw new Error(`MusicBrainz respondió HTTP ${response.status}`);
  const payload = await response.json();

  const candidates = (payload.releases || []).map(item => {
    const credit = (item["artist-credit"] || []).map(part => typeof part === "string" ? part : (part.name || part.artist?.name || "")).join("");
    const title = item.title || "Álbum sin título";
    const artistNorm = normalizeMusicText(credit);
    const titleNorm = normalizeMusicText(title);
    const artistMatch = artistNorm === normalizedQuery ? 100 : artistNorm.includes(normalizedQuery) ? 80 : 0;
    const titleMatch = titleNorm === normalizedQuery ? 95 : titleNorm.includes(normalizedQuery) ? 75 : 0;
    const score = Math.max(artistMatch, titleMatch);
    if (!score) return null;

    const groupId = item["release-group"]?.id || "";
    return {
      score,
      release: {
        id: item.id,
        title,
        artist: credit || "Artista desconocido",
        date: item.date || "",
        country: item.country || "",
        releaseGroupId: groupId,
        artworkURL: groupId ? `https://coverartarchive.org/release-group/${groupId}/front-250` : "",
        provider: "MusicBrainz",
        metadataOnly: true,
        url: `https://musicbrainz.org/release/${item.id}`
      }
    };
  }).filter(Boolean);

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 25).map(item => item.release);
}

async function searchArchive(query, ctx) {
  // IA usa sintaxis Lucene. Evitamos comillas/paréntesis aportados por el usuario
  // para no convertir una búsqueda normal en una consulta mal formada.
  const terms = query.normalize("NFKC").replace(/[^\p{L}\p{N} _-]/gu, " ").trim();
  const params = new URLSearchParams();
  // Buscar por título, artista, álbum y metadatos descriptivos.
  // Así aparecen registros aunque el artista no figure en el título.
  const searchableFields = ["title", "creator", "album", "collection", "subject", "description", "genre"];
  const fieldQuery = searchableFields.map(field => `${field}:(${terms})`).join(" OR ");
  params.set("q", `mediatype:audio AND (${fieldQuery})`);
  for (const field of ["identifier", "title", "creator", "album", "collection", "subject", "description", "genre", "date", "year", "runtime", "licenseurl"]) {
    params.append("fl[]", field);
  }
  params.set("rows", "100");
  params.set("page", "1");
  params.set("output", "json");

  const response = await cachedFetch(`${ARCHIVE_SEARCH}?${params}`, ctx, 300);
  if (!response.ok) throw new Error(`Internet Archive Search HTTP ${response.status}`);
  const payload = await response.json();
  const docs = payload?.response?.docs || [];
  const licensedDocs = docs
    .filter(item => safeId(String(item.identifier || "")) && licensed(item))
    .slice(0, 60);
  return {
    docs: licensedDocs,
    totalFound: Number(payload?.response?.numFound || 0),
    checked: docs.length
  };
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
    if (url.pathname === "/catalog/search") {
      if (query.length < 2 || query.length > 100) return json({ error: "La búsqueda debe tener entre 2 y 100 caracteres." }, 400, origin);
      try {
        const releases = await searchMusicMetadata(query, ctx);
        return json({ provider: "MusicBrainz", releases }, 200, origin, { "Cache-Control": "public, max-age=3600" });
      } catch (error) {
        return json({ error: "No se pudo consultar el catálogo musical.", detail: String(error?.message || error).slice(0, 160) }, 502, origin);
      }
    }
    if (url.pathname === "/search" || url.pathname === "/api/search") {
      if (query.length < 2 || query.length > 100) {
        return json({ error: "La búsqueda debe tener entre 2 y 100 caracteres." }, 400, origin);
      }
      try {
        const resultSet = await searchArchive(query, ctx);
        const tracks = resultSet.docs.map(trackFromItem);
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
        return json({ tracks, totalFound: resultSet.totalFound, checked: resultSet.checked, licensed: tracks.length }, 200, origin, { "Cache-Control": "public, max-age=300" });
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
