(function (global) {
    "use strict";

    if (global.__KV_BLOCKED) return;

    // 1. Official Social Media Config (synced with my site/index.html)
    global.KAVEEZ_SOCIAL_CONFIG = {
        facebook: "https://www.facebook.com/share/1DxNnVeAsr/",
        whatsappChannel: "https://whatsapp.com/channel/0029Vb8TOKv3LdQTui689i0W",
        linkedin: "https://www.linkedin.com/in/kaveesha-theekshana-664290299?utm_source=share_via&utm_content=profile&utm_medium=member_android",
        instagram: "https://www.instagram.com/kaveez.exe?exln=ZXhoaXhhaXR1Zzk2",
        threads: "https://www.threads.com/@kaveez.exe",
        tiktok: "https://www.tiktok.com/@kaveez.exe"
    };

    global.SMART_LINK_URL = "https://www.profitableratecpmnetwork.com/bimt4xwp4f?key=4d93b0e7c4433b4547dc0a98e66fb34a";
    const FALLBACK_POSTER = "https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg";
    const SEO_FALLBACK_POSTER = "https://moviestream.top/images/seo-banner.jpg?v=8";
    const MOVIE_SECRET_KEY = "MovieStream_Stealth_Key_2026";
    const API_SECRET_SALT = "MS_CLOUD_SECURE_TOKEN_2026";

    // 2. Environment-Aware Origin Helpers
    function isLocalLiveServer() {
        const h = (window.location.hostname || "").toLowerCase();
        return (h === "localhost" || h === "127.0.0.1") && String(window.location.port) === "5500";
    }

    function getApiBase() {
        if (isLocalLiveServer()) {
            return localStorage.getItem("ms_local_api_base") || "https://moviestream.top";
        }
        return "";
    }

    function getBotOriginCandidates() {
        if (isLocalLiveServer()) {
            const custom = localStorage.getItem("ms_local_bot_base");
            return custom ? [custom, "https://moviestream.top"] : ["https://moviestream.top"];
        }
        return [""];
    }

    // 3. Crypto & URL Normalization (RC4 + SHA-256 + wodocloud fix)
    function rc4Crypt(key, dataBytes) {
        const s = new Uint8Array(256);
        let j = 0;
        for (let i = 0; i < 256; i++) s[i] = i;
        const keyBytes = new TextEncoder().encode(key);
        for (let i = 0; i < 256; i++) {
            j = (j + s[i] + keyBytes[i % keyBytes.length]) % 256;
            const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
        }
        let i = 0; j = 0;
        const out = new Uint8Array(dataBytes.length);
        for (let idx = 0; idx < dataBytes.length; idx++) {
            i = (i + 1) % 256;
            j = (j + s[i]) % 256;
            const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
            out[idx] = dataBytes[idx] ^ s[(s[i] + s[j]) % 256];
        }
        return out;
    }

    function encryptMovieUrl(url) {
        if (!url) return "";
        if (url.startsWith("enc_")) return url;
        const dataBytes = new TextEncoder().encode(url);
        const encrypted = rc4Crypt(MOVIE_SECRET_KEY, dataBytes);
        let hex = "";
        for (const b of encrypted) hex += b.toString(16).padStart(2, "0");
        return "enc_" + hex;
    }

    function decryptMovieUrl(token) {
        if (!token || !token.startsWith("enc_")) return token;
        try {
            const hex = token.slice(4);
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < bytes.length; i++) {
                bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
            }
            const dec = rc4Crypt(MOVIE_SECRET_KEY, bytes);
            return new TextDecoder().decode(dec);
        } catch (_) {
            return token;
        }
    }

    function normalizeCineSubzDirectUrl(url) {
        if (!url || typeof url !== "string") return url;
        return url.replace(/(\b[a-z0-9-]+\.)?supercloud1?\.xyz\b/gi, (m, prefix) => `${prefix || ""}wodocloud.xyz`);
    }

    function unwrapNestedDownloadUrl(rawTarget) {
        let out = String(rawTarget || "");
        let guard = 0;
        while ((out.includes("/api/download") || out.includes("/download")) && (out.includes("url=") || out.includes("token=")) && guard++ < 5) {
            try {
                const u = new URL(out, window.location.origin);
                const tok = u.searchParams.get("token");
                const rawUrl = u.searchParams.get("url");
                if (tok && tok.startsWith("enc_")) out = decryptMovieUrl(tok);
                else if (rawUrl) out = decodeURIComponent(rawUrl);
                else break;
            } catch (_) {
                break;
            }
        }
        return normalizeCineSubzDirectUrl(out);
    }

    async function genApiHeaders() {
        const ts = Date.now().toString();
        let hex = "";
        try {
            if (crypto && crypto.subtle) {
                const msgBytes = new TextEncoder().encode(`${ts}:${API_SECRET_SALT}`);
                const buf = await crypto.subtle.digest("SHA-256", msgBytes);
                hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
            }
        } catch (_) {}
        const headers = {
            "X-Client-Timestamp": ts,
            "X-Client-Signature": hex
        };
        if (global.__KV_SENTINEL_TOKEN) {
            headers["X-Sentinel-Token"] = global.__KV_SENTINEL_TOKEN;
        }
        return headers;
    }

    // 4. Universal CineSubz & Sinhala API Fetchers
    async function fetchCineSubzAPI(endpoint) {
        if (global.__KV_BLOCKED) throw new Error("ERR_ORIGIN_VERIFICATION");
        const path = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
        const headers = await genApiHeaders();
        const bases = [getApiBase()];

        for (const base of bases) {
            try {
                const res = await fetch(`${base}${path}`, {
                    headers,
                    signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined
                });
                if (res.status === 403) {
                    const data403 = await res.json().catch(() => ({}));
                    if (data403 && data403.code === "ERR_ORIGIN_VERIFICATION") {
                        console.warn("Origin verification rejected by server");
                        if (!isLocalLiveServer() && typeof global.__KV_RENDER_403 === "function") {
                            global.__KV_RENDER_403();
                            throw new Error("ERR_ORIGIN_VERIFICATION");
                        }
                    }
                    continue;
                }
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.offline) continue;
                    return data;
                }
            } catch (_) {}
        }

        const fb = getOfflineFallback(path);
        if (fb) return fb;
        throw new Error("Unable to fetch CineSubz API");
    }

    let _lastSinhalaWasFallback = false;

    function normalizeTelegramImageUrl(imgUrl) {
        if (!imgUrl || typeof imgUrl !== "string") return FALLBACK_POSTER;
        const trimmed = imgUrl.trim();
        const botApiBase = getApiBase();
        if (trimmed.startsWith("/images/sinhala/")) {
            return `${botApiBase}/api/bot-image/${encodeURIComponent(trimmed.slice(16))}`;
        }
        if (trimmed.startsWith("/images/")) {
            return `${botApiBase}/api/bot-image/${encodeURIComponent(trimmed.slice(8))}`;
        }
        if (trimmed.startsWith("https://moviestream.kaveez.top/images/") || trimmed.startsWith("https://moviestream.top/images/sinhala/")) {
            const fn = trimmed.split("/").pop();
            return `${botApiBase}/api/bot-image/${encodeURIComponent(fn)}`;
        }
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
        return FALLBACK_POSTER;
    }

    function normalizeSinhalaRecord(m) {
        const title = m.title || "Sinhala Movie";
        const ym = String(title).match(/\b(19\d{2}|20\d{2})\b/);
        const dl = m.downloadLink || m.url || "";
        const source = m.source === "cinesubz" ? "cinesubz" : "telegram";
        return {
            _id: m._id || encodeURIComponent(title),
            title,
            imageUrl: normalizeTelegramImageUrl(m.imageUrl || m.image),
            image: normalizeTelegramImageUrl(m.imageUrl || m.image),
            downloadLink: dl,
            url: m.url || dl,
            year: m.year || (ym ? ym[1] : ""),
            quality: m.quality || (source === "telegram" ? "SINHALA HD" : "HD"),
            rating: m.rating || "",
            source,
            media_type: m.media_type || "movies",
            language: m.language || "Sinhala",
            synopsis: m.synopsis || ""
        };
    }

    function getFallbackSinhalaList(query = "", year = "") {
        const fbRaw = Array.isArray(global.CINESUBZ_FALLBACK_SINHALA) ? global.CINESUBZ_FALLBACK_SINHALA : [];
        let list = fbRaw.map(normalizeSinhalaRecord);
        const q = String(query || "").trim().toLowerCase();
        if (q) {
            list = list.filter(item =>
                (item.title || "").toLowerCase().includes(q) ||
                (item.synopsis || "").toLowerCase().includes(q)
            );
        }
        if (year && year !== "all") {
            list = list.filter(item => String(item.year || "") === String(year) || (item.title || "").includes(String(year)));
        }
        return list;
    }

    function isSinhalaFallbackActive() {
        return _lastSinhalaWasFallback;
    }

    async function fetchSinhalaMovies(query = "", year = "") {
        if (global.__KV_BLOCKED) return [];
        const headers = await genApiHeaders();
        const qs = new URLSearchParams();
        if (query) qs.set("q", query);
        if (year && year !== "all") qs.set("year", year);
        const queryStr = qs.toString() ? `?${qs.toString()}` : "";

        for (const base of getBotOriginCandidates()) {
            try {
                const res = await fetch(`${base}/api/sinhala-movies${queryStr}`, {
                    headers,
                    signal: AbortSignal.timeout ? AbortSignal.timeout(6500) : undefined
                });
                if (res.status === 403) {
                    const data403 = await res.json().catch(() => ({}));
                    if (data403 && data403.code === "ERR_ORIGIN_VERIFICATION" && !isLocalLiveServer() && typeof global.__KV_RENDER_403 === "function") {
                        global.__KV_RENDER_403();
                        return [];
                    }
                    continue;
                }
                if (!res.ok) continue;
                const upstreamOffline = (res.headers.get("X-Upstream-Status") || "").toLowerCase() === "offline";
                const data = await res.json();
                const list = Array.isArray(data) ? data : (Array.isArray(data?.movies) ? data.movies : (Array.isArray(data?.items) ? data.items : null));
                if (upstreamOffline) continue;
                if (list) {
                    if (list.length === 0 && !query) continue;
                    _lastSinhalaWasFallback = false;
                    return list.map(normalizeSinhalaRecord);
                }
            } catch (_) {}
        }

        _lastSinhalaWasFallback = true;
        return getFallbackSinhalaList(query, year);
    }

    function getOfflineFallback(endpoint) {
        const hp = global.CINESUBZ_FALLBACK_HOMEPAGE || {};
        if (endpoint.includes("/api/homepage")) {
            return hp;
        }
        if (endpoint.includes("/api/categories")) {
            return global.CINESUBZ_TAXONOMY || { collections: [], languages: [], genres: [], years: [] };
        }
        if (endpoint.includes("/api/search")) {
            try {
                const u = new URL(endpoint, "https://moviestream.top");
                const q = (u.searchParams.get("q") || "").toLowerCase().trim();
                const all = deduplicateMovies(Object.values(hp).flat());
                return { results: q ? all.filter(m => (m.title || "").toLowerCase().includes(q)) : all.slice(0, 20) };
            } catch (_) {}
        }
        if (endpoint.includes("/api/person") || (endpoint.includes("/api/category") && /[?&]type=(?:cast|director|creator|actor)(?:%2f|\/)/i.test(endpoint))) {
            try {
                const u = new URL(endpoint, "https://moviestream.top");
                const rawRef = u.searchParams.get("url") || u.searchParams.get("slug") || u.searchParams.get("type") || "";
                const typeParam = (u.searchParams.get("type") || "").toLowerCase();
                let ptype = (typeParam === "director" || typeParam === "creator" || typeParam === "actor" || typeParam === "cast") ? typeParam : "cast";
                let slug = rawRef.trim();
                const refMatch = rawRef.match(/(?:https?:\/\/[^/]+)?\/?(cast|director|creator|actor)\/([^/?#]+)/i);
                if (refMatch) {
                    ptype = refMatch[1].toLowerCase();
                    slug = refMatch[2].trim().toLowerCase();
                } else {
                    slug = slug.replace(/^\/+|\/+$/g, "").toLowerCase();
                }

                const personsDb = global.CINESUBZ_FALLBACK_PERSONS || {};
                const exactEntry = personsDb[`${ptype}/${slug}`] || personsDb[`cast/${slug}`] || personsDb[`director/${slug}`] || null;
                let results = exactEntry && Array.isArray(exactEntry.results) ? [...exactEntry.results] : [];
                let personName = (exactEntry && exactEntry.name) || slug.split("-").filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
                let personImg = (exactEntry && exactEntry.image) || "";

                const seenUrls = new Set(results.map(r => String(r.url || "").replace(/\/+$/, "").toLowerCase()));
                const fbList = global.CINESUBZ_FALLBACK_DETAILS || [];
                for (const det of fbList) {
                    if (!det) continue;
                    const people = [...(det.cast || []), ...(det.directors || [])];
                    const hit = people.find(p => p && ((p.slug || "").toLowerCase() === slug || (p.name || "").toLowerCase() === personName.toLowerCase()));
                    if (hit) {
                        if (!personImg && hit.image) personImg = hit.image;
                        if (hit.name && personName.toLowerCase() === slug.replace(/-/g, " ")) personName = hit.name;
                        const du = String(det.url || "").replace(/\/+$/, "").toLowerCase();
                        if (du && !seenUrls.has(du)) {
                            seenUrls.add(du);
                            results.push({
                                title: det.title,
                                url: det.url,
                                image: det.poster || det.image || FALLBACK_POSTER,
                                rating: det.imdb || det.rating || "N/A",
                                quality: det.quality_badge || det.quality || "HD",
                                year: det.year || "",
                                type: det.seasons && det.seasons.length ? "TV Show" : "Movie"
                            });
                        }
                    }
                }
                const page = Math.max(1, parseInt(u.searchParams.get("page") || "1", 10) || 1);
                return {
                    name: personName,
                    type: ptype,
                    slug,
                    image: personImg,
                    page,
                    total: results.length,
                    results: page > 1 ? [] : results,
                    offline: true
                };
            } catch (_) {}
        }
        if (endpoint.includes("/api/category") || endpoint.includes("/api/filter")) {
            try {
                const OFFLINE_SLUG_ALIASES = {
                    "trending now": "trending",
                    "trending-now": "trending",
                    "popular": "trending",
                    "complete series": "complete",
                    "complete-series": "complete",
                    "ongoing": "incomplete",
                    "ongoing series": "incomplete",
                    "ongoing-series": "incomplete",
                    "top imdb 250": "imdbtop250",
                    "top-imdb-250": "imdbtop250",
                    "top-imdb": "imdbtop250",
                    "tv": "tvshows",
                    "tvshow": "tvshows",
                    "tv shows": "tvshows",
                    "tv-shows": "tvshows",
                    "series": "tvshows",
                    "movie": "movies",
                    "all movies": "movies",
                    "all-movies": "movies",
                    "korean": "korea",
                    "german": "germany",
                    "french": "france",
                    "spanish": "spain",
                    "sinhala-sub": "sinhala",
                    "sinhala sub": "sinhala",
                    "other language": "other-language",
                    "other": "other-language",
                    "sci-fi": "science-fiction",
                    "scifi": "science-fiction",
                    "sci fi": "science-fiction",
                    "18+": "18"
                };
                const canonicalSlug = (val) => {
                    const s = String(val || "").trim().toLowerCase();
                    if (!s || s === "all") return "";
                    return OFFLINE_SLUG_ALIASES[s] || s;
                };
                const routeKeyOf = (m) => {
                    const rawUrl = String((m && m.url) || "").trim().toLowerCase();
                    if (rawUrl) {
                        try {
                            return new URL(rawUrl, "https://cinesubz.net").pathname.replace(/\/+$/, "");
                        } catch (_) {
                            return rawUrl.replace(/^https?:\/\/[^/]+/, "").replace(/\/+$/, "");
                        }
                    }
                    return String((m && m.title) || "").trim().toLowerCase();
                };

                const buckets = Object.create(null);
                const allByKey = new Map();
                const tagsByKey = new Map();
                const registerItemTag = (item, rawSlug) => {
                    const slug = canonicalSlug(rawSlug);
                    if (!slug || !item) return;
                    const rk = routeKeyOf(item);
                    if (!rk) return;
                    if (!allByKey.has(rk)) allByKey.set(rk, item);
                    if (!buckets[slug]) buckets[slug] = new Map();
                    if (!buckets[slug].has(rk)) buckets[slug].set(rk, allByKey.get(rk));
                    if (!tagsByKey.has(rk)) tagsByKey.set(rk, new Set());
                    tagsByKey.get(rk).add(slug);

                    const uLower = String(item.url || "").toLowerCase();
                    const isTv = item.media_type === "tvshows" || uLower.includes("/tvshows/");
                    const typeSlug = isTv ? "tvshows" : (uLower.includes("/movies/") ? "movies" : "");
                    if (typeSlug) {
                        if (!buckets[typeSlug]) buckets[typeSlug] = new Map();
                        if (!buckets[typeSlug].has(rk)) buckets[typeSlug].set(rk, allByKey.get(rk));
                        tagsByKey.get(rk).add(typeSlug);
                    }
                    if (item.is_complete === true) {
                        if (!buckets.complete) buckets.complete = new Map();
                        if (!buckets.complete.has(rk)) buckets.complete.set(rk, allByKey.get(rk));
                        tagsByKey.get(rk).add("complete");
                    }
                };

                const hpSectionSlug = {
                    "Trending Now": "trending",
                    "All Movies": "movies",
                    "TV Shows": "tvshows",
                    "Complete Series": "complete",
                    "Tamil": "tamil",
                    "Hindi": "hindi",
                    "Malayalam": "malayalam",
                    "Korean": "korea",
                    "Animation": "animation",
                    "Action": "action",
                    "Top IMDB 250": "imdbtop250"
                };
                for (const [section, list] of Object.entries(hp)) {
                    const slug = hpSectionSlug[section];
                    if (slug && Array.isArray(list)) {
                        list.forEach((m) => registerItemTag(m, slug));
                    }
                }
                const archives = global.CINESUBZ_FALLBACK_ARCHIVES || {};
                for (const [slug, list] of Object.entries(archives)) {
                    if (Array.isArray(list)) {
                        list.forEach((m) => registerItemTag(m, slug));
                    }
                }
                const detailsMap = global.CINESUBZ_FALLBACK_DETAILS || {};
                for (const [dUrl, det] of Object.entries(detailsMap)) {
                    if (!det || typeof det !== "object") continue;
                    const rk = routeKeyOf({ url: det.url || dUrl, title: det.title });
                    if (!allByKey.has(rk)) continue;
                    const item = allByKey.get(rk);
                    String(det.genre || "")
                        .split(",")
                        .map((g) => g.trim())
                        .filter(Boolean)
                        .forEach((g) => registerItemTag(item, g));
                    if (det.language) registerItemTag(item, det.language);
                    if (det.is_complete === true) registerItemTag(item, "complete");
                }

                const u = new URL(endpoint, "https://moviestream.top");
                const cat = canonicalSlug(u.searchParams.get("type") || u.searchParams.get("category"));
                const genre = canonicalSlug(u.searchParams.get("genre"));
                const lang = canonicalSlug(u.searchParams.get("language"));
                const mtype = canonicalSlug(u.searchParams.get("media_type"));
                const year = String(u.searchParams.get("year") || "").trim();
                const quality = String(u.searchParams.get("quality") || "").trim().toLowerCase();
                const q = String(u.searchParams.get("q") || "").trim().toLowerCase();
                const page = Math.max(1, parseInt(u.searchParams.get("page") || "1", 10) || 1);

                const requiredSlugs = [];
                [cat, lang, genre, mtype].forEach((slug) => {
                    if (slug && !requiredSlugs.includes(slug)) requiredSlugs.push(slug);
                });

                let candidates = [];
                if (requiredSlugs.length) {
                    const hasAllBuckets = requiredSlugs.every((slug) => Boolean(buckets[slug]));
                    if (hasAllBuckets) {
                        const smallestSlug = requiredSlugs.reduce((best, cur) =>
                            buckets[cur].size < buckets[best].size ? cur : best, requiredSlugs[0]
                        );
                        for (const [rk, item] of buckets[smallestSlug].entries()) {
                            const tags = tagsByKey.get(rk);
                            if (tags && requiredSlugs.every((slug) => tags.has(slug))) {
                                candidates.push(item);
                            }
                        }
                    }
                } else {
                    candidates = Array.from(allByKey.values());
                }

                const filtered = page > 1 ? [] : candidates.filter((m) => {
                    const t = String(m.title || "").toLowerCase();
                    const uStr = String(m.url || "").toLowerCase();
                    const ql = String(m.quality || "").toLowerCase();
                    if (year && year !== "all") {
                        const yMatch = String(m.year || "") === year || (m.title && String(m.title).includes(year));
                        if (!yMatch) return false;
                    }
                    if (mtype) {
                        const wantTv = mtype === "tvshows";
                        const isTv = m.media_type === "tvshows" || uStr.includes("/tvshows/");
                        if (wantTv !== isTv) return false;
                    }
                    if (quality && quality !== "all" && !ql.includes(quality) && !t.includes(quality)) return false;
                    if (q && !t.includes(q) && !ql.includes(q)) return false;
                    return true;
                });

                return { results: filtered, offline: true, taxonomy: global.CINESUBZ_TAXONOMY };
            } catch (_) {}
        }
        if (endpoint.includes("/api/details")) {
            try {
                const u = new URL(endpoint, "https://moviestream.top");
                const target = (u.searchParams.get("url") || "").toLowerCase().replace(/\/+$/, "");
                const fbList = global.CINESUBZ_FALLBACK_DETAILS || [];
                const match = fbList.find(d => {
                    if (!d || !d.url) return false;
                    const du = d.url.toLowerCase().replace(/\/+$/, "");
                    return du === target || (du && target && (target.includes(du) || du.includes(target)));
                });
                if (match) return { details: match, offline: true };
            } catch (_) {}
        }
        return null;
    }

    function deduplicateMovies(arr) {
        const seen = new Set();
        const res = [];
        for (const item of arr || []) {
            if (!item) continue;
            const key = item.url || item._id || item.title;
            if (!key || seen.has(key)) continue;
            seen.add(key);
            res.push(item);
        }
        return res;
    }

    // 5. Formatting, Filenames & Size Helpers
    function escapeHtml(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getCleanDownloadFileName(titleHint, seasonHint, episodeHint, isTv, rawUrl) {
        let ext = "mp4";
        if (rawUrl) {
            const mExt = rawUrl.match(/\.(mp4|mkv|avi|mov|webm|flv|ts)(?:[?#]|$)/i);
            if (mExt) ext = mExt[1].toLowerCase();
        }
        let sNum = seasonHint ? (String(seasonHint).match(/\d+/) ? parseInt(String(seasonHint).match(/\d+/)[0], 10) : null) : null;
        let eNum = episodeHint ? (String(episodeHint).match(/\d+/) ? parseInt(String(episodeHint).match(/\d+/)[0], 10) : null) : null;
        const pool = `${titleHint || ""} ${rawUrl || ""}`;
        if (sNum === null || eNum === null) {
            const m = pool.match(/[sS](\d{1,2})\s*[-._ ]*[eE](\d{1,3})/);
            if (m) {
                if (sNum === null) sNum = parseInt(m[1], 10);
                if (eNum === null) eNum = parseInt(m[2], 10);
            }
        }
        let base = String(titleHint || "Movie")
            .replace(/[\u2018\u2019']/g, "'").replace(/[\u201C\u201D"]/g, "").replace(/[\u2013\u2014]/g, "-")
            .replace(/\|.*$/i, "")
            .replace(/\b(sinhala|subtitles?|tv\s*series|complete|incomplete|cinesubz(?:\.\w+)?|moviestream)\b/gi, "")
            .replace(/[^\x20-\x7E]/g, " ")
            .replace(/[/\\?%*:|"<>]/g, "")
            .replace(/\s+/g, " ").trim();
        if (!base) base = "Movie";
        if ((isTv || (sNum !== null && eNum !== null)) && sNum !== null && eNum !== null) {
            return `${base} S${String(sNum).padStart(2, "0")}E${String(eNum).padStart(2, "0")} MovieStream.${ext}`;
        }
        return `${base} MovieStream.${ext}`;
    }

    function parseQualitySize(qStr, explicitSize) {
        if (explicitSize && explicitSize !== "N/A") return String(explicitSize).trim();
        const m = String(qStr || "").match(/(\d+(?:\.\d+)?\s*(?:GB|MB))/i);
        return m ? m[1].toUpperCase() : "Direct HD";
    }

    function isSizeOver2GB(sizeStr) {
        const s = String(sizeStr || "").toUpperCase();
        const gb = s.match(/([\d.]+)\s*GB/);
        if (gb && parseFloat(gb[1]) >= 1.95) return true;
        const mb = s.match(/([\d.]+)\s*MB/);
        if (mb && parseFloat(mb[1]) >= 2000) return true;
        return false;
    }

    function optimizePosterUrl(url) {
        if (!url || url === "N/A") return FALLBACK_POSTER;
        let out = String(url).trim();
        if (out.includes("image.tmdb.org/t/p/original")) {
            out = out.replace("/t/p/original/", "/t/p/w500/");
        }
        return out;
    }

    function cleanDisplayTitle(title) {
        return String(title || "Untitled")
            .replace(/\|\s*සිංහල.*$/i, "")
            .replace(/\|\s*Sinhala\s*Subtitles?.*$/i, "")
            .replace(/\s+Sinhala\s*Subtitles?$/i, "")
            .trim();
    }

    // 6. Card Renderers (Clean White UI + Streamverse Metadata Below Poster)
    function renderPosterCard(m, opts = {}) {
        const isTg = opts.isTelegram || m.source === "telegram";
        const source = isTg ? "sinhala" : "cs";
        const rawUrl = m.url || m.downloadLink || "";
        const id = isTg ? ("sinhala_" + encodeURIComponent(m.title || "")) : encodeURIComponent(rawUrl);
        const title = cleanDisplayTitle(m.title || m.name || "Untitled");
        const rawTitle = m.title || m.name || "Untitled";
        const yearMatch = rawTitle.match(/\b(19\d{2}|20\d{2})\b/);
        const year = m.year || (yearMatch ? yearMatch[1] : "");
        const imgUrl = optimizePosterUrl(isTg ? m.imageUrl : (m.image || m.imageUrl));
        let quality = String(m.quality || (isTg ? "SINHALA" : "HD")).replace(/IMDb:.*$/i, "").trim();
        if (!quality || quality.toUpperCase() === "N/A") quality = "HD";
        const rating = m.rating && m.rating !== "N/A" ? m.rating : "";
        const isTv = m.media_type === "tvshows" || rawUrl.includes("/tvshows/") || String(m.type || "").toLowerCase().includes("tv");
        const badgeLabel = isTv ? "TV Series" : (isTg ? "Sinhala" : "Movie");

        const payloadAttr = encodeURIComponent(JSON.stringify({
            id: decodeURIComponent(id),
            source,
            title: rawTitle,
            imgUrl,
            url: rawUrl,
            year,
            quality,
            rating,
            isTv,
            language: m.language || (isTg ? "Sinhala" : ""),
            synopsis: m.synopsis || ""
        })).replace(/'/g, "%27");

        return `
        <article class="ms-card" tabindex="0" role="button" aria-label="${escapeHtml(title)}"
            data-movie-payload="${payloadAttr}"
            onclick="MovieStream.handleCardActivate(this)"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();MovieStream.handleCardActivate(this)}">
            <div class="ms-card-thumb">
                <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(title)} - Sinhala Subtitles" width="220" height="330"
                    loading="lazy" decoding="async" referrerpolicy="no-referrer"
                    onerror="this.onerror=null;this.src='${FALLBACK_POSTER}';">
                <div class="ms-card-badges">
                    <span class="ms-badge-q ${isTg ? "tg" : ""}">${escapeHtml(quality)}</span>
                    ${rating ? `<span class="ms-badge-rate">&#9733; ${escapeHtml(rating)}</span>` : ""}
                </div>
                <div class="ms-card-hover-play" aria-hidden="true">
                    <div class="ms-play-circle">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                </div>
            </div>
            <div class="ms-card-body">
                <h3 class="ms-card-title" title="${escapeHtml(rawTitle)}">${escapeHtml(title)}</h3>
                <div class="ms-card-meta">
                    <span>${year ? escapeHtml(year) : badgeLabel} &bull; ${isTg ? "Sinhala" : (isTv ? "Series" : "Sub")}</span>
                    ${rating ? `<span style="color:#d97706;font-weight:700">&#9733; ${escapeHtml(rating)}</span>` : `<span>${isTv ? "TV" : "HD"}</span>`}
                </div>
            </div>
        </article>`;
    }

    function renderContinueWatchingRow(containerId) {
        const container = document.getElementById(containerId);
        const section = document.getElementById("continue-watching-section");
        if (!container || !section) return;
        let items = [];
        try {
            items = JSON.parse(localStorage.getItem("ms_watch_history") || "[]");
        } catch (_) { items = []; }

        if (!Array.isArray(items) || items.length === 0) {
            section.classList.add("hidden");
            return;
        }
        section.classList.remove("hidden");
        container.innerHTML = items.slice(0, 10).map((m) => {
            const payloadAttr = encodeURIComponent(JSON.stringify(m)).replace(/'/g, "%27");
            const pct = Math.min(95, Math.max(15, Number(m.progress || 42)));
            return `
            <article class="ms-cw-card" tabindex="0" role="button" data-movie-payload="${payloadAttr}"
                onclick="MovieStream.handleCardActivate(this)">
                <div class="ms-cw-thumb">
                    <img src="${escapeHtml(optimizePosterUrl(m.imgUrl))}" alt="${escapeHtml(cleanDisplayTitle(m.title))}" loading="lazy" referrerpolicy="no-referrer"
                        onerror="this.onerror=null;this.src='${SEO_FALLBACK_POSTER}'">
                    <div class="ms-cw-progress"><div class="ms-cw-progress-fill" style="width:${pct}%"></div></div>
                </div>
                <div class="ms-card-body">
                    <h3 class="ms-card-title">${escapeHtml(cleanDisplayTitle(m.title))}</h3>
                    <div class="ms-card-meta">
                        <span>${m.episodeLabel ? escapeHtml(m.episodeLabel) : "Resume"}</span>
                        <span style="color:var(--ms-red);font-weight:700">Continue &rsaquo;</span>
                    </div>
                </div>
            </article>`;
        }).join("");
    }

    function saveWatchHistory(movieObj, progress = 35) {
        try {
            let list = JSON.parse(localStorage.getItem("ms_watch_history") || "[]");
            if (!Array.isArray(list)) list = [];
            list = list.filter(x => (x.url || x.title) !== (movieObj.url || movieObj.title));
            list.unshift({
                id: movieObj.id || "",
                source: movieObj.source || "cs",
                title: movieObj.title || "Movie",
                imgUrl: movieObj.imgUrl || movieObj.image || FALLBACK_POSTER,
                url: movieObj.url || "",
                year: movieObj.year || "",
                quality: movieObj.quality || "HD",
                episodeLabel: movieObj.episodeLabel || "",
                progress
            });
            localStorage.setItem("ms_watch_history", JSON.stringify(list.slice(0, 14)));
        } catch (_) {}
    }

    // 7. Page Routing (New Tab Movie Detail & Instant Quality Download Popup) & Toast
    function openMoviePage(moviePayload, autoPlay = false, mirrorIdx = null) {
        if (!moviePayload) return;
        const normalized = {
            ...moviePayload,
            imgUrl: optimizePosterUrl(moviePayload.imgUrl || moviePayload.image || moviePayload.imageUrl),
            url: moviePayload.url || moviePayload.downloadLink || "",
            source: moviePayload.source === "telegram" ? "sinhala" : (moviePayload.source || "cs"),
            autoPlay: Boolean(autoPlay)
        };
        try {
            saveWatchHistory(normalized, autoPlay ? 35 : 15);
            sessionStorage.setItem("ms_pending_movie", JSON.stringify(normalized));
        } catch (_) {}

        const params = new URLSearchParams();
        if (normalized.title) params.set("title", normalized.title);
        if (normalized.url) params.set("url", normalized.url);
        if (normalized.source) params.set("source", normalized.source);
        if (normalized.imgUrl) params.set("img", normalized.imgUrl);
        if (normalized.year) params.set("year", normalized.year);
        if (normalized.quality) params.set("quality", normalized.quality);
        if (normalized.rating) params.set("rating", normalized.rating);
        if (autoPlay) params.set("autoplay", "1");
        if (mirrorIdx !== null && mirrorIdx !== undefined) params.set("mirror", String(mirrorIdx));

        const targetUrl = `movie.html?${params.toString()}`;
        try {
            const win = window.open(targetUrl, "_blank");
            if (!win) window.location.href = targetUrl;
        } catch (_) {
            window.location.href = targetUrl;
        }
    }

    let _dlModalState = {
        movie: null,
        mode: "download",
        links: [],
        rawLinks: [],
        seasons: null,
        seasonKey: "",
        seasonIdx: 0,
        episodeIdx: 0,
        onWatchSelect: null
    };

    function closeDownloadModal() {
        const el = document.getElementById("ms_download_popup");
        if (el) el.classList.add("hidden");
        const movieModal = document.getElementById("ms_movie_modal");
        if (!movieModal || movieModal.classList.contains("hidden")) {
            document.body.style.overflow = "";
        }
    }

    function resolvePopupDirectHref(rawUrl, qualityLabel, isDownload) {
        const cleanTitle = cleanDisplayTitle(_dlModalState.movie?.title || "Movie");
        const isTv = Boolean(_dlModalState.movie?.isTv || _dlModalState.seasons);
        const fileName = getCleanDownloadFileName(
            cleanTitle,
            _dlModalState.movie?.season,
            _dlModalState.movie?.episode,
            isTv,
            rawUrl
        );
        let u = unwrapNestedDownloadUrl(rawUrl || "");
        if (!u) return { href: "", fileName };

        if (u.includes("pixeldrain.com/u/")) {
            u = `${u.replace("/u/", "/api/file/").split("?")[0]}${isDownload ? "?download" : ""}`;
        } else if (u.includes("t.me/c/")) {
            const m = u.match(/t\.me\/c\/\d+\/(\d+)/);
            if (m) u = `https://moviestream.top/api/stream/${m[1]}`;
        } else if (["wodocloud", "supercloud", "skylines", "terracloud", "drive0", "kdrive", "cinesubz", "csplayer", "google.com/server", "zt-links"].some(d => u.includes(d))) {
            u = `${getApiBase()}/api/download?token=${encryptMovieUrl(u)}&download=${isDownload ? 1 : 0}&filename=${encodeURIComponent(fileName)}`;
        }
        return { href: u, fileName };
    }

    function normalizePopupLinks(rawLinks, movieObj) {
        const isSinhala = movieObj.source === "sinhala" || movieObj.source === "telegram" || String(movieObj.url || "").includes("t.me/");
        let list = Array.isArray(rawLinks) ? rawLinks.map((lnk, i) => {
            const rawTarget = unwrapNestedDownloadUrl(lnk.real_direct_download_url || lnk.url || lnk.link || lnk.cinesubz_link || "");
            const qInfo = lnk.quality_info || lnk.quality || lnk.label || "HD";
            const size = parseQualitySize(qInfo, lnk.size);
            return { quality_info: qInfo, size, url: rawTarget, over2gb: isSizeOver2GB(size), origIdx: i };
        }).filter(x => Boolean(x.url)) : [];

        if (!list.length && movieObj.directLink) {
            const q = movieObj.quality || "720p HD";
            list.push({ quality_info: q, size: "Direct HD", url: unwrapNestedDownloadUrl(movieObj.directLink), over2gb: false, origIdx: 0 });
        }

        if (!list.length && movieObj.url) {
            const resolvedBase = unwrapNestedDownloadUrl(movieObj.url);
            if (isSinhala) {
                list = [
                    { quality_info: "480p SD • Data Saver", size: "~450 MB", url: resolvedBase, over2gb: false, origIdx: 0 },
                    { quality_info: "720p HD • Recommended", size: "~950 MB", url: resolvedBase, over2gb: false, origIdx: 1 },
                    { quality_info: "1080p Full HD • Master", size: "~1.8 GB", url: resolvedBase, over2gb: false, origIdx: 2 }
                ];
            } else {
                list = [
                    { quality_info: `${movieObj.quality || "720p HD"} Direct Cloud`, size: "Auto Mirror", url: resolvedBase, over2gb: false, origIdx: 0 }
                ];
            }
        }
        return list;
    }

    function renderDownloadPopupBody() {
        const statusEl = document.getElementById("ms_dlp_status");
        const listEl = document.getElementById("ms_dlp_list");
        const tvEl = document.getElementById("ms_dlp_tv_wrap");
        const tabWatch = document.getElementById("ms_dlp_tab_watch");
        const tabDl = document.getElementById("ms_dlp_tab_dl");
        const tabWa = document.getElementById("ms_dlp_tab_wa");
        if (!listEl) return;

        const mode = _dlModalState.mode || "download";
        const isWatch = mode === "watch";
        const isWa = mode === "whatsapp";
        if (tabWatch) tabWatch.classList.toggle("active", isWatch);
        if (tabDl) tabDl.classList.toggle("active", !isWatch && !isWa);
        if (tabWa) tabWa.classList.toggle("active", isWa);

        if (tvEl && _dlModalState.seasons && _dlModalState.seasons.length) {
            tvEl.classList.remove("hidden");
        } else if (tvEl) {
            tvEl.classList.add("hidden");
        }

        const links = _dlModalState.links || [];
        if (!links.length) {
            listEl.innerHTML = `<div style="padding:18px;text-align:center;color:var(--ms-text-muted);font-size:0.86rem;">Resolving HD quality mirrors...</div>`;
            return;
        }

        if (statusEl && !statusEl.dataset.sticky) {
            statusEl.innerHTML = isWatch
                ? `<span>Select your preferred quality below to start the <b>CineMagic HD Player</b>.</span>`
                : isWa
                    ? `<span>Select a quality below — your WhatsApp delivery PIN will be generated instantly.</span>`
                    : `<span>Select a quality below — your download will start immediately.</span>`;
            statusEl.className = "ms-dlp-status";
        }

        listEl.innerHTML = links.map((lnk, idx) => {
            const qLabel = cleanDisplayTitle(lnk.quality_info || "HD");
            const sizeLabel = lnk.size || "Direct HD";
            const sizeWarn = isWa && lnk.over2gb ? `<span class="ms-dlq-warn">&gt;2GB WhatsApp Limit</span>` : "";
            const cardCls = isWatch ? "is-watch" : (isWa ? "is-wa" : "");
            const ctaHtml = isWatch
                ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>Watch Now</span>`
                : isWa
                    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.453 3.484 1.328 5l-1.391 5.063 5.188-1.359c1.469.797 3.125 1.219 4.844 1.219 5.516 0 9.969-4.453 9.969-9.969S17.547 2 12.031 2z"/></svg><span>Send to WhatsApp</span>`
                    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/></svg><span>Download Now</span>`;
            return `
            <div class="ms-dlq-row">
                <button type="button" class="ms-dlq-card ${cardCls}" data-no-ad="1" onclick="MovieStream.triggerPopupQualityAction(${idx})">
                    <div class="ms-dlq-left">
                        <span class="ms-dlq-badge">${escapeHtml(qLabel)}</span>
                        <div class="ms-dlq-meta">${escapeHtml(sizeLabel)} ${sizeWarn}</div>
                    </div>
                    <div class="ms-dlq-cta">${ctaHtml}</div>
                </button>
                ${(!isWa && !isWatch) ? `<button type="button" class="ms-dlq-copy" data-no-ad="1" title="Copy 1DM / IDM Direct Link" onclick="MovieStream.copyPopupQualityLink(${idx}, this)">1DM Link</button>` : ""}
            </div>`;
        }).join("");
    }

    function switchDownloadModalMode(mode) {
        _dlModalState.mode = (mode === "whatsapp" || mode === "watch") ? mode : "download";
        const statusEl = document.getElementById("ms_dlp_status");
        if (statusEl) delete statusEl.dataset.sticky;
        renderDownloadPopupBody();
    }

    function handlePopupSeasonChange(seasonIdx) {
        const s = _dlModalState.seasons?.[Number(seasonIdx)];
        if (!s) return;
        _dlModalState.seasonIdx = Number(seasonIdx) || 0;
        const epSel = document.getElementById("ms_dlp_ep_sel");
        const eps = s.episodes || [];
        if (epSel) {
            epSel.innerHTML = eps.map((ep, i) => `<option value="${i}">Ep ${escapeHtml(ep.episode_number || i + 1)} — ${escapeHtml(ep.episode_title || ep.name || ep.title || "Episode")}</option>`).join("");
        }
        handlePopupEpisodeChange(seasonIdx, 0);
    }

    async function handlePopupEpisodeChange(seasonIdx, epIdx) {
        const s = _dlModalState.seasons?.[Number(seasonIdx)];
        const ep = s?.episodes?.[Number(epIdx)];
        if (!s || !ep) return;
        _dlModalState.seasonIdx = Number(seasonIdx) || 0;
        _dlModalState.episodeIdx = Number(epIdx) || 0;
        _dlModalState.movie = {
            ..._dlModalState.movie,
            season: s.season_num || Number(seasonIdx) + 1,
            episode: ep.episode_number || Number(epIdx) + 1
        };
        let epLinks = ep.links || ep.download_links || [];
        if (!epLinks.length && ep.url) {
            const listEl = document.getElementById("ms_dlp_list");
            if (listEl) listEl.innerHTML = `<div style="padding:18px;text-align:center;color:var(--ms-text-muted);font-size:0.86rem;">Loading episode quality mirrors...</div>`;
            try {
                const res = await fetchCineSubzAPI(`/api/episode?url=${encodeURIComponent(ep.url)}`);
                const d = res?.details || res || {};
                epLinks = d.download_links || d.links || [];
            } catch (_) {}
        }
        _dlModalState.rawLinks = epLinks;
        _dlModalState.links = normalizePopupLinks(epLinks.length ? epLinks : [{ quality_info: "Episode HD", url: ep.url || _dlModalState.movie.url }], _dlModalState.movie);
        renderDownloadPopupBody();
    }

    async function triggerPopupQualityAction(idx) {
        const lnk = _dlModalState.links?.[Number(idx)];
        const movieObj = _dlModalState.movie;
        const statusEl = document.getElementById("ms_dlp_status");
        if (!lnk || !movieObj) return;

        const cleanTitle = cleanDisplayTitle(movieObj.title || "Movie");
        const qLabel = cleanDisplayTitle(lnk.quality_info || "HD");
        const isSinhala = movieObj.source === "sinhala" || movieObj.source === "telegram" || String(movieObj.url || "").includes("t.me/");

        if (_dlModalState.mode === "watch") {
            const onWatch = _dlModalState.onWatchSelect;
            const origIdx = typeof lnk.origIdx === "number" ? lnk.origIdx : Number(idx);
            const sIdx = _dlModalState.seasonIdx || 0;
            const eIdx = _dlModalState.episodeIdx || 0;
            closeDownloadModal();
            if (typeof onWatch === "function") {
                onWatch(origIdx, lnk, sIdx, eIdx);
            } else {
                openMoviePage({
                    ...movieObj,
                    download_links: _dlModalState.rawLinks || []
                }, true, origIdx);
            }
            return;
        }

        if (_dlModalState.mode === "whatsapp") {
            const epTag = (movieObj.season && movieObj.episode)
                ? ` S${String(movieObj.season).padStart(2, "0")}E${String(movieObj.episode).padStart(2, "0")}`
                : "";
            const { href: directHref } = resolvePopupDirectHref(lnk.url, qLabel, false);
            if (statusEl) {
                statusEl.dataset.sticky = "1";
                statusEl.className = "ms-dlp-status is-loading";
                statusEl.innerHTML = `<span>Generating WhatsApp PIN for <b>${escapeHtml(cleanTitle)} (${escapeHtml(qLabel)})</b>...</span>`;
            }

            let botNum = "94722926276";
            try { botNum = localStorage.getItem("moviestream_bot_number") || botNum; } catch (_) {}
            const pinBase = (getBotOriginCandidates()[0] || getApiBase() || "");
            let pin = "";
            try {
                const headers = await genApiHeaders();
                headers["Content-Type"] = "application/json";
                const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
                const tid = controller ? setTimeout(() => controller.abort(), 4500) : null;
                const res = await fetch(`${pinBase}/api/movie-pin`, {
                    method: "POST",
                    headers,
                    signal: controller ? controller.signal : undefined,
                    body: JSON.stringify({
                        movieName: `${cleanTitle}${epTag}`,
                        directLink: directHref || lnk.url,
                        quality: qLabel,
                        source: isSinhala ? "telegram" : "cinesubz"
                    })
                });
                if (tid) clearTimeout(tid);
                const data = await res.json().catch(() => ({}));
                if (res.ok && data && data.pin) pin = data.pin;
            } catch (_) {}

            const waText = pin
                ? `${cleanTitle}${epTag} (${qLabel}) - ${pin}`
                : `${cleanTitle}${epTag} (${qLabel})`;
            const waUrl = `https://wa.me/${botNum}?text=${encodeURIComponent(waText)}`;
            try { window.open(waUrl, "_blank", "noopener,noreferrer"); } catch (_) {}

            if (statusEl) {
                statusEl.dataset.sticky = "1";
                statusEl.className = "ms-dlp-status is-success";
                statusEl.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;width:100%;">
                        <span>${pin ? `WhatsApp PIN Ready: <b>${escapeHtml(pin)}</b> (${escapeHtml(qLabel)})` : `WhatsApp Request Ready (${escapeHtml(qLabel)})`}</span>
                        <a href="${escapeHtml(waUrl)}" target="_blank" rel="noopener noreferrer" class="ms-btn ms-btn-green" style="padding:7px 14px;font-size:0.78rem;">Open WhatsApp &rarr;</a>
                    </div>`;
            }
            showToast(pin ? `WhatsApp Bot PIN: ${pin}` : "Opening WhatsApp Bot...");
            return;
        }

        // Direct instant download mode
        const { href: dlUrl, fileName } = resolvePopupDirectHref(lnk.url, qLabel, true);
        if (!dlUrl) {
            showToast("No downloadable mirror available right now.");
            return;
        }

        if (dlUrl.startsWith("/") || dlUrl.startsWith(window.location.origin) || dlUrl.includes("/api/download") || dlUrl.includes("/api/stream")) {
            const a = document.createElement("a");
            a.href = dlUrl;
            a.download = fileName;
            a.rel = "noopener noreferrer";
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { if (a.parentNode) a.remove(); }, 1000);
        } else {
            window.open(dlUrl, "_blank", "noopener,noreferrer");
        }

        if (statusEl) {
            statusEl.dataset.sticky = "1";
            statusEl.className = "ms-dlp-status is-success";
            statusEl.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;width:100%;">
                    <span>Downloading <b>${escapeHtml(qLabel)}</b> (${escapeHtml(fileName)})</span>
                    <a href="${escapeHtml(dlUrl)}" target="_blank" rel="noopener noreferrer" class="ms-btn ms-btn-blue" style="padding:6px 12px;font-size:0.75rem;">Restart Link</a>
                </div>`;
        }
        showToast(`Starting ${qLabel} download...`);
    }

    function copyPopupQualityLink(idx, btnEl) {
        const lnk = _dlModalState.links?.[Number(idx)];
        if (!lnk) return;
        const { href } = resolvePopupDirectHref(lnk.url, lnk.quality_info, true);
        if (!href) return;
        const absHref = href.startsWith("http") ? href : new URL(href, window.location.origin).href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(absHref).then(() => {
                if (btnEl) btnEl.textContent = "Copied!";
                showToast("1DM / IDM direct link copied!");
                setTimeout(() => { if (btnEl) btnEl.textContent = "1DM Link"; }, 2200);
            }).catch(() => showToast("Copy failed — click Download Now instead."));
        }
    }

    function ensureDownloadModalDom() {
        let modal = document.getElementById("ms_download_popup");
        if (modal) return modal;
        modal = document.createElement("div");
        modal.id = "ms_download_popup";
        modal.className = "ms-modal-backdrop hidden";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-labelledby", "ms_dlp_title");
        modal.innerHTML = `
            <div class="ms-modal ms-dlp-dialog" onclick="event.stopPropagation()">
                <button type="button" class="ms-modal-close" aria-label="Close download popup" onclick="MovieStream.closeDownloadModal()">&times;</button>
                <div class="ms-dlp-head">
                    <img id="ms_dlp_poster" src="${FALLBACK_POSTER}" alt="" referrerpolicy="no-referrer" />
                    <div class="ms-dlp-head-info">
                        <div id="ms_dlp_meta" class="ms-dlp-meta-row"></div>
                        <h2 id="ms_dlp_title" class="ms-dlp-title">Select Quality</h2>
                        <div class="ms-dlp-tabs" role="tablist">
                            <button type="button" id="ms_dlp_tab_watch" role="tab" class="ms-dlp-tab" data-no-ad="1" onclick="MovieStream.switchDownloadModalMode('watch')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                <span>Watch Online</span>
                            </button>
                            <button type="button" id="ms_dlp_tab_dl" role="tab" class="ms-dlp-tab active" data-no-ad="1" onclick="MovieStream.switchDownloadModalMode('download')">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/></svg>
                                <span>Direct Download</span>
                            </button>
                            <button type="button" id="ms_dlp_tab_wa" role="tab" class="ms-dlp-tab" data-no-ad="1" onclick="MovieStream.switchDownloadModalMode('whatsapp')">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.453 3.484 1.328 5l-1.391 5.063 5.188-1.359c1.469.797 3.125 1.219 4.844 1.219 5.516 0 9.969-4.453 9.969-9.969S17.547 2 12.031 2z"/></svg>
                                <span>WhatsApp Bot</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="ms-dlp-body">
                    <div id="ms_dlp_tv_wrap" class="ms-dlp-tv hidden">
                        <select id="ms_dlp_season_sel" class="ms-select" data-no-ad="1" onchange="MovieStream.handlePopupSeasonChange(this.value)"></select>
                        <select id="ms_dlp_ep_sel" class="ms-select" data-no-ad="1" onchange="MovieStream.handlePopupEpisodeChange(document.getElementById('ms_dlp_season_sel').value, this.value)"></select>
                    </div>
                    <div id="ms_dlp_status" class="ms-dlp-status"></div>
                    <div id="ms_dlp_list" class="ms-dlp-list"></div>
                </div>
            </div>
        `;
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeDownloadModal();
        });
        document.body.appendChild(modal);
        return modal;
    }

    async function openDownloadModal(moviePayload, initialMode = "download") {
        if (!moviePayload) return;
        const modal = ensureDownloadModalDom();
        const normalized = {
            ...moviePayload,
            imgUrl: optimizePosterUrl(moviePayload.imgUrl || moviePayload.image || moviePayload.imageUrl),
            url: moviePayload.url || moviePayload.movieUrl || moviePayload.downloadLink || "",
            source: moviePayload.source === "telegram" ? "sinhala" : (moviePayload.source || "cs")
        };

        const rawLinks = Array.isArray(normalized.download_links)
            ? normalized.download_links
            : (Array.isArray(normalized.links) ? normalized.links : []);
        const preSeasons = Array.isArray(normalized.seasons) && normalized.seasons.length > 0 ? normalized.seasons : null;
        const modeVal = (initialMode === "whatsapp" || initialMode === "watch") ? initialMode : "download";
        const initSeasonIdx = Math.max(0, Number(normalized.seasonIdx) || 0);
        const initEpIdx = Math.max(0, Number(normalized.episodeIdx) || 0);

        _dlModalState = {
            movie: normalized,
            mode: modeVal,
            links: normalizePopupLinks(rawLinks, normalized),
            rawLinks: rawLinks,
            seasons: preSeasons,
            seasonIdx: initSeasonIdx,
            episodeIdx: initEpIdx,
            onWatchSelect: typeof moviePayload.onWatchSelect === "function" ? moviePayload.onWatchSelect : null
        };

        const titleEl = document.getElementById("ms_dlp_title");
        const posterEl = document.getElementById("ms_dlp_poster");
        const metaEl = document.getElementById("ms_dlp_meta");
        const statusEl = document.getElementById("ms_dlp_status");
        if (statusEl) delete statusEl.dataset.sticky;
        if (titleEl) titleEl.textContent = cleanDisplayTitle(normalized.title || "Select Quality");
        if (posterEl) posterEl.src = normalized.imgUrl || FALLBACK_POSTER;
        if (metaEl) {
            metaEl.innerHTML = [
                normalized.year ? `<span class="ms-tag-pill">${escapeHtml(normalized.year)}</span>` : "",
                normalized.quality ? `<span class="ms-tag-pill">${escapeHtml(normalized.quality)}</span>` : "",
                `<span class="ms-tag-pill">${normalized.source === "sinhala" ? "Sinhala Movies" : "Sinhala Subtitles"}</span>`
            ].join("");
        }

        if (preSeasons) {
            const sSel = document.getElementById("ms_dlp_season_sel");
            const epSel = document.getElementById("ms_dlp_ep_sel");
            const activeSIdx = Math.min(initSeasonIdx, preSeasons.length - 1);
            _dlModalState.seasonIdx = activeSIdx;
            if (sSel) {
                sSel.innerHTML = preSeasons.map((s, i) => `<option value="${i}">${escapeHtml(s.name || "Season " + (s.season_num || i + 1))}</option>`).join("");
                sSel.value = String(activeSIdx);
            }
            const eps = preSeasons[activeSIdx]?.episodes || [];
            const activeEpIdx = Math.min(initEpIdx, Math.max(0, eps.length - 1));
            _dlModalState.episodeIdx = activeEpIdx;
            if (epSel) {
                epSel.innerHTML = eps.map((ep, i) => `<option value="${i}">Ep ${escapeHtml(ep.episode_number || i + 1)} — ${escapeHtml(ep.episode_title || ep.name || ep.title || "Episode")}</option>`).join("");
                if (eps.length) epSel.value = String(activeEpIdx);
            }
            if (!rawLinks.length && eps.length) {
                handlePopupEpisodeChange(activeSIdx, activeEpIdx);
            }
        }

        renderDownloadPopupBody();
        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";

        const isSinhala = normalized.source === "sinhala" || String(normalized.url || "").includes("t.me/");
        const hasMultiplePassed = rawLinks.length > 0 || Boolean(preSeasons);
        if (!isSinhala && !hasMultiplePassed && normalized.url) {
            try {
                const data = await fetchCineSubzAPI(`/api/details?url=${encodeURIComponent(normalized.url)}`);
                const details = data?.details || data || {};
                if (_dlModalState.movie?.url !== normalized.url) return;
                if (details.title) _dlModalState.movie.title = details.title;
                if (Array.isArray(details.seasons) && details.seasons.length > 0) {
                    _dlModalState.seasons = details.seasons;
                    const sSel = document.getElementById("ms_dlp_season_sel");
                    if (sSel) {
                        sSel.innerHTML = details.seasons.map((s, i) => `<option value="${i}">${escapeHtml(s.name || "Season " + (s.season_num || i + 1))}</option>`).join("");
                    }
                    handlePopupSeasonChange(0);
                } else {
                    const dlList = details.download_links || details.links || details.qualities || [];
                    if (dlList.length) {
                        _dlModalState.rawLinks = dlList;
                        _dlModalState.links = normalizePopupLinks(dlList, _dlModalState.movie);
                        renderDownloadPopupBody();
                    }
                }
            } catch (_) {}
        }
    }

    function openDownloadPage(moviePayload) {
        return openDownloadModal(moviePayload, "download");
    }

    function showToast(msg) {
        const prev = document.getElementById("ms_toast_box");
        if (prev) prev.remove();
        const div = document.createElement("div");
        div.id = "ms_toast_box";
        div.className = "ms-toast";
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => { if (div.parentNode) div.remove(); }, 3400);
    }

    function scrollRow(trackId, dir) {
        const el = document.getElementById(trackId);
        if (!el) return;
        const step = Math.max(el.clientWidth * 0.78, 320);
        el.scrollBy({ left: dir * step, behavior: "smooth" });
    }

    function setActiveMobileTab() {
        const bar = document.querySelector(".ms-mobile-tabbar");
        if (!bar) return;
        const path = (window.location.pathname || "").toLowerCase();
        const qs = new URLSearchParams(window.location.search || "");
        const cat = (qs.get("cat") || "").toLowerCase();
        let activeKey = "home";
        if (path.endsWith("category.html")) {
            activeKey = cat === "sinhala" ? "sinhala" : "explore";
        } else if (path.endsWith("movie.html") || path.endsWith("download.html")) {
            activeKey = "explore";
        }
        bar.querySelectorAll("[data-mob-tab]").forEach((el) => {
            el.classList.toggle("active", el.getAttribute("data-mob-tab") === activeKey);
        });
    }

    // 8. Interactive Movie Preview / Watch Online Modal
    let currentModalMovie = null;
    let currentModalLinks = [];
    let currentSeriesSeasons = null;
    let currentSelectedDirectUrl = "";

    function handleCardActivate(cardEl) {
        if (!cardEl) return;
        const raw = cardEl.getAttribute("data-movie-payload");
        if (!raw) return;
        try {
            const obj = JSON.parse(decodeURIComponent(raw));
            openMoviePage(obj);
        } catch (e) {
            console.error("Card parse error", e);
        }
    }

    async function openMovieModal(obj) {
        const modal = document.getElementById("ms_movie_modal");
        if (!modal) {
            openDownloadPage(obj);
            return;
        }
        currentModalMovie = { ...obj };
        currentModalLinks = [];
        currentSeriesSeasons = null;
        currentSelectedDirectUrl = obj.url || "";

        saveWatchHistory(obj, 25);

        const heroImg = document.getElementById("modal_hero_img");
        const titleEl = document.getElementById("modal_title");
        const metaEl = document.getElementById("modal_meta");
        const descEl = document.getElementById("modal_desc");
        const tvSec = document.getElementById("modal_tv_section");
        const playerSec = document.getElementById("modal_player_section");
        const actionBox = document.getElementById("modal_action_box");
        const loader = document.getElementById("modal_loader");

        if (heroImg) heroImg.src = optimizePosterUrl(obj.imgUrl || obj.image);
        if (titleEl) titleEl.textContent = cleanDisplayTitle(obj.title);
        if (metaEl) {
            metaEl.innerHTML = [
                obj.year ? `<span class="ms-tag-pill">${escapeHtml(obj.year)}</span>` : "",
                obj.quality ? `<span class="ms-tag-pill">${escapeHtml(obj.quality)}</span>` : "",
                obj.rating ? `<span class="ms-star-pill">&#9733; ${escapeHtml(obj.rating)}</span>` : "",
                `<span class="ms-tag-pill">${obj.source === "sinhala" ? "Sinhala Movies" : "Sinhala Subtitles"}</span>`
            ].join("");
        }
        if (descEl) descEl.textContent = "Loading stream mirrors and download options...";
        if (tvSec) tvSec.classList.add("hidden");
        if (playerSec) playerSec.classList.add("hidden");
        if (loader) loader.classList.remove("hidden");

        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";

        if (obj.source === "sinhala") {
            if (loader) loader.classList.add("hidden");
            if (descEl) descEl.textContent = "Sinhala Movie via MovieStream Sinhala Vault. Watch online directly or choose download quality.";
            currentSelectedDirectUrl = obj.url || "";
            if (actionBox) {
                actionBox.innerHTML = renderModalPrimaryButtons(obj, [{ quality_info: "HD • Sinhala Movies", url: obj.url }]);
            }
            return;
        }

        // Fetch full CineSubz details
        try {
            const data = await fetchCineSubzAPI(`/api/details?url=${encodeURIComponent(obj.url)}`);
            const details = data?.details || data || {};
            currentModalMovie = {
                ...currentModalMovie,
                ...details,
                title: details.title || obj.title,
                imgUrl: details.poster || details.image || obj.imgUrl,
                url: obj.url
            };
            if (heroImg && currentModalMovie.imgUrl) heroImg.src = optimizePosterUrl(currentModalMovie.imgUrl);
            if (descEl) {
                descEl.textContent = details.description || details.synopsis || details.plot ||
                    `${cleanDisplayTitle(currentModalMovie.title)} with Sinhala Subtitles. Stream live or click Download for instant HD & WhatsApp quality options.`;
            }

            if (Array.isArray(details.seasons) && details.seasons.length > 0) {
                setupModalSeries(details.seasons);
            } else {
                const links = details.download_links || details.links || details.qualities || [];
                currentModalLinks = links;
                if (links[0]) {
                    currentSelectedDirectUrl = unwrapNestedDownloadUrl(links[0].real_direct_download_url || links[0].url || links[0].link || links[0].cinesubz_link || "");
                }
                if (actionBox) {
                    actionBox.innerHTML = renderModalPrimaryButtons(currentModalMovie, links);
                }
            }
        } catch (err) {
            if (descEl) descEl.textContent = "Server details temporarily unavailable — click Download for direct & WhatsApp options.";
            if (actionBox) actionBox.innerHTML = renderModalPrimaryButtons(currentModalMovie, []);
        } finally {
            if (loader) loader.classList.add("hidden");
        }
    }

    function renderModalPrimaryButtons(movieObj, links) {
        const hasLinks = Array.isArray(links) && links.length > 0;
        const firstLink = hasLinks ? (links[0].real_direct_download_url || links[0].url || links[0].link || links[0].cinesubz_link || "") : (movieObj.url || "");
        const watchBtnDisabled = !firstLink && movieObj.source !== "sinhala";

        let qualityTags = "";
        if (hasLinks) {
            qualityTags = `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">` +
                links.slice(0, 6).map((l, idx) => {
                    const qLabel = l.quality_info || l.quality || `Option ${idx + 1}`;
                    const rawU = l.real_direct_download_url || l.url || l.link || l.cinesubz_link || "";
                    return `<button type="button" onclick="MovieStream.selectModalQuality(this, '${encodeURIComponent(rawU)}')"
                        class="ms-chip ${idx === 0 ? "active" : ""}">${escapeHtml(qLabel)}</button>`;
                }).join("") +
                `</div>`;
        }

        return `
            ${qualityTags}
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">
                <button type="button" ${watchBtnDisabled ? "disabled" : ""} onclick="MovieStream.playActiveStream()"
                    class="ms-btn ms-btn-primary" style="padding:13px 18px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    <span>Watch Online (HD)</span>
                </button>
                <button type="button" onclick="MovieStream.goDownloadFromModal()"
                    class="ms-btn ms-btn-blue" style="padding:13px 18px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/></svg>
                    <span>Download &rarr;</span>
                </button>
            </div>
        `;
    }

    function selectModalQuality(btnEl, encodedUrl) {
        const parent = btnEl.parentElement;
        if (parent) parent.querySelectorAll(".ms-chip").forEach(b => b.classList.remove("active"));
        btnEl.classList.add("active");
        currentSelectedDirectUrl = unwrapNestedDownloadUrl(decodeURIComponent(encodedUrl));
    }

    function setupModalSeries(seasons) {
        const tvSec = document.getElementById("modal_tv_section");
        const seasonSel = document.getElementById("modal_season_select");
        if (!tvSec || !seasonSel) return;
        currentSeriesSeasons = {};
        seasonSel.innerHTML = "";
        seasons.forEach((s, i) => {
            const name = s.name || `Season ${s.season_num || i + 1}`;
            currentSeriesSeasons[name] = s.episodes || [];
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = `${name} (${(s.episodes || []).length} Eps)`;
            seasonSel.appendChild(opt);
        });
        tvSec.classList.remove("hidden");
        seasonSel.onchange = () => loadModalEpisodes(seasonSel.value);
        if (seasons[0]) {
            const firstName = seasons[0].name || `Season ${seasons[0].season_num || 1}`;
            loadModalEpisodes(firstName);
        }
    }

    function loadModalEpisodes(seasonName) {
        const epGrid = document.getElementById("modal_episodes_list");
        if (!epGrid || !currentSeriesSeasons) return;
        const eps = currentSeriesSeasons[seasonName] || [];
        epGrid.innerHTML = eps.map((ep, idx) => {
            const num = ep.num || ep.ep_num || idx + 1;
            const label = ep.title || `Episode ${num}`;
            return `<button type="button" class="ms-ep-btn ${idx === 0 ? "active" : ""}"
                onclick="MovieStream.selectModalEpisode(${idx}, '${escapeHtml(seasonName).replace(/'/g, "\\'")}', this)">
                <div style="font-weight:800;font-size:12px;">EP ${escapeHtml(num)}</div>
                <div style="font-size:11px;color:var(--ms-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(label)}</div>
            </button>`;
        }).join("");
        if (eps.length > 0) {
            selectModalEpisode(0, seasonName, epGrid.querySelector(".ms-ep-btn"));
        }
    }

    async function selectModalEpisode(idx, seasonName, btnEl) {
        const epGrid = document.getElementById("modal_episodes_list");
        if (epGrid && btnEl) {
            epGrid.querySelectorAll(".ms-ep-btn").forEach(b => b.classList.remove("active"));
            btnEl.classList.add("active");
        }
        const eps = (currentSeriesSeasons && currentSeriesSeasons[seasonName]) || [];
        const ep = eps[idx];
        if (!ep) return;

        currentModalMovie.currentSeason = seasonName;
        currentModalMovie.currentEpisode = ep.num || ep.ep_num || `E${idx + 1}`;
        currentModalMovie.episodeUrl = ep.url || ep.link || "";

        const actionBox = document.getElementById("modal_action_box");
        if (actionBox) actionBox.innerHTML = `<div style="padding:14px;color:var(--ms-text-muted);font-size:13px;font-weight:600;">Fetching episode links...</div>`;

        let links = ep.download_links || ep.links || [];
        if ((!links || !links.length) && currentModalMovie.episodeUrl) {
            try {
                const res = await fetchCineSubzAPI(`/api/episode?url=${encodeURIComponent(currentModalMovie.episodeUrl)}`);
                const d = res?.details || res || {};
                links = d.download_links || d.links || [];
            } catch (_) {}
        }
        currentModalLinks = links;
        currentSelectedDirectUrl = links[0] ? unwrapNestedDownloadUrl(links[0].real_direct_download_url || links[0].url || links[0].link || "") : "";
        if (actionBox) actionBox.innerHTML = renderModalPrimaryButtons(currentModalMovie, links);
    }

    function playActiveStream() {
        const raw = unwrapNestedDownloadUrl(currentSelectedDirectUrl || currentModalMovie?.url || "");
        if (!raw) {
            showToast("No playable video mirror found — click Download for quality links.");
            return;
        }
        const playerSec = document.getElementById("modal_player_section");
        const video = document.getElementById("html5_player");
        const iframe = document.getElementById("iframe_player");
        if (!playerSec || !video || !iframe) return;

        playerSec.classList.remove("hidden");
        let streamUrl = raw;

        if (streamUrl.includes("pixeldrain.com/u/")) streamUrl = streamUrl.replace("/u/", "/api/file/").replace("?download", "");
        else if (streamUrl.includes("t.me/c/")) {
            const m = streamUrl.match(/t\.me\/c\/\d+\/(\d+)/);
            if (m) streamUrl = `https://moviestream.top/api/stream/${m[1]}`;
        } else if (streamUrl.includes("t.me/") || streamUrl.includes("telegram.me")) {
            window.open(streamUrl, "_blank", "noopener,noreferrer");
            return;
        } else if (["wodocloud", "supercloud", "skylines", "terracloud", "drive0", "kdrive", "cinesubz", "csplayer", "google.com/server", "zt-links"].some(d => streamUrl.includes(d))) {
            streamUrl = `${getApiBase()}/api/download?token=${encryptMovieUrl(raw)}&download=0`;
        }

        const isIframe = !streamUrl.includes("/api/download") &&
            (streamUrl.includes("youtube.com") || streamUrl.includes("youtu.be") || streamUrl.includes("embed") || streamUrl.includes("player"));

        if (isIframe) {
            video.classList.add("hidden");
            video.pause();
            iframe.classList.remove("hidden");
            iframe.src = streamUrl;
        } else {
            iframe.classList.add("hidden");
            iframe.src = "";
            video.classList.remove("hidden");
            video.src = streamUrl;
            video.play().catch(() => {});
        }
        playerSec.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function closeMovieModal() {
        const modal = document.getElementById("ms_movie_modal");
        const video = document.getElementById("html5_player");
        const iframe = document.getElementById("iframe_player");
        if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
        if (iframe) iframe.src = "";
        if (modal) modal.classList.add("hidden");
        document.body.style.overflow = "";
    }

    function goDownloadFromModal() {
        if (!currentModalMovie) return;
        openDownloadPage({
            title: currentModalMovie.title,
            url: currentModalMovie.episodeUrl || currentModalMovie.url,
            movieUrl: currentModalMovie.url,
            imgUrl: currentModalMovie.imgUrl,
            year: currentModalMovie.year,
            quality: currentModalMovie.quality,
            rating: currentModalMovie.rating,
            source: currentModalMovie.source,
            season: currentModalMovie.currentSeason || "",
            episode: currentModalMovie.currentEpisode || "",
            download_links: currentModalLinks,
            directLink: currentSelectedDirectUrl
        });
    }

    // 9. Spotlight Global Search
    let _searchDebounce = null;
    function openSearch() {
        const el = document.getElementById("ms_search_overlay");
        if (!el) return;
        el.classList.remove("hidden");
        const inp = document.getElementById("ms_spotlight_input");
        if (inp) setTimeout(() => inp.focus(), 40);
    }

    function closeSearch() {
        const el = document.getElementById("ms_search_overlay");
        if (el) el.classList.add("hidden");
    }

    async function liveSearch(query) {
        clearTimeout(_searchDebounce);
        const grid = document.getElementById("ms_search_results");
        const status = document.getElementById("ms_search_status");
        if (!grid) return;

        const q = String(query || "").trim();
        if (q.length < 2) {
            grid.innerHTML = "";
            if (status) status.textContent = "Type at least 2 characters (English, Sinhala, Tamil, Hindi, Year)...";
            return;
        }
        if (status) status.textContent = `Searching "${q}" across MovieStream Catalog & Sinhala Movies...`;

        _searchDebounce = setTimeout(async () => {
            const [csRes, tgRes] = await Promise.allSettled([
                fetchCineSubzAPI(`/api/search?q=${encodeURIComponent(q)}`),
                fetchSinhalaMovies(q)
            ]);
            const csItems = (csRes.status === "fulfilled" && csRes.value?.results) ? csRes.value.results : [];
            const tgItems = (tgRes.status === "fulfilled" && Array.isArray(tgRes.value)) ? tgRes.value : [];

            const html = tgItems.map(m => renderPosterCard(m, { isTelegram: m.source !== "cinesubz" })).join("") +
                         csItems.map(m => renderPosterCard(m)).join("");

            if (html) {
                if (status) status.textContent = `Found ${tgItems.length + csItems.length} result(s) for "${q}"`;
                grid.innerHTML = html;
            } else {
                if (status) status.textContent = `No results found for "${q}". Try another keyword.`;
                grid.innerHTML = "";
            }
        }, 380);
    }

    // 10. Social Media Footer Hydration
    function hydrateSocialLinks() {
        const cfg = global.KAVEEZ_SOCIAL_CONFIG || {};
        document.querySelectorAll("[data-social-key]").forEach((a) => {
            const key = a.getAttribute("data-social-key");
            if (cfg[key]) a.setAttribute("href", cfg[key]);
        });
    }

    // 11. Alternating Adsterra SmartLink Handler (Strictly 1 Ad Click -> 1 Real Click)
    function initAlternatingSmartLink() {
        if (global.__KV_BLOCKED) return;
        let lastEventTs = 0;

        function isAdTurn() {
            return sessionStorage.getItem("ms_ad_turn") === "1";
        }
        function setAdTurn(val) {
            sessionStorage.setItem("ms_ad_turn", val ? "1" : "0");
        }
        if (sessionStorage.getItem("ms_ad_turn") === null) {
            setAdTurn(true); // Alternating cadence: Ad click -> Real action -> Ad click -> Real action
        }

        function isExcludedElement(el) {
            if (!el) return true;
            if (el.closest("[data-no-ad], header, nav, footer, #ms_search_overlay, #ms_download_popup, .ms-magic-controls, .ms-filter-bar, .ms-empty-state, .ms-hero-arrow, .ms-hero-dot, .ms-row-arrow, .social-3d-btn, .ms-floating-wa, .ms-modal-close")) {
                return true;
            }
            const tag = (el.tagName || "").toLowerCase();
            if (tag === "input" || tag === "select" || tag === "textarea" || tag === "option" || tag === "label") return true;
            if (el.closest("a[target='_blank']")) return true;
            return false;
        }

        document.addEventListener("click", function (e) {
            const target = e.target;
            const interactive = target.closest(".ms-card, .ms-cw-card, .ms-btn, .ms-quality-card, .ms-ep-btn");
            if (!interactive || isExcludedElement(interactive)) return;

            const now = Date.now();
            if (now - lastEventTs < 80) return;
            lastEventTs = now;

            if (isAdTurn()) {
                setAdTurn(false);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                try {
                    window.open(global.SMART_LINK_URL, "_blank", "noopener,noreferrer");
                } catch (_) {}
            } else {
                setAdTurn(true);
            }
        }, true);
    }

    // Expose Global Namespace
    global.MovieStream = {
        getApiBase,
        isLocalLiveServer,
        encryptMovieUrl,
        decryptMovieUrl,
        normalizeCineSubzDirectUrl,
        unwrapNestedDownloadUrl,
        genApiHeaders,
        fetchCineSubzAPI,
        fetchSinhalaMovies,
        isSinhalaFallbackActive,
        renderPosterCard,
        renderContinueWatchingRow,
        saveWatchHistory,
        openMoviePage,
        openDownloadPage,
        openDownloadModal,
        closeDownloadModal,
        switchDownloadModalMode,
        handlePopupSeasonChange,
        handlePopupEpisodeChange,
        triggerPopupQualityAction,
        copyPopupQualityLink,
        showToast,
        scrollRow,
        setActiveMobileTab,
        handleCardActivate,
        openMovieModal,
        closeMovieModal,
        selectModalQuality,
        selectModalEpisode,
        playActiveStream,
        goDownloadFromModal,
        openSearch,
        closeSearch,
        liveSearch,
        getCleanDownloadFileName,
        parseQualitySize,
        isSizeOver2GB,
        escapeHtml,
        cleanDisplayTitle,
        optimizePosterUrl,
        hydrateSocialLinks,
        FALLBACK_POSTER,
        SEO_FALLBACK_POSTER
    };

    document.addEventListener("DOMContentLoaded", function () {
        hydrateSocialLinks();
        setActiveMobileTab();
        initAlternatingSmartLink();
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                closeSearch();
                closeMovieModal();
                closeDownloadModal();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                openSearch();
            }
        });
    });
})(window);
