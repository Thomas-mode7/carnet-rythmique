/* ---------- storage: this device always, Google Drive folder when connected ---------- */
const LS="carnet-rythmique-v1", LS_DRIVE="carnet-rythmique-drive";
const CLIENT_ID=(window.CARNET_CONFIG&&window.CARNET_CONFIG.googleClientId)||"";
const SCOPE="https://www.googleapis.com/auth/drive.file"; // only files this app created
const FOLDER="Carnet Rythmique", EXPORTS="Exports", BANKFILE="banque.json";
const drive={token:null,exp:0,folder:null,exports:null,fileId:null,remoteStamp:null,busy:false,pending:false,timer:null,client:null,want:false,email:""};
function lsSave(){try{localStorage.setItem(LS,JSON.stringify({bank:state.bank,settings:state.settings,updatedAt:state.updatedAt||0}))}catch(e){}}
function lsLoad(){try{const d=JSON.parse(localStorage.getItem(LS)||"null");if(d&&Array.isArray(d.bank)){applyData(d);state.updatedAt=d.updatedAt||0}}catch(e){}
  try{const m=JSON.parse(localStorage.getItem(LS_DRIVE)||"null");if(m){drive.want=!!m.want;drive.folder=m.folder||null;drive.exports=m.exports||null;drive.fileId=m.fileId||null;drive.remoteStamp=m.remoteStamp||null;drive.email=m.email||""}}catch(e){}}
function driveMetaSave(){try{localStorage.setItem(LS_DRIVE,JSON.stringify({want:drive.want,folder:drive.folder,exports:drive.exports,fileId:drive.fileId,remoteStamp:drive.remoteStamp,email:drive.email}))}catch(e){}}
function normPattern(p){const o=blankPattern();if(p)TRACKS.forEach(t=>{if(typeof p[t.id]==="string"&&/^[0-9a-f]{16}$/.test(p[t.id]))o[t.id]=p[t.id];
  const c=p.cond&&p.cond[t.id];if(typeof c==="string"&&/^[0-6]{16}$/.test(c)&&c!==EMPTY){o.cond=o.cond||{};o.cond[t.id]=c}});return o}
function applyData(d){
  if(Array.isArray(d.bank))state.bank=Array.from({length:SLOTS},(_,i)=>normPattern(d.bank[i]));
  if(d.settings){const s=d.settings,k=defaultKit();
    if(s.kit)TRACKS.forEach(t=>{if(s.kit[t.id])Object.assign(k[t.id],s.kit[t.id])});
    Object.assign(state.settings,{bpm:+s.bpm||124,swing:+s.swing||0,flam:+s.flam||20,accent:s.accent??60,vol:s.vol??80,kit:k,chain:Array.isArray(s.chain)?s.chain.filter(n=>n>=0&&n<SLOTS).slice(0,4):[]});}
}
function setStatus(t){document.getElementById("status").textContent=t}
function touch(){state.updatedAt=Date.now();lsSave();schedulePush()}
const saveSlot=()=>touch();
const saveSettings=()=>touch();
const bankJson=()=>JSON.stringify({app:"carnet-rythmique",version:1,updatedAt:state.updatedAt||0,bank:state.bank,settings:state.settings});

/* Google sign-in (Google Identity Services token flow) */
function gisReady(){return !!(window.google&&google.accounts&&google.accounts.oauth2)}
function tokenValid(){return drive.token&&Date.now()<drive.exp-60000}
function getToken(interactive){
  return new Promise((res,rej)=>{
    if(!CLIENT_ID)return rej(new Error("no_client_id"));
    if(!gisReady())return rej(new Error("gis_not_loaded"));
    if(!drive.client)drive.client=google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPE,callback:()=>{}});
    drive.client.callback=r=>{if(r.error)return rej(new Error(r.error));drive.token=r.access_token;drive.exp=Date.now()+(+r.expires_in||3600)*1000;res(drive.token)};
    drive.client.error_callback=e=>rej(new Error(e&&e.type||"popup"));
    drive.client.requestAccessToken({prompt:interactive?"consent":"",login_hint:drive.email||undefined});
  });
}
async function api(path,opt={},retry=true){
  if(!tokenValid())throw new Error("need_token");
  const r=await fetch(path,{...opt,headers:{...(opt.headers||{}),Authorization:"Bearer "+drive.token}});
  if(r.status===401&&retry){drive.token=null;throw new Error("need_token")}
  if(!r.ok)throw new Error("http_"+r.status);
  return r;
}
const G="https://www.googleapis.com/drive/v3/files", U="https://www.googleapis.com/upload/drive/v3/files";
const q=s=>"'"+s.replace(/\\/g,"\\\\").replace(/'/g,"\\'")+"'";
async function findOne(query){const r=await api(G+"?spaces=drive&pageSize=5&fields=files(id,name,modifiedTime)&q="+encodeURIComponent(query+" and trashed=false"));return (await r.json()).files[0]||null}
async function ensureFolder(name,parent){
  const f=await findOne("name="+q(name)+" and mimeType='application/vnd.google-apps.folder'"+(parent?" and "+q(parent)+" in parents":""));
  if(f)return f.id;
  const r=await api(G+"?fields=id",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,mimeType:"application/vnd.google-apps.folder",parents:parent?[parent]:undefined})});
  return (await r.json()).id;
}
async function upload(name,parent,blob,mime,fileId){
  if(fileId){const r=await api(U+"/"+fileId+"?uploadType=media&fields=id,modifiedTime",{method:"PATCH",headers:{"Content-Type":mime},body:blob});return r.json()}
  const meta=JSON.stringify({name,parents:[parent]}),b="carnet"+Math.random().toString(36).slice(2);
  const body=new Blob(["--"+b+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+meta+"\r\n--"+b+"\r\nContent-Type: "+mime+"\r\n\r\n",blob,"\r\n--"+b+"--"]);
  const r=await api(U+"?uploadType=multipart&fields=id,modifiedTime",{method:"POST",headers:{"Content-Type":"multipart/related; boundary="+b},body});return r.json();
}
async function setupFolders(){
  if(!drive.folder)drive.folder=await ensureFolder(FOLDER);
  if(!drive.exports)drive.exports=await ensureFolder(EXPORTS,drive.folder);
  if(!drive.fileId){const f=await findOne("name="+q(BANKFILE)+" and "+q(drive.folder)+" in parents");drive.fileId=f?f.id:null}
  driveMetaSave();
}
/* pull then push: the most recently edited bank wins */
async function syncNow(){
  if(!drive.want)return;
  if(drive.busy){drive.pending=true;return}
  if(!tokenValid()){renderDrive("reconnect");return}
  drive.busy=true;renderDrive("sync");
  try{
    try{await setupFolders()}catch(e){if(e.message==="http_404"){drive.folder=drive.exports=drive.fileId=null;await setupFolders()}else throw e}
    let remote=null;
    if(drive.fileId){try{remote=await (await api(G+"/"+drive.fileId+"?alt=media")).json()}catch(e){if(e.message==="http_404"){drive.fileId=null}else throw e}}
    if(remote&&(remote.updatedAt||0)>(state.updatedAt||0)){
      applyData(remote);state.updatedAt=remote.updatedAt;lsSave();renderAll();toast("Banque mise à jour depuis Google Drive");
    }else if(!remote||(remote.updatedAt||0)<(state.updatedAt||0)){
      const r=await upload(BANKFILE,drive.folder,new Blob([bankJson()],{type:"application/json"}),"application/json",drive.fileId);
      drive.fileId=r.id;
    }
    drive.lastSync=Date.now();driveMetaSave();renderDrive("ok");
  }catch(e){
    if(e.message==="need_token")renderDrive("reconnect");
    else renderDrive(navigator.onLine?"error":"offline",e.message);
  }finally{drive.busy=false;if(drive.pending){drive.pending=false;schedulePush()}}
}
function schedulePush(){if(!drive.want)return;clearTimeout(drive.timer);drive.timer=setTimeout(syncNow,2500)}
async function connectDrive(){
  try{await getToken(!drive.want);drive.want=true;await fetchEmail();driveMetaSave();await syncNow()}
  catch(e){renderDrive(e.message==="no_client_id"?"noid":"error",e.message)}
}
async function fetchEmail(){try{const r=await api("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)");drive.email=(await r.json()).user.emailAddress||""}catch(e){}}
async function reconnect(){try{await getToken(false);await syncNow()}catch(e){renderDrive("reconnect")}}
function disconnectDrive(){
  try{if(drive.token&&gisReady())google.accounts.oauth2.revoke(drive.token,()=>{})}catch(e){}
  Object.assign(drive,{token:null,exp:0,want:false,folder:null,exports:null,fileId:null,email:""});driveMetaSave();renderDrive();
}
async function saveExportToDrive(name,data,mime){
  if(!drive.want)return false;
  if(!tokenValid())await getToken(false);
  await setupFolders();
  await upload(name,drive.exports,new Blob([data],{type:mime}),mime);
  return true;
}
function renderDrive(st,detail){
  const b=$("driveBtn"),s=$("driveSync"),o=$("driveOff");
  if(!b)return;
  o.hidden=!drive.want;s.hidden=!drive.want;
  b.hidden=drive.want&&st!=="reconnect";
  b.textContent=st==="reconnect"?"Reconnecter Google Drive":"Se connecter à Google Drive";
  const who=drive.email?" ("+drive.email+")":"";
  const msg={sync:"Synchronisation avec Google Drive…",ok:"Synchronisé avec Google Drive"+who+" · dossier « "+FOLDER+" »",
    reconnect:"Google Drive : touche « Reconnecter » pour reprendre la synchro",offline:"Hors connexion : enregistré sur ce téléphone, synchro au retour du réseau",
    error:"Problème avec Google Drive ("+(detail||"erreur")+"). Enregistré sur ce téléphone.",noid:"La connexion Google n'est pas encore configurée sur ce site."}[st];
  setStatus(msg||(drive.want?"Google Drive connecté"+who:"Enregistré sur ce téléphone"));
}
function initStore(){
  renderDrive();
  if(!drive.want)return;
  // a silent token request needs a user gesture on most phones: take the first tap
  const once=()=>{document.removeEventListener("pointerdown",once,true);if(!tokenValid())reconnect();else syncNow()};
  document.addEventListener("pointerdown",once,true);
  renderDrive("reconnect");
}
window.addEventListener("online",()=>{if(drive.want)syncNow()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&drive.want&&tokenValid())syncNow()});
