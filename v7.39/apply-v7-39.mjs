// Dodo Control v7.39 report export patch
// Run from project folder: node apply-v7-39.mjs
import fs from "fs";

const path = "admin.html";
let html = fs.readFileSync(path, "utf8");

const oldButton = '<button id="exportReportBtn" class="green" type="button" onclick="exportReportSafe()">↓ Скачать Excel</button>';
const newButtons = '<button id="exportReportBtn" class="green" type="button" onclick="exportReportSafe()">↓ Скачать Excel (.xlsx)</button>\n      <button id="exportReportPdfBtn" class="orange" type="button" onclick="exportReportPdfSafe()">↓ Скачать PDF</button>';

if (!html.includes(oldButton) && !html.includes('id="exportReportPdfBtn"')) {
  throw new Error("Не найдена кнопка экспорта Excel в admin.html");
}
if (html.includes(oldButton)) html = html.replace(oldButton, newButtons);

const marker = '<script src="admin.js"></script></body></html>';
if (!html.includes(marker) && !html.includes('DODO_V739_REPORT_EXPORT')) {
  throw new Error("Не найден финальный script admin.js в admin.html");
}

if (!html.includes('DODO_V739_REPORT_EXPORT')) {
const patch = String.raw`
<!-- DODO_V739_REPORT_EXPORT -->
<script src="https://cdn.jsdelivr.net/npm/pdfmake@0.2.12/build/pdfmake.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pdfmake@0.2.12/build/vfs_fonts.js"></script>
<script src="admin.js"></script>
<script>
(function(){
  function downloadBase64File(base64,mimeType,fileName){
    const binary=atob(base64||"");
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const blob=new Blob([bytes],{type:mimeType||"application/octet-stream"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=fileName||"report.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function reportPeriodValues(){
    return {
      dateFrom:(document.getElementById("reportDateFrom")?.value||"").trim(),
      dateTo:(document.getElementById("reportDateTo")?.value||"").trim()
    };
  }

  function tableMatrix(selector){
    const table=document.querySelector(selector);
    if(!table)return {headers:[],rows:[]};
    const headers=Array.from(table.querySelectorAll("thead th")).map(th=>th.textContent.trim());
    const rows=Array.from(table.querySelectorAll("tbody tr")).map(tr=>
      Array.from(tr.querySelectorAll("td")).map(td=>td.textContent.replace(/\\s+/g," ").trim())
    ).filter(row=>row.length);
    return {headers,rows};
  }

  window.exportReportSafe=async function(){
    const btn=document.getElementById("exportReportBtn");
    const original=btn?.textContent||"↓ Скачать Excel (.xlsx)";
    const {dateFrom,dateTo}=reportPeriodValues();
    if(!dateFrom||!dateTo){
      if(typeof msg==="function")msg("Выберите период отчёта");
      return;
    }
    try{
      if(btn){btn.disabled=true;btn.textContent="Формируем Excel…";}
      const res=await api("exportPeriodReportXlsx",{dateFrom,dateTo});
      if(!res?.ok)throw new Error(res?.message||"Не удалось сформировать Excel");
      if(!res.base64)throw new Error("Сервер не вернул файл Excel");
      downloadBase64File(
        res.base64,
        res.mimeType||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        res.fileName||("Отчет_контролинга_"+dateFrom+"_"+dateTo+".xlsx")
      );
      if(typeof msg==="function")msg("Excel .xlsx сформирован");
    }catch(err){
      if(typeof msg==="function")msg(err?.message||"Ошибка формирования Excel");
    }finally{
      if(btn){btn.disabled=false;btn.textContent=original;}
    }
  };

  window.exportReportPdfSafe=async function(){
    const btn=document.getElementById("exportReportPdfBtn");
    const original=btn?.textContent||"↓ Скачать PDF";
    const {dateFrom,dateTo}=reportPeriodValues();
    if(!dateFrom||!dateTo){
      if(typeof msg==="function")msg("Выберите период отчёта");
      return;
    }
    try{
      if(btn){btn.disabled=true;btn.textContent="Формируем PDF…";}
      if(!window.pdfMake)throw new Error("Модуль PDF не загрузился. Обновите страницу и повторите.");
      const summary=tableMatrix(".report-summary-table-v70");
      const errors=tableMatrix(".report-errors-table-v70");
      if(!summary.rows.length && !errors.rows.length){
        throw new Error("Сначала нажмите «Показать», чтобы загрузить отчёт");
      }

      const content=[
        {text:"Отчёт контролинга",style:"title"},
        {text:"Период: "+dateFrom+" — "+dateTo,style:"period"},
        {text:"Сводка по пиццериям",style:"section"}
      ];

      if(summary.headers.length){
        content.push({
          table:{
            headerRows:1,
            widths:Array(summary.headers.length).fill("*"),
            body:[
              summary.headers.map(v=>({text:v,style:"tableHeader"})),
              ...summary.rows.map(r=>summary.headers.map((_,i)=>({text:r[i]||"",style:"tableCell"})))
            ]
          },
          layout:{
            fillColor:(rowIndex)=>rowIndex===0?"#ff7a00":(rowIndex%2===0?"#f7f7f7":null),
            hLineColor:"#d6d6d6",
            vLineColor:"#d6d6d6"
          },
          margin:[0,0,0,16]
        });
      }

      content.push({text:"Ошибки за период",style:"section"});

      if(errors.headers.length){
        const errorWidths=errors.headers.map((_,i)=>{
          if(i===5)return 70;
          if(i===8||i===9||i===12)return 72;
          if(i===0||i===4||i===6||i===7)return 34;
          return 48;
        });
        content.push({
          table:{
            headerRows:1,
            dontBreakRows:true,
            widths:errorWidths,
            body:[
              errors.headers.map(v=>({text:v,style:"errorHeader"})),
              ...errors.rows.map(r=>errors.headers.map((_,i)=>({text:r[i]||"",style:"errorCell"})))
            ]
          },
          layout:{
            fillColor:(rowIndex)=>rowIndex===0?"#ff7a00":(rowIndex%2===0?"#fafafa":null),
            hLineColor:"#d9d9d9",
            vLineColor:"#d9d9d9"
          }
        });
      }

      pdfMake.createPdf({
        pageSize:"A4",
        pageOrientation:"landscape",
        pageMargins:[22,24,22,24],
        info:{title:"Отчёт контролинга "+dateFrom+" — "+dateTo,subject:"Dodo Control"},
        content,
        styles:{
          title:{fontSize:18,bold:true,color:"#161616",margin:[0,0,0,4]},
          period:{fontSize:9,color:"#555555",margin:[0,0,0,14]},
          section:{fontSize:12,bold:true,color:"#ff6a00",margin:[0,5,0,7]},
          tableHeader:{fontSize:7,bold:true,color:"#ffffff"},
          tableCell:{fontSize:7,color:"#222222"},
          errorHeader:{fontSize:5.5,bold:true,color:"#ffffff"},
          errorCell:{fontSize:5.2,color:"#222222"}
        },
        defaultStyle:{font:"Roboto"}
      }).download("Отчет_контролинга_"+dateFrom+"_"+dateTo+".pdf");

      if(typeof msg==="function")msg("PDF сформирован");
    }catch(err){
      if(typeof msg==="function")msg(err?.message||"Ошибка формирования PDF");
    }finally{
      if(btn){btn.disabled=false;btn.textContent=original;}
    }
  };
})();
</script>`;

html = html.replace(marker, patch + "</body></html>");
}

fs.writeFileSync(path, html, "utf8");
console.log("v7.39 applied: Excel .xlsx + PDF export");
