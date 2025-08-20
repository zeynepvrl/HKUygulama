const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    searchInverters: async (params) => {
        try {
            const result = await ipcRenderer.invoke('search-inverters', params);
            return result;
        } catch (error) {
            console.error('❌ Preload: searchInverters hatası:', error);
            throw error;
        }
    },
    
    // AutoUpdater API'leri
    checkForUpdates: async () => {
        try {
            const result = await ipcRenderer.invoke('check-for-updates');
            return result;
        } catch (error) {
            console.error('❌ Preload: checkForUpdates hatası:', error);
            throw error;
        }
    },
    
    downloadUpdate: async () => {
        try {
            const result = await ipcRenderer.invoke('download-update');
            return result;
        } catch (error) {
            console.error('❌ Preload: downloadUpdate hatası:', error);
            throw error;
        }
    },
    
    installUpdate: async () => {
        try {
            const result = await ipcRenderer.invoke('install-update');
            return result;
        } catch (error) {
            console.error('❌ Preload: installUpdate hatası:', error);
            throw error;
        }
    },
    
    // Güncelleme durumu dinleyicisi
    onUpdateStatus: (callback) => {
        ipcRenderer.on('update-status', (event, data) => callback(data));
    }
}); 