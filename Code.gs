const SHEET_NAME = 'REGISTRO_FALLAS';
const DRIVE_FOLDER_NAME = 'FOTOS_REGISTRO_FALLAS_XTREME';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) sh = ss.insertSheet(SHEET_NAME);
    ensureHeader_(sh);

    const folder = getOrCreateFolder_(DRIVE_FOLDER_NAME);
    const fotoUrls = [];
    (data.imagenes || []).forEach((b64, i) => {
      const url = saveBase64File_(folder, b64, `${data.folio}_foto_${i+1}.jpg`, 'image/jpeg');
      fotoUrls.push(url);
    });
    let firmaUrl = '';
    if (data.firma) firmaUrl = saveBase64File_(folder, data.firma, `${data.folio}_firma.png`, 'image/png');

    sh.appendRow([
      new Date(), data.folio || '', data.fecha || '', data.operador || '', data.contrato || '', data.supervisor || '', data.equipo || '', data.interno || '',
      data.tipoFalla || '', data.costo || '', data.repuesto || '', data.tiempoFalla || '', data.ot || '', data.descripcion || '', fotoUrls.join('\n'), firmaUrl
    ]);
    return json_({ok:true, folio:data.folio, fotos:fotoUrls.length, firma:firmaUrl});
  } catch (err) {
    return json_({ok:false, error:String(err)});
  }
}
function doGet(){ return json_({ok:true, message:'Registro de fallas activo'}); }
function ensureHeader_(sh){
  if (sh.getLastRow() === 0) {
    sh.appendRow(['TIMESTAMP','FOLIO','FECHA','OPERADOR DENUNCIANTE','CONTRATO','SUPERVISOR','EQUIPO','N° INTERNO','TIPOFALLA','COSTO','REPUESTO','TIEMPOFALLA','N° OT','DESCRIPCIÓN','IMÁGENES DRIVE','FIRMA DRIVE']);
    sh.setFrozenRows(1);
  }
}
function getOrCreateFolder_(name){
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}
function saveBase64File_(folder, dataUrl, filename, mimeType){
  const base64 = dataUrl.split(',')[1];
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}
function json_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
