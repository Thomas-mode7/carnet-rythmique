"""Builds the installable app (index.html) from the Claude artifact version (src/carnet.html).
The artifact keeps its Claude-account storage; the app swaps in Google Drive storage and plain downloads."""
import pathlib,re,sys
root=pathlib.Path(__file__).parent
src=(root/"src/carnet.html").read_text()
def cut(s,start,end,new):
    i=s.index(start); j=s.index(end,i); return s[:i]+new+s[j:]
def rep(s,a,b):
    assert s.count(a)==1,("not unique",a[:70]); return s.replace(a,b)
s=src
s=rep(s,'<meta name="claude:viewport-fit-sides" content="cover">\n','')
s=cut(s,"/* ---------- storage: account","/* ---------- audio",(root/"src/storage-app.js").read_text()+"\n")
s=cut(s,"async function offerFile","/* ---------- boot",(root/"src/export-app.js").read_text()+"\n")
s=rep(s,'function toast(msg,undo){$("toastTxt").textContent=msg;const b=$("toastBtn");b.hidden=!undo;b.onclick=()=>{undo&&undo();',
        'function toast(msg,undo,label,fn){$("toastTxt").textContent=msg;const b=$("toastBtn"),act=undo||fn;b.textContent=label||"Annuler";b.hidden=!act;b.onclick=()=>{act&&act();')
s=rep(s,'toastT=setTimeout(()=>$("toast").classList.remove("show"),undo?5000:2600)','toastT=setTimeout(()=>$("toast").classList.remove("show"),(undo||fn)?6000:2600)')
s=rep(s,'''    <div class="more">
      <button class="tool" id="backup">''','''    <div class="more">
      <button class="tool on" id="driveBtn">Se connecter à Google Drive</button>
      <button class="tool" id="driveSync" hidden>Synchroniser maintenant</button>
      <button class="tool" id="driveOff" hidden>Déconnecter Drive</button>
    </div>
    <div class="more">
      <button class="tool" id="backup">''')
s=rep(s,'Chaque modification est enregistrée toute seule dans le pattern affiché.',
        'Chaque modification est enregistrée toute seule sur ce téléphone et, si tu es connecté, dans le dossier « Carnet Rythmique » de ton Google Drive. Les exports MIDI vont dans son sous-dossier « Exports ».')
s=rep(s,'<div class="status" id="status">Enregistrement sur cet appareil</div>','<div class="status" id="status">Enregistré sur ce téléphone</div>')
s=rep(s,'buildUI();wire();lsLoad();renderAll();requestAnimationFrame(frame);initStore();',
'''buildUI();wire();lsLoad();renderAll();requestAnimationFrame(frame);initStore();
$("driveBtn").onclick=()=>drive.want?reconnect():connectDrive();
$("driveSync").onclick=()=>tokenValid()?syncNow():reconnect();
$("driveOff").onclick=()=>{disconnectDrive();toast("Google Drive déconnecté. Tes fichiers restent dans ton Drive.")};
if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js").catch(()=>{});''')
head='''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<script src="config.js"></script>
<script src="https://accounts.google.com/gsi/client" async></script>
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font-size:14px}[hidden]{display:none!important}</style>
</head>
<body>
'''
s=head+s+"\n</body>\n</html>\n"
(root/"index.html").write_text(s)
print("built",len(s))
