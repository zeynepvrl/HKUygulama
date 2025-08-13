const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    searchInverters: (params) => ipcRenderer.invoke('search-inverters', params),
}); 