// quartz/components/pages/didyoumean.inline.ts
// Runs in the browser (Quartz injects this into postscript.js)
(() => {
  // Visible runtime tag
  (window as any).__DYM_INLINE__ = 1;

  // Toggle debug with ?dym=1 or localStorage 'dym-debug'='1'
  const DEBUG =
    new URLSearchParams(location.search).has("dym") ||
    localStorage.getItem("dym-debug") === "1";
  const log = (...a: any[]) => { if (DEBUG) console.log("[DYM]", ...a); };
  const warn = (...a: any[]) => { if (DEBUG) console.warn("[DYM]", ...a); };

  function normPath(p: string) {
    try { p = decodeURIComponent(p); } catch {}
    return p.replace(/\/+/g, "/").replace(/\/$/, "");
  }
  const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
  const isPagePath = (p: string) => !/\.[a-z0-9]{1,6}$/i.test(p); // drop paths with extensions (xml, png, css, js, etc.)

  // Robust, URL-safe join (no slash math, works with subpaths)
function joinBase(base: string, rel: string): string {
  const baseAbs = new URL(base.startsWith("/") ? base : "/" + base, location.origin);
  return new URL(rel.replace(/^\//, ""), baseAbs).pathname; // safe join
}
function stripBase(base: string, p: string): string {
  if (base === "/") return p;
  const b = base.endsWith("/") ? base.slice(0, -1) : base; // "/notes"
  return p.startsWith(b + "/") ? p.slice(b.length) : p;     // keep leading slash on result
}


  // Case-insensitive Levenshtein (case-only changes cost 0)
  function ciLevenshtein(a: string, b: string) {
    const A = a.toLowerCase(), B = b.toLowerCase();
    const n = A.length, m = B.length;
    if (n === 0) return m; if (m === 0) return n;
    let prev = new Uint16Array(m + 1), curr = new Uint16Array(m + 1);
    for (let j = 0; j <= m; j++) prev[j] = j;
    for (let i = 1; i <= n; i++) {
      curr[0] = i;
      const ai = A.charCodeAt(i - 1);
      for (let j = 1; j <= m; j++) {
        const sub = prev[j - 1] + (ai === B.charCodeAt(j - 1) ? 0 : 1);
        const del = prev[j] + 1, ins = curr[j - 1] + 1;
        curr[j] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
      }
      const t = prev; prev = curr; curr = t;
    }
    return prev[m];
  }

  function asPathFromUrlish(s: string | null | undefined) {
    if (!s) return null;
    s = s.trim(); if (!s) return null;
    if (/^https?:\/\//i.test(s)) {
      try {
        const u = new URL(s, location.origin);
        return u.origin === location.origin ? normPath(u.pathname) : null;
      } catch { return null; }
    }
    return s.startsWith("/") ? normPath(s) : null;
  }

  async function fetchJSON<T = any>(url: string): Promise<T | null> {
    try { const r = await fetch(url, { credentials: "omit" }); return r.ok ? (await r.json()) : null; }
    catch { return null; }
  }
  async function fetchText(url: string): Promise<string | null> {
    try { const r = await fetch(url, { credentials: "omit" }); return r.ok ? (await r.text()) : null; }
    catch { return null; }
  }

async function getContentIndex(base: string) {
  const candidates = [
    joinBase(base, "static/contentIndex.json"),
  ];

  let data: any = null;
  for (const url of candidates) {
    data = await fetchJSON(url);
    if (data) break;
  }
  if (!data) return null;

  const out = new Set<string>();

  if (Array.isArray(data)) {
    // fallback if it ever is a flat array
    data.forEach(it => {
      if (typeof it === "string") out.add(normPath(it));
      else if (it && typeof it === "object" && "slug" in it) {
        out.add("/" + normPath(it.slug));
      }
    });
  } else if (data && typeof data === "object") {
    // normal Quartz shape: keys are slugs
    for (const [slug, entry] of Object.entries<any>(data)) {
      const s = entry?.slug || slug;
      if (s) out.add("/" + normPath(String(s)));
    }
  }

  const arr = Array.from(out);
  log("contentIndex paths", arr.length);
  return arr;
}


async function getSitemap(base: string) {
  const candidates = [
    joinBase(base, "sitemap.xml"),
    joinBase(base, "static/sitemap.xml"),
    joinBase(base, "sitemap.xml.gz"),      // some hosts gzip it
  ];

  let xml: string | null = null;
  for (const url of candidates) {
    xml = await fetchText(url);
    if (xml) { if (DEBUG) console.log("[DYM] sitemap candidate", url); break; }
  }
  if (!xml) { if (DEBUG) console.warn("[DYM] no sitemap"); return null; }

  const parse = (x: string) => new DOMParser().parseFromString(x, "application/xml");

  // namespace-agnostic helpers
  const locText = (el: Element | null) => (el && el.textContent ? el.textContent.trim() : null);
  const getNS = (doc: Document, tag: string) => Array.from(doc.getElementsByTagNameNS("*", tag));
  const get = (el: Element, tag: string) => {
    const arr = (el as any).getElementsByTagNameNS
      ? (el as any).getElementsByTagNameNS("*", tag)
      : el.getElementsByTagName(tag);
    return arr && arr.length ? (arr[0] as Element) : null;
  };

  const origin = location.origin;
  const locs: string[] = [];

  async function extractFromSitemapIndex(doc: Document) {
    const MAX_SITEMAPS = 5; // guard; raise if needed
    const sitemaps = getNS(doc, "sitemap");
    const urls: string[] = [];
    for (const sm of sitemaps) {
      const u = locText(get(sm, "loc"));
      if (u) urls.push(u);
    }
    if (!urls.length) return;
    const subs = await Promise.all(urls.slice(0, MAX_SITEMAPS).map(u => fetchText(u)));
    for (const sx of subs) {
      if (!sx) continue;
      const subDoc = parse(sx);
      extractFromUrlSet(subDoc);
    }
  }

  function extractFromUrlSet(doc: Document) {
    // collect any <url><loc> pairs irrespective of namespace
    const urls = getNS(doc, "url");
    for (const u of urls) {
      const l = locText(get(u, "loc"));
      if (l) locs.push(l);
    }
    // fallback: grab any stray <loc>
    if (!urls.length) {
      const loose = getNS(doc, "loc");
      for (const n of loose) {
        const t = n.textContent?.trim();
        if (t) locs.push(t);
      }
    }
  }

  const doc = parse(xml);
  const root = doc.documentElement?.localName?.toLowerCase() || "";

  if (root === "sitemapindex") {
    await extractFromSitemapIndex(doc);
  } else if (root === "urlset") {
    extractFromUrlSet(doc);
  } else {
    // unknown root; try best-effort
    extractFromUrlSet(doc);
  }

  // Normalize to same-origin paths
  const paths = uniq(
    locs
      .map(u => {
        try {
          const url = new URL(u, origin);
          if (url.origin !== origin) return null;
          return normPath(url.pathname);
        } catch { return null; }
      })
      .filter((p): p is string => !!p)
  );

  log("sitemap paths", paths.length);
  return paths;
}

  async function getPagesJson(base: string) {
    const arr = await fetchJSON<any[]>(joinBase(base, "pages.json"));
    if (!Array.isArray(arr)) return null;
    const out = uniq(arr.map(x => asPathFromUrlish(typeof x === "string" ? x : "")).filter(Boolean) as string[]);
    log("pages.json paths", out.length);
    return out;
  }

  function scrapeLinks() {
    const paths = Array.from(document.querySelectorAll('a[href^="/"]'))
      .map(a => asPathFromUrlish((a as HTMLAnchorElement).getAttribute("href") || ""))
      .filter(Boolean) as string[];
    const out = uniq(paths);
    log("scraped paths", out.length);
    return out;
  }

  function pickBest(query: string, paths: string[]) {
    const qLower = query.toLowerCase();
    const lowerMap = new Map(paths.map(p => [p.toLowerCase(), p]));
    if (lowerMap.has(qLower) && lowerMap.get(qLower) !== query) {
      return { path: lowerMap.get(qLower) as string, d: 0, caseOnly: true };
    }
    let best: { path: string; d: number; canon: string } | null = null;
    const q = query.replace(/^\/+/, "");
    for (const p of paths) {
      const c = p.replace(/^\/+/, "");
      const d = ciLevenshtein(q, c);
      if (!best || d < best.d || (d === best.d && c.length < best.canon.length)) best = { path: p, d, canon: c };
    }
    return best;
  }

  function renderSuggestion(best: { path: string; d: number; caseOnly?: boolean }, extraQs = 0) {
    const el = document.getElementById("didyoumean");
    if (!el || !best || !best.path) return;
    const qmarks = "?".repeat(1 + Math.max(0, extraQs));
    el.innerHTML = 'Did you mean <a href="' + best.path + '"><code>' + best.path + "</code></a>" + qmarks;
  }

async function run() {
  const hostEl = document.getElementById("didyoumean");
  const base = (hostEl && hostEl.getAttribute("data-base")) || "/";
  log("base", base, "path", location.pathname);

  const raw = normPath(location.pathname);
  if (!raw || raw === "/") return;

  const [a, b, c] = await Promise.all([getContentIndex(base), getSitemap(base), getPagesJson(base)]);
  let paths = uniq([...(a || []), ...(b || []), ...(c || [])]);
  if (!paths.length) paths = scrapeLinks();

  // normalise candidates
  paths = paths.filter(isPagePath);
  if (!paths.length) { warn("no paths found"); return; }

  // ---- NEW: make canonical (base-stripped) views for matching
  const qCanon = stripBase(base, raw);                 // e.g. "/now"
  const candidates = paths.map(p => ({ original: p, canon: stripBase(base, p) }));

  // case-only fast path on canon
  const lowerMap = new Map(candidates.map(c => [c.canon.toLowerCase(), c]));
  const hit = lowerMap.get(qCanon.toLowerCase());
  if (hit && hit.canon !== qCanon) {
    // only case differs
    const href = joinBase(base, hit.canon);
    renderSuggestion({ path: href, d: 0, caseOnly: true }, 0);
    return;
  }

  // pick by distance on canon
  let best: { c: typeof candidates[number]; d: number } | null = null;
  const q = qCanon.replace(/^\/+/, "");
  for (const c of candidates) {
    const cand = c.canon.replace(/^\/+/, "");
    const d = ciLevenshtein(q, cand);
    if (!best || d < best.d || (d === best.d && cand.length < best.c!.canon.length)) {
      best = { c, d };
    }
  }
  if (!best) { warn("no best"); return; }

  const minLen = Math.min(q.length, best.c.canon.replace(/^\/+/, "").length);
  const threshold = Math.max(1, Math.floor(minLen / 3));

  // Relax when few candidates exist
  const shouldShow = best.d <= threshold || candidates.length <= 3;

  // Re-apply base for the href we render
  const href = joinBase(base, best.c.canon);

  if (shouldShow) {
    renderSuggestion({ path: href, d: best.d }, 0);
  } else {
    // still render, with extra question marks: 1 + floor((d - threshold)/10)
    const extra = Math.max(1, Math.floor((best.d - threshold) / 10) + 1);
    warn("best too far", { href, d: best.d, threshold, base, qCanon, bestCanon: best.c.canon });
    renderSuggestion({ path: href, d: best.d }, extra);
  }
}


  // Run now; re-run on SPA navigations.
  document.addEventListener("nav", run);
  run();
})();
