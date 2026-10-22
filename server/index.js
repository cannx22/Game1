// Komut satırından sunucuyu başlatır: npm start
import { startServer, lanAddresses } from './app.js';

const PORT = Number(process.env.PORT) || 4747;

startServer(PORT).then(() => {
  console.log('');
  console.log('  🐣 Civciv Kıyameti sunucusu çalışıyor!');
  console.log(`  Bu bilgisayarda:   http://localhost:${PORT}`);
  for (const ip of lanAddresses()) console.log(`  Aynı ağdakiler:    http://${ip}:${PORT}`);
  console.log('  İnternetten arkadaşlarını çağırmak için README.md dosyasına bak.');
  console.log('');
}, err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✘ ${PORT} numaralı port kullanımda. Oyun zaten açık olabilir ya da başka bir program bu portu kullanıyor.`);
    console.error('    Farklı bir port için: PORT=5000 ortam değişkeniyle başlatın (README.md).\n');
  } else {
    console.error(err);
  }
  process.exit(1);
});
