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
      return json({ ok: true, service: "NORE MUSIC API" }, 200, origin);
    }

    if (url.pathname !== "/api/search") {
      return json({ error: "Ruta no encontrada" }, 404, origin);
    }

    const query = (url.searchParams.get("q") || "").trim();
    if (query.length < 2 || query.length > 100) {
      return json({ error: "La búsqueda debe tener entre 2 y 100 caracteres." }, 400, origin);
    }

    if (!env.YOUTUBE_API_KEY) {
      return json({ error: "El servicio de búsqueda aún no está configurado." }, 503, origin);
    }

    const cache = caches.default;
    const cacheUrl = new URL(request.url);
    const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("Access-Control-Allow-Origin", corsHeaders(origin)["Access-Control-Allow-Origin"]);
      headers.set("Vary", "Origin");
      return new Response(cached.body, { status: cached.status, headers });
    }

    const apiUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    apiUrl.search = new URLSearchParams({
      part: "snippet",
      type: "video",
      videoCategoryId: "10",
      maxResults: "15",
      safeSearch: "strict",
      q: query,
      key: env.YOUTUBE_API_KEY
    }).toString();

    try {
      const response = await fetch(apiUrl.toString());
      const payload = await response.json();

      if (!response.ok) {
        const reason = payload?.error?.errors?.[0]?.reason;
        const status = response.status === 403 ? 503 : 502;
        return json({
          error: reason === "quotaExceeded"
            ? "Se alcanzó el límite diario de búsquedas. Inténtalo mañana."
            : "YouTube no pudo completar la búsqueda."
        }, status, origin);
      }

      const items = (payload.items || []).map(item => ({
        id: item.id?.videoId || "",
        title: item.snippet?.title || "Sin título",
        artist: item.snippet?.channelTitle || "Canal de YouTube",
        thumbnail: item.snippet?.thumbnails?.high?.url
          || item.snippet?.thumbnails?.medium?.url
          || item.snippet?.thumbnails?.default?.url
          || "",
        publishedAt: item.snippet?.publishedAt || ""
      })).filter(item => item.id);

      const result = json({ items }, 200, origin, {
        "Cache-Control": "public, max-age=300"
      });
      ctx.waitUntil(cache.put(cacheKey, result.clone()));
      return result;
    } catch {
      return json({ error: "No se pudo conectar con YouTube. Inténtalo de nuevo." }, 502, origin);
    }
  }
};
