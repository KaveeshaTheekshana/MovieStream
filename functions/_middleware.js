const ALLOWED_EDGE_HOSTS = new Set(["moviestream.top", "www.moviestream.top", "localhost", "127.0.0.1"]);
const SEO_SOCIAL_BOT_RX = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|facebot|facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|pinterest|slackbot|discordbot|applebot|lighthouse|chrome-lighthouse|pagespeed|screaming frog/i;

function renderKaveezSentinel403() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>403 | Access Denied — KaveezCloud</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;background:#0b1120;color:#e2e8f0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:460px;width:100%;background:#111827;border:1px solid rgba(148,163,184,0.14);border-radius:16px;padding:34px 32px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.65)}
.brand{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;font-weight:700;letter-spacing:0.08em;color:#94a3b8;margin-bottom:14px}
h1{font-size:28px;font-weight:800;color:#ef4444;margin-bottom:12px;letter-spacing:-0.02em}
p{font-size:14.5px;line-height:1.6;color:#cbd5e1;margin-bottom:24px}
.divider{height:1px;background:rgba(148,163,184,0.12);margin-bottom:18px}
.code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;color:#64748b}
</style>
</head>
<body>
<main class="card" role="alert">
  <div class="brand">KaveezCloud</div>
  <h1>403 | Access Denied</h1>
  <p>Security Protocol Violation: Unauthorized Domain / Origin Detected. Access to this cloud environment has been terminated.</p>
  <div class="divider"></div>
  <div class="code">ERR_ORIGIN_VERIFICATION</div>
</main>
</body>
</html>`;
}

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const ua = context.request.headers.get("User-Agent") || "";
    const isCrawler = SEO_SOCIAL_BOT_RX.test(ua);
    const hostname = url.hostname.toLowerCase();

    // Bypass if requesting maintenance UI directly
    if (url.pathname.includes('desktop%20update%20ui') || url.pathname.includes('desktop update ui') || url.pathname === '/maintenance.html') {
      return context.next();
    }

    const isAsset = Boolean(url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf|eot|webmanifest|json|xml|txt)$/i));
    const isApiOrImage = url.pathname.startsWith('/api/') || url.pathname.startsWith('/images/');

    // Server-based host enforcement for cloned Pages previews / unauthorized mirrors (never blocks crawlers or assets/api)
    if (!isCrawler && !isAsset && !isApiOrImage && !ALLOWED_EDGE_HOSTS.has(hostname)) {
      return new Response(renderKaveezSentinel403(), {
        status: 403,
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex"
        }
      });
    }

    // 2. Read 'status' key from KV with multi-binding support and REST API fallback
    let status = null;
    const kvBinding = context.env.MAINTENANCE_KV || context.env.MAINTENANCE || context.env.KV || context.env.moviestream_kv;
    if (kvBinding) {
      try {
        status = await kvBinding.get('status');
      } catch (e) {
        console.error('KV Binding Error:', e);
      }
    }

    // Direct REST API fallback if KV binding is not mapped in Cloudflare dashboard
    if (status === null || status === undefined) {
      try {
        const cfRes = await fetch('https://api.cloudflare.com/client/v4/accounts/105c1a6c782fc9ac0c02f778ee66004b/storage/kv/namespaces/37ca232e4b164af39b369bfb2a4c72df/values/status', {
          headers: {
            'Authorization': 'Bearer cfut_hPBrdgfZtqdwU8l721JVBIZ8X8Rijc54huo2yFbI199ecf67'
          },
          cf: { cacheTtl: 3, cacheEverything: false }
        });
        if (cfRes.ok) {
          status = (await cfRes.text()).trim();
        }
      } catch (apiErr) {
        console.error('KV API fallback error:', apiErr);
      }
    }

    // 3. If maintenance mode is ON and request is for a web page
    if (status === 'true' && !isAsset && !isApiOrImage) {
      let maintenancePage = null;
      try {
        maintenancePage = await context.env.ASSETS.fetch(new URL('/maintenance.html', context.request.url));
      } catch (e) {}

      if (!maintenancePage || !maintenancePage.ok) {
        try {
          maintenancePage = await context.env.ASSETS.fetch(new URL('/desktop%20update%20ui.html', context.request.url));
        } catch (e) {}
      }

      if (maintenancePage && maintenancePage.ok) {
        return new Response(maintenancePage.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          }
        });
      }
    }

    // 4. Proceed to origin asset and apply enterprise security headers
    const response = await context.next();

    // Ensure /manifest.webmanifest never fails with HTML fallback SyntaxError
    if (url.pathname === '/manifest.webmanifest') {
      const mCt = (response.headers.get('content-type') || '').toLowerCase();
      if (!response.ok || mCt.includes('text/html')) {
        const manifestFallback = JSON.stringify({
          name: "MovieStream",
          short_name: "MovieStream",
          description: "Sri Lanka's Clean HD Sinhala Subtitles & Direct Cinema Streaming App.",
          start_url: "/index.html",
          display: "standalone",
          orientation: "portrait-primary",
          background_color: "#f8fafc",
          theme_color: "#ffffff",
          icons: [
            { src: "/images/favicon-48.png?v=10", sizes: "48x48", type: "image/png" },
            { src: "/images/favicon-96.png?v=10", sizes: "96x96", type: "image/png" },
            { src: "/images/android-chrome-192x192.png?v=10", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/images/android-chrome-512x512.png?v=10", sizes: "512x512", type: "image/png", purpose: "any maskable" }
          ]
        }, null, 2);
        return new Response(manifestFallback, {
          status: 200,
          headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
            'X-Content-Type-Options': 'nosniff'
          }
        });
      }
    }

    const newHeaders = new Headers(response.headers);

    // Anti-Clickjacking, Static Cache Optimization & Enterprise Security Headers
    newHeaders.set('X-Frame-Options', 'SAMEORIGIN');
    newHeaders.set('X-Content-Type-Options', 'nosniff');
    newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    newHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (isAsset && !url.pathname.endsWith('sitemap.xml')) {
      newHeaders.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });

  } catch (error) {
    console.error("Middleware Error:", error);
    return context.next();
  }
}
