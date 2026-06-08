// 1) Pega aquí la URL del Web App de Google Apps Script.
// Ejemplo: const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxxxx/exec';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbydZhOc2YEtXtPCYPPTc2VUC7F7Wk5jE-eYYBj4ZQ6xVT-D_a31zXjqaYsvvYv5TQ2G/exec';

const EQUIPOS = [
 'JUMBO J-187','JUMBO S1D J-133','JUMBO DD311D J-587','JUMBO S7D J-163','JUMBO BOLTEC J-381',
 'MANIPULADOR MAT-474','MANIPULADOR MAT-336','MANIPULADOR MAT-319','MANIPULADOR MAT-047','MANIPULADOR MAT-869','MANIPULADOR MAT-933','MANIPULADOR MAT-160','MANIPULADOR MAT-747','MANIPULADOR MAT-512','MANIPULADOR MAT-757','MANIPULADOR MAT-891','MANIPULADOR MAT-660',
 'RETROEXCAVADORA 264','RETROEXCAVADORA 385','ROBOSHOT 231','ROBOSHOT 048','LHD 033','LHD 043','ACUÑADOR 427','MIXER','BROKK 424','MINICARGADOR 872'
];

const $ = (id)=>document.getElementById(id);
let fotosComprimidas = [];
let firmaData = '';

window.addEventListener('DOMContentLoaded', () => {
  $('fecha').valueAsDate = new Date();
  const equipo = $('equipo');
  equipo.innerHTML = '<option value="">Seleccione equipo</option>' + EQUIPOS.map(e=>`<option>${e}</option>`).join('');
  $('configWarning').style.display = SCRIPT_URL ? 'none' : 'block';
  cargarHistorial();
  iniciarFirma();
});

$('fotos').addEventListener('change', async (ev)=>{
  fotosComprimidas = [];
  $('previewFotos').innerHTML = '';
  const files = Array.from(ev.target.files || []).slice(0,4);
  for (const file of files) {
    const data = await comprimirImagen(file, 1280, 0.68);
    fotosComprimidas.push(data);
    const img = new Image();
    img.src = data;
    $('previewFotos').appendChild(img);
  }
});

$('limpiarFirma').addEventListener('click', ()=>{
  const c=$('firma'), ctx=c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height); firmaData='';
});

$('generarPDF').addEventListener('click', async ()=>{
  const data = recolectarDatos();
  await crearPDF(data, true);
});

$('formFalla').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const status = $('status');
  const data = recolectarDatos();
  guardarLocal(data);
  status.className='status'; status.textContent='Guardando registro...';

  if (!SCRIPT_URL) {
    status.className='status err';
    status.textContent='Falta configurar SCRIPT_URL en app.js. El registro quedó guardado localmente.';
    cargarHistorial(); return;
  }

  try {
    const resp = await fetch(SCRIPT_URL, {
      method:'POST', mode:'cors', cache:'no-cache',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify(data)
    });
    const result = await resp.json();
    if (!result.ok) throw new Error(result.error || 'Error desconocido');
    status.className='status ok';
    status.textContent=`Guardado en Google Sheets. Folio: ${result.folio || data.folio}`;
    await crearPDF(data, false);
    cargarHistorial();
  } catch(err) {
    status.className='status err';
    status.textContent='No se pudo enviar a Google Sheets. Revisa URL/permisos. Quedó guardado localmente.';
    console.error(err);
    cargarHistorial();
  }
});

function recolectarDatos(){
  const c=$('firma'); firmaData = c.toDataURL('image/png');
  return {
    folio: generarFolio(), fecha:$('fecha').value, operador:$('operador').value.trim().toUpperCase(), contrato:$('contrato').value,
    supervisor:$('supervisor').value.trim().toUpperCase(), equipo:$('equipo').value, interno:$('interno').value.trim().toUpperCase(),
    tipoFalla:$('tipoFalla').value, costo:$('costo').value, repuesto:$('repuesto').value.trim().toUpperCase(),
    tiempoFalla:$('tiempoFalla').value.trim().toUpperCase(), ot:$('ot').value.trim().toUpperCase(), descripcion:$('descripcion').value.trim(),
    imagenes:fotosComprimidas, firma:firmaData, creadoEn:new Date().toISOString()
  };
}
function generarFolio(){
  const d=new Date(); const y=d.getFullYear(); const n=String(Date.now()).slice(-6);
  return `XT-${y}-${n}`;
}
async function comprimirImagen(file, maxWidth=1280, quality=.68){
  const img = await fileToImage(file);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxWidth / img.width);
  canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}
function fileToImage(file){
  return new Promise((resolve,reject)=>{
    const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject;
    img.src=URL.createObjectURL(file);
  });
}
function iniciarFirma(){
  const canvas=$('firma'), ctx=canvas.getContext('2d'); let drawing=false;
  function pos(e){ const r=canvas.getBoundingClientRect(); const t=e.touches?e.touches[0]:e; return {x:(t.clientX-r.left)*(canvas.width/r.width), y:(t.clientY-r.top)*(canvas.height/r.height)}; }
  function start(e){ drawing=true; const p=pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); e.preventDefault(); }
  function move(e){ if(!drawing)return; const p=pos(e); ctx.lineWidth=4; ctx.lineCap='round'; ctx.strokeStyle='#111'; ctx.lineTo(p.x,p.y); ctx.stroke(); e.preventDefault(); }
  function end(){ drawing=false; firmaData=canvas.toDataURL('image/png'); }
  canvas.addEventListener('mousedown',start); canvas.addEventListener('mousemove',move); window.addEventListener('mouseup',end);
  canvas.addEventListener('touchstart',start,{passive:false}); canvas.addEventListener('touchmove',move,{passive:false}); canvas.addEventListener('touchend',end);
}
async function crearPDF(data, onlyDownload){
  if (!window.jspdf) { alert('No se cargó jsPDF. Revisa internet o usa el botón imprimir del navegador.'); return; }
  const { jsPDF } = window.jspdf; const doc=new jsPDF('p','mm','a4');
  const logo = await loadImageAsDataURL('assets/logo_xtreme.png').catch(()=>null);
  if(logo) doc.addImage(logo,'PNG',14,10,55,16);
  doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.text('REPORTE DE FALLA OPERACIONAL', 105, 18, {align:'center'});
  doc.setFontSize(10); doc.text(`FOLIO: ${data.folio}`, 196, 18, {align:'right'});
  let y=32; doc.setFont('helvetica','normal'); doc.setFontSize(10);
  const rows=[['FECHA',data.fecha],['OPERADOR DENUNCIANTE',data.operador],['CONTRATO',data.contrato],['SUPERVISOR',data.supervisor],['EQUIPO',data.equipo],['N° INTERNO',data.interno],['TIPO FALLA',data.tipoFalla],['COSTO',formatCLP(data.costo)],['REPUESTO',data.repuesto],['TIEMPO FALLA',data.tiempoFalla],['N° OT',data.ot]];
  rows.forEach(([k,v],i)=>{ const x=i%2===0?14:108; if(i%2===0 && i>0)y+=9; doc.setFont('helvetica','bold'); doc.text(k+':',x,y); doc.setFont('helvetica','normal'); doc.text(String(v||'-'),x+34,y); });
  y+=13; doc.setFont('helvetica','bold'); doc.text('DESCRIPCIÓN / OBSERVACIÓN',14,y); y+=6; doc.setFont('helvetica','normal');
  doc.text(doc.splitTextToSize(data.descripcion||'-',180),14,y); y+=22;
  if(data.imagenes?.length){ doc.setFont('helvetica','bold'); doc.text('EVIDENCIA FOTOGRÁFICA',14,y); y+=7;
    for(let i=0;i<data.imagenes.length;i++){
      if(y>230){doc.addPage(); y=18;}
      const x = (i%2===0)?14:108; if(i%2===0 && i>0) y+=58;
      doc.addImage(data.imagenes[i], 'JPEG', x, y, 84, 52, undefined, 'FAST');
      doc.setFontSize(8); doc.text(`Foto ${i+1}`, x, y+56); doc.setFontSize(10);
    }
    y += (data.imagenes.length%2===0 ? 66 : 66);
  }
  if(y>225){doc.addPage(); y=18;}
  doc.setFont('helvetica','bold'); doc.text('FIRMA DEL INVOLUCRADO',14,y); y+=6;
  if(data.firma) doc.addImage(data.firma,'PNG',14,y,80,28);
  doc.setDrawColor(80); doc.line(14,y+32,94,y+32); doc.setFont('helvetica','normal'); doc.text(data.operador || 'Nombre involucrado',14,y+37);
  doc.save(`${data.folio}_reporte_falla.pdf`);
}
function formatCLP(v){ if(!v)return '-'; return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v)); }
function loadImageAsDataURL(url){return new Promise((res,rej)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);res(c.toDataURL('image/png'));};img.onerror=rej;img.src=url;});}
function guardarLocal(data){ const arr=JSON.parse(localStorage.getItem('fallas_xtreme')||'[]'); arr.unshift({...data, imagenes:[]}); localStorage.setItem('fallas_xtreme',JSON.stringify(arr.slice(0,30))); }
function cargarHistorial(){ const arr=JSON.parse(localStorage.getItem('fallas_xtreme')||'[]'); $('historial').innerHTML = arr.length ? arr.slice(0,8).map(r=>`<div class="historyItem"><b>${r.folio}</b> · ${r.fecha} · ${r.equipo} · ${r.tipoFalla}</div>`).join('') : '<p class="hint">Sin registros locales.</p>'; }
