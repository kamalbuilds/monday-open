// Overlap test: at 1440/768/390, scroll the page in steps and check that no two
// text runs (text nodes + SVG <text>) intersect on screen, including text under
// sticky/fixed elements. Usage: node tests/overlap.mjs <url> [shotDir]
import { chromium } from "playwright";
const url = process.argv[2] || "http://localhost:4391";
const shotDir = process.argv[3];
const exe = process.env.PW_CHROME;
const b = await chromium.launch(exe ? { executablePath: exe } : {});
let bad = 0;
for (const w of [1440, 768, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
  await p.goto(url, { waitUntil: "networkidle" }).catch(() => {});
  await p.waitForTimeout(6000);
  if (shotDir) await p.screenshot({ path: `${shotDir}/ov-${w}-full.png`, fullPage: true });
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  const vh = p.viewportSize().height;
  const seen = new Set();
  for (let y = 0, i = 0; y < H; y += Math.round(vh * 0.6), i++) {
    await p.evaluate((y) => window.scrollTo(0, y), y);
    await p.waitForTimeout(250);
    if (shotDir && i < 6) await p.screenshot({ path: `${shotDir}/ov-${w}-s${i}.png` });
    const hits = await p.evaluate(() => {
      const runs = [];
      const vis = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.visibility === "hidden" || s.display === "none" || +s.opacity === 0) return false; } return true; };
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = tw.nextNode());) {
        if (!n.textContent.trim() || !vis(n.parentElement)) continue;
        if (n.parentElement.closest("svg") && n.parentElement.tagName !== "text" && n.parentElement.tagName !== "tspan") continue;
        const r = document.createRange(); r.selectNodeContents(n);
        for (const q of r.getClientRects()) if (q.width > 1 && q.height > 1 && q.bottom > 0 && q.top < innerHeight) runs.push({ q, el: n.parentElement, t: n.textContent.trim().slice(0, 30) });
      }
      // clip each run to its overflow-clipping ancestors so scrolled-out text is ignored
      for (const r of runs) { for (let e = r.el.parentElement; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (/(hidden|auto|scroll|clip)/.test(s.overflow + s.overflowX + s.overflowY)) { const c = e.getBoundingClientRect(); r.q = { left: Math.max(r.q.left, c.left), right: Math.min(r.q.right, c.right), top: Math.max(r.q.top, c.top), bottom: Math.min(r.q.bottom, c.bottom) }; } } }
      const out = [];
      for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
        const a = runs[i].q, c = runs[j].q;
        if (a.right <= a.left || c.right <= c.left || a.bottom <= a.top || c.bottom <= c.top) continue;
        const ix = Math.min(a.right, c.right) - Math.max(a.left, c.left), iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
        if (ix > 2 && iy > 3) out.push(`"${runs[i].t}" x "${runs[j].t}" (${Math.round(ix)}x${Math.round(iy)}px)`);
      }
      // fixed/sticky layers: text from outside the layer that sits under a see-through layer is flagged
      for (const e of document.querySelectorAll("body *")) {
        const s = getComputedStyle(e); if (s.position !== "fixed" && s.position !== "sticky") continue;
        const c = e.getBoundingClientRect(); if (c.width < 2 || c.height < 2 || !vis(e)) continue;
        const m = s.backgroundColor.match(/[\d.]+/g) || []; const alpha = m.length === 4 ? +m[3] : (s.backgroundColor === "transparent" ? 0 : 1);
        if (alpha >= 0.95 && s.backgroundImage === "none" || s.backdropFilter.includes("blur") && alpha >= 0.6) continue;
        for (const r of runs) { if (e.contains(r.el)) continue; const a = r.q;
          const ix = Math.min(a.right, c.right) - Math.max(a.left, c.left), iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
          if (ix > 2 && iy > 3) out.push(`"${r.t}" under see-through ${s.position} <${e.tagName.toLowerCase()}.${e.className}> (${Math.round(ix)}x${Math.round(iy)}px)`); }
      }
      return out;
    });
    for (const h of hits) { const k = `${w} ${h.replace(/\(.*\)/, "")}`; if (!seen.has(k)) { seen.add(k); bad++; console.log(`OVERLAP ${w}px @y=${y}: ${h}`); } }
  }
  await p.close();
}
await b.close();
console.log(bad ? `overlap: FAIL (${bad})` : "overlap: PASS");
process.exit(bad ? 1 : 0);
