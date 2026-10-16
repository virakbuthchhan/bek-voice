import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export default defineConfig({
  base: "./",
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    {
      name: "bek-offline-shell",
      apply: "build",
      async closeBundle() {
        const assets = (await readdir("dist/assets"))
          .filter((name) => /\.(js|css)$/.test(name))
          .map((name) => "assets/" + name);
        const version = createHash("sha256")
          .update(assets.join("|"))
          .digest("hex")
          .slice(0, 12);
        const shell = [
          "./",
          "index.html",
          "model-manifest.json",
          "browser-engine.worker.js",
          ...assets,
        ];
        await writeFile(
          "dist/service-worker.js",
          `const CACHE='bek-shell-vue-${version}';const SHELL=${JSON.stringify(shell)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('sori-shell-')||k.startsWith('bek-shell-vue-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;if(e.request.mode!=='navigate'&&!/\\.(html|css|js|mjs|wasm|ttf|json)$/.test(u.pathname))return;e.respondWith((async()=>{const c=await caches.open(CACHE);try{const r=await fetch(e.request);if(r.ok)await c.put(e.request,r.clone());return r;}catch(error){const saved=await c.match(e.request);if(saved)return saved;if(e.request.mode==='navigate'){const index=await c.match('./');if(index)return index;}throw error;}})());});`,
        );
      },
    },
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8765",
        changeOrigin: true,
        headers: { Origin: "http://127.0.0.1:8765" },
      },
    },
  },
  build: { target: "es2022" },
});
