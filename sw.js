/* Service worker Trafik : mode hors ligne (cache de l'app) + notifications système, y compris app fermée (push serveur). */
var VER='trafik-sw-34',SHELL_CACHE=VER+'-shell',LIB_CACHE=VER+'-lib',SCOPE=self.registration.scope;
/* fichiers de l'app gardés pour le hors ligne ; chacun est ajouté séparément : s'il en manque un (ex. vendor/leaflet), l'installation continue */
var SHELL=['index.html','manifest.json','icon-192.png','apple-touch-icon.png','vendor/leaflet/leaflet.js','vendor/leaflet/leaflet.css'];
/* bibliothèques externes à version fixe : gardées une fois pour toutes (économise les données mobiles) */
var LIBS=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js','https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js','https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;800&display=swap'];
var LIB_HOSTS=['cdn.jsdelivr.net','cdnjs.cloudflare.com','fonts.googleapis.com','fonts.gstatic.com'];

self.addEventListener('install',function(e){
 e.waitUntil(Promise.all([
  caches.open(SHELL_CACHE).then(function(c){return Promise.all(SHELL.map(function(u){return c.add(new Request(u,{cache:'reload'})).catch(function(){})}))}),
  caches.open(LIB_CACHE).then(function(c){return Promise.all(LIBS.map(function(u){return libGet(c,u).catch(function(){})}))})
 ]).then(function(){return self.skipWaiting()}))});
/* activation : on supprime les anciens caches ; s'il y avait une ancienne version, les pages ouvertes sont rechargées tout de suite (mise à jour automatique, même pour les vieilles versions de l'app) */
self.addEventListener('activate',function(e){
 e.waitUntil(caches.keys().then(function(ks){
  var old=ks.filter(function(k){return k.indexOf('trafik-sw-')===0&&k.indexOf(VER)!==0});
  return Promise.all(old.map(function(k){return caches.delete(k)})).then(function(){return old.length>0})
 }).then(function(upd){return self.clients.claim().then(function(){
  if(!upd)return;
  return self.clients.matchAll({type:'window'}).then(function(l){return Promise.all(l.map(function(c){return c.navigate(c.url).catch(function(){})}))})})}))});

function isIndex(u){return /\/(index\.html)?$/.test(u.pathname)}
function navKey(u){return isIndex(u)?SCOPE+'index.html':u.origin+u.pathname}
function offlinePage(){return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors ligne</title><body style="font:16px system-ui;background:#0F1418;color:#E9EDEF;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px"><div><h1 style="font-size:22px">Vous êtes hors ligne</h1><p>Cette page n’est pas encore enregistrée sur votre appareil. Reconnectez-vous puis réessayez.</p></div>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}})}

/* pages : réseau d'abord (mises à jour immédiates), mais après 4 s sans réponse on ouvre la copie enregistrée (connexion lente ou coupée) */
function navFetch(e){
 var r=e.request,u=new URL(r.url),key=navKey(u);
 var net=fetch(r).then(function(res){if(res&&res.ok){var cp=res.clone(),p=caches.open(SHELL_CACHE).then(function(c){return c.put(key,cp)});try{e.waitUntil(p)}catch(x){}}return res});
 return new Promise(function(ok){
  var done=false,t=setTimeout(function(){fb(false)},4000);
  function fb(last){caches.match(key).then(function(c){if(done)return;if(c){done=true;clearTimeout(t);ok(c)}else if(last){done=true;ok(offlinePage())}})}
  net.then(function(res){if(!done){done=true;clearTimeout(t);ok(res)}},function(){clearTimeout(t);fb(true)})})}
/* fichiers de l'app (icônes, carte locale, pages annexes) : copie enregistrée tout de suite, mise à jour en arrière-plan */
function swr(e){
 var r=e.request;
 return caches.open(SHELL_CACHE).then(function(c){return c.match(r).then(function(hit){
  var net=fetch(r).then(function(res){if(res&&res.ok&&res.type==='basic')c.put(r,res.clone());return res}).catch(function(){return null});
  if(hit){e.waitUntil(net);return hit}
  return net.then(function(res){return res||new Response('',{status:504,statusText:'Hors ligne'})})})})}
/* bibliothèques externes : copie enregistrée d'abord (versions fixes) ; requête CORS pour éviter les réponses « opaques » qui gonflent le quota */
function libGet(c,url){return c.match(url).then(function(hit){
 if(hit)return hit;
 return fetch(url,{mode:'cors',credentials:'omit'}).then(function(res){if(res&&res.ok)c.put(url,res.clone());return res})})}
function libFetch(e){
 var r=e.request;
 return caches.open(LIB_CACHE).then(function(c){return libGet(c,r.url).catch(function(){return fetch(r)})})}

/* base de données, authentification, itinéraires et tuiles de carte ne passent jamais par ici : l'app garde elle-même ses dernières données */
self.addEventListener('fetch',function(e){
 var r=e.request;if(r.method!=='GET'||r.headers.has('range'))return;
 var u=new URL(r.url);
 /* contrôle de version de l'app (?_b=…) : toujours directement au réseau, jamais mis en cache */
 if(u.origin===self.location.origin&&u.searchParams.has('_b'))return;
 if(u.origin===self.location.origin){e.respondWith(r.mode==='navigate'?navFetch(e):swr(e));return}
 if(LIB_HOSTS.indexOf(u.hostname)>=0)e.respondWith(libFetch(e))});

self.addEventListener('push',function(e){
 var d={};try{d=e.data.json()}catch(x){d={body:e.data?e.data.text():''}}
 var o={body:d.body||'',icon:'icon-192.png',badge:'icon-192.png',tag:d.tag||'trafik-alert',renotify:true,data:{url:d.url||'index.html',seg:d.seg||null,st:d.st||null}};
 /* demande d'état : bouton Répondre sur la notification */
 if(d.seg||d.st)o.actions=[{action:'reply',title:'Répondre'}];
 e.waitUntil(self.registration.showNotification(d.title||'Trafik',o))});
self.addEventListener('notificationclick',function(e){
 e.notification.close();
 var dt=e.notification.data||{},u=dt.url||'index.html',seg=dt.seg,st=dt.st;
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(l){
  for(var i=0;i<l.length;i++){if('focus' in l[i]){
   /* app déjà ouverte : on la ramène devant et on ouvre Signaler sur le bon tronçon */
   if(seg)l[i].postMessage({type:'reply',seg:seg});else if(st)l[i].postMessage({type:'fuel',st:st});
   return l[i].focus()}}
  /* app fermée : on l'ouvre directement sur la réponse */
  return self.clients.openWindow(u)}))});
