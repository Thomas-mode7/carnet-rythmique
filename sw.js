// Keeps the app usable offline. Same-origin files: served from cache, refreshed in the background.
const CACHE="carnet-v2";
const SHELL=["./","index.html","config.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET")return;
  const fonts=u.host==="fonts.googleapis.com"||u.host==="fonts.gstatic.com";
  if(u.origin!==location.origin&&!fonts)return; // Google sign-in and Drive always go to the network
  e.respondWith(caches.open(CACHE).then(async c=>{
    const hit=await c.match(e.request,{ignoreSearch:u.origin===location.origin});
    const net=fetch(e.request).then(r=>{if(r.ok||r.type==="opaque")c.put(e.request,r.clone());return r}).catch(()=>hit);
    return hit||net;
  }));
});
