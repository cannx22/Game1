# Civciv Kıyameti — Coolify Kurulum Rehberi

Bu rehberin sonunda oyun sunucun Coolify üzerinde 7/24 çalışacak. Arkadaşların kurulum dosyasıyla yüklediği oyun açılınca otomatik olarak bu sunucuya bağlanacak.

**Gerekenler**
- Çalışan bir Coolify (v4) sunucusu
- Bu GitHub deposu: `https://github.com/cannx22/Game1`
- (İsteğe bağlı ama önerilir) Kendi alan adın, örneğin `civciv.alanadin.com`

Sunucuya ayrıca bir şey yüklemen gerekmez. Coolify depodaki `Dockerfile` ile her şeyi kendisi kurar.

---

## 1. Alan adını hazırla (önerilir)

DNS panelinde (Cloudflare, GoDaddy vb.) bir **A kaydı** ekle:

| Tür | Ad | Değer |
|---|---|---|
| A | `civciv` | Coolify sunucunun IP adresi |

Böylece adresin `civciv.alanadin.com` olur. Alan adın yoksa bu adımı atla; Coolify sana `http://xxxx.SUNUCU-IP.sslip.io` gibi bir adres verir.

> Cloudflare kullanıyorsan turuncu bulut (proxy) açık da olabilir, kapalı da. Oyunun kullandığı WebSocket bağlantıları iki durumda da çalışır.

## 2. Projeyi Coolify'a ekle

1. Coolify paneline gir → **Projects** → bir proje seç ya da **+ Add** ile `Civciv Kiyameti` adında yeni bir proje oluştur.
2. **production** ortamına gir → **+ New** → kaynak türünü seç:
   - Depo **herkese açıksa (public)**: **Public Repository**
   - Depo **özelse (private)**: **Private Repository (with GitHub App)**. Coolify seni GitHub'a yönlendirir; `Game1` deposuna erişim izni ver.
3. Depo adresini yaz: `https://github.com/cannx22/Game1`
4. **Branch**: `main`
5. **Build Pack**: **Dockerfile** seç (Nixpacks değil).
6. **Continue** de.

## 3. Ayarlar

Kaynağın **Configuration → General** sayfasında:

| Alan | Değer |
|---|---|
| **Ports Exposes** | `4747` |
| **Domains** | `https://civciv.alanadin.com` (alan adın yoksa Coolify'ın verdiği adres kalabilir) |
| Dockerfile Location | `/Dockerfile` (varsayılan) |

- Alan adının başına **`https://`** yaz. Coolify, Let's Encrypt ile ücretsiz SSL sertifikasını kendisi alır.
- **Environment Variables** eklemen gerekmez. Port zaten Dockerfile'da `4747` olarak ayarlı.
- **Health Check**: Dockerfile'da tanımlı, ayrıca bir şey yapma. Coolify panelinde açmak istersen yol `/health`, port `4747`.

> ⚠️ **Replicas / ölçekleme sayısını 1'de bırak.** Odalar ve maçlar sunucunun hafızasında tutulur; birden fazla kopya çalışırsa oyuncular farklı kopyalara düşüp birbirini bulamaz.

**Save** de.

## 4. Yayına al

1. Sağ üstteki **Deploy** butonuna bas.
2. **Logs** sekmesinde derlemeyi izle. 1–3 dakika sürer. Sonunda şu satırları görmelisin:
   ```
   🐣 Civciv Kıyameti sunucusu çalışıyor!
   ```
3. Durum **Running (healthy)** olmalı.

## 5. Kontrol et

1. Tarayıcıda `https://civciv.alanadin.com/health` adresini aç. Şunu görmelisin:
   ```json
   {"ok":true,"game":"civciv-kiyameti","rooms":0}
   ```
2. `https://civciv.alanadin.com` adresini aç. Oyunun ana menüsü gelmeli.
3. İki farklı tarayıcıdan (ya da bir de gizli sekmeden) girip birinde **Oda oluştur**, diğerinde **Kodla katıl** dene.

Buraya kadar çalışıyorsa sunucu hazır. 🎉

## 6. Kurulum dosyasını (exe) bu sunucuya bağla

Exe açılınca hangi sunucuya bağlanacağını `electron/config.json` dosyasından okur.

1. `electron/config.json` dosyasını aç ve adresini yaz:
   ```json
   {
     "defaultServer": "https://civciv.alanadin.com"
   }
   ```
2. Proje klasöründe bir terminal aç ve sırayla çalıştır:
   ```bash
   npm install
   npm run dist
   ```
3. Kurulum dosyası şurada oluşur: **`dist/CivcivKiyameti-Kurulum-1.0.0.exe`**
4. Bu tek dosyayı arkadaşlarına gönder (WhatsApp, Discord, Google Drive…).

> İstersen adresi bana gönder, kurulum dosyasını ben oluşturayım.

> `npm run dist` sırasında **"Cannot create symbolic link"** hatası alırsan: Windows **Ayarlar → Sistem → Geliştiriciler için → Geliştirici Modu**'nu aç (ya da terminali bir kereliğine *Yönetici olarak* çalıştır) ve komutu tekrarla. Bu, derleme aracının indirdiği paketteki macOS dosyalarından kaynaklanır; oyunla ilgisi yoktur.

**Arkadaşların için:**
- Exe'yi çalıştırınca Windows **"Windows bilgisayarınızı korudu"** uyarısı gösterebilir. Uygulama dijital olarak imzalanmadığı için bu normaldir: **Ek bilgi → Yine de çalıştır**.
- Kurulumdan sonra masaüstündeki **Civciv Kiyameti** simgesiyle açarlar. Oyun doğrudan ana menüyle açılır.
- Biri **Oda oluştur**'a basar ve 5 harfli kodu söyler, diğerleri **Kodla katıl**'a basar.

## 7. Güncelleme

Kodda bir değişiklik yapıp GitHub'a gönderdiğinde (`git push`):
- Coolify'da **Deploy**'a basman yeterli.
- Ya da kaynağın **Webhooks / Auto Deploy** ayarını açarsan her push'ta kendisi yayına alır. GitHub App ile bağladıysan bu varsayılan olarak açıktır.

Sadece sunucu kodu değiştiyse arkadaşların exe'yi yeniden kurmak zorunda değil, çünkü oyun ekranı da sunucudan geliyor. Yeni exe yalnızca `electron/` klasöründe bir değişiklik olursa ya da sunucu adresi değişirse gerekir.

> Yeniden yayına alma (deploy) sırasında sunucu birkaç saniye kapanır ve o an süren maçlar biter. Arkadaşlarınla oynarken deploy yapma.

## 8. Sorun giderme

| Belirti | Çözüm |
|---|---|
| **Bad Gateway / 502** | **Ports Exposes** değeri `4747` mü? Logs'ta sunucu çalışıyor mu? |
| **No available server / 404** | Domains alanını ve DNS A kaydını kontrol et. DNS yayılması birkaç dakika sürebilir. |
| SSL hatası | Domain `https://` ile mi yazıldı? DNS doğru IP'yi gösteriyor mu? 80 ve 443 portları sunucu güvenlik duvarında açık mı? |
| Sayfa açılıyor ama "Bağlantı koptu" yazısı gidip geliyor | Önündeki proxy WebSocket'i engelliyor olabilir. Cloudflare'de **Network → WebSockets** açık olmalı (varsayılan açıktır). |
| Exe "Sunucuya ulaşılamadı" diyor | `config.json`'daki adres tarayıcıda açılıyor mu? `/health` adresi JSON döndürüyor mu? |
| Arkadaşlar aynı kodla odayı bulamıyor | Replicas 1'den fazla olabilir; 1'e düşür. |
