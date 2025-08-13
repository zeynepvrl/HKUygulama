const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sql = require('mssql');
const { Worker } = require('worker_threads');

let globalPool = null;
let mainWindow = null;

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

    // Development modunda src klasöründen, production'da dist klasöründen yükle
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadFile('src/index.html');
    } else {
        mainWindow.loadFile('dist/index.html');
    }

    // Developer tools'u her zaman aç (hata ayıklama için)
    mainWindow.webContents.openDevTools();
    
    // Hata ayıklama için console log'ları
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Sayfa yükleme hatası:', errorCode, errorDescription);
    });
    
    mainWindow.webContents.on('crashed', () => {
        console.error('Renderer process çöktü');
    });
}

// Worker thread ile paralel arama - Inverter unique değerleri
async function searchInvertersInTable(tableName) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(`
            const { parentPort } = require('worker_threads');
            const sql = require('mssql');

            const mssqlConfig = {
                server: '192.168.234.3\\\\prod19',
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

            const tableName = '${tableName}';

            async function searchInverters() {
                try {
                    const pool = await sql.connect(mssqlConfig);
                    
                    // Sadece gerekli verileri al, parsing'i JavaScript'te yap
                    const query = \`
                        SELECT 
                            NAME,
                            WERT,
                            DATUMZEIT,
                            STATUS
                        FROM \${tableName}
                        WHERE NAME LIKE '%Inverter.%'
                        ORDER BY DATUMZEIT DESC
                    \`;
                    
                    const result = await pool.request().query(query);
                    await pool.close();
                    
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
                        
                        const key = \`\${inverterNum}_\${measurementType}\`;
                        
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
                    
                    parentPort.postMessage({
                        success: true,
                        tableName: tableName,
                        data: groupedData,
                        totalInverters: Object.keys(groupedData).length,
                        totalMeasurements: result.recordset.length
                    });
                } catch (error) {
                    parentPort.postMessage({
                        success: false,
                        tableName: tableName,
                        error: error.message
                    });
                }
            }
            
            searchInverters();
        `, { eval: true });

        worker.on('message', (result) => {
            resolve(result);
            worker.terminate();
        });

        worker.on('error', (error) => {
            reject(error);
            worker.terminate();
        });
    });
}

// Worker thread ile paralel arama - RTU ve Meas.p değerleri
async function searchRTUMeasPInTable(tableName) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(`
            const { parentPort } = require('worker_threads');
            const sql = require('mssql');

            const mssqlConfig = {
                server: '192.168.234.3\\\\prod19',
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

            const tableName = '${tableName}';

            async function searchRTUMeasP() {
                try {
                    const pool = await sql.connect(mssqlConfig);
                    
                    // Sadece gerekli verileri al, parsing'i JavaScript'te yap
                    const query = \`
                        SELECT 
                            NAME,
                            WERT,
                            DATUMZEIT,
                            STATUS
                        FROM \${tableName}
                        WHERE NAME LIKE '%RTU.%' AND NAME LIKE '%Meas.p%'
                        ORDER BY DATUMZEIT DESC
                    \`;
                    
                    const result = await pool.request().query(query);
                    await pool.close();
                    
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
                        
                        const key = \`\${rtuNum}_\${measurementType}\`;
                        
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
                    
                    parentPort.postMessage({
                        success: true,
                        tableName: tableName,
                        data: groupedData,
                        totalRTUs: Object.keys(groupedData).length,
                        totalMeasurements: result.recordset.length,
                        searchType: 'rtu-measp'
                    });
                } catch (error) {
                    parentPort.postMessage({
                        success: false,
                        tableName: tableName,
                        error: error.message
                    });
                }
            }
            
            searchRTUMeasP();
        `, { eval: true });

        worker.on('message', (result) => {
            resolve(result);
            worker.terminate();
        });

        worker.on('error', (error) => {
            reject(error);
            worker.terminate();
        });
    });
}

// Duplicate call prevention
let isSearching = false;

// IPC Handlers
ipcMain.handle('search-inverters', async (event, { tables }) => {
    // Eğer zaten arama yapılıyorsa, yeni aramayı engelle
    if (isSearching) {
        console.log('⚠️ Zaten arama yapılıyor, yeni arama engellendi');
        return;
    }
    
    try {
        isSearching = true;
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🔍 [${timestamp}] ${tables.length} tabloda veri arama başlatılıyor... (Inverter + RTU/Meas.p)`);
        
        // Her tablo için hem Inverter hem RTU/Meas.p aramalarını aynı anda yap
        const tablePromises = tables.map(async (tableName) => {
            const [inverterRes, rtuRes] = await Promise.allSettled([
                searchInvertersInTable(tableName),
                searchRTUMeasPInTable(tableName)
            ]);

            const inverterOk = inverterRes.status === 'fulfilled' && inverterRes.value.success;
            const rtuOk = rtuRes.status === 'fulfilled' && rtuRes.value.success;

            if (!inverterOk && !rtuOk) {
                return { success: false, tableName, error: `Both queries failed` };
            }

            return {
                success: true,
                tableName,
                inverterData: inverterOk ? inverterRes.value.data : {},
                totalInverters: inverterOk ? inverterRes.value.totalInverters : 0,
                rtuData: rtuOk ? rtuRes.value.data : {},
                totalRTUs: rtuOk ? rtuRes.value.totalRTUs : 0,
                totalMeasurements: (inverterOk ? inverterRes.value.totalMeasurements : 0) + (rtuOk ? rtuRes.value.totalMeasurements : 0)
            };
        });

        const results = await Promise.allSettled(tablePromises);
        const successfulResults = results
            .filter(r => r.status === 'fulfilled' && r.value.success)
            .map(r => r.value);

        const failedResults = results
            .filter(r => r.status === 'fulfilled' && !r.value.success)
            .map(r => r.value);

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
