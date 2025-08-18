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
}); 