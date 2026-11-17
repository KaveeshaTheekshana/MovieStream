// Cloudflare Pages Function: High-Performance Stealth API & Streaming Proxy
// Hides all backend scrapers, storage hosts, and backend domain completely.
// Exposes clean https://moviestream.top/api/* endpoints to the browser, IDM, and video players.

const PRIMARY_BACKEND = "https://cinesubz.kaveez.top";
const VPS_FALLBACK = "http://92.5.25.67:6555";
const BOT_PRIMARY = "https://moviestream.kaveez.top";
const BOT_FALLBACK = "http://92.5.25.67:8443";

const ALLOWED_DOMAIN = "moviestream.top";

const ALLOWED_HOSTS = new Set(["moviestream.top", "www.moviestream.top"]);

function parseAllowedOrigin(rawOrigin) {
    if (!rawOrigin || rawOrigin === "null") return null;
    try {
        const u = new URL(rawOrigin);
        const host = u.hostname.toLowerCase();
        const port = u.port || (u.protocol === "https:" ? "443" : "80");
        if (ALLOWED_HOSTS.has(host) || host.endsWith(".moviestream.top") || host === "kaveez.top" || host.endsWith(".kaveez.top")) {
            return u.origin;
        }
        if ((host === "localhost" || host === "127.0.0.1") && port === "5500") {
            return u.origin;
        }
    } catch (e) {}
    return null;
}

function isAuthorizedOrigin(request) {
    const origin = request.headers.get("Origin") || "";
    const referer = request.headers.get("Referer") || "";
    const url = new URL(request.url);
    const secFetchSite = (request.headers.get("Sec-Fetch-Site") || "").toLowerCase();

    if (origin) return Boolean(parseAllowedOrigin(origin));
    if (referer) return Boolean(parseAllowedOrigin(referer));

    if (url.pathname === "/api/download") {
        const tok = url.searchParams.get("token") || url.searchParams.get("enc") || "";
        if (tok.startsWith("enc_") && tok.length > 16) return true;
    }
    if (url.pathname.startsWith("/api/stream/")) {
        if (url.searchParams.get("download") === "1" || url.searchParams.get("filename")) return true;
    }

    const ts = request.headers.get("X-Client-Timestamp") || "";
    const sig = request.headers.get("X-Client-Signature") || "";
    if (ts && sig && sig.length === 64) return true;

    if (secFetchSite === "same-origin" && ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
        return true;
    }

    return false;
}

export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

    const authorized = isAuthorizedOrigin(request);
    const reqOrigin = request.headers.get("Origin") || "";
    const resolvedOrigin = parseAllowedOrigin(reqOrigin) || (ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ? `https://${url.hostname}` : `https://${ALLOWED_DOMAIN}`);

    if (request.method === "OPTIONS") {
        if (!authorized) {
            return new Response(JSON.stringify({
                error: "Security Protocol Violation: Unauthorized Domain / Origin Detected.",
                code: "ERR_ORIGIN_VERIFICATION"
            }), {
                status: 403,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "null",
                    "Vary": "Origin"
                }
            });
        }
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": resolvedOrigin,
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization, Range, X-Client-Timestamp, X-Client-Signature, X-Sentinel-Token",
                "Access-Control-Max-Age": "86400",
                "Vary": "Origin"
            }
        });
    }

    if (!authorized) {
        return new Response(JSON.stringify({
            error: "Security Protocol Violation: Unauthorized Domain / Origin Detected. Access to this cloud environment has been terminated.",
            code: "ERR_ORIGIN_VERIFICATION"
        }), {
            status: 403,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "null",
                "Vary": "Origin",
                "X-Content-Type-Options": "nosniff"
            }
        });
    }

    const isTgDownload = url.pathname === "/api/download" && (
        url.searchParams.get("tg") === "1" ||
        (url.searchParams.get("source") || "").toLowerCase() === "tg" ||
        (url.searchParams.get("source") || "").toLowerCase() === "telegram"
    );

    const isBotRoute = url.pathname.startsWith('/api/movie-pin') ||
                       url.pathname.startsWith('/api/bot') ||
                       url.pathname.startsWith('/api/moviestream') ||
                       url.pathname.startsWith('/api/sinhala-movies') ||
                       url.pathname.startsWith('/api/stream') ||
                       url.pathname.startsWith('/api/admin') ||
                       isTgDownload;

    const upstreamCandidates = isBotRoute
        ? [BOT_PRIMARY, BOT_FALLBACK]
        : [PRIMARY_BACKEND, BOT_PRIMARY, VPS_FALLBACK];

    const upstreamPath = url.pathname.startsWith('/api/stream/')
        ? url.pathname.replace(/^\/api\/stream\//, '/stream/')
        : url.pathname;

    const forwardHeaders = new Headers();
    const headersToForward = [
        "range",
        "accept",
        "accept-encoding",
        "accept-language",
        "user-agent",
        "cache-control",
        "if-range",
        "if-modified-since",
        "if-none-match",
        "content-type",
        "x-client-signature",
        "x-client-timestamp",
        "x-sentinel-token"
    ];

    for (const h of headersToForward) {
        const val = request.headers.get(h);
        if (val) forwardHeaders.set(h, val);
    }

    forwardHeaders.set("Origin", "https://moviestream.top");
    forwardHeaders.set("Referer", "https://moviestream.top/");
    forwardHeaders.set("X-Edge-Proxy", "moviestream-cf");
    forwardHeaders.set("X-Forwarded-Host", url.host);
    forwardHeaders.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    let bodyBuffer = null;
    if (hasBody && request.body) {
        try {
            bodyBuffer = await request.arrayBuffer();
        } catch (_) {}
    }

    let upstreamRes = null;
    for (const base of upstreamCandidates) {
        try {
            const candidateUrl = new URL(upstreamPath + url.search, base);
            const fetchOpts = {
                method: request.method,
                headers: forwardHeaders,
                body: bodyBuffer !== null ? bodyBuffer : undefined,
                redirect: "follow",
            };
            if (base.startsWith("http://92.5.") && typeof AbortSignal !== "undefined" && AbortSignal.timeout) {
                fetchOpts.signal = AbortSignal.timeout(4500);
            }
            const candidateRes = await fetch(candidateUrl.toString(), fetchOpts);
            if (!candidateRes) continue;
            if (candidateRes.status >= 500) continue;
            // Ignore Cloudflare Workers edge blocks (e.g. Error 1003 Direct IP access not allowed)
            if (candidateRes.status === 403) {
                const ct = (candidateRes.headers.get("content-type") || "").toLowerCase();
                if (ct.includes("text/plain")) {
                    const txt = (await candidateRes.clone().text().catch(() => "")).trim();
                    if (/^error code:\s*\d+/i.test(txt)) continue;
                }
            }
            upstreamRes = candidateRes;
            break;
        } catch (_) {}
    }

    if (!upstreamRes || upstreamRes.status >= 500) {
        const isCatalogRead = request.method === "GET" && (
            url.pathname.startsWith("/api/sinhala-movies") ||
            url.pathname.startsWith("/api/homepage") ||
            url.pathname.startsWith("/api/categories") ||
            url.pathname.startsWith("/api/category") ||
            url.pathname.startsWith("/api/filter")
        );
        if (isCatalogRead) {
            const emptyBody = url.pathname.startsWith("/api/sinhala-movies")
                ? JSON.stringify([])
                : JSON.stringify({ offline: true, results: [] });
            return new Response(emptyBody, {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": resolvedOrigin,
                    "Access-Control-Expose-Headers": "X-Upstream-Status",
                    "Vary": "Origin",
                    "X-Upstream-Status": "offline",
                    "Cache-Control": "no-store"
                }
            });
        }
        return new Response(JSON.stringify({
            error: "MovieStream Gateway Temporarily Unavailable",
            offline: true
        }), {
            status: 503,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": resolvedOrigin,
                "Vary": "Origin"
            }
        });
    }

    const responseHeaders = new Headers(upstreamRes.headers);
    responseHeaders.set("Access-Control-Allow-Origin", resolvedOrigin);
    responseHeaders.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Range, X-Client-Timestamp, X-Client-Signature, X-Sentinel-Token");
    responseHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Disposition, Accept-Ranges");
    responseHeaders.set("Vary", "Origin");
    responseHeaders.delete("x-powered-by");
    responseHeaders.delete("server");

    return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: responseHeaders,
    });
}
