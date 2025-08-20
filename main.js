const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const sql = require('mssql');
const { Worker } = require('worker_threads');
const { autoUpdater } = require('electron-updater');

let globalPool = null;
let mainWindow = null;

// AutoUpdater konfigürasyonu
autoUpdater.autoDownload = false; // Otomatik indirme kapalı
autoUpdater.autoInstallOnAppQuit = true; // Uygulama kapanırken otomatik kurulum

    // Auto-updater feed URL'ini ayarla (development için devre dışı)
    if (process.env.NODE_ENV !== 'development') {
        // Production'da auto-updater'ı etkinleştir
        autoUpdater.setFeedURL({
            provider: 'github',
            owner: 'zeynepvrl', // GitHub kullanıcı adınızı buraya yazın
            repo: 'Yat-r-mc-Tesis-zleme', // GitHub repo adınızı buraya yazın
            private: true, // Private repository
            token: process.env.GH_TOKEN || 'your_github_token_here' // GitHub Personal Access Token
        });
    }

const mssqlConfig = {
    server: '192.168.234.3\\prod19',
    database: 'ZENON',
    user: 'zenon',
    password: 'zeN&N-8QL*',
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    requestTimeout: 90000,
    connectionTimeout: 90000
};

async function initSqlConnection() {
    if (!globalPool) {
        try {
            globalPool = await sql.connect(mssqlConfig);
            console.log("✅ MSSQL bağlantısı kuruldu");
        } catch (err) {
            console.error("❌ MSSQL bağlantısı kurulamadı:", err);
        }
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets/icon.png'),
        title: 'HK Energy Dashboard'
    });

    // Ana HTML dosyasını yükle
    console.log('NODE_ENV:', process.env.NODE_ENV);
    if (process.env.NODE_ENV === 'development') {
        console.log('Development mode: Vite dev server\'a bağlanılıyor...');
        // Vite dev server'ı kullan
        mainWindow.loadURL('http://localhost:3000');
        // Dev tools'u aç
        mainWindow.webContents.openDevTools();
    } else {
        console.log('Production mode: Local dosya yükleniyor...');
        // Production'da Vite build çıktısını kullan
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
        // Production'da da dev tools'u aç (hata ayıklama için)
        mainWindow.webContents.openDevTools();
    }
    
    // Hata ayıklama için console log'ları
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Sayfa yükleme hatası:', errorCode, errorDescription);
    });
    
    mainWindow.webContents.on('crashed', () => {
        console.error('Renderer process çöktü');
    });
}

// Basit SQL arama - Inverter unique değerleri
async function searchInvertersInTable(tableName) {
    try {
        console.log(`🔍 Inverter arama başlatılıyor: ${tableName}`);
        
        if (!globalPool) {
            await initSqlConnection();
        }
        
        const query = `
            SELECT 
                NAME,
                WERT,
                CONVERT(VARCHAR(50), DATUMZEIT, 120) AS DATUMZEIT,
                STATUS
            FROM ${tableName}
            WHERE NAME LIKE '%Inverter.%'
            ORDER BY DATUMZEIT DESC
        `;
        
        const result = await globalPool.request().query(query);
        console.log(`✅ ${tableName} tablosunda ${result.recordset.length} Inverter verisi bulundu`);
        
        // Inverter numaralarına göre grupla
        const groupedData = {};
        const measurementMap = {};
        
        result.recordset.forEach(row => {
            // STATUS binary kontrolü - sadece spontaneous olanları al
            const statusRaw = Number(row.STATUS);
            const statusBinary = statusRaw.toString(2).padStart(32, '0');
            const isSpontaneous = statusBinary.charAt(14) === '1';
            
            // Spontaneous değilse bu satırı atla
            if (!isSpontaneous) {
                return;
            }
            
            // NAME alanını JavaScript'te parse et
            const name = row.NAME;
            let inverterNum = 'Unknown';
            let measurementType = 'Unknown';
            
            if (name.includes('Inverter.')) {
                const parts = name.split('.');
                const inverterIndex = parts.findIndex(part => part === 'Inverter');
                
                if (inverterIndex !== -1 && parts[inverterIndex + 1]) {
                    inverterNum = parts[inverterIndex + 1];
                    
                    // Measurement type'ı bul
                    if (parts[inverterIndex + 2]) {
                        measurementType = parts[inverterIndex + 2];
                    }
                }
            }
            
            const key = `${inverterNum}_${measurementType}`;
            
            if (!groupedData[inverterNum]) {
                groupedData[inverterNum] = [];
            }
            
            if (!measurementMap[key]) {
                measurementMap[key] = {
                    name: row.NAME,
                    measurementType: measurementType,
                    latestWert: row.WERT,
                    latestDate: row.DATUMZEIT,
                    history: []
                };
                
                groupedData[inverterNum].push(measurementMap[key]);
            }
            
            // Son 50 veriyi sakla (grafik için)
            if (measurementMap[key].history.length < 50) {
                measurementMap[key].history.push({
                    date: row.DATUMZEIT,
                    wert: row.WERT
                });
            }
        });
        
        return {
            success: true,
            tableName: tableName,
            data: groupedData,
            totalInverters: Object.keys(groupedData).length,
            totalMeasurements: result.recordset.length
        };
    } catch (error) {
        console.error(`❌ ${tableName} Inverter arama hatası:`, error);
        return {
            success: false,
            tableName: tableName,
            error: error.message
        };
    }
}

// Basit SQL arama - RTU ve Meas.p değerleri
async function searchRTUMeasPInTable(tableName) {
    try {
        console.log(`🔍 RTU arama başlatılıyor: ${tableName}`);
        
        if (!globalPool) {
            await initSqlConnection();
        }
        
        const query = `
            SELECT 
                NAME,
                ABS(WERT) AS WERT,  -- Negatif değerleri pozitife çevir
                CONVERT(VARCHAR(50), DATUMZEIT, 120) AS DATUMZEIT,
                STATUS
            FROM ${tableName}
            WHERE NAME LIKE '%RTU.%' AND NAME LIKE '%Meas.p%'
            ORDER BY DATUMZEIT DESC
        `;
        
        const result = await globalPool.request().query(query);
        console.log(`✅ ${tableName} tablosunda ${result.recordset.length} RTU verisi bulundu`);
        
        // RTU numaralarına göre grupla
        const groupedData = {};
        const measurementMap = {};
        
        result.recordset.forEach(row => {
            // STATUS binary kontrolü - sadece spontaneous olanları al
            const statusRaw = Number(row.STATUS);
            const statusBinary = statusRaw.toString(2).padStart(32, '0');
            const isSpontaneous = statusBinary.charAt(14) === '1';
            
            // Spontaneous değilse bu satırı atla
            if (!isSpontaneous) {
                return;
            }
            
            // NAME alanını JavaScript'te parse et
            const name = row.NAME;
            let rtuNum = 'Unknown';
            let measurementType = 'Unknown';
            
            if (name.includes('RTU.') && name.includes('Meas.p')) {
                const parts = name.split('.');
                const rtuIndex = parts.findIndex(part => part === 'RTU');
                
                if (rtuIndex !== -1 && parts[rtuIndex + 1]) {
                    rtuNum = parts[rtuIndex + 1];
                    
                    // Meas.p'den sonraki kısmı al
                    const measPIndex = name.indexOf('Meas.p');
                    if (measPIndex !== -1) {
                        measurementType = name.substring(measPIndex);
                    }
                }
            }
            
            const key = `${rtuNum}_${measurementType}`;
            
            if (!groupedData[rtuNum]) {
                groupedData[rtuNum] = [];
            }
            
            if (!measurementMap[key]) {
                measurementMap[key] = {
                    name: row.NAME,
                    measurementType: measurementType,
                    latestWert: row.WERT,
                    latestDate: row.DATUMZEIT,
                    history: []
                };
                
                groupedData[rtuNum].push(measurementMap[key]);
            }
            
            // Son 50 veriyi sakla (grafik için)
            if (measurementMap[key].history.length < 50) {
                measurementMap[key].history.push({
                    date: row.DATUMZEIT,
                    wert: row.WERT
                });
            }
        });
        
        return {
            success: true,
            tableName: tableName,
            data: groupedData,
            totalRTUs: Object.keys(groupedData).length,
            totalMeasurements: result.recordset.length,
            searchType: 'rtu-measp'
        };
    } catch (error) {
        console.error(`❌ ${tableName} RTU arama hatası:`, error);
        return {
            success: false,
            tableName: tableName,
            error: error.message
        };
    }
}

// Duplicate call prevention
let isSearching = false;

// AutoUpdater Event Handlers
autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Güncelleme kontrol ediliyor...');
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { status: 'checking', message: 'Güncelleme kontrol ediliyor...' });
    }
});

// Auto-updater hata yakalama
autoUpdater.on('error', (err) => {
    console.error('❌ Auto-updater hatası:', err);
    // Development modunda auto-updater hatalarını görmezden gel
    if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Development modunda auto-updater hatası görmezden geliniyor');
        return;
    }
    
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { 
            status: 'error', 
            message: `Güncelleme hatası: ${err.message}` 
        });
    }
});

autoUpdater.on('update-available', (info) => {
    console.log('✅ Yeni güncelleme mevcut:', info.version);
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { 
            status: 'available', 
            message: `Yeni güncelleme mevcut: v${info.version}`,
            version: info.version,
            releaseDate: info.releaseDate
        });
    }
    
    // Kullanıcıya güncelleme bildirimi göster
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Güncelleme Mevcut',
        message: `Yeni güncelleme mevcut: v${info.version}`,
        detail: 'Güncellemeyi indirmek ister misiniz?',
        buttons: ['Evet, İndir', 'Hayır, Daha Sonra'],
        defaultId: 0
    }).then((result) => {
        if (result.response === 0) {
            // Kullanıcı güncellemeyi indirmek istiyor
            autoUpdater.downloadUpdate();
        }
    });
});

autoUpdater.on('update-not-available', (info) => {
    console.log('✅ Güncelleme yok, en son sürüm kullanılıyor:', info.version);
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { 
            status: 'not-available', 
            message: 'En son sürüm kullanılıyor',
            version: info.version
        });
    }
});



autoUpdater.on('download-progress', (progressObj) => {
    const message = `İndiriliyor: ${Math.round(progressObj.percent)}%`;
    console.log(message);
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { 
            status: 'downloading', 
            message: message,
            percent: progressObj.percent
        });
    }
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Güncelleme indirildi:', info.version);
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { 
            status: 'downloaded', 
            message: `Güncelleme indirildi: v${info.version}`,
            version: info.version
        });
    }
    
    // Kullanıcıya kurulum bildirimi göster
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Güncelleme Hazır',
        message: `Güncelleme v${info.version} indirildi!`,
        detail: 'Uygulamayı yeniden başlatmak için "Şimdi Kur" butonuna tıklayın.',
        buttons: ['Şimdi Kur', 'Daha Sonra'],
        defaultId: 0
    }).then((result) => {
        if (result.response === 0) {
            // Kullanıcı kurulumu istiyor
            autoUpdater.quitAndInstall();
        }
    });
});

// IPC Handlers
ipcMain.handle('check-for-updates', async () => {
    try {
        console.log('🔍 Manuel güncelleme kontrolü başlatılıyor...');
        const result = await autoUpdater.checkForUpdates();
        console.log('✅ Güncelleme kontrolü tamamlandı');
        return { success: true, result };
    } catch (error) {
        console.error('❌ Güncelleme kontrolü hatası:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('download-update', async () => {
    try {
        console.log('📥 Güncelleme indirme başlatılıyor...');
        autoUpdater.downloadUpdate();
        return { success: true, message: 'Güncelleme indirme başlatıldı' };
    } catch (error) {
        console.error('❌ Güncelleme indirme hatası:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('install-update', async () => {
    try {
        console.log('🚀 Güncelleme kurulumu başlatılıyor...');
        autoUpdater.quitAndInstall();
        return { success: true, message: 'Güncelleme kurulumu başlatıldı' };
    } catch (error) {
        console.error('❌ Güncelleme kurulumu hatası:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('search-inverters', async (event, { tables }) => {
    // Eğer zaten arama yapılıyorsa, yeni aramayı engelle
    if (isSearching) {
        console.log('⚠️ Zaten arama yapılıyor, yeni arama engellendi');
        return { success: false, error: 'Zaten arama yapılıyor' };
    }
    
    try {
        isSearching = true;
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🔍 [${timestamp}] ${tables.length} tabloda veri arama başlatılıyor... (Inverter + RTU/Meas.p)`);
        
        // Worker thread'leri daha etkin kullan - batch processing
        const batchSize = 3; // Aynı anda 3 tablo işle
        const successfulResults = [];
        const failedResults = [];
        
        for (let i = 0; i < tables.length; i += batchSize) {
            const batch = tables.slice(i, i + batchSize);
            
                    // Batch'i paralel işle
        const batchPromises = batch.map(async (tableName) => {
            try {
                console.log(`🔄 ${tableName} tablosu işleniyor...`);
                
                const [inverterRes, rtuRes] = await Promise.allSettled([
                    searchInvertersInTable(tableName),
                    searchRTUMeasPInTable(tableName)
                ]);

                const inverterOk = inverterRes.status === 'fulfilled' && inverterRes.value.success;
                const rtuOk = rtuRes.status === 'fulfilled' && rtuRes.value.success;

                if (!inverterOk && !rtuOk) {
                    console.error(`❌ ${tableName}: Her iki sorgu da başarısız`);
                    return { success: false, tableName, error: `Both queries failed` };
                }

                console.log(`✅ ${tableName}: Inverter=${inverterOk}, RTU=${rtuOk}`);
                
                return {
                    success: true,
                    tableName,
                    inverterData: inverterOk ? inverterRes.value.data : {},
                    totalInverters: inverterOk ? inverterRes.value.totalInverters : 0,
                    rtuData: rtuOk ? rtuRes.value.data : {},
                    totalRTUs: rtuOk ? rtuRes.value.totalRTUs : 0,
                    totalMeasurements: (inverterOk ? inverterRes.value.totalMeasurements : 0) + (rtuOk ? rtuRes.value.totalMeasurements : 0)
                };
            } catch (error) {
                console.error(`❌ ${tableName} batch işleme hatası:`, error);
                return { success: false, tableName, error: error.message };
            }
        });
            
            const batchResults = await Promise.all(batchPromises);
            
            // Batch sonuçlarını işle
            batchResults.forEach(result => {
                if (result.success) {
                    successfulResults.push(result);
                } else {
                    failedResults.push(result);
                }
            });
            
            // Batch'ler arası kısa bekleme (worker thread'leri rahatlat)
            if (i + batchSize < tables.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`✅ ${successfulResults.length} tabloda veri bulundu`);
        if (failedResults.length > 0) {
            console.log(`❌ ${failedResults.length} tabloda hata oluştu`);
        }
        
        // Arama tamamlandı, yeni aramaya izin ver
        isSearching = false;
        
        return {
            success: true,
            results: successfulResults,
            errors: failedResults,
            totalSearched: tables.length
        };
    } catch (error) {
        console.error('Veri arama hatası:', error);
        // Hata durumunda da arama durumunu sıfırla
        isSearching = false;
        return {
            success: false,
            error: error.message
        };
    }
});


app.whenReady().then(async () => {
    // Cache hatalarını önlemek için
    app.commandLine.appendSwitch('--disable-gpu-cache');
    app.commandLine.appendSwitch('--disable-disk-cache');
    
    await initSqlConnection();
    createWindow(); 
    
    // Uygulama başladıktan 5 saniye sonra güncelleme kontrolü (sadece production'da)
    if (process.env.NODE_ENV !== 'development') {
        setTimeout(() => {
            console.log('🔍 Uygulama başlangıcında güncelleme kontrolü...');
            autoUpdater.checkForUpdates();
        }, 5000);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async () => {
    if (globalPool) {
        await globalPool.close();
        console.log("🔌 Veritabanı bağlantısı kapatıldı");
    }
});
