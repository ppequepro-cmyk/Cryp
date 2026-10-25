const ALLOWED_ORIGINS = new Set([
  "https://ppequepro-cmyk.github.io",
  "https://nore-music-api.ppequepro.workers.dev"
]);

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://ppequepro-cmyk.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
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
      return json({ ok: true, service: "NORE MUSIC API", provider: "iTunes Search API" }, 200, origin);
    }

    if (url.pathname !== "/api/search") {
      return json({ error: "Ruta no encontrada" }, 404, origin);
    }

    const query = (url.searchParams.get("q") || "").trim();
    if (query.length < 2 || query.length > 100) {
      return json({ error: "La búsqueda debe tener entre 2 y 100 caracteres." }, 400, origin);
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("Access-Control-Allow-Origin", corsHeaders(origin)["Access-Control-Allow-Origin"]);
      headers.set("Vary", "Origin");
      return new Response(cached.body, { status: cached.status, headers });
    }

    const apiUrl = new URL("https://itunes.apple.com/search");
    apiUrl.search = new URLSearchParams({
      term: query,
      media: "music",
      entity: "song",
      limit: "20",
      country: "MX"
    }).toString();

    try {
      const response = await fetch(apiUrl.toString(), {
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        return json({ error: "El catálogo musical no pudo completar la búsqueda." }, 502, origin);
      }

      const payload = await response.json();
      const items = (payload.results || []).map(track => ({
        id: String(track.trackId || ""),
        title: track.trackName || "Sin título",
        artist: track.artistName || "Artista desconocido",
        album: track.collectionName || "",
        thumbnail: track.artworkUrl100 || "",
        previewUrl: track.previewUrl || "",
        durationMs: track.trackTimeMillis || null,
        trackUrl: track.trackViewUrl || ""
      })).filter(track => track.id);

      const result = json({ items }, 200, origin, {
        "Cache-Control": "public, max-age=300"
      });
      ctx.waitUntil(cache.put(cacheKey, result.clone()));
      return result;
    } catch {
      return json({ error: "No se pudo conectar con el catálogo musical. Inténtalo de nuevo." }, 502, origin);
    }
  }
};
