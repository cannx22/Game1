# 🐣 Civciv Kıyameti

Çiftlikte geçen, 4–12 kişilik çevrim içi bir gizli hain oyunu. Masum civcivler görev yapar, hainler aralarına karışıp sabotaj yapar ve masumları bayıltır. Toplantılarda yazılı sohbetle tartışılır, oylamayla hain bulunur.

Oyun tarayıcıda çalışır. **Arkadaşlarının hiçbir şey indirmesine gerek yok**: biri oyunu başlatır, diğerleri linke tıklayıp oynar.

---

## 1. Hızlı başlangıç (Windows)

1. [Node.js](https://nodejs.org) kurulu değilse **LTS** sürümünü kur (bir kere yapılır).
2. Bu klasördeki **`BASLAT.bat`** dosyasına çift tıkla.
   - İlk açılışta gerekli paketleri kendisi kurar.
   - Tarayıcıda `http://localhost:4747` açılır.
3. Siyah pencere açık kaldığı sürece oyun çalışır. Kapatınca oyun durur.

## 2. Arkadaşlarınla oynamak

### A) İnternetten (en kolay yol) — `INTERNETE_AC.bat`

1. **`INTERNETE_AC.bat`** dosyasına çift tıkla.
   - Sunucu çalışmıyorsa onu da başlatır.
   - İlk seferde Cloudflare'in ücretsiz tünel aracını (`cloudflared`) `tools/` klasörüne indirir. Hesap açman gerekmez.
2. Ekranda `https://xxxx.trycloudflare.com` gibi bir link çıkar (panoya da kopyalanır).
3. Bu linki WhatsApp/Discord'dan arkadaşlarına gönder. Linke tıklayan herkes oyuna girer.
4. Oyunda **Oda oluştur**'a bas, çıkan **5 haneli oda kodunu** ya da **🔗 Davet linki**ni gönder.

> Link, pencere açık kaldığı sürece çalışır. Her açılışta yeni bir link oluşur.

### B) Aynı ev / aynı Wi-Fi

`BASLAT.bat` penceresinde `Aynı ağdakiler: http://192.168.x.x:4747` satırı yazar. Aynı ağdaki arkadaşların bu adresi açar.
Windows güvenlik duvarı izin isterse **Özel ağlar** için izin ver.

### C) Kendi sunucunda: Coolify (önerilen kalıcı kurulum)

Adım adım rehber: **[COOLIFY_KURULUM.md](COOLIFY_KURULUM.md)**. Depodaki `Dockerfile` sayesinde Coolify her şeyi kendisi kurar.

### D) Masaüstü uygulaması (exe)

Arkadaşların tarayıcı yerine kurulabilir bir oyun istiyorsa:

1. `electron/config.json` içine sunucu adresini yaz: `{ "defaultServer": "https://civciv.alanadin.com" }`
2. `npm install` ve ardından `npm run dist` çalıştır.
3. `dist/CivcivKiyameti-Kurulum-1.0.0.exe` dosyasını arkadaşlarına gönder.

Kurulan oyun açılınca doğrudan bu sunucuya bağlanır ve ana menü gelir. Sunucuya ulaşılamazsa "Tekrar dene" ve diğer seçenekler çıkar. Diğer seçenekler: başka bir adrese bağlanmak ya da **Sunucu ben olayım** (oyun o bilgisayarda sunucu açar, istenirse internet linki de üretir). Oyun içinde **F10** bu ekrana döner, **F11** tam ekran yapar. Geliştirirken `npm run desktop` ile kurulum yapmadan açılır.

### E) Render (ücretsiz alternatif)

Oyunu ücretsiz olarak [Render](https://render.com)'a yükleyebilirsin:

1. Bu klasörü bir GitHub deposuna yükle (`node_modules` ve `tools` klasörleri `.gitignore` sayesinde gitmez).
2. Render'da **New → Blueprint** seç ve depoyu bağla. `render.yaml` dosyası her şeyi otomatik ayarlar.
3. Birkaç dakika sonra `https://civciv-kiyameti-xxxx.onrender.com` gibi kalıcı bir adresin olur.

> Ücretsiz Render sunucuları 15 dakika kimse bağlanmazsa uyur. İlk açılış 30–60 saniye sürebilir.

Railway, Fly.io veya kendi VPS'in de olur: `npm install --omit=dev` ve `npm start` yeterli. Port, `PORT` ortam değişkeninden okunur (varsayılan **4747**).

---

## 3. Nasıl oynanır?

| | Masum 🐤 | Hain 😈 |
|---|---|---|
| Amaç | Bütün görevleri bitirmek **ya da** bütün hainleri oylamayla çıkarmak | Hain sayısını masumlara eşitlemek **ya da** kritik bir sabotajın süresini doldurmak |
| Görevler | Gerçek mini oyunlar, ortak çubuğu doldurur | Sahte görev yapabilir, ilerleme sağlamaz |
| Özel | Rapor, acil zil, sabotaj onarma | Bayıltma, sabotaj, gizli geçitler |

**Kontroller**

| Tuş | İşlev |
|---|---|
| WASD / ok tuşları ya da farenin sol tuşunu basılı tutmak | Yürü |
| E | Kullan (görev, zil, onarım) |
| R | Baygın civcivi raporla |
| Q | Bayılt (hain) |
| F | Sabotaj menüsü (hain) |
| V | Gizli geçit (hain) |
| Boşluk | Zıpla |
| 1–7 | İfadeler (kahkaha, şaşırma, panik, selam, şüphe, dans, üzüntü) |
| Enter | Sohbet |
| M / Tab | Büyük harita |
| Esc | Pencereyi kapat |

**Oyunda sesli sohbet yoktur.** Mikrofon izni istenmez ve oyuncular arasında ses iletilmez; yalnızca oyunun kendi efekt sesleri çalar (Ayarlar'dan kapatılabilir). İsteyen Discord gibi harici bir uygulama kullanabilir.

## 4. İçerik

- **Harita:** Merkez avlu (acil toplantı zili, kuyu), Büyük Kümes, Yumurta Paketleme, Yem Deposu, Ahır, Traktör Garajı, Sebze Bahçesi, Su Kulesi, Çit ve Samanlık. Kilitlenebilir kapılar, gizli geçitler, alternatif yollar.
- **16 görev:** yumurta toplama, kümes temizliği, kuluçka makinesi, yem taşıma (taşırken yavaşlarsın), yumurta sınıflandırma, yumurta paketleme, yem karıştırma, alet yerleştirme, saman taşıma, traktörü çalıştırma, bahçe sulama, böcek ayıklama, su borusu tamiri, su deposu doldurma, çit tamiri, kaçan civcivleri toplama.
- **6 sabotaj:** elektrik kesintisi (görüş daralır, elektrikli görevler durur), su borusu arızası (kritik, zemin kayar), kaçan civcivler (kritik), yem kaosu (masumlar yavaşlar), kapı arızası, sahte alarm.
- **Toplantı ve oylama:** tartışma ve oylama süreleri, pas geçme, eşitlikte kimse çıkmaz, isteğe bağlı rol açıklama ve gizli oylama.
- **Hayaletler:** bayılan oyuncular görev yapmaya devam eder, yalnızca diğer hayaletlerle yazışabilir.
- **Eğlence:** rastgele çiftlik olayları (ördek, horoz, dev yumurta, keçi, kendi kendine giden traktör, kafaya düşen saman kovası, kaçan tavuklar), çarpışınca sendeleme, su birikintisinde kayma, 12 renk, 10 aksesuar.
- **Oda ayarları:** maksimum oyuncu, hain sayısı (oyuncu sayısına göre sınırlanır), görev sayısı, süreler, acil toplantı hakkı, bayıltma bekleme süresi, kritik sabotajla kazanma, maç içi sohbet.

## 5. Güvenlik ve hile koruması

Bütün oyun mantığı sunucuda çalışır. İstemci yalnızca tuşları ve görüntüyü yönetir.

- Roller sunucuda dağıtılır; her oyuncuya yalnızca kendi rolü (hainlere ise hain arkadaşları) gönderilir.
- Görüş alanı dışındaki oyuncuların ve baygın civcivlerin konumları istemciye hiç gönderilmez.
- Hareketler sunucuda hız ve duvar kontrolünden geçer; ışınlanma ve hız hilesi geri alınır.
- Görev tamamlama, bayıltma, rapor, zil, sabotaj ve oylar sunucuda mesafe, rol ve bekleme süresi açısından doğrulanır.
- Mesajlar uzunluk ve hız sınırına tabidir; bağlantı başına saniyede 60 paket sınırı vardır.

## 6. Geliştirici bilgileri

**Teknoloji seçimi:** Node.js + Express + Socket.IO sunucu, Three.js istemci, saf JavaScript (ES modülleri). Derleme adımı yoktur: `npm install` sonrası doğrudan çalışır, bu da arkadaşların bilgisayarında kurulumu en basit hâle getirir. Sunucu ve istemci aynı harita/çarpışma kodunu (`shared/`) kullanır.

```
server/index.js      komut satırından sunucuyu başlatır
server/app.js        HTTP + Socket.IO, odalar, oturum devamı (startServer)
server/room.js       oda ve maç mantığı: roller, görevler, sabotaj, toplantı, oylama, kazanma
shared/constants.js  renkler, aksesuarlar, ayarlar, görev ve sabotaj tanımları
shared/map.js        harita, duvarlar, istasyonlar, çarpışma yardımcıları
client/index.html    arayüz iskeleti
client/style.css     görünüm
client/js/main.js    menü, lobi, ağ, hareket, HUD, toplantı, maç sonu
client/js/world.js   3D çiftlik, civciv modelleri, animasyonlar, efektler
client/js/minigames.js  görev mini oyunları
client/js/audio.js   WebAudio ile üretilen ses efektleri
tests/flow-test.js   uçtan uca sunucu testi
electron/            masaüstü uygulaması (açılış ekranı, otomatik bağlanma, sunucu açma)
Dockerfile           Coolify / Docker için sunucu imajı
```

**Komutlar**

```bash
npm install     # bağımlılıklar
npm start       # sunucu (http://localhost:4747)
npm test        # 4 botla bütün maç akışını test eder
```

`MIN_PLAYERS=2 npm start` ile tek başına denerken minimum oyuncu sayısını düşürebilirsin (birden fazla tarayıcı sekmesi açarak).

**Varlıklar ve lisans:** Bütün 3D modeller kodla üretilen basit şekillerdir, bütün sesler WebAudio ile anlık sentezlenir; harici görsel/ses dosyası yoktur. Kullanılan kütüphaneler: Three.js (MIT), Socket.IO (MIT), Express (MIT). Yazı tipi: Google Fonts "Baloo 2" (OFL); internet yoksa sistem yazı tipi kullanılır.

## 7. Sorun giderme

- **"4747 numaralı port kullanımda"**: oyun zaten açık olabilir. Açık pencereyi kapat ya da `set PORT=5000` yazıp `node server/index.js` ile başlat.
- **Arkadaşım bağlanamıyor (aynı Wi-Fi)**: Windows güvenlik duvarında Node.js'e özel ağ izni ver ya da `INTERNETE_AC.bat` kullan.
- **Bağlantı koptu**: oyun otomatik yeniden bağlanır; 60 saniye içinde dönen oyuncu maça kaldığı yerden devam eder.
- **Oyun yavaş**: Ayarlar'dan gölgeleri kapat.
