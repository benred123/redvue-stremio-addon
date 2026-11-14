/**
 * REDVUE — TMDB API gateway (Cloudflare Worker)
 * 
 * Cloudflare secret: TMDB_READ_TOKEN (the TMDB API Read Access Token).
 * This is deliberately NOT a general-purpose TMDB API proxy.
 * Supported: /health, /catalog/:slug?page=1, /search?q=...&page=1,
 * /details/:movie|series/:numericTmdbId
 *
 * TMDB attribution: This product uses the TMDB API but is not
 * endorsed or certified by TMDB.
 */
const ORIGIN = "https://benred123.github.io";
const TMDB = "https://api.themoviedb.org/3";
const IMAGE = "https://image.tmdb.org/t/p/";
const SOURCES = Object.freeze({
  "trending-movies": ["movie", "/trending/movie/week"],
  "trending-series": ["series", "/trending/tv/week"],
  "trending-today": ["movie", "/trending/movie/day"],
  "popular-movies": ["movie", "/movie/popular"],
  "popular-series": ["series", "/tv/popular"],
  "now-playing": ["movie", "/movie/now_playing"],
  "upcoming": ["movie", "/movie/upcoming"],
  "top-movies": ["movie", "/movie/top_rated"],
  "top-series": ["series", "/tv/top_rated"],
  "airing-today": ["series", "/tv/airing_today"],
  "action": ["movie", "/discover/movie", 28],
  "adventure": ["movie", "/discover/movie", 12],
  "sci-fi": ["movie", "/discover/movie", 878],
  "thriller": ["movie", "/discover/movie", 53],
  "crime-movies": ["movie", "/discover/movie", 80],
  "horror": ["movie", "/discover/movie", 27],
  "comedy-movies": ["movie", "/discover/movie", 35],
  "animation": ["movie", "/discover/movie", 16],
  "documentaries": ["movie", "/discover/movie", 99],
  "family": ["movie", "/discover/movie", 10751],
  "romance": ["movie", "/discover/movie", 10749],
  "fantasy": ["movie", "/discover/movie", 14],
  "drama-series": ["series", "/discover/tv", 18],
  "mystery-series": ["series", "/discover/tv", 9648],
  "crime-series": ["series", "/discover/tv", 80],
  "comedy-series": ["series", "/discover/tv", 35],
  "scifi-series": ["series", "/discover/tv", 10765],
  "documentary-series": ["series", "/discover/tv", 99],
  "animation-series": ["series", "/discover/tv", 16],
  "reality-series": ["series", "/discover/tv", 10764]
});
const headers = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
  "Content-Type": "application/json; charset=utf-8"
};
const reply = (value, status = 200, maxAge = 1800) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { ...headers, "Cache-Control": "public, max-age=" + maxAge }
  });
function image(path, size) {
  if (typeof path !== "string" || !/^\/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/.test(path)) return "";
  return IMAGE + size + path;
}
function normalise(item, type) {
  if (!item || !Number.isSafeInteger(item.id) || !item.poster_path || item.adult) return null;
  const release = type === "movie" ? item.release_date : item.first_air_date;
  const title = type === "movie" ? (item.title || item.original_title) : (item.name || item.original_name);
  return {
    id: "tmdb:" + type + ":" + item.id,
    tmdbId: item.id,
    type,
    name: title || "Untitled",
    poster: image(item.poster_path, "w500"),
    background: image(item.backdrop_path, "w1280"),
    description: item.overview || "",
    year: typeof release === "string" ? release.slice(0, 4) : "",
    rating: Number.isFinite(item.vote_average) ? Number(item.vote_average.toFixed(1)) : null
  };
}
function pageOf(url) {
  const n = Number(url.searchParams.get("page") || 1);
  return Number.isInteger(n) ? Math.min(500, Math.max(1, n)) : 1;
}
async function upstream(endpoint, params, token) {
  const url = new URL(TMDB + endpoint);
  url.searchParams.set("language", "en-GB");
  url.searchParams.set("include_adult", "false");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const res = await fetch(url.href, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
    cf: { cacheTtl: 1800, cacheEverything: true }
  });
  if (!res.ok) throw new Error("TMDB returned " + res.status);
  return await res.json();
}
async function catalog(slug, url, token) {
  const spec = SOURCES[slug];
  if (!spec) return reply({ error: "Unknown catalog" }, 404, 0);
  const [type, endpoint, genre] = spec;
  const p = pageOf(url);
  const params = { page: p };
  if (endpoint.startsWith("/discover/")) {
    params.sort_by = "popularity.desc";
    params["vote_count.gte"] = 20;
    params.with_genres = genre;
  }
  if (endpoint.startsWith("/movie/")) params.region = "GB";
  const data = await upstream(endpoint, params, token);
  return reply({
    page: p,
    total_pages: Math.min(500, data.total_pages || 1),
    total_results: data.total_results || 0,
    results: (data.results || []).map(v => normalise(v, type)).filter(Boolean)
  }, 200, endpoint.startsWith("/trending/") ? 900 : 1800);
}
async function search(url, token) {
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2 || q.length > 120) return reply({ error: "Search query must contain 2-120 characters" }, 400, 0);
  const page = pageOf(url);
  const [movies, series] = await Promise.all([
    upstream("/search/movie", { query: q, page }, token),
    upstream("/search/tv", { query: q, page }, token)
  ]);
  const results = [...(movies.results || []).map(v => normalise(v, "movie")),
    ...(series.results || []).map(v => normalise(v, "series"))]
    .filter(Boolean)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return reply({
    page,
    total_pages: Math.min(500, Math.max(movies.total_pages || 1, series.total_pages || 1)),
    results
  }, 200, 120);
}
async function details(type, id, token) {
  const tv = type === "series";
  const media = tv ? "tv" : "movie";
  const meta = await upstream("/" + media + "/" + id, tv ? { append_to_response: "external_ids" } : {}, token);
  const imdbId = tv ? meta.external_ids?.imdb_id : meta.imdb_id;
  const name = tv ? (meta.name || meta.original_name) : (meta.title || meta.original_title);
  return reply({
    id: "tmdb:" + type + ":" + id, tmdbId: Number(id), type,
    name: name || "Untitled",
    description: meta.overview || "",
    poster: image(meta.poster_path, "w500"),
    background: image(meta.backdrop_path, "w1280"),
    year: ((tv ? meta.first_air_date : meta.release_date) || "").slice(0, 4),
    rating: Number.isFinite(meta.vote_average) ? Number(meta.vote_average.toFixed(1)) : null,
    genres: Array.isArray(meta.genres) ? meta.genres.map(g => g.name).slice(0, 5) : [],
    imdbId: /^tt\d+$/.test(imdbId || "") ? imdbId : null
  }, 200, 86400);
}
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "GET") return reply({ error: "Method not allowed" }, 405, 0);
    const origin = request.headers.get("Origin");
    if (origin && origin !== ORIGIN && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
      return reply({ error: "This origin is not permitted" }, 403, 0);
    const url = new URL(request.url);
    if (url.pathname === "/health")
      return reply({ service: "REDVUE TMDB gateway", configured: Boolean(env.TMDB_READ_TOKEN) }, 200, 0);
    if (!env.TMDB_READ_TOKEN)
      return reply({ error: "TMDB_READ_TOKEN secret not configured" }, 503, 0);
    try {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 2 && parts[0] === "catalog") return await catalog(parts[1], url, env.TMDB_READ_TOKEN);
      if (parts.length === 1 && parts[0] === "search") return await search(url, env.TMDB_READ_TOKEN);
      if (parts.length === 3 && parts[0] === "details" && ["movie", "series"].includes(parts[1]) && /^[1-9]\d{0,9}$/.test(parts[2]))
        return await details(parts[1], parts[2], env.TMDB_READ_TOKEN);
      return reply({ error: "Route not found" }, 404, 0);
    } catch (err) {
      console.error("REDVUE TMDB gateway:", String(err));
      return reply({ error: "Metadata provider unavailable; try again shortly" }, 502, 0);
    }
  }
};
