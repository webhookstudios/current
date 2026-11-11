// Current: the narrow bridge between the editor page and the main process.
'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('native', {
  importMedia: call('dialog:importMedia'),
  openProjectDialog: call('dialog:openProject'),
  saveProjectDialog: call('dialog:saveProject'),
  exportPathDialog: call('dialog:exportPath'),
  message: call('dialog:message'),
  readText: call('fs:readText'),
  writeText: call('fs:writeText'),
  readBinary: call('fs:readBinary'),
  exists: call('fs:exists'),
  stat: call('fs:stat'),
  cacheWrite: call('fs:cacheWrite'),
  cachePath: call('fs:cachePath'),
  showItem: call('shell:showItem'),
  openExternal: call('shell:openExternal'),
  info: call('app:info'),
  setTitle: call('win:setTitle'),
  recentList: call('recent:list'),
  recentAdd: call('recent:add'),
  recentRemove: call('recent:remove'),
  proxy: call('media:proxy'),
  exportStart: call('export:start'),
  exportFrame: call('export:frame'),
  exportFinish: call('export:finish'),
  exportCancel: call('export:cancel'),
  gstCheck: call('gst:check'),
  selftestCapture: (f) => ipcRenderer.invoke('selftest:capture', f),
  selftestDone: (code) => ipcRenderer.send('selftest:done', code),
  pathForFile: (file) => webUtils.getPathForFile(file),
});
