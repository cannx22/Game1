// Sunucu ve istemcinin ortak kullandığı sabitler.

export const COLORS = [
  { id: 'sari', name: 'Sarı', hex: '#ffd23f' },
  { id: 'kirmizi', name: 'Kırmızı', hex: '#e63946' },
  { id: 'mavi', name: 'Mavi', hex: '#3a86ff' },
  { id: 'yesil', name: 'Yeşil', hex: '#38b000' },
  { id: 'siyah', name: 'Siyah', hex: '#33343f' },
  { id: 'beyaz', name: 'Beyaz', hex: '#f4f4f0' },
  { id: 'pembe', name: 'Pembe', hex: '#ff8fab' },
  { id: 'mor', name: 'Mor', hex: '#9d4edd' },
  { id: 'turuncu', name: 'Turuncu', hex: '#fb8500' },
  { id: 'kahverengi', name: 'Kahverengi', hex: '#8d5524' },
  { id: 'camgobegi', name: 'Camgöbeği', hex: '#00c2d1' },
  { id: 'gri', name: 'Gri', hex: '#9aa0a6' },
];
export const colorById = id => COLORS.find(c => c.id === id) || COLORS[0];

export const HATS = [
  { id: 'none', name: 'Yok' },
  { id: 'cowboy', name: 'Kovboy şapkası' },
  { id: 'pirate', name: 'Korsan bandanası' },
  { id: 'goggles', name: 'Pilot gözlüğü' },
  { id: 'crown', name: 'Taç' },
  { id: 'chef', name: 'Şef şapkası' },
  { id: 'detective', name: 'Dedektif şapkası' },
  { id: 'straw', name: 'Saman şapkası' },
  { id: 'bag', name: 'Mini sırt çantası' },
  { id: 'mustache', name: 'Komik bıyık' },
];

export const EMOTES = [
  { id: 'laugh', icon: '😂', name: 'Kahkaha' },
  { id: 'wow', icon: '😮', name: 'Şaşırma' },
  { id: 'panic', icon: '😱', name: 'Panik' },
  { id: 'wave', icon: '👋', name: 'Selam' },
  { id: 'sus', icon: '🤨', name: 'Şüphe' },
  { id: 'dance', icon: '💃', name: 'Dans' },
  { id: 'sad', icon: '😢', name: 'Üzüntü' },
];

export const DEFAULT_SETTINGS = {
  maxPlayers: 10,
  impostors: 1,
  tasks: 5,
  discussion: 30,
  voting: 30,
  emergencies: 1,
  killCooldown: 25,
  confirmEjects: true,
  criticalWin: true,
  playChat: true,
  anonVotes: false,
};

// [min, max] for numeric settings
export const SETTING_LIMITS = {
  maxPlayers: [4, 12],
  impostors: [1, 3],
  tasks: [3, 8],
  discussion: [0, 120],
  voting: [15, 120],
  emergencies: [0, 5],
  killCooldown: [10, 60],
};

export const defaultImpostors = n => (n >= 10 ? 3 : n >= 7 ? 2 : 1);
export const maxImpostors = n => Math.max(1, Math.floor((n - 1) / 3));

export const GAME = {
  minPlayers: 4,
  speed: 4.6,
  ghostSpeed: 6.2,
  carrySpeed: 3.3,
  slowSpeed: 3.5,
  radius: 0.45,
  killRange: 2.0,
  reportRange: 3.2,
  useRange: 2.4,
  tunnelRange: 1.8,
  visionCrew: 9.5,
  visionImp: 12,
  visionLights: 4,
  sabCooldown: 25,
  introMs: 4500,
  resultMs: 6000,
  meetingCooldown: 15,
  chatMax: 160,
};

// stations: one station per step. carry tasks have two steps (pick up, drop off).
// min: seconds the minigame must stay open before the server accepts completion.
// power: unavailable during a blackout.
export const TASK_DEFS = {
  eggs: { name: 'Yumurta toplama', desc: 'Yuvalardaki sağlam yumurtaları sepete topla.', stations: ['nests'], min: 1.5 },
  clean: { name: 'Kümes temizliği', desc: 'Kümesteki kirli alanları temizle.', stations: ['coopclean'], min: 1.5 },
  incubator: { name: 'Kuluçka makinesi', desc: 'Sıcaklık ve süreyi yeşil aralıkta tut.', stations: ['incubator'], min: 2, power: true },
  feedcarry: { name: 'Yem taşıma', desc: 'Depodan yem çuvalını al, kümesteki yemliğe götür.', stations: ['sackpick', 'trough'], carry: 'sack' },
  sorteggs: { name: 'Yumurta sınıflandırma', desc: 'Yumurtaları boyutlarına göre kasalara koy.', stations: ['sorttable'], min: 1.5 },
  packing: { name: 'Yumurta paketleme', desc: 'Konveyördeki yumurtaları doğru kasaya yönlendir.', stations: ['conveyor'], min: 2, power: true },
  feedmix: { name: 'Yem karıştırma', desc: 'Tarifteki oranlarla yemi karıştır.', stations: ['mixer'], min: 1.5 },
  tools: { name: 'Aletleri yerleştirme', desc: 'Ahırdaki aletleri yerlerine as.', stations: ['toolrack'], min: 1.5 },
  haycarry: { name: 'Saman taşıma', desc: 'Ahırdan saman balyasını al, samanlığa götür.', stations: ['haypick', 'haydrop'], carry: 'hay' },
  tractor: { name: 'Traktörü çalıştırma', desc: 'Adımları doğru sırayla uygula.', stations: ['tractor'], min: 2, power: true },
  watering: { name: 'Bahçeyi sulama', desc: 'Vanaları istenen sırayla aç.', stations: ['valves'], min: 1.5 },
  bugs: { name: 'Böcek ayıklama', desc: 'Zararlı tırtılları topla, uğur böceklerine dokunma.', stations: ['bugs'], min: 1.5 },
  pipes: { name: 'Su borusu tamiri', desc: 'Boruları döndürerek suyu hedefe ulaştır.', stations: ['pipes'], min: 2 },
  tank: { name: 'Su deposunu doldurma', desc: 'Depoyu hedef seviyeye kadar doldur, taşırma.', stations: ['tank'], min: 1.5 },
  fence: { name: 'Çit tamiri', desc: 'Eksik tahtaları çite yerleştir.', stations: ['fence'], min: 1.5 },
  herd: { name: 'Kaçan civcivleri toplama', desc: 'Yavru civcivleri ağıla yönlendir.', stations: ['pen'], min: 2 },
};

export const SAB_DEFS = {
  lights: { name: 'Elektrik kesintisi', icon: '💡', desc: 'Masumların görüşü azalır, elektrikli görevler durur. Garajdaki panodan onarılır.' },
  water: { name: 'Su borusu arızası', icon: '💧', critical: true, time: 45, desc: 'Su kulesindeki boru onarılmazsa hainler kazanır. Zeminler kaygan olur.' },
  chicks: { name: 'Kaçan civcivler', icon: '🐤', critical: true, time: 60, desc: 'Yavrular kaçar; hepsi toplanmazsa hainler kazanır.' },
  feed: { name: 'Yem kaosu', icon: '🌾', desc: 'Yemler saçılır, masumlar yavaşlar. Yığınlar toplanınca biter.' },
  doors: { name: 'Kapı arızası', icon: '🚪', time: 12, desc: 'Seçilen binanın kapıları kilitlenir.' },
  alarm: { name: 'Sahte alarm', icon: '🚨', time: 7, desc: 'Bir bölgeden alarm çalar, dikkat dağılır.' },
};

export const END_REASONS = {
  tasks: 'Masumlar bütün çiftlik görevlerini tamamladı!',
  imps_gone: 'Bütün hainler çiftlikten uzaklaştırıldı!',
  kills: 'Hainler sayıca masumlara yetişti!',
  sabotage: 'Kritik sabotaj zamanında giderilmedi!',
};
