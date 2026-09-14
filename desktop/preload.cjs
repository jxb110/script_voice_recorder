const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopBridge", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (value) => ipcRenderer.invoke("settings:save", value),
  chooseDirectory: () => ipcRenderer.invoke("dialog:choose-directory"),
  openScript: () => ipcRenderer.invoke("dialog:open-script"),
  saveRecording: (payload) => ipcRenderer.invoke("recording:save", payload),
  deleteTask: (payload) => ipcRenderer.invoke("recording:delete-task", payload),
  getRecording: (payload) => ipcRenderer.invoke("recording:get", payload),
  getTaskWorkspace: () => ipcRenderer.invoke("tasks:get-workspace"),
  saveTaskWorkspace: (workspace) => ipcRenderer.invoke("tasks:save-workspace", workspace),
  getDeviceName: () => ipcRenderer.invoke("system:device-name"),
  sync: {
    host: (input) => ipcRenderer.invoke("sync:host", input),
    join: (input) => ipcRenderer.invoke("sync:join", input),
    stop: () => ipcRenderer.invoke("sync:stop"),
    status: () => ipcRenderer.invoke("sync:status"),
    command: (name, sentenceIndex) => ipcRenderer.invoke("sync:command", name, sentenceIndex),
    state: (value) => ipcRenderer.invoke("sync:state", value),
    onEvent: (listener) => { const callback = (_event, value) => listener(value); ipcRenderer.on("sync:event", callback); return () => ipcRenderer.removeListener("sync:event", callback); },
  },
});
