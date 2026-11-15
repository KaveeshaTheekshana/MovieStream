// Cloudflare Pages Function: High-Performance Images Proxy & Static Asset Handler
// Serves local static assets in /images/* directly from Cloudflare Pages CDN,
// and proxies dynamic /images/sinhala/* movie posters from VPS storage at https://moviestream.kaveez.top/images/*

const BOT_PRIMARY = "https://moviestream.kaveez.top";
const BOT_FALLBACK = "http://92.5.25.67:8443";
const FALLBACK_POSTER = "https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg";

export async function onRequest(context) {
    const { request, params } = context;
    const subpath = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');

    // 1. Serve local static images (Logo.png, seo-banner.jpg, favicons, Mobile Hero.webp, etc.) directly from Pages assets
    if (!subpath.startsWith('sinhala/')) {
        try {
            const assetRes = await context.next();
            if (assetRes && (assetRes.ok || assetRes.status === 304)) {
                const headers = new Headers(assetRes.headers);
                headers.set('Access-Control-Allow-Origin', '*');
                headers.set('Cache-Control', 'public, max-age=604800, s-maxage=2592000');
                return new Response(assetRes.body, {
                    status: assetRes.status,
                    statusText: assetRes.statusText,
                    headers
                });
            }
        } catch (err) {
            // Fall through to upstream proxy if context.next() fails
        }
    }

    const imagePath = `/images/${subpath}`;

    const targets = [
        `${BOT_PRIMARY}${imagePath}`,
        `${BOT_FALLBACK}${imagePath}`
    ];

    for (const targetUrl of targets) {
        try {
            const res = await fetch(targetUrl, {
                method: request.method,
                headers: {
                    'User-Agent': request.headers.get('User-Agent') || 'MovieStream-ImageProxy',
                    'Accept': request.headers.get('Accept') || 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*'
                },
                cf: {
                    cacheTtl: 604800, // Cache for 7 days at Cloudflare Edge
                    cacheEverything: true
                }
            });

            if (res.ok) {
                const newHeaders = new Headers(res.headers);
                newHeaders.set('Access-Control-Allow-Origin', '*');
                newHeaders.set('Cache-Control', 'public, max-age=604800, s-maxage=2592000, immutable');
                return new Response(res.body, {
                    status: res.status,
                    statusText: res.statusText,
                    headers: newHeaders
                });
            }
        } catch (e) {
            console.error(`Failed to fetch image from ${targetUrl}:`, e);
        }
    }

    // Fallback if image not found on VPS: redirect to clean cinema poster placeholder
    return Response.redirect(FALLBACK_POSTER, 302);
}
