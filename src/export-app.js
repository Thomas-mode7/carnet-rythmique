function localDownload(name,data,mime){
  const url=URL.createObjectURL(new Blob([data],{type:mime}));
  const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
}
async function offerFile(name,data,mime){
  if(drive.want){
    try{await saveExportToDrive(name,data,mime);toast("Enregistré dans Drive › "+FOLDER+" › "+EXPORTS,null,"Télécharger aussi",()=>localDownload(name,data,mime));return}
    catch(e){toast("Drive indisponible, fichier téléchargé sur le téléphone")}
  }
  localDownload(name,data,mime);
}
function exportMidi(mapId){
  const ch=state.settings.chain,useChain=state.chainOn&&ch.length>1,slots=useChain?ch:[state.cur];
  const stamp=new Date().toISOString().slice(0,16).replace("T"," ").replace(":","h");
  const name="carnet "+slots.map(slotName).join("-")+" "+state.settings.bpm+"bpm "+MIDIMAPS[mapId].suffix+" "+stamp+".mid";
  offerFile(name,buildMidi(slots,mapId),"audio/midi");
}
function exportBackup(){
  const n="carnet-rythmique-banque-"+new Date().toISOString().slice(0,10)+".json";
  offerFile(n,bankJson(),"application/json");
}
