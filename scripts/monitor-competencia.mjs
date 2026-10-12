// [LA14 · COMPETENCIA · MONITOR · v1]
// Node 20+. Ejecutado por GitHub Actions. Solo consulta fuentes públicas.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const REPORT_EMAIL = process.env.REPORT_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL || "La 14 Lounge <onboarding@resend.dev>";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const ua = "Mozilla/5.0 (compatible; La14Lounge-Competencia-Monitor/1.0)";

async function sb(path, options = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

async function getText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { "user-agent": ua, accept: "text/html,application/xhtml+xml,text/plain;q=0.8" }, signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(timer); }
}

function text(html) { return html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g," ").trim(); }
function norm(v) { return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }
function money(v) { const n=Number(v.replace(/[^\d.,]/g,"").replace(/\.(?=\d{3}(?:\D|$))/g,"").replace(",",".")); return Number.isFinite(n)?n:null; }
function presentation(v) { const m=v.match(/(\d+(?:[.,]\d+)?)\s*(ml|l|cl)\b/i); if(!m)return null; let n=Number(m[1].replace(",",".")); if(m[2].toLowerCase()==="l")n*=1000; if(m[2].toLowerCase()==="cl")n*=10; return `${Math.round(n)} ml`; }
function tokens(q) { return norm(q).split(/\s+/).filter(Boolean).filter(x=>!/^\d+(ml|l|cl)$/.test(x)); }
function match(name,q) { const n=norm(name); return tokens(q).every(t=>n.includes(t)); }
function stableId(name,pres,sku) { return sku || `${norm(name)}|${pres||""}`; }
function parseCatalog(raw, competitor) {
  const t=text(raw), out=[];
  for(const chunk of t.split(/(?=₡|CRC|SKU:|Disponible|No disponible)/i)) {
    const prices=(chunk.match(/₡\s*[\d.,]+/g)||[]).map(money).filter(Number.isFinite);
    if(!prices.length)continue;
    const sku=chunk.match(/SKU:\s*([A-Z0-9_-]+)/i)?.[1]||null;
    const name=chunk.replace(/SKU:\s*[A-Z0-9_-]+/gi," ").replace(/₡\s*[\d.,]+/g," ").replace(/Disponible|No disponible|Agregar al carrito/gi," ").replace(/-\s*\d+%/g," ").replace(/\s+/g," ").trim();
    if(name.length<3)continue;
    const current=prices.at(-1), previous=prices.length>1?prices.at(-2):null;
    out.push({competitor_id:competitor.id,external_id:stableId(name,presentation(name),sku),name,brand:null,presentation:presentation(name),product_url:competitor.url,current_price:current,previous_price:previous,available:!/no disponible|agotado/i.test(chunk),promotion:Boolean(previous&&current&&current<previous),discount_percent:previous&&current&&current<previous?Math.round((previous-current)/previous*100):null});
  }
  const map=new Map(); for(const r of out)map.set(r.external_id,r); return [...map.values()];
}

async function catalog(competitor) {
  if(competitor.name === "Mini Súper Zeus") {
    const all=[]; for(let page=1;page<=23;page++){const url=page===1?competitor.url:`https://www.minisuperzeus.com/?pagina=${page}`; try{all.push(...parseCatalog(await getText(url),competitor));}catch{}}
    const map=new Map(); for(const r of all)map.set(r.external_id,r); return [...map.values()];
  }
  return parseCatalog(await getText(competitor.url), competitor);
}

function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
async function email(subject, html){ if(!RESEND_API_KEY||!REPORT_EMAIL)return; const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:FROM_EMAIL,to:[REPORT_EMAIL],subject,html})}); if(!r.ok)throw new Error(`Resend ${r.status}: ${await r.text()}`); }

const started=new Date().toISOString();
const run=(await sb("monitor_runs",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({started_at:started,status:"running"})}))[0];
const competitors=await sb("competitors?select=id,name,channel,url&order=id");
let sourcesChecked=0, productsFound=0, promotions=0, priceChanges=0, availabilityChanges=0, errors=0;
const changes=[], failures=[];

for(const competitor of competitors){
  sourcesChecked++;
  try {
    const products=await catalog(competitor); productsFound+=products.length;
    for(const p of products){
      const existing=(await sb(`competitor_products?competitor_id=eq.${p.competitor_id}&external_id=eq.${encodeURIComponent(p.external_id)}&select=id,current_price,available,previous_price&limit=1`))[0];
      const oldPrice=existing?.current_price==null?null:Number(existing.current_price);
      const oldAvailable=existing?.available;
      if(p.promotion)promotions++;
      if(oldPrice!==null&&oldPrice!==p.current_price){priceChanges++; changes.push({type:"Precio",store:competitor.name,name:p.name,old:oldPrice,current:p.current_price});}
      if(oldAvailable!==undefined&&oldAvailable!==p.available){availabilityChanges++; changes.push({type:"Disponibilidad",store:competitor.name,name:p.name,old:oldAvailable,current:p.available});}
      const payload={...p,last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      if(existing) await sb(`competitor_products?id=eq.${existing.id}`,{method:"PATCH",body:JSON.stringify(payload)});
      else await sb("competitor_products",{method:"POST",body:JSON.stringify(payload)});
      const id=existing?.id || (await sb(`competitor_products?competitor_id=eq.${p.competitor_id}&external_id=eq.${encodeURIComponent(p.external_id)}&select=id&limit=1`))[0]?.id;
      if(id) await sb("competitor_price_history",{method:"POST",body:JSON.stringify({competitor_product_id:id,price:p.current_price,previous_price:oldPrice,available:p.available,promotion:p.promotion,discount_percent:p.discount_percent})});
    }
  } catch(e){ errors++; failures.push({competitor:competitor.name,error:e.message||"Error"}); await sb("monitor_errors",{method:"POST",body:JSON.stringify({monitor_run_id:run.id,competitor_id:competitor.id,error_type:"source",error_message:e.message||"Error"})}); }
}

const finished=new Date().toISOString();
await sb(`monitor_runs?id=eq.${run.id}`,{method:"PATCH",body:JSON.stringify({finished_at:finished,status:errors===competitors.length?"failed":"completed",sources_checked:sourcesChecked,products_found:productsFound,promotions_found:promotions,price_changes_found:priceChanges,availability_changes_found:availabilityChanges,error_count:errors})});

const rows=changes.slice(0,80).map(c=>`<tr><td>${esc(c.type)}</td><td>${esc(c.store)}</td><td>${esc(c.name)}</td><td>${c.old??"—"}</td><td>${c.current??"—"}</td></tr>`).join("");
const fails=failures.map(f=>`<li><b>${esc(f.competitor)}</b>: ${esc(f.error)}</li>`).join("");
const html=`<h2>La 14 Lounge · Monitor de competencia</h2><p>Fuentes: ${sourcesChecked} · Productos: ${productsFound} · Promociones: ${promotions} · Cambios de precio: ${priceChanges} · Cambios de disponibilidad: ${availabilityChanges} · Errores: ${errors}</p>${rows?`<h3>Cambios detectados</h3><table border="1" cellpadding="6" cellspacing="0"><tr><th>Tipo</th><th>Fuente</th><th>Producto</th><th>Anterior</th><th>Actual</th></tr>${rows}</table>`:"<p>No se detectaron cambios de precio o disponibilidad.</p>"}${fails?`<h3>Fuentes con incidencia</h3><ul>${fails}</ul>`:""}`;
await email(`La 14 · Monitor semanal · ${new Date().toLocaleDateString("es-CR")}`,html);

console.log(JSON.stringify({sourcesChecked,productsFound,promotions,priceChanges,availabilityChanges,errors},null,2));
