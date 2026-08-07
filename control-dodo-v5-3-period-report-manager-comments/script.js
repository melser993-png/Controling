const API_URL="/api/admin";
let checks=[], monthRows=[], selectedPizza="", selectedErrorPayload=null;

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
function ymNow(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
function monthRu(ym){const [y,m]=String(ym).split("-");return new Date(Number(y),Number(m)-1,1).toLocaleString("ru-RU",{month:"long",year:"numeric"});}
function toIso(v){const s=String(v||"").trim();let m=s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);if(m)return`${m[3]}-${m[2]}-${m[1]}`;m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:s;}
function fmt(v){const iso=toIso(v);const m=iso.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}.${m[2]}.${m[1]}`:String(v||"");}
function splitErrors(t){return String(t||"").split(";").map(x=>x.trim()).filter(Boolean);}
function weightOf(t){const m=String(t||"").match(/\(-?(\d+)\)/);return m?Number(m[1]):0;}
function levelOf(t){const w=weightOf(t);return w>=100?"D3":w>=50?"D2":"D1";}
function scoreCls(s){s=Number(s||0);return s<85?"bad":s<90?"warn":"";}
async function api(action,payload={}){const res=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});return res.json();}

function groupedByPizza(rows=monthRows){
  const map={};
  rows.forEach(r=>{
    if(!r.pizzeria)return;
    map[r.pizzeria]??={pizzeria:r.pizzeria,checks:0,scoreSum:0,errors:0,d2:0,d3:0,rows:[]};
    const g=map[r.pizzeria];g.checks++;g.scoreSum+=Number(r.score||0);g.rows.push(r);
    splitErrors(r.errors).forEach(e=>{g.errors++; if(levelOf(e)==="D2")g.d2++; if(levelOf(e)==="D3")g.d3++;});
  });
  Object.values(map).forEach(g=>g.avg=g.checks?Math.round((g.scoreSum/g.checks)*10)/10:0);
  return map;
}
function setPeriodLabels(){const label=monthRu($("periodInput").value);["periodLabel1","periodLabel2","periodLabel3","periodLabel4","periodLabel5"].forEach(id=>$(id).textContent=label);}
function renderRanks(){
  const groups=Object.values(groupedByPizza()).sort((a,b)=>b.avg-a.avg);
  const best=groups.slice(0,3); const attention=[...groups].sort((a,b)=>a.avg-b.avg).slice(0,3);
  $("topBest").innerHTML=best.map((g,i)=>rankRow(g,i,false)).join("")||"Нет данных";
  $("topAttention").innerHTML=attention.map((g,i)=>rankRow(g,i,true)).join("")||"Нет данных";
}
function rankRow(g,i,bad){
  const medal=bad?`<div class="medal place-red">${i+1}</div>`:`<div class="medal">${["🥇","🥈","🥉"][i]||i+1}</div>`;
  return `<div class="rank-row">${medal}<div><div class="rank-name">${esc(g.pizzeria)}</div><div class="rank-sub">Проверок: ${g.checks}${bad?` · D3 ${g.d3} · D2 ${g.d2}`:""}</div></div><div class="score-badge ${scoreCls(g.avg)}">${g.avg}</div></div>`;
}
function renderNetworkMetrics(){
  let d2=0,d3=0,total=0,critical=0;
  const risk=Object.values(groupedByPizza()).filter(g=>g.avg<85);
  monthRows.forEach(r=>splitErrors(r.errors).forEach(e=>{total++; if(levelOf(e)==="D2")d2++; if(levelOf(e)==="D3")d3++; if(weightOf(e)>=50)critical++;}));
  $("networkD2").textContent=d2;$("networkD3").textContent=d3;$("networkAllErrors").textContent=total;$("networkRisk").textContent=risk.length;
  $("networkD2b").textContent=d2;$("networkD3b").textContent=d3;$("networkCritical").textContent=critical;$("networkRiskB").textContent=risk.length;
}
function renderPizzaSelect(){
  const groups=Object.values(groupedByPizza()).sort((a,b)=>a.pizzeria.localeCompare(b.pizzeria));
  const current=$("pizzaSelect").value||selectedPizza||groups[0]?.pizzeria||"";
  $("pizzaSelect").innerHTML=groups.map(g=>`<option ${g.pizzeria===current?"selected":""}>${esc(g.pizzeria)}</option>`).join("");
  selectedPizza=$("pizzaSelect").value||current;
}
function renderPizzaMetrics(){
  const g=groupedByPizza()[selectedPizza]||{avg:0,checks:0,errors:0,d2:0,d3:0,rows:[]};
  $("selectedPizzaTitle").textContent=selectedPizza||"—";$("chartPizzaTitle").textContent=selectedPizza||"—";$("errorsPizzaTitle").textContent=selectedPizza||"—";
  $("pizzaD2").textContent=g.d2||0;$("pizzaD3").textContent=g.d3||0;$("pizzaAllErrors").textContent=g.errors||0;
  $("pizzaAvg").textContent=g.avg||0;$("pizzaChecks").textContent=g.checks||0;
  $("chartAvg").textContent=g.avg||0;
  const scores=g.rows.map(r=>Number(r.score||0));$("chartBest").textContent=scores.length?Math.max(...scores):0;$("chartWorst").textContent=scores.length?Math.min(...scores):0;$("chartErrors").textContent=g.errors||0;
  renderChart(g.rows||[]);
  renderPizzaErrors(g.rows||[]);
}
function renderChart(rows){
  const sorted=[...rows].sort((a,b)=>String(toIso(a.date)).localeCompare(toIso(b.date)));
  $("barChart").innerHTML=sorted.map(r=>{
    const h=Math.max(6,Math.min(100,Number(r.score||0)))*2;
    const cls=Number(r.score)<85?"red":Number(r.score)<90?"yellow":"green";
    return `<div class="bar-wrap"><div class="bar ${cls}" style="height:${h}px">${esc(r.score)}</div><div class="bar-date">${fmt(r.date).slice(0,5)}</div></div>`;
  }).join("")||"<div class='muted'>Нет данных</div>";
}
function renderPizzaErrors(rows){
  const out=[];

  rows.forEach(r=>{
    const details=Array.isArray(r.errorDetails)?r.errorDetails:[];

    if(details.length){
      details.forEach(item=>out.push({
        errorId:item.errorId||"",
        date:r.date,
        inspector:r.inspector,
        error:item.errorText||item.error||"",
        inspectorComment:item.comment||"",
        managerComment:item.managerComment||"",
        weight:Number(item.weight||0),
        level:item.level||levelOf(item.errorText||item.error||""),
        row:r
      }));
    }else{
      splitErrors(r.errors).forEach(e=>out.push({
        errorId:"",
        date:r.date,
        inspector:r.inspector,
        error:e,
        inspectorComment:r.errorComment||"",
        managerComment:"",
        weight:weightOf(e),
        level:levelOf(e),
        row:r
      }));
    }
  });

  $("pizzaErrorsTable").innerHTML=out.map(x=>`
    <tr>
      <td>${fmt(x.date)}</td>
      <td>${esc(x.inspector||"—")}</td>
      <td>${esc(x.error)}</td>
      <td class="error-comment-cell">${x.inspectorComment?`<strong>${esc(x.inspectorComment)}</strong>`:"—"}</td>
      <td class="manager-comment-cell">
        ${x.errorId
          ? `<textarea class="manager-comment-input" data-error-id="${esc(x.errorId)}" rows="2" placeholder="Комментарий управляющего">${esc(x.managerComment||"")}</textarea>
             <button class="manager-comment-save" data-error-id="${esc(x.errorId)}" type="button">Сохранить</button>`
          : "—"}
      </td>
      <td>-${x.weight||"—"}</td>
      <td><span class="level ${x.level==="D3"?"d3":""}">${x.level}</span></td>
      <td><button class="appeal-btn" data-payload="${encodeURIComponent(JSON.stringify({
        errorId:x.errorId,
        displayDate:fmt(x.date),
        date:x.date,
        pizzeria:selectedPizza,
        score:x.row.score,
        errors:x.error,
        inspector:x.inspector||""
      }))}">Апелляция</button></td>
    </tr>
  `).join("")||"<tr><td colspan='8'>Нет ошибок</td></tr>";
}

async function saveManagerComment(errorId,button){
  const input=document.querySelector(`.manager-comment-input[data-error-id="${CSS.escape(errorId)}"]`);
  if(!input)return;

  const original=button.textContent;
  button.disabled=true;
  button.textContent="Сохраняем…";

  try{
    const result=await api("saveManagerErrorComment",{
      errorId:errorId,
      managerComment:input.value.trim()
    });

    if(!result.ok)throw new Error(result.message||"Ошибка сохранения");

    button.textContent="Сохранено ✓";
    setTimeout(()=>button.textContent=original,1200);
  }catch(e){
    button.textContent="Ошибка";
    alert(e.message);
    setTimeout(()=>button.textContent=original,1500);
  }finally{
    button.disabled=false;
  }
}

function renderControlTable(){
  const rows=[...monthRows].sort((a,b)=>String(toIso(b.date)).localeCompare(toIso(a.date)));
  $("controlTable").innerHTML=rows.map(r=>{
    let d2=0,d3=0;splitErrors(r.errors).forEach(e=>{if(levelOf(e)==="D2")d2++;if(levelOf(e)==="D3")d3++;});
    return `<tr><td>${fmt(r.date)}</td><td><b>${esc(r.pizzeria)}</b></td><td><span class="score-cell ${scoreCls(r.score)}">${esc(r.score)}</span></td><td>${esc(r.errors||"—")}</td><td style="color:var(--yellow)">${d2}</td><td style="color:var(--red)">${d3}</td><td>${esc(r.inspector||"—")}</td></tr>`;
  }).join("")||"<tr><td colspan='7'>Нет данных</td></tr>";
}
function showList(title,items){
  $("dialogTitle").textContent=title;
  $("dialogContent").innerHTML=`<div class="dialog-list">${items.length?items.map(i=>`<div class="dialog-item">${i}</div>`).join(""):"Нет данных"}</div>`;
  $("listDialog").showModal();
}
function openRiskList(){
  const items=Object.values(groupedByPizza()).filter(g=>g.avg<85).map(g=>`<b>${esc(g.pizzeria)}</b> — ${g.avg} баллов`);
  showList("Пиццерии в зоне риска",items);
}
function openLevelList(level,onlyPizza=false){
  const map={}; const rows=onlyPizza?monthRows.filter(r=>r.pizzeria===selectedPizza):monthRows;
  rows.forEach(r=>splitErrors(r.errors).forEach(e=>{if(levelOf(e)===level){map[r.pizzeria]??=0;map[r.pizzeria]++;}}));
  const items=Object.keys(map).sort().map(p=>`<b>${esc(p)}</b> — ${map[p]}`);
  showList(`${level}${onlyPizza?": "+selectedPizza:" по сети"}`,items);
}
function downloadSelectedErrors(){
  const g=groupedByPizza()[selectedPizza]||{rows:[]}; const rows=[["Дата","Проверяющий","Ошибка","Вес","Уровень"]];
  g.rows.forEach(r=>splitErrors(r.errors).forEach(e=>rows.push([fmt(r.date),r.inspector||"",e,"-"+weightOf(e),levelOf(e)])));
  const csv="\ufeff"+rows.map(r=>r.map(c=>`"${String(c).replaceAll('"','""')}"`).join(";")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=`Ошибки_${selectedPizza}_${$("periodInput").value}.csv`;a.click();
}

function normForAppealMatch(v){
  return String(v||"")
    .toLowerCase()
    .replace(/ё/g,"е")
    .replace(/\s+/g," ")
    .replace(/[—–]/g,"-")
    .replace(/[()]/g,"")
    .trim();
}
function isoForAppealMatch(v){
  const s=String(v||"").trim();
  let m=s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if(m)return `${m[3]}-${m[2]}-${m[1]}`;
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m)return `${m[1]}-${m[2]}-${m[3]}`;
  return s;
}
function isApprovedAppeal(a){
  return String(a?.status||"").toLowerCase().includes("удовлетворена");
}
function removeApprovedAppealedErrorsFromChecks(rows, appeals){
  const approved=(appeals||[]).filter(isApprovedAppeal);
  if(!approved.length)return rows;

  return rows.map(r=>{
    const errors=splitErrors(r.errors);
    if(!errors.length)return r;

    const activeErrors=errors.filter(err=>{
      const errNorm=normForAppealMatch(err);
      const rowDate=isoForAppealMatch(r.date);
      const rowPizza=normForAppealMatch(r.pizzeria);

      const matched=approved.some(a=>{
        const apPizza=normForAppealMatch(a.pizzeria);
        const apDate=isoForAppealMatch(a.checkDate||a.date||a.displayDate||a.createdAt);
        const apErr=normForAppealMatch(a.error||a.errors);

        if(apPizza && apPizza!==rowPizza)return false;
        if(apDate && rowDate && apDate!==rowDate)return false;

        return apErr && (apErr.includes(errNorm) || errNorm.includes(apErr));
      });

      return !matched;
    });

    const removed=errors.length-activeErrors.length;
    if(!removed)return r;

    let score=Number(r.score||0);
    // Если сервер уже пересчитал балл — не трогаем его.
    // Если нет — стараемся восстановить по весу удалённой ошибки.
    if(score<100){
      const removedPenalty=errors
        .filter(e=>!activeErrors.includes(e))
        .reduce((sum,e)=>sum+Math.abs(weightOf(e)||0),0);
      score=Math.min(100,score+removedPenalty);
    }

    return {...r, errors:activeErrors.join("; "), errorsCount:activeErrors.length, score};
  });
}
async function load(){
  setPeriodLabels();

  const [checksRes, appealsRes]=await Promise.all([
    api("listChecks"),
    api("listAppeals").catch(()=>({ok:false,appeals:[]}))
  ]);

  if(!checksRes.ok){
    $("demoNotice").classList.remove("hidden");
    checks=[];
  }else{
    checks=checksRes.checks||[];
    $("demoNotice").classList.add("hidden");
  }

  checks=removeApprovedAppealedErrorsFromChecks(checks, appealsRes.appeals||[]);

  const ym=$("periodInput").value;
  monthRows=checks.filter(r=>String(toIso(r.date)).startsWith(ym));

  renderPizzaSelect();
  renderRanks();
  renderNetworkMetrics();
  renderPizzaMetrics();
  renderControlTable();
}

function openAppeal(payload){
  selectedErrorPayload=payload;$("appealMeta").textContent=`${payload.pizzeria} · ${payload.displayDate} · балл ${payload.score}`;$("appealErrorText").textContent=payload.errors||"—";$("appealEmail").value="";$("appealComment").value="";$("appealFiles").value="";$("appealStatus").textContent="";$("appealDialog").showModal();
}
function compressImageFile(file){return new Promise(resolve=>{if(!file.type?.startsWith("image/"))return resolve(file);const img=new Image(),reader=new FileReader();reader.onload=()=>{img.onload=()=>{let{width,height}=img;const max=1600;if(width>max||height>max){const r=Math.min(max/width,max/height);width=Math.round(width*r);height=Math.round(height*r)}const c=document.createElement("canvas");c.width=width;c.height=height;c.getContext("2d").drawImage(img,0,0,width,height);c.toBlob(b=>resolve(b?new File([b],file.name.replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"}):file),"image/jpeg",.72)};img.onerror=()=>resolve(file);img.src=reader.result};reader.onerror=()=>resolve(file);reader.readAsDataURL(file)})}
function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const s=String(r.result||"");resolve({name:file.name,type:file.type,size:file.size,base64:s.includes(",")?s.split(",")[1]:s})};r.onerror=reject;r.readAsDataURL(file)})}
function normalizeEmailValue(value){
  return String(value || "")
    .trim()
    .replace(/\u00A0/g, "")
    .replace(/\s+/g, "")
    .replace(/[а-яА-ЯёЁ]/g, "");
}

function isValidEmailForAppeal(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

async function submitAppeal(e){
  e.preventDefault();

  const status=$("appealStatus");
  const email=normalizeEmailValue($("appealEmail").value);

  $("appealEmail").value=email;

  if(!isValidEmailForAppeal(email)){
    status.textContent="Укажите корректный email";
    return;
  }

  try{
    status.textContent="Отправляем…";

    let files=Array.from($("appealFiles").files||[]);
    files=await Promise.all(files.map(compressImageFile));

    const attachments=await Promise.all(files.map(fileToBase64));

    const res=await fetch("/api/appeal",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        ...selectedErrorPayload,
        replyEmail:email,
        email:email,
        comment:$("appealComment").value.trim(),
        period:$("periodInput").value,
        attachments
      })
    });

    const data=await res.json();

    if(!data.ok)throw new Error(data.message||"Ошибка");

    status.textContent="Апелляция отправлена";
    setTimeout(()=>$("appealDialog").close(),900);
  }catch(err){
    status.textContent=err.message;
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  $("periodInput").value=ymNow();$("refreshBtn").onclick=load;$("periodInput").onchange=load;$("pizzaSelect").onchange=()=>{selectedPizza=$("pizzaSelect").value;renderPizzaMetrics()};
  $("dialogCloseBtn").onclick=()=>$("listDialog").close();$("openRiskNetwork").onclick=openRiskList;$("openRiskNetwork2").onclick=openRiskList;$("openD2Network").onclick=()=>openLevelList("D2");$("openD2Network2").onclick=()=>openLevelList("D2");$("openD3Network").onclick=()=>openLevelList("D3");$("openD3Network2").onclick=()=>openLevelList("D3");$("openD2Pizza").onclick=()=>openLevelList("D2",true);$("openD3Pizza").onclick=()=>openLevelList("D3",true);$("downloadErrorsBtn").onclick=downloadSelectedErrors;
  document.addEventListener("click",e=>{
    const appealBtn=e.target.closest(".appeal-btn");
    if(appealBtn)openAppeal(JSON.parse(decodeURIComponent(appealBtn.dataset.payload)));

    const commentBtn=e.target.closest(".manager-comment-save");
    if(commentBtn)saveManagerComment(commentBtn.dataset.errorId,commentBtn);
  });
  $("appealCloseBtn").onclick=()=>$("appealDialog").close();$("appealCancelBtn").onclick=()=>$("appealDialog").close();$("appealForm").onsubmit=submitAppeal;load();
});
