const {app,BrowserWindow,shell,Menu}=require('electron');
const path=require('path');
if(!app.requestSingleInstanceLock()){app.quit();}
let win;
function create(){
  win=new BrowserWindow({width:1400,height:900,minWidth:900,minHeight:600,backgroundColor:'#14141c',title:'Progress Tracker',
    icon:path.join(__dirname,'build','icon.png'),autoHideMenuBar:true,webPreferences:{contextIsolation:true,sandbox:true,spellcheck:false}});
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname,'index.html'));
  win.webContents.setWindowOpenHandler(({url})=>{if(/^https?:/.test(url))shell.openExternal(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('file:')){e.preventDefault();if(/^https?:/.test(url))shell.openExternal(url);}});
  win.webContents.on('before-input-event',(e,i)=>{ // F11 puni zaslon, Ctrl+Shift+I alati za razvoj
    if(i.type==='keyDown'&&i.key==='F11'){win.setFullScreen(!win.isFullScreen());e.preventDefault();}
    if(i.type==='keyDown'&&i.control&&i.shift&&i.key.toLowerCase()==='i'){win.webContents.toggleDevTools();e.preventDefault();}});
}
app.setAppUserModelId('hr.progresstracker.app');
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
app.whenReady().then(create);
app.on('window-all-closed',()=>app.quit());
