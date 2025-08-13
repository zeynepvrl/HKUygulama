# ZENON Veritabanı Arama Uygulaması

Bu uygulama, ZENON veritabanındaki tablolarda paralel arama yapabilen bir Electron desktop uygulamasıdır. Worker Threads kullanarak hızlı ve verimli arama işlemleri gerçekleştirir.

## Özellikler

- 🔍 **Paralel Arama**: Worker Threads ile birden fazla tabloda eş zamanlı arama
- 📊 **Dinamik Tablo Seçimi**: Veritabanındaki tüm tabloları görüntüleme ve seçme
- 🎯 **Sütun Bazlı Arama**: Belirli sütunlarda arama yapabilme
- 📈 **Gerçek Zamanlı Sonuçlar**: Arama sonuçlarını anlık görüntüleme
- 🎨 **Modern UI**: React ile geliştirilmiş kullanıcı dostu arayüz
- ⚡ **Hızlı Performans**: Optimize edilmiş veritabanı sorguları

## Kurulum

1. **Bağımlılıkları yükleyin:**
```bash
npm install
```

2. **Uygulamayı geliştirme modunda çalıştırın:**
```bash
npm run dev
```

3. **Veya sadece Electron uygulamasını çalıştırın:**
```bash
npm start
```

## Kullanım

1. **Uygulama başlatıldığında** veritabanı bağlantısı otomatik olarak kurulur
2. **Arama terimi** girin
3. **İstediğiniz tabloları** seçin (tümünü seçebilir veya tek tek seçebilirsiniz)
4. **Aranacak sütunları** belirleyin (opsiyonel - boş bırakırsanız tüm sütunlarda arar)
5. **"Aramayı Başlat"** butonuna tıklayın
6. **Sonuçları** gerçek zamanlı olarak görüntüleyin

## Teknik Detaylar

### Veritabanı Bağlantısı
- **Server**: 192.168.234.3\prod19
- **Database**: ZENON
- **User**: zenon
- **Encryption**: Devre dışı (trustServerCertificate: true)

### Worker Threads
Her tablo için ayrı bir worker thread oluşturulur ve paralel olarak arama yapılır. Bu sayede:
- Performans artışı sağlanır
- CPU çekirdekleri etkin kullanılır
- Büyük veri setlerinde hızlı sonuç alınır

### Güvenlik
- Context isolation aktif
- Node integration devre dışı
- Preload script ile güvenli IPC iletişimi

## Proje Yapısı

```
HKUygulama/
├── main.js              # Electron main process
├── preload.js           # Preload script
├── webpack.config.js    # Webpack konfigürasyonu
├── package.json         # Proje bağımlılıkları
├── src/
│   ├── index.html       # Ana HTML dosyası
│   ├── index.js         # React giriş noktası
│   ├── App.js           # Ana React bileşeni
│   └── styles.css       # CSS stilleri
└── dist/                # Build çıktıları (otomatik oluşur)
```

## Geliştirme

### Yeni özellik eklemek için:
1. `src/App.js` dosyasını düzenleyin
2. `npm run watch` ile otomatik build'i aktif tutun
3. Değişiklikler otomatik olarak yansıyacaktır

### Production build:
```bash
npm run build
```

## Sorun Giderme

### Veritabanı Bağlantı Hatası
- Ağ bağlantısını kontrol edin
- Firewall ayarlarını kontrol edin
- Veritabanı sunucusunun çalıştığından emin olun

### Worker Thread Hatası
- Node.js sürümünüzün güncel olduğundan emin olun
- Sistem kaynaklarını kontrol edin

## Lisans

ISC License 