// After `next build` (static export to ./out), list every JS/CSS/font asset
// under _next so the service worker can precache them — guaranteeing the whole
// app (all routes) works offline, not just whatever was visited online.
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("out");
const acc = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else {
      const url = "/" + path.relative(OUT, p).split(path.sep).join("/");
      if (/\.(js|css|woff2?|txt)$/.test(url)) acc.push(url);
    }
  }
}

walk(OUT);
fs.writeFileSync(path.join(OUT, "sw-manifest.js"), `self.__PRECACHE_MANIFEST=${JSON.stringify(acc)};`);
console.log(`sw-manifest.js: ${acc.length} static assets precached`);
