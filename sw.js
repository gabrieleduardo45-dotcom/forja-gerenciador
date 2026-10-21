/* Forja · Gerenciador · service worker v1.0
   Guarda só a "casca" do app para abrir rápido. Dados da operação NUNCA ficam em cache:
   chamadas ao backend são POST e passam direto pela rede. */
var V = 'forja-gerenciador-v1-1';
var CASCA = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/config.js'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(CASCA); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var r = e.request; if (r.method !== 'GET') return;
  var u = new URL(r.url); if (u.origin !== location.origin) return;
  /* rede primeiro (pega versão nova assim que existir); cache só se estiver sem sinal */
  e.respondWith(fetch(r).then(function (res) { if (res && res.ok) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(r, cp); }); } return res; }).catch(function () { return caches.match(r).then(function (m) { return m || caches.match('/index.html'); }); }));
});
