const {app,BrowserWindow,shell,Menu,ipcMain,dialog}=require('electron');
const path=require('path');
const fs=require('fs');
if(!app.requestSingleInstanceLock()){app.quit();}
let win;
function create(){
  win=new BrowserWindow({width:1400,height:900,minWidth:900,minHeight:600,backgroundColor:'#14141c',title:'Progress Tracker',
    icon:path.join(__dirname,'build','icon.png'),autoHideMenuBar:true,webPreferences:{contextIsolation:true,sandbox:true,spellcheck:false,preload:path.join(__dirname,'preload.js')}});
  Menu.setApplicationMenu(null);
  // zumiranje: Ctrl + kotačić miša, Ctrl +/-/0; pamti se između pokretanja
  const zf=path.join(app.getPath('userData'),'zoom.json');let zl=0;
  try{zl=JSON.parse(fs.readFileSync(zf,'utf8')).z||0;}catch(_){}
  const setZ=l=>{zl=Math.max(-3,Math.min(5,Math.round(l*10)/10));win.webContents.setZoomLevel(zl);try{fs.writeFileSync(zf,JSON.stringify({z:zl}));}catch(_){}};
  win.webContents.on('did-finish-load',()=>win.webContents.setZoomLevel(zl));
  win.webContents.on('zoom-changed',(e,dir)=>setZ(zl+(dir==='in'?0.5:-0.5)));
  win.loadFile(path.join(__dirname,'index.html'));
  win.webContents.setWindowOpenHandler(({url})=>{if(/^https?:/.test(url))shell.openExternal(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('file:')){e.preventDefault();if(/^https?:/.test(url))shell.openExternal(url);}});
  win.webContents.on('before-input-event',(e,i)=>{ // F11 puni zaslon, Ctrl+Shift+I alati za razvoj
    if(i.type==='keyDown'&&i.control&&!i.alt&&(i.key==='='||i.key==='+')){setZ(zl+0.5);e.preventDefault();}
    if(i.type==='keyDown'&&i.control&&!i.alt&&i.key==='-'){setZ(zl-0.5);e.preventDefault();}
    if(i.type==='keyDown'&&i.control&&!i.alt&&i.key==='0'){setZ(0);e.preventDefault();}
    if(i.type==='keyDown'&&i.key==='F11'){win.setFullScreen(!win.isFullScreen());e.preventDefault();}
    if(i.type==='keyDown'&&i.control&&i.shift&&i.key.toLowerCase()==='i'){win.webContents.toggleDevTools();e.preventDefault();}});
}

// ===== automatska sigurnosna kopija na disk =====
const BK_KEEP=14,BK_RE=/^pt-auto-\d{4}-\d{2}-\d{2}\.json$/;
const bkCfgFile=()=>path.join(app.getPath('userData'),'backup.json');
function bkDir(){
  let d=null;try{d=JSON.parse(fs.readFileSync(bkCfgFile(),'utf8')).dir;}catch(_){}
  return d||path.join(app.getPath('documents'),'ProgressTracker-kopije');
}
const fromApp=e=>!!win&&e.sender===win.webContents;
ipcMain.handle('ptb:info',e=>{if(!fromApp(e))return null;return {dir:bkDir()};});
ipcMain.handle('ptb:choose',async e=>{
  if(!fromApp(e))return null;
  const r=await dialog.showOpenDialog(win,{title:'Mapa za automatske sigurnosne kopije',properties:['openDirectory','createDirectory']});
  if(r.canceled||!r.filePaths[0])return null;
  fs.writeFileSync(bkCfgFile(),JSON.stringify({dir:r.filePaths[0]}));return r.filePaths[0];
});
ipcMain.handle('ptb:write',(e,name,text)=>{
  if(!fromApp(e))throw new Error('nedopušteno');
  if(typeof name!=='string'||!BK_RE.test(name)||typeof text!=='string')throw new Error('neispravan zahtjev');
  const d=bkDir();fs.mkdirSync(d,{recursive:true});
  const f=path.join(d,name),tmp=f+'.tmp';
  fs.writeFileSync(tmp,text,'utf8');fs.renameSync(tmp,f);
  const all=fs.readdirSync(d).filter(n=>BK_RE.test(n)).sort();
  all.slice(0,Math.max(0,all.length-BK_KEEP)).forEach(n=>{try{fs.unlinkSync(path.join(d,n));}catch(_){}});
  return {path:f,size:Buffer.byteLength(text,'utf8')};
});
ipcMain.handle('ptb:list',e=>{if(!fromApp(e))return [];try{return fs.readdirSync(bkDir()).filter(n=>BK_RE.test(n)).sort().reverse();}catch(_){return [];}});
ipcMain.handle('ptb:open',async e=>{if(!fromApp(e))return '';const d=bkDir();fs.mkdirSync(d,{recursive:true});return shell.openPath(d);});
ipcMain.handle('ptb:pdf',async(e,html,name)=>{
  if(!fromApp(e)||typeof html!=='string'||html.length>200e6)return {ok:false,err:'invalid'};
  const base=String(name||'bilježnica').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,80)||'bilježnica';
  const r=await dialog.showSaveDialog(win,{title:'Spremi PDF',defaultPath:path.join(app.getPath('documents'),base+'.pdf'),filters:[{name:'PDF',extensions:['pdf']}]});
  if(r.canceled||!r.filePath)return {ok:false,canceled:true};
  const tmp=path.join(app.getPath('temp'),'pt-export-'+Date.now()+'.html');
  let w=null;
  try{
    fs.writeFileSync(tmp,html,'utf8');
    w=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,javascript:false,offscreen:false}});
    await w.loadFile(tmp);
    await new Promise(res=>setTimeout(res,900));
    const buf=await w.webContents.printToPDF({printBackground:true,preferCSSPageSize:true});
    const t2=r.filePath+'.tmp';fs.writeFileSync(t2,buf);fs.renameSync(t2,r.filePath);
    return {ok:true,path:r.filePath};
  }catch(err){return {ok:false,err:String(err&&err.message||err)};}
  finally{try{if(w)w.destroy();}catch(_){}try{fs.unlinkSync(tmp);}catch(_){}}
});

// ===== pohrana podataka na disku (bez ograničenja preglednika) =====
const v8=require('v8');
const dkCfgFile=()=>path.join(app.getPath('userData'),'podaci-mapa.json');
function dkDir(){
  let d=null;try{d=JSON.parse(fs.readFileSync(dkCfgFile(),'utf8')).dir;}catch(_){}
  return d||path.join(app.getPath('documents'),'ProgressTracker-podaci');
}
const dkMain=()=>path.join(dkDir(),'podaci.json');
const dkBlobs=()=>path.join(dkDir(),'datoteke');
const dkDaily=()=>path.join(dkDir(),'dnevne-kopije');
const kvName=k=>Buffer.from(String(k),'utf8').toString('base64url')+'.v8';
const kvKey=n=>{try{return Buffer.from(n.slice(0,-3),'base64url').toString('utf8');}catch(_){return null;}};
function atomicWrite(f,data){fs.mkdirSync(path.dirname(f),{recursive:true});const t=f+'.tmp';fs.writeFileSync(t,data);fs.renameSync(t,f);}
let dkDay='';
function dkSave(text){
  if(typeof text!=='string'||text.length>1.5e9)throw new Error('neispravan zahtjev');
  const f=dkMain();
  const day=new Date().toISOString().slice(0,10);
  if(dkDay!==day){
    try{
      if(fs.existsSync(f)){
        const dd=dkDaily(),tgt=path.join(dd,'podaci-'+day+'.json');
        if(!fs.existsSync(tgt)){fs.mkdirSync(dd,{recursive:true});fs.copyFileSync(f,tgt);}
        const all=fs.readdirSync(dd).filter(n=>/^podaci-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
        all.slice(0,Math.max(0,all.length-14)).forEach(n=>{try{fs.unlinkSync(path.join(dd,n));}catch(_){}});
      }
      dkDay=day;
    }catch(_){}
  }
  atomicWrite(f,text);
  return {size:Buffer.byteLength(text,'utf8')};
}
function dkLoad(){
  const out={dir:dkDir(),main:null,prev:null,err:null};
  try{out.main=fs.readFileSync(dkMain(),'utf8');}catch(e){if(e&&e.code!=='ENOENT')out.err=String(e.message||e);}
  try{
    const dd=dkDaily();const all=fs.readdirSync(dd).filter(n=>/^podaci-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
    if(all.length)out.prev=fs.readFileSync(path.join(dd,all[all.length-1]),'utf8');
  }catch(_){}
  return out;
}
ipcMain.on('ptd:load',e=>{if(!fromApp(e)){e.returnValue=null;return;}try{e.returnValue=dkLoad();}catch(err){e.returnValue={dir:dkDir(),main:null,prev:null,err:String(err&&err.message||err)};}});
ipcMain.on('ptd:saveSync',(e,text)=>{if(!fromApp(e)){e.returnValue=false;return;}try{dkSave(text);e.returnValue=true;}catch(_){e.returnValue=false;}});
ipcMain.handle('ptd:save',(e,text)=>{if(!fromApp(e))throw new Error('nedopušteno');return dkSave(text);});
ipcMain.handle('ptd:put',(e,k,v)=>{
  if(!fromApp(e)||typeof k!=='string'||!k||k.length>300)throw new Error('neispravan zahtjev');
  atomicWrite(path.join(dkBlobs(),kvName(k)),v8.serialize(v===undefined?null:v));return true;
});
ipcMain.handle('ptd:get',(e,k)=>{
  if(!fromApp(e)||typeof k!=='string')throw new Error('neispravan zahtjev');
  let b;try{b=fs.readFileSync(path.join(dkBlobs(),kvName(k)));}catch(err){if(err&&err.code==='ENOENT')return undefined;throw err;}
  return v8.deserialize(b);
});
ipcMain.handle('ptd:has',(e,k)=>{if(!fromApp(e)||typeof k!=='string')return false;try{return fs.existsSync(path.join(dkBlobs(),kvName(k)));}catch(_){return false;}});
ipcMain.handle('ptd:del',(e,k)=>{
  if(!fromApp(e)||typeof k!=='string')throw new Error('neispravan zahtjev');
  try{fs.unlinkSync(path.join(dkBlobs(),kvName(k)));}catch(err){if(!err||err.code!=='ENOENT')throw err;}return true;
});
ipcMain.handle('ptd:keys',e=>{
  if(!fromApp(e))return [];
  try{return fs.readdirSync(dkBlobs()).filter(n=>n.endsWith('.v8')).map(kvKey).filter(k=>k!=null);}catch(_){return [];}
});
ipcMain.handle('ptd:info',e=>{
  if(!fromApp(e))return null;
  const o={dir:dkDir(),mainBytes:0,files:0,fileBytes:0,free:null,total:null};
  try{o.mainBytes=fs.statSync(dkMain()).size;}catch(_){}
  try{fs.readdirSync(dkBlobs()).forEach(n=>{if(n.endsWith('.v8')){o.files++;try{o.fileBytes+=fs.statSync(path.join(dkBlobs(),n)).size;}catch(_){}}});}catch(_){}
  try{fs.mkdirSync(dkDir(),{recursive:true});const st=fs.statfsSync(dkDir());o.free=Number(st.bavail)*Number(st.bsize);o.total=Number(st.blocks)*Number(st.bsize);}catch(_){}
  return o;
});
ipcMain.handle('ptd:open',async e=>{if(!fromApp(e))return '';const d=dkDir();fs.mkdirSync(d,{recursive:true});return shell.openPath(d);});
ipcMain.handle('ptd:choose',async e=>{
  if(!fromApp(e))return null;
  const r=await dialog.showOpenDialog(win,{title:'Mapa za podatke aplikacije (npr. na drugom disku)',properties:['openDirectory','createDirectory']});
  if(r.canceled||!r.filePaths[0])return null;
  const nd=path.join(r.filePaths[0],'ProgressTracker-podaci'),od=dkDir();
  if(path.resolve(nd)===path.resolve(od))return {dir:od,moved:false};
  // kopiraj sve u novu mapu i provjeri; stara mapa ostaje netaknuta
  const copyDir=(a,b)=>{fs.mkdirSync(b,{recursive:true});for(const n of fs.readdirSync(a)){const x=path.join(a,n),y=path.join(b,n);const st=fs.statSync(x);if(st.isDirectory())copyDir(x,y);else if(!n.endsWith('.tmp')){fs.copyFileSync(x,y);if(fs.statSync(y).size!==st.size)throw new Error('kopiranje nije uspjelo: '+n);}}};
  if(fs.existsSync(od))copyDir(od,nd);else fs.mkdirSync(nd,{recursive:true});
  fs.writeFileSync(dkCfgFile(),JSON.stringify({dir:nd}));
  return {dir:nd,moved:true,old:od};
});
app.setAppUserModelId('hr.progresstracker.app');
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
app.whenReady().then(create);
app.on('window-all-closed',()=>app.quit());
