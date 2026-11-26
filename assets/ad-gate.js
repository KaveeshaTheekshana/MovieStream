/* MovieStream Unified Ad-Gate Coordinator (1 Ad <-> 1 Site Action, Zero Button Blocking) */
(function (global) {
    "use strict";

    var NEXT_AD_KEY = "ms_sl_next_is_ad";
    var ODD_TURN_KEY = "ms_sl_odd_turn";
    var AD_STACK_RE = /al5sm\.com|quge5\.com|6opo\.com|255md\.com|rtmark\.net|bancadeltempoidea\.org|iclick|monetag/i;
    var UI_EXCLUDE_SEL = "input, textarea, select, option, label, video, [data-no-ad], #mv_magic_controls, #mv_close_player_btn, .ms-modal-close, [aria-label*='Close']";
    var INTERACTIVE_SEL = "a, button, [role='button'], .ms-card, .ms-bento-card, .ms-quality-card, .ms-mirror-btn, .ms-ep-btn, .ms-chip, .ms-hero-card";
    var OWN_UI_CONTAINER_SEL = "header, .ms-notice-bar, .ms-movie-hero, main, footer, .ms-modal-backdrop, .ms-mobile-sticky-cta, .ms-mobile-tabbar, #ms_toast_box";
    var AD_SLOT_CONTAINER_SEL = ".ms-ad-slot, .ms-ad-300x250-box, .ms-native-ad-wrap, [id^='container-']";

    var memNextAd = true;
    var memOddTurn = "monetag";
    var suppressAdUntil = 0;
    var monetagFiredThisGesture = false;
    var lastMonetagPopAt = 0;
    var totalAdsFired = 0;
    var lastAdProvider = "";
    var lastGateableAt = 0;
    var touchStartX = 0;
    var touchStartY = 0;
    var touchMoved = false;

    function isNextClickAd() {
        try {
            var v = sessionStorage.getItem(NEXT_AD_KEY);
            if (v === "0") return false;
            if (v === "1") return true;
        } catch (_) {}
        return memNextAd;
    }

    function syncTurnBodyClass() {
        var isSiteTurn = !isNextClickAd();
        try {
            if (global.document && global.document.documentElement) {
                global.document.documentElement.classList.toggle("ms-site-turn", isSiteTurn);
            }
            if (global.document && global.document.body) {
                global.document.body.classList.toggle("ms-site-turn", isSiteTurn);
            }
        } catch (_) {}
    }

    function setNextClickAd(val) {
        memNextAd = Boolean(val);
        try {
            sessionStorage.setItem(NEXT_AD_KEY, memNextAd ? "1" : "0");
        } catch (_) {}
        syncTurnBodyClass();
    }

    function getOddAdTurn() {
        try {
            var t = sessionStorage.getItem(ODD_TURN_KEY);
            if (t === "smartlink" || t === "monetag") return t;
        } catch (_) {}
        return memOddTurn;
    }

    function flipOddAdTurn() {
        var next = getOddAdTurn() === "monetag" ? "smartlink" : "monetag";
        memOddTurn = next;
        try {
            sessionStorage.setItem(ODD_TURN_KEY, next);
        } catch (_) {}
        return next;
    }

    function markAdFiredNow(provider) {
        var isMonetag = (provider !== "smartlink");
        lastMonetagPopAt = Date.now();
        totalAdsFired += 1;
        lastAdProvider = provider || "monetag";
        if (isMonetag) {
            if (!monetagFiredThisGesture) {
                flipOddAdTurn();
            }
            monetagFiredThisGesture = true;
            setNextClickAd(false);
            suppressAdsFor(550);
        } else {
            monetagFiredThisGesture = false;
        }
    }

    function getStats() {
        return { totalAdsFired: totalAdsFired, lastAdProvider: lastAdProvider };
    }

    function consumeMonetagFired() {
        var fired = monetagFiredThisGesture;
        monetagFiredThisGesture = false;
        return fired;
    }

    function didAdFireRecently(windowMs) {
        return monetagFiredThisGesture || (lastMonetagPopAt > 0 && (Date.now() - lastMonetagPopAt) < (windowMs || 400));
    }

    function suppressAdsFor(ms) {
        var until = Date.now() + (ms || 600);
        if (until > suppressAdUntil) suppressAdUntil = until;
    }

    function isExcludedTarget(el) {
        if (!el || !el.closest) return false;
        if (el.closest(UI_EXCLUDE_SEL)) return true;
        if (el.closest("[data-ms-ad-overlay='1']")) return false;
        return false;
    }

    function isVisibleAdContainer(el) {
        if (!el || !el.closest) return false;
        return Boolean(el.closest(AD_SLOT_CONTAINER_SEL));
    }

    function isGateableTarget(el) {
        if (!el || !el.closest) return false;
        if (isExcludedTarget(el)) return false;
        if (isVisibleAdContainer(el)) return false;
        if (!el.closest(OWN_UI_CONTAINER_SEL)) return false;
        return Boolean(el.closest(INTERACTIVE_SEL));
    }

    function isOwnCallStack(stack) {
        if (!stack) return false;
        if (AD_STACK_RE.test(stack)) return false;
        var lines = String(stack).split(/\r?\n/).slice(1);
        var origin = "";
        try { origin = global.location && global.location.origin ? global.location.origin : ""; } catch (_) {}
        var sawOwn = false;
        var hasSentinel = /sentinel\.js/i.test(stack);
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (!line || /ad-gate\.js/i.test(line)) continue;
            if (/blob:|data:|eval at /i.test(line)) {
                if (!hasSentinel) return false;
                continue;
            }
            var urls = line.match(/https?:\/\/[^\s)"']+/gi);
            if (urls && urls.length) {
                for (var u = 0; u < urls.length; u++) {
                    var cleanUrl = urls[u].replace(/:\d+(?::\d+)?$/, "");
                    var matchedOrigin = false;
                    try {
                        matchedOrigin = Boolean(origin && new URL(cleanUrl).origin === origin);
                    } catch (_) {
                        matchedOrigin = Boolean(origin && cleanUrl.indexOf(origin) === 0);
                    }
                    if (matchedOrigin || /cloudflareinsights\.com/i.test(cleanUrl)) {
                        sawOwn = true;
                    } else {
                        return false;
                    }
                }
            } else if (/^\s*at\s+(?:Object\.|window\.)?(?:<anonymous>|anonymous)\b|\(\s*<anonymous>:\d+:\d+\s*\)/i.test(line)) {
                if (!hasSentinel) return false;
            }
        }
        return sawOwn;
    }

    function shouldAllowMonetagEvent(e) {
        if (global.__KV_BLOCKED) return false;
        var type = (e && e.type ? String(e.type) : "").toLowerCase();
        // Never trigger click-ads during scroll-start / pointerdown / move events
        if (type === "touchstart" || type === "touchmove" || type === "pointerdown" || type === "pointermove" || type === "mousemove") {
            return false;
        }
        if (type === "touchend" && touchMoved) {
            return false;
        }
        var target = e && e.target && e.target.closest ? e.target : null;
        // Direct user click inside visible Adsterra Banner / Native box behaves as a banner click
        if (target && isVisibleAdContainer(target)) {
            return !isExcludedTarget(target);
        }
        var now = Date.now();
        if (now < suppressAdUntil) return false;
        if (!isNextClickAd()) return false;
        if (getOddAdTurn() !== "monetag") return false;
        if (monetagFiredThisGesture) return false;
        if (!target || !isGateableTarget(target)) return false;
        lastGateableAt = now;
        return true;
    }

    function isKnownUiRootElement(el) {
        if (!el || el.nodeType !== 1) return true;
        var tag = el.tagName;
        if (tag === "HEADER" || tag === "MAIN" || tag === "FOOTER" || tag === "NAV" || tag === "SCRIPT" || tag === "STYLE" || tag === "LINK" || tag === "SECTION" || tag === "HEAD" || tag === "BODY" || tag === "HTML") {
            return true;
        }
        var id = typeof el.id === "string" ? el.id : "";
        var cls = typeof el.className === "string" ? el.className : "";
        if (/(?:^|\b)(?:ms-|ms_|mv_|cat_|dl_|container-)/.test(id + " " + cls)) return true;
        if (el.closest && el.closest("#mv_player_stage, .ms-ad-300x250-box, .ms-native-ad-wrap, [id^='container-'], .ms-modal-backdrop")) {
            return true;
        }
        return false;
    }

    function checkAndFlagOverlayNode(node) {
        try {
            if (!node || node.nodeType !== 1) return;
            var tag = node.tagName;
            if (tag !== "DIV" && tag !== "A" && tag !== "IFRAME" && tag !== "SPAN" && tag !== "INS" && tag !== "SECTION") return;
            if (node.getAttribute("data-ms-ad-overlay") === "1" || isKnownUiRootElement(node)) return;
            var st = global.getComputedStyle ? global.getComputedStyle(node) : null;
            if (!st) return;
            if (st.position !== "fixed" && st.position !== "absolute") return;
            var vw = global.innerWidth || 360;
            var vh = global.innerHeight || 640;
            var rect = node.getBoundingClientRect();
            if (rect.width >= vw * 0.45 && rect.height >= vh * 0.4) {
                node.setAttribute("data-ms-ad-overlay", "1");
            }
        } catch (_) {}
    }

    function flagInvisibleFullOverlays(rootEl) {
        try {
            var docEl = global.document && global.document.documentElement;
            if (docEl && docEl.children) {
                for (var h = 0; h < docEl.children.length; h++) {
                    checkAndFlagOverlayNode(docEl.children[h]);
                }
            }
            var bodyEl = global.document && global.document.body;
            if (bodyEl && bodyEl.children) {
                for (var b = 0; b < bodyEl.children.length; b++) {
                    checkAndFlagOverlayNode(bodyEl.children[b]);
                }
            }
            if (rootEl && rootEl !== docEl && rootEl !== bodyEl) {
                checkAndFlagOverlayNode(rootEl);
                if (rootEl.querySelectorAll) {
                    var nested = rootEl.querySelectorAll("div, a, iframe, span, ins");
                    for (var n = 0; n < nested.length && n < 30; n++) {
                        checkAndFlagOverlayNode(nested[n]);
                    }
                }
            }
        } catch (_) {}
    }

    // Wrap EventTarget.prototype.addEventListener BEFORE external Monetag tags run
    var origAEL = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
        if (typeof fn === "function" && /^(?:click|mousedown|mouseup|pointerdown|pointerup|touchstart|touchend|touchmove|auxclick)$/i.test(type)) {
            var stack = "";
            try { stack = new Error().stack || ""; } catch (_) {}
            var isAdSource = AD_STACK_RE.test(stack) || !isOwnCallStack(stack);

            if (isAdSource) {
                var wrappedFn = fn.__msWrappedAdFn;
                if (!wrappedFn) {
                    wrappedFn = function (ev) {
                        if (!shouldAllowMonetagEvent(ev)) {
                            return;
                        }
                        return fn.apply(this, arguments);
                    };
                    try { fn.__msWrappedAdFn = wrappedFn; } catch (_) {}
                }
                return origAEL.call(this, type, wrappedFn, opts);
            }
        }
        return origAEL.apply(this, arguments);
    };

    // Track gateable presses + scroll detection cleanly using raw origAEL
    origAEL.call(global.document, "touchstart", function (e) {
        touchMoved = false;
        if (e && e.touches && e.touches[0]) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }
        var target = e && e.target && e.target.closest ? e.target : null;
        if (target && isGateableTarget(target)) lastGateableAt = Date.now();
    }, { capture: true, passive: true });

    origAEL.call(global.document, "touchmove", function (e) {
        if (touchMoved || !e || !e.touches || !e.touches[0]) return;
        if (Math.abs(e.touches[0].clientX - touchStartX) > 10 || Math.abs(e.touches[0].clientY - touchStartY) > 10) {
            touchMoved = true;
        }
    }, { capture: true, passive: true });

    origAEL.call(global.document, "pointerdown", function (e) {
        var target = e && e.target && e.target.closest ? e.target : null;
        if (target && isGateableTarget(target)) {
            lastGateableAt = Date.now();
        }
        flagInvisibleFullOverlays(global.document.body);
    }, true);

    function isMessagingHref(rawHref) {
        if (!rawHref) return false;
        try {
            var u = new URL(String(rawHref).trim(), global.location.href);
            return /(?:^|\.)(?:wa\.me|whatsapp\.com|t\.me|telegram\.me)$/i.test(u.hostname);
        } catch (_) {}
        return false;
    }

    function canExternalRedirectFireNow(stack, rawHref) {
        if (global.__KV_BLOCKED) return false;
        if (!AD_STACK_RE.test(stack) && isOwnCallStack(stack)) return true;
        if (isMessagingHref(rawHref)) return true;
        var now = Date.now();
        if (now < suppressAdUntil) return false;
        if (!isNextClickAd()) return false;
        if (getOddAdTurn() !== "monetag") return false;
        if (monetagFiredThisGesture) return false;
        if ((now - lastGateableAt) > 1200) return false;
        markAdFiredNow("monetag");
        return true;
    }

    function guardIframeWindowOpen(node) {
        try {
            if (!node || node.nodeType !== 1 || node.tagName !== "IFRAME") return;
            if (node.id && /^(?:ms_|mv_|cat_|dl_)/.test(node.id)) return;
            var cw = node.contentWindow;
            if (!cw || typeof cw.open !== "function" || cw.__msOpenGuarded) return;
            var cwOrigOpen = cw.open;
            cw.__msOpenGuarded = true;
            cw.open = function (url) {
                var stack = "";
                try { stack = new Error().stack || ""; } catch (_) {}
                if (!canExternalRedirectFireNow(stack, url)) {
                    return null;
                }
                return cwOrigOpen.apply(this, arguments);
            };
        } catch (_) {}
    }

    if (global.Node && global.Node.prototype) {
        var origAppendChild = global.Node.prototype.appendChild;
        if (typeof origAppendChild === "function") {
            global.Node.prototype.appendChild = function (child) {
                var res = origAppendChild.apply(this, arguments);
                guardIframeWindowOpen(child);
                return res;
            };
        }
        var origInsertBefore = global.Node.prototype.insertBefore;
        if (typeof origInsertBefore === "function") {
            global.Node.prototype.insertBefore = function (newNode) {
                var res = origInsertBefore.apply(this, arguments);
                guardIframeWindowOpen(newNode);
                return res;
            };
        }
    }

    // Guard window.open so external ad tags cannot fire multiple popups or fire on button site-turns
    var internalOpenDepth = 0;
    var nativeOpen = typeof global.open === "function" ? global.open : null;
    if (nativeOpen) {
        global.open = function (url) {
            if (internalOpenDepth > 0) {
                return nativeOpen.apply(global, arguments);
            }
            var stack = "";
            try { stack = new Error().stack || ""; } catch (_) {}
            if (!canExternalRedirectFireNow(stack, url)) {
                return null;
            }
            return nativeOpen.apply(global, arguments);
        };
    }

    // Guard synthetic HTMLAnchorElement.prototype.click used by anti-adblock popunders
    if (global.HTMLAnchorElement && global.HTMLAnchorElement.prototype && typeof global.HTMLAnchorElement.prototype.click === "function") {
        var nativeAnchorClick = global.HTMLAnchorElement.prototype.click;
        global.HTMLAnchorElement.prototype.click = function () {
            if (internalOpenDepth > 0 || (this.hasAttribute && this.hasAttribute("download"))) {
                return nativeAnchorClick.apply(this, arguments);
            }
            var href = this.getAttribute ? (this.getAttribute("href") || this.href || "") : (this.href || "");
            var stack = "";
            try { stack = new Error().stack || ""; } catch (_) {}
            if (!canExternalRedirectFireNow(stack, href)) {
                return;
            }
            return nativeAnchorClick.apply(this, arguments);
        };
    }

    function openSmartlinkTrusted(url) {
        monetagFiredThisGesture = false;
        markAdFiredNow("smartlink");
        monetagFiredThisGesture = false;
        internalOpenDepth++;
        try {
            return global.open(url, "_blank", "noopener,noreferrer");
        } finally {
            internalOpenDepth--;
        }
    }

    syncTurnBodyClass();
    origAEL.call(global.document, "DOMContentLoaded", function () {
        syncTurnBodyClass();
        flagInvisibleFullOverlays(global.document.body);
        if (typeof global.MutationObserver === "function" && global.document.documentElement) {
            var mo = new global.MutationObserver(function (mutations) {
                for (var m = 0; m < mutations.length; m++) {
                    var added = mutations[m].addedNodes;
                    if (!added) continue;
                    for (var a = 0; a < added.length; a++) {
                        if (added[a] && added[a].nodeType === 1) {
                            flagInvisibleFullOverlays(added[a]);
                        }
                    }
                }
            });
            mo.observe(global.document.documentElement, { childList: true, subtree: true });
        }
    });
    origAEL.call(global, "pageshow", syncTurnBodyClass);
    origAEL.call(global, "focus", syncTurnBodyClass);

    global.__MS_AD_GATE = {
        isNextClickAd: isNextClickAd,
        setNextClickAd: setNextClickAd,
        getOddAdTurn: getOddAdTurn,
        flipOddAdTurn: flipOddAdTurn,
        syncTurnBodyClass: syncTurnBodyClass,
        markAdFiredNow: markAdFiredNow,
        consumeMonetagFired: consumeMonetagFired,
        didAdFireRecently: didAdFireRecently,
        suppressAdsFor: suppressAdsFor,
        isExcludedTarget: isExcludedTarget,
        isGateableTarget: isGateableTarget,
        openSmartlinkTrusted: openSmartlinkTrusted,
        getStats: getStats
    };
})(window);
