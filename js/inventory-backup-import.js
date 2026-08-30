/* Inventory Backup & Import manager.
 * - Creates a complete JSON backup from public.cards.
 * - Exports CSV for spreadsheet use.
 * - Imports JSON/CSV with validation, preview, duplicate-safe upsert, and image preservation.
 * - Never overwrites the live catalog until the user confirms the import.
 */
(function () {
  'use strict';

  const CARD_FIELDS = [
    'id','serial','name','type','price','base_floor_price','owner','status',
    'img_url','image_url','edition','sn','tier','printing','description',
    'asset_value','metadata','created_at','updated_at'
  ];
  const MAX_FILE_MB = 25;
  let lastPreview = null;
  let busy = false;

  function client() { return window.supabaseClient; }
  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function value(row, key) {
    if (key === 'image_url') return row.image_url || row.img_url || '';
    if (key === 'img_url') return row.img_url || row.image_url || '';
    return row[key] ?? '';
  }
  function normalize(row, index) {
    const r = {};
    CARD_FIELDS.forEach(k => { if (row[k] !== undefined) r[k] = row[k]; });
    r.id = String(r.id || r.serial || ('import-' + Date.now() + '-' + index));
    const img = r.image_url || r.img_url || row.imageUrl || row.imgUrl || row.image || '';
    r.image_url = img;
    r.img_url = img;
    if (r.metadata === undefined || r.metadata === '') r.metadata = {};
    if (typeof r.metadata === 'string') {
      try { r.metadata = JSON.parse(r.metadata); } catch (_) { r.metadata = { imported_metadata: r.metadata }; }
    }
    return r;
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function stamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }
  function csvEscape(v) { return '"' + String(v ?? '').replace(/"/g, '""') + '"'; }
  function toCsv(rows) {
    const head = ['id','serial','name','type','price','base_floor_price','owner','status','image_url','edition','sn','tier','printing','description','asset_value'];
    return head.map(csvEscape).join(',') + '\n' + rows.map(r => head.map(k => csvEscape(value(r,k))).join(',')).join('\n');
  }
  function parseCsv(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(x => x.trim());
    if (!lines.length) return [];
    const parse = line => {
      const out=[]; let cur='', q=false;
      for (let i=0;i<line.length;i++) { const c=line[i]; if(c==='"' && line[i+1]==='"'){cur+='"';i++;} else if(c==='"'){q=!q;} else if(c===','&&!q){out.push(cur);cur='';} else cur+=c; }
      out.push(cur); return out;
    };
    const h=parse(lines[0]).map(x=>x.trim());
    return lines.slice(1).map(line => { const v=parse(line), r={}; h.forEach((k,i)=>r[k]=v[i]??''); return normalize(r,0); });
  }
  async function fetchAll() {
    if (!client()) throw new Error('Supabase is not ready.');
    const pageSize = 1000; let from=0, all=[];
    while (true) {
      const {data,error}=await client().from('cards').select('*').range(from,from+pageSize-1);
      if(error) throw error;
      all=all.concat(data||[]); if(!data || data.length<pageSize) break; from+=pageSize;
    }
    return all;
  }
  async function backup(format) {
    if (busy) return; busy=true; setStatus('Creating backup…');
    try {
      const rows=await fetchAll();
      if(format==='csv') download('eugene-card-inventory-'+stamp()+'.csv',toCsv(rows),'text/csv;charset=utf-8');
      else {
        const payload={schema_version:2,exported_at:new Date().toISOString(),source:'eugene-card-inventory',row_count:rows.length,fields:CARD_FIELDS,data:rows};
        download('eugene-card-inventory-backup-'+stamp()+'.json',JSON.stringify(payload,null,2),'application/json;charset=utf-8');
      }
      setStatus(`Backup complete — ${rows.length} cards.`);
    } catch(e){ setStatus('Backup failed: '+(e.message||e)); }
    finally{busy=false;}
  }
  function setStatus(s){ const el=document.getElementById('inventoryBackupStatus'); if(el) el.textContent=s; }
  function showPreview(rows,name){
    lastPreview=rows;
    const body=document.getElementById('inventoryImportPreview');
    const count=document.getElementById('inventoryImportCount');
    if(count) count.textContent=`${rows.length} records from ${name}`;
    if(body) body.innerHTML=rows.slice(0,8).map(r=>`<tr><td>${esc(r.id)}</td><td>${esc(r.serial)}</td><td>${esc(r.name)}</td><td>${esc(r.status)}</td><td>${r.image_url?'✓':''}</td></tr>`).join('');
    document.getElementById('inventoryImportDialog')?.classList.add('open');
  }
  async function readImport(file){
    if(file.size>MAX_FILE_MB*1024*1024) throw new Error('File is larger than 25 MB.');
    const text=await file.text(); let rows;
    if(file.name.toLowerCase().endsWith('.csv')) rows=parseCsv(text);
    else {
      const parsed=JSON.parse(text); rows=Array.isArray(parsed)?parsed:(Array.isArray(parsed.data)?parsed.data:(Array.isArray(parsed.cards)?parsed.cards:[]));
      rows=rows.map((r,i)=>normalize(r,i));
    }
    if(!rows.length) throw new Error('No inventory records found.');
    if(rows.length>10000) throw new Error('Import is limited to 10,000 records per file.');
    const bad=rows.filter(r=>!r.id); if(bad.length) throw new Error('Some records have no usable ID.');
    showPreview(rows,file.name);
  }
  async function commitImport(mode){
    if(!lastPreview || !lastPreview.length || busy) return;
    if(!client()) return setStatus('Supabase is not ready.');
    busy=true; setStatus('Importing…');
    try {
      const rows=lastPreview.map((r,i)=>normalize(r,i));
      if(mode==='replace') {
        if(!confirm('Replace mode deletes existing catalog cards before importing. Continue?')) return;
        const {error:dErr}=await client().from('cards').delete().neq('id','__never_match__');
        if(dErr) throw dErr;
      }
      for(let i=0;i<rows.length;i+=250){ const {error}=await client().from('cards').upsert(rows.slice(i,i+250),{onConflict:'id'}); if(error) throw error; }
      document.getElementById('inventoryImportDialog')?.classList.remove('open');
      setStatus(`Import complete — ${rows.length} cards ${mode==='merge'?'merged':'restored'}.`);
      lastPreview=null;
      window.dispatchEvent(new CustomEvent('inventory:refresh'));
      setTimeout(()=>location.reload(),500);
    } catch(e){ setStatus('Import failed: '+(e.message||e)); }
    finally{busy=false;}
  }
  function inject(){
    if(document.getElementById('inventoryBackupImport')) return;
    const host=document.querySelector('#inventory, [data-page="inventory"], .inventory-section') || document.body;
    const box=document.createElement('section'); box.id='inventoryBackupImport'; box.innerHTML=`
      <div class="ibi-head"><div><strong>Inventory Backup & Import</strong><small>Safe catalog backup, restore and migration</small></div><span id="inventoryBackupStatus">Ready</span></div>
      <div class="ibi-actions">
        <button type="button" data-ibi="json">⬇ Backup JSON</button>
        <button type="button" data-ibi="csv">⬇ Export CSV</button>
        <button type="button" data-ibi="import">⬆ Import / Restore</button>
      </div>
      <input id="inventoryImportFile" type="file" accept=".json,.csv,application/json,text/csv" hidden>
      <div id="inventoryImportDialog" class="ibi-dialog"><div class="ibi-card"><h3>Review inventory import</h3><p id="inventoryImportCount"></p><div class="ibi-table"><table><thead><tr><th>ID</th><th>Serial</th><th>Name</th><th>Status</th><th>Image</th></tr></thead><tbody id="inventoryImportPreview"></tbody></table></div><div class="ibi-actions"><button type="button" data-ibi="cancel">Cancel</button><button type="button" data-ibi="merge">Merge / Update</button><button type="button" data-ibi="replace">Replace All</button></div></div></div>`;
    const style=document.createElement('style'); style.textContent=`#inventoryBackupImport{margin:16px 0;padding:16px;border:1px solid rgba(127,127,127,.25);border-radius:16px;background:rgba(20,20,25,.55);font:inherit;position:relative;z-index:2}.ibi-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.ibi-head strong{display:block;font-size:16px}.ibi-head small{display:block;opacity:.65;margin-top:3px}.ibi-head span{font-size:12px;opacity:.75}.ibi-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.ibi-actions button{border:1px solid rgba(127,127,127,.3);border-radius:10px;padding:9px 12px;background:transparent;color:inherit;cursor:pointer}.ibi-actions button:hover{filter:brightness(1.2)}.ibi-dialog{display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);align-items:center;justify-content:center;padding:18px;z-index:99999}.ibi-dialog.open{display:flex}.ibi-card{width:min(900px,100%);max-height:85vh;overflow:auto;padding:18px;border-radius:16px;background:#17171c}.ibi-table{overflow:auto}.ibi-table table{width:100%;border-collapse:collapse;font-size:12px}.ibi-table th,.ibi-table td{padding:7px;border-bottom:1px solid rgba(127,127,127,.2);text-align:left}`; document.head.appendChild(style);
    host.prepend(box);
    box.addEventListener('click',e=>{const a=e.target.closest('[data-ibi]');if(!a)return;const act=a.dataset.ibi;if(act==='json'||act==='csv')backup(act);if(act==='import')document.getElementById('inventoryImportFile').click();if(act==='cancel')document.getElementById('inventoryImportDialog').classList.remove('open');if(act==='merge'||act==='replace')commitImport(act);});
    box.querySelector('#inventoryImportFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)readImport(f).catch(err=>setStatus('Import failed: '+(err.message||err)));e.target.value='';});
  }
  function boot(){ setTimeout(inject,250); setTimeout(inject,1200); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
