// Yükleme ekranı: sunucuya ulaşılamazsa yalnızca "Tekrar dene" gösterir.
const $ = id => document.getElementById(id);

window.civciv.onOffline(() => {
  $('title').textContent = '😕 Sunucuya ulaşılamadı';
  $('text').textContent = 'İnternet bağlantını kontrol edip tekrar dene.';
  $('retry').classList.remove('hidden');
});

$('retry').onclick = () => {
  $('retry').classList.add('hidden');
  $('title').textContent = 'Çiftliğe bağlanılıyor…';
  $('text').textContent = 'Lütfen bekle.';
  window.civciv.retry();
};
