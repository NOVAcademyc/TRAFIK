/* Service worker : notifications système, y compris app fermée (push serveur). */
self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',function(){});
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
