/* MovieStream Unified Ad-Gate Coordinator (1 Ad <-> 1 Site Action, Zero Button Blocking) */
(function (global) {
    "use strict";

    var NEXT_AD_KEY = "ms_sl_next_is_ad";
    var ODD_TURN_KEY = "ms_sl_odd_turn";
    var AD_STACK_RE = /al5sm\.com|quge5\.com|6opo\.com|255md\.com|rtmark\.net|bancadeltempoidea\.org|iclick|monetag/i;
    var UI_EXCLUDE_SEL = "input, textarea, select, option, label, video, #mv_magic_controls, #mv_close_player_btn, .ms-modal-close, [aria-label*='Close']";
    var INTERACTIVE_SEL = "a, button, [role='button'], .ms-card, .ms-bento-card, .ms-quality-card, .ms-mirror-btn, .ms-ep-btn, .ms-chip, .ms-hero-card";

    var memNextAd = true;
    var memOddTurn = "monetag";
    var suppressAdUntil = 0;
    var monetagFiredThisGesture = false;
    var lastMonetagPopAt = 0;
    var totalAdsFired = 0;
    var lastAdProvider = "";

    function isNextClickAd() {
        try {
            var v = sessionStorage.getItem(NEXT_AD_KEY);
            if (v === "0") return false;
            if (v === "1") return true;
        } catch (_) {}
        return memNextAd;
    }

    function setNextClickAd(val) {
        memNextAd = Boolean(val);
        try {
            sessionStorage.setItem(NEXT_AD_KEY, memNextAd ? "1" : "0");
        } catch (_) {}
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
        monetagFiredThisGesture = (provider !== "smartlink");
        lastMonetagPopAt = Date.now();
        totalAdsFired += 1;
        lastAdProvider = provider || "monetag";
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
        return Boolean(el.closest(UI_EXCLUDE_SEL));
    }

    function isGateableTarget(el) {
        if (!el || !el.closest) return false;
        if (isExcludedTarget(el)) return false;
        return Boolean(el.closest(INTERACTIVE_SEL));
    }

    function shouldAllowMonetagEvent(e) {
        if (global.__KV_BLOCKED) return false;
        var now = Date.now();
        if (now < suppressAdUntil) return false;
        if (!isNextClickAd()) return false;
        if (getOddAdTurn() !== "monetag") return false;
        if (monetagFiredThisGesture) return false;
        var target = e && e.target && e.target.closest ? e.target : null;
        if (target && isExcludedTarget(target)) return false;
        return true;
    }

    // Wrap EventTarget.prototype.addEventListener BEFORE external Monetag tags run
    var origAEL = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
        if (typeof fn === "function" && /^(?:click|mousedown|mouseup|pointerdown|pointerup|touchstart|touchend|auxclick)$/i.test(type)) {
            var stack = "";
            try { stack = new Error().stack || ""; } catch (_) {}
            var isGlobalEl = (this === global || this === document || this === document.documentElement || this === document.body);
            var isOwnScript = /app-core\.js|sentinel\.js|ad-gate\.js|cloudflareinsights\.com/i.test(stack);
            var isAdSource = AD_STACK_RE.test(stack) || (isGlobalEl && !isOwnScript && /<anonymous>|eval/i.test(stack));

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

    // Guard window.open so external ad tags cannot fire multiple popups on the same click gesture
    var internalOpenDepth = 0;
    var nativeOpen = typeof global.open === "function" ? global.open : null;
    if (nativeOpen) {
        global.open = function () {
            if (internalOpenDepth > 0) {
                return nativeOpen.apply(global, arguments);
            }
            var stack = "";
            try { stack = new Error().stack || ""; } catch (_) {}
            var isAdCaller = AD_STACK_RE.test(stack) || (!/app-core\.js|download\.html|movie\.html|category\.html|index\.html/i.test(stack) && /<anonymous>/i.test(stack));
            if (isAdCaller) {
                if (Date.now() < suppressAdUntil || !isNextClickAd() || getOddAdTurn() !== "monetag" || monetagFiredThisGesture) {
                    return null;
                }
                markAdFiredNow("monetag");
            }
            return nativeOpen.apply(global, arguments);
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

    global.__MS_AD_GATE = {
        isNextClickAd: isNextClickAd,
        setNextClickAd: setNextClickAd,
        getOddAdTurn: getOddAdTurn,
        flipOddAdTurn: flipOddAdTurn,
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
