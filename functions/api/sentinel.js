const ALLOWED_EXACT_HOSTS = new Set([
    "moviestream.top",
    "www.moviestream.top",
]);

function isAllowedOriginHeader(rawUrl) {
    if (!rawUrl || rawUrl === "null") return null;
    try {
        const u = new URL(rawUrl);
        const host = u.hostname.toLowerCase();
        const port = u.port || (u.protocol === "https:" ? "443" : "80");
        if (ALLOWED_EXACT_HOSTS.has(host) && u.protocol === "https:") {
            return u.origin;
        }
        if ((host === "localhost" || host === "127.0.0.1") && port === "5500") {
            return u.origin;
        }
    } catch (_) {}
    return null;
}

async function signSentinelPayload(secret, message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    return Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export async function onRequest(context) {
    const { request, env } = context;
    const reqUrl = new URL(request.url);
    const originHeader = request.headers.get("Origin");
    const refererHeader = request.headers.get("Referer");
    const secFetchSite = (request.headers.get("Sec-Fetch-Site") || "").toLowerCase();

    const allowedOrigin = isAllowedOriginHeader(originHeader);
    const allowedReferer = isAllowedOriginHeader(refererHeader);
    const sameOriginHostOk =
        secFetchSite === "same-origin" && ALLOWED_EXACT_HOSTS.has(reqUrl.hostname.toLowerCase());

    const resolvedOrigin = allowedOrigin || allowedReferer || (sameOriginHostOk ? reqUrl.origin : null);

    const corsHeaders = {
        "Access-Control-Allow-Origin": resolvedOrigin || "https://moviestream.top",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Client-Timestamp, X-Client-Signature, X-Sentinel-Token",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
        "Cache-Control": "no-store, private",
    };

    if (request.method === "OPTIONS") {
        if (!allowedOrigin) {
            return new Response(null, { status: 403, headers: { "Vary": "Origin" } });
        }
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Reject explicit unauthorized Origin or Referer, or missing context from unknown hosts
    if (originHeader && !allowedOrigin) {
        return new Response(
            JSON.stringify({
                verified: false,
                code: "ERR_ORIGIN_VERIFICATION",
                error: "Security Protocol Violation: Unauthorized Domain / Origin Detected. Access to this cloud environment has been terminated.",
            }),
            { status: 403, headers: { ...corsHeaders, "Access-Control-Allow-Origin": "null", "Content-Type": "application/json" } }
        );
    }

    if (!resolvedOrigin) {
        return new Response(
            JSON.stringify({
                verified: false,
                code: "ERR_ORIGIN_VERIFICATION",
                error: "Security Protocol Violation: Unauthorized Domain / Origin Detected. Access to this cloud environment has been terminated.",
            }),
            { status: 403, headers: { ...corsHeaders, "Access-Control-Allow-Origin": "null", "Content-Type": "application/json" } }
        );
    }

    const issuedAt = Date.now();
    const expiresAt = issuedAt + 1000 * 60 * 30;
    const secret = (env && env.SENTINEL_SECRET) || "MS_KAVEEZ_SENTINEL_EDGE_2026";
    const proof = await signSentinelPayload(secret, `${issuedAt}:${resolvedOrigin}`);

    return new Response(
        JSON.stringify({
            verified: true,
            sentinel: "KaveezCloud",
            origin: resolvedOrigin,
            issuedAt,
            expiresAt,
            token: `${issuedAt}.${proof}`,
        }),
        {
            status: 200,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
            },
        }
    );
}

