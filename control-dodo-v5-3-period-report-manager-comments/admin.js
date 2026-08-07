const API="/api/admin";
const PIZZAS=["Артём","Нерюнгри","Нарьян-Мар","Москва 14-1","14-2","14-3","14-5","Внуково-1","Дзержинский-1","Клин-1","Клин-2","Солнечногорск-1","Черноголовка-1","Звенигород-1","Балабаново-1","Рублёво-1"];
const ZONES=["Общая проверка","Склад","Зал","Горячий цех","Холодный цех","Касса","Кухня","Доставка"];
let user=null, errorsDict=[], checks=[], appeals=[], reportRows=[], reportErrorRows=[], reportPeriod={dateFrom:'',dateTo:''};
const $=id=>document.getElementById(id);const esc=v=>String(v??"").replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));const ym=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`};
async function api(action,payload={}){const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});return r.json()}
function msg(t){$("msg").textContent=t||""}
async function login(){
  user=JSON.parse(sessionStorage.getItem("dodoUser")||"null");
  if(user)return showApp();

  $("loginForm").onsubmit=async e=>{
    e.preventDefault();
    const name=$("loginUser").value;
    const password=$("loginPassword").value;

    $("loginError").textContent="Проверяем доступ...";

    const result=await api("login",{name,password});

    if(!result.ok){
      $("loginError").textContent=result.message||"Ошибка входа";
      return;
    }

    user=result.user;
    sessionStorage.setItem("dodoUser",JSON.stringify(user));
    $("loginError").textContent="";
    showApp();
  };
}

function showApp(){$("loginScreen").classList.add("hidden");$("app").classList.remove("hidden");$("currentUserName").textContent=user.name;$("inspectorInput").value=user.name;loadHome()}
function setTab(t){document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.tab===t));document.querySelectorAll(".tab").forEach(s=>s.classList.toggle("active",s.id==="tab-"+t));if(t==="home")loadHome();if(t==="new")initNew();if(t==="checks")loadChecks();if(t==="appeals")loadAppeals();if(t==="reports")loadReport();if(t==="users")loadUsers()}
async function loadHome(){const d=await api("dashboard");if(!d.ok)return msg(d.message||"Ошибка");const x=d.dashboard;$("hChecks").textContent=x.checksCount;$("hAppeals").textContent=x.appealsCount;$("hNew").textContent=x.newAppeals;$("hWork").textContent=x.inWorkAppeals;$("hClosed").textContent=x.closedAppeals;$("hTop").innerHTML=(x.top3||[]).map(r=>`<p><b>${esc(r.pizzeria)}</b> — ${r.avgScore} баллов</p>`).join("")||"Нет данных";$("hRisk").textContent=(x.risk||[]).length;$("riskList").innerHTML=(x.risk||[]).map(r=>`<p>${esc(r.pizzeria)} — ${r.avgScore}</p>`).join("")}
async function loadErrors(){const d=await api("listErrors");errorsDict=d.ok?d.errors||[]:[]}
function options(){return `<option value="">Выберите нарушение</option>`+errorsDict.map(e=>`<option value="${esc(e.name)}" data-weight="${esc(e.weight)}">${esc(e.name)}${e.weight?` (-${e.weight})`:""}</option>`).join("")}
async function initNew(){if(!errorsDict.length)await loadErrors();$("pizzeriaSelect").innerHTML=PIZZAS.map(p=>`<option>${p}</option>`).join("");$("zoneSelect").innerHTML=ZONES.map(z=>`<option>${z}</option>`).join("");$("inspectorInput").value=user.name;document.querySelector('[name="date"]').value="";document.querySelector('[name="time"]').value="";if(!$("errorRows").children.length)addError()}
function addError(){
  const div=document.createElement("div");
  div.className="error-row";

  div.innerHTML=`
    <label>Нарушение
      <select class="err-name" required>${options()}</select>
    </label>

    <label>Зона нарушения
      <select class="err-zone" required>${ZONES.map(z=>`<option>${z}</option>`).join("")}</select>
    </label>

    <label>Время нарушения
      <input class="err-time" type="time" step="1" required>
    </label>

    <label>Баллов снимется
      <input class="err-weight-view" value="—" readonly>
    </label>

    <label>Комментарий по нарушению
      <input class="err-comment" placeholder="Комментарий по конкретному нарушению">
    </label>

    <button type="button" class="remove">×</button>
  `;

  $("errorRows").appendChild(div);

  const select = div.querySelector(".err-name");
  const weightView = div.querySelector(".err-weight-view");

  function updateWeight(){
    const weight = select.selectedOptions[0]?.dataset.weight || "";
    weightView.value = weight ? `-${weight}` : "—";
  }

  select.addEventListener("change", updateWeight);
  updateWeight();

  div.querySelector(".remove").onclick=()=>div.remove();
}

async function submitCheck(e){e.preventDefault();const p=Object.fromEntries(new FormData(e.target).entries());if(!p.date)return msg("Выберите дату проверки из календаря");if(!p.time)return msg("Укажите время проверки");p.inspector=user.name;const errors=[...document.querySelectorAll(".error-row")].map(r=>{const s=r.querySelector(".err-name");return{error:s.value,weight:s.selectedOptions[0]?.dataset.weight||"",zone:r.querySelector(".err-zone").value,time:r.querySelector(".err-time").value,comment:r.querySelector(".err-comment").value}}).filter(x=>x.error);if(errors.some(x=>!x.time))return msg("Укажите время нарушения для каждого нарушения");const res=await api("createCheck",{...p,errors});msg(res.ok?`Проверка отправлена. Балл: ${res.score}`:res.message);if(res.ok){$("errorRows").innerHTML="";addError()}}
async function loadChecks(){
  const d=await api("listChecks");
  checks=d.ok?d.checks||[]:[];
  $("checksTable").innerHTML=checks.map(r=>{
    const managerComments=(r.errorDetails||[])
      .filter(e=>e.managerComment)
      .map(e=>`${e.error}: ${e.managerComment}`)
      .join(" | ");

    return `<tr>
      <td>${esc(r.date)}</td>
      <td>${esc(r.pizzeria)}</td>
      <td>${esc(r.score)}</td>
      <td>${esc(r.errors||"—")}</td>
      <td>${esc(r.inspector||"—")}${managerComments?`<br><span class="manager-comment-admin"><b>Комментарий управляющего:</b> ${esc(managerComments)}</span>`:""}</td>
    </tr>`;
  }).join("");
}

async function saveAppeal(id){
  const appeal=appeals.find(a=>a.id===id);
  if(appeal && (appeal.status==="Удовлетворена" || appeal.status==="Не удовлетворена")){
    msg("Апелляция уже обработана. Изменение решения запрещено.");
    return;
  }

  const status=document.querySelector(`.ap-status[data-id="${CSS.escape(id)}"]`).value;
  const controlComment=document.querySelector(`.ap-comment[data-id="${CSS.escape(id)}"]`).value;

  if((status==="Удовлетворена" || status==="Не удовлетворена") && !controlComment.trim()){
    msg("Перед обработкой апелляции заполните комментарий контролинга");
    return;
  }

  const r=await api("updateAppeal",{id,status,controlComment,actorName:user.name,actorEmail:user.email});
  msg(r.message||"");
  if(r.ok)loadAppeals();
}

function defaultReportDates(){
  const now=new Date();
  const from=new Date(now.getFullYear(),now.getMonth(),1);
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  if(!$("reportDateFrom").value)$("reportDateFrom").value=iso(from);
  if(!$("reportDateTo").value)$("reportDateTo").value=iso(now);
}

async function loadReport(){
  defaultReportDates();

  const dateFrom=$("reportDateFrom").value;
  const dateTo=$("reportDateTo").value;

  const d=await api("periodReport",{dateFrom,dateTo});

  if(!d.ok){
    msg(d.message||"Ошибка загрузки отчёта");
    return;
  }

  reportPeriod={dateFrom:d.dateFrom,dateTo:d.dateTo};
  reportRows=d.summary||[];
  reportErrorRows=d.errors||[];

  $("reportTable").innerHTML=reportRows.map(r=>`
    <tr>
      <td>${esc(r.pizzeria)}</td>
      <td>${esc(r.avgScore)}</td>
      <td>${esc(r.checks)}</td>
      <td>${esc(r.activeErrors)}</td>
      <td>${esc(r.totalErrors)}</td>
      <td>${esc(r.d2)}</td>
      <td>${esc(r.d3)}</td>
      <td>${esc(r.approvedAppeals)}</td>
    </tr>
  `).join("")||"<tr><td colspan='8'>Нет данных</td></tr>";

  $("reportErrorsTable").innerHTML=reportErrorRows.map(e=>`
    <tr>
      <td>${esc(e.date)}</td>
      <td>${esc(e.pizzeria)}</td>
      <td>${esc(e.inspector)}</td>
      <td>${esc(e.zone)}</td>
      <td>${esc(e.time)}</td>
      <td>${esc(e.error)}</td>
      <td>-${esc(e.weight)}</td>
      <td>${esc(e.level)}</td>
      <td>${esc(e.inspectorComment||"—")}</td>
      <td class="manager-comment-admin">${esc(e.managerComment||"—")}</td>
      <td>${esc(e.status)}</td>
      <td>${esc(e.appealId||"—")}</td>
      <td>${esc(e.controlComment||"—")}</td>
    </tr>
  `).join("")||"<tr><td colspan='13'>Нет ошибок за выбранный период</td></tr>";
}

function xmlEscape(v){
  return String(v??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function excelCell(v,style=""){
  const n=Number(v);
  const isNumber=v!=="" && v!==null && v!==undefined && Number.isFinite(n) && !String(v).includes("-");
  const type=isNumber?"Number":"String";
  return `<Cell${style?` ss:StyleID="${style}"`:""}><Data ss:Type="${type}">${xmlEscape(v)}</Data></Cell>`;
}

function excelRow(values,style=""){
  return `<Row>${values.map(v=>excelCell(v,style)).join("")}</Row>`;
}

function exportReport(){
  if(!reportRows.length && !reportErrorRows.length){
    msg("Сначала сформируйте отчёт");
    return;
  }

  const summaryHeaders=["Пиццерия","Средний балл","Проверок","Активных ошибок","Всего зафиксировано","D2","D3","Удовлетворённых апелляций"];
  const errorHeaders=["Дата","Пиццерия","Проверяющий","Зона","Время","Нарушение","Вес","Уровень","Комментарий проверяющего","Комментарий управляющего","Статус","№ апелляции","Комментарий контролинга"];

  const summaryRows=reportRows.map(r=>[
    r.pizzeria,r.avgScore,r.checks,r.activeErrors,r.totalErrors,r.d2,r.d3,r.approvedAppeals
  ]);

  const errorRows=reportErrorRows.map(e=>[
    e.date,e.pizzeria,e.inspector,e.zone,e.time,e.error,-Math.abs(Number(e.weight||0)),e.level,
    e.inspectorComment||"",e.managerComment||"",e.status,e.appealId||"",e.controlComment||""
  ]);

  const workbook=`<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#FF6900" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Manager">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#FFF2E8" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Сводка">
  <Table>
   ${excelRow(["Период",`${reportPeriod.dateFrom} — ${reportPeriod.dateTo}`],"Header")}
   ${excelRow(summaryHeaders,"Header")}
   ${summaryRows.map(r=>excelRow(r)).join("")}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Ошибки">
  <Table>
   ${excelRow(errorHeaders,"Header")}
   ${errorRows.map(r=>`<Row>${r.map((v,i)=>excelCell(v,i===9?"Manager":"")).join("")}</Row>`).join("")}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob=new Blob(["\ufeff"+workbook],{type:"application/vnd.ms-excel;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`Отчёт_контролинга_${reportPeriod.dateFrom}_${reportPeriod.dateTo}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}


async function loadUsers(){
  const d=await api("listUsers");
  const users=d.ok?d.users||[]:[];
  $("usersTable").innerHTML=users.map(u=>`
    <tr>
      <td>${esc(u.name)}</td>
      <td>${esc(u.login)}</td>
      <td>${esc(u.email)}</td>
      <td>${esc(u.role)}</td>
      <td>${esc(u.active)}</td>
      <td><button class="orange edit-user" data-user="${encodeURIComponent(JSON.stringify(u))}" type="button">Изменить пароль</button></td>
    </tr>
  `).join("")||"<tr><td colspan='6'>Нет пользователей</td></tr>";
}

async function saveUser(){
  const payload={
    name:$("userNameInput").value.trim(),
    login:$("userLoginInput").value.trim(),
    password:$("userPasswordInput").value.trim(),
    email:$("userEmailInput").value.trim(),
    role:$("userRoleInput").value.trim()||"Контролинг",
    active:$("userActiveInput").value
  };

  const r=await api("saveUser",payload);
  msg(r.message||"");
  if(r.ok){
    $("userPasswordInput").value="";
    loadUsers();
  }
}

function fillUserForm(u){
  $("userNameInput").value=u.name||"";
  $("userLoginInput").value=u.login||"";
  $("userPasswordInput").value="";
  $("userEmailInput").value=u.email||"";
  $("userRoleInput").value=u.role||"Контролинг";
  $("userActiveInput").value=u.active||"Да";
  msg("Введите новый пароль и нажмите «Сохранить пользователя»");
}


function openNativeDatePicker(){
  const input=$("checkDateInput") || document.querySelector('[name="date"]');
  if(!input)return;
  if(typeof input.showPicker==="function"){
    input.showPicker();
  }else{
    input.focus();
    input.click();
  }
}

document.addEventListener("DOMContentLoaded",()=>{login();$("logoutBtn").onclick=()=>{sessionStorage.removeItem("dodoUser");location.reload()};document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));$("refreshBtn").onclick=()=>setTab(document.querySelector(".nav.active").dataset.tab);$("addErrorBtn").onclick=addError;
  $("openDatePickerBtn").onclick=openNativeDatePicker;
  $("checkDateInput").addEventListener("click",openNativeDatePicker);$("checkForm").onsubmit=submitCheck;$("appealFilter").onchange=renderAppeals;document.addEventListener("click",e=>{const b=e.target.closest(".save-ap");if(b)saveAppeal(b.dataset.id)});$("loadReportBtn").onclick=loadReport;$("exportReportBtn").onclick=exportReport;$("showRiskBtn").onclick=()=>$("riskList").classList.toggle("hidden");
  $("saveUserBtn").onclick=saveUser;
  document.addEventListener("click",e=>{
    const b=e.target.closest(".edit-user");
    if(b)fillUserForm(JSON.parse(decodeURIComponent(b.dataset.user)));
  });
});
