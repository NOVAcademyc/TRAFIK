/* Service worker : notifications système, y compris app fermée (push serveur). */
self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',function(){});
self.addEventListener('push',function(e){
 var d={};try{d=e.data.json()}catch(x){d={body:e.data?e.data.text():''}}
 e.waitUntil(self.registration.showNotification(d.title||'Trafik PAP',{body:d.body||'',tag:'trafik-alert',renotify:true,data:{url:d.url||'index.html'}}))});
self.addEventListener('notificationclick',function(e){
 e.notification.close();
 var u=(e.notification.data&&e.notification.data.url)||'index.html';
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(l){
  for(var i=0;i<l.length;i++){if('focus' in l[i])return l[i].focus()}
  return self.clients.openWindow(u)}))});