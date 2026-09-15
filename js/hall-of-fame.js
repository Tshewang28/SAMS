(function(){
"use strict";

const RECORDS_KEY = "sams_assessment_records";
const CLASSES_KEY = "sams_classes";
const AREAS = ["SUPW","Assembly","Classroom","Discipline"];
const WEEKS = [1,2,3];

function read(key,fallback){
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
  catch(e){ return fallback; }
}
function records(){ const v=read(RECORDS_KEY,[]); return Array.isArray(v)?v:[]; }
function classes(){ const v=read(CLASSES_KEY,[]); return Array.isArray(v)?v:[]; }
function escapeHTML(v){ return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function classKey(grade,section){ return `${String(grade||"").trim()}|${String(section||"").trim()}`; }
function label(grade,section){ return `${grade||""}${section?` ${section}`:""}`.trim(); }
function dateOf(record){ const d=new Date(record?.savedAt); return Number.isNaN(d.getTime())?null:d; }
function monthKey(year,month){ return `${year}-${String(month+1).padStart(2,"0")}`; }
function monthLabel(year,month){ return new Date(year,month,1).toLocaleDateString(undefined,{month:"long",year:"numeric"}); }

function pointsForRecord(record){
  if(!record) return 0;
  // Discipline is always a class deduction. Other explicitly excluded records
  // remain excluded, matching the existing SAMS scoring behaviour.
  if(record.area!=="Discipline" && record.affectsClassTotal===false) return 0;
  return (Array.isArray(record.records)?record.records:[]).reduce((sum,item)=>{
    const p=Number(item?.point);
    return Number.isFinite(p)?sum+p:sum;
  },0);
}

function weekOfMonth(date){
  if(!date) return null;
  // Week 1 = days 1–7, Week 2 = 8–14, Week 3 = 15–21.
  return Math.floor((date.getDate()-1)/7)+1;
}
function selectedPeriod(){
  const select=document.getElementById("monthPicker");
  const value=select?.value;
  if(value){ const [y,m]=value.split("-").map(Number); return {year:y,month:m-1}; }
  const now=new Date(); return {year:now.getFullYear(),month:now.getMonth()};
}
function periodRecords(period){
  return records().filter(r=>{
    const d=dateOf(r); if(!d) return false;
    return d.getFullYear()===period.year && d.getMonth()===period.month;
  });
}

function buildRows(period){
  const map={};
  const ensure=(grade,section)=>{
    const key=classKey(grade,section);
    if(!grade) return null;
    if(!map[key]) map[key]={grade,section,label:label(grade,section),areas:{}};
    AREAS.forEach(a=>{ if(!map[key].areas[a]) map[key].areas[a]={1:0,2:0,3:0,total:0}; });
    return map[key];
  };

  classes().forEach(c=>{
    const grade=String(c.grade??c.className??c.class??c.Grade??"").trim();
    const section=String(c.section??c.stream??c["Section/Stream"]??c.Section??c.Stream??"").trim();
    ensure(grade,section);
  });

  periodRecords(period).forEach(r=>{
    const grade=String(r.class??r.grade??r.Class??"").trim();
    const section=String(r.section??r.stream??r["Section/Stream"]??"").trim();
    const row=ensure(grade,section); if(!row) return;
    const area=String(r.area??"").trim();
    if(!AREAS.includes(area)) return;
    const week=weekOfMonth(dateOf(r));
    if(!WEEKS.includes(week)) return;
    const points=pointsForRecord(r);
    row.areas[area][week]+=points;
    row.areas[area].total+=points;
  });

  return Object.values(map).map(row=>{
    const net=AREAS.reduce((sum,a)=>sum+row.areas[a].total,0);
    return {...row,net};
  }).sort((a,b)=>b.net-a.net || a.label.localeCompare(b.label));
}

function formatPoints(value){
  const n=Number(value)||0;
  return n>0?`+${n}`:String(n);
}
function cell(value,area,total){
  const cls=[area.toLowerCase().replace(/\s+/g,"-"), total?"total-col":""].filter(Boolean).join(" ");
  return `<td class="${cls} ${area==='Discipline'?'negative-cell':''}">${formatPoints(value)}</td>`;
}

function renderDetail(rows){
  const body=document.getElementById("detailBody");
  if(!body) return;
  if(!rows.length){
    body.innerHTML='<tr><td colspan="19" class="empty-row">No classes or assessment results are available for this month.</td></tr>';
    return;
  }
  body.innerHTML=rows.map((row,index)=>{
    const medal=index===0?'🥇':index===1?'🥈':index===2?'🥉':'';
    const rank=medal||String(index+1);
    return `<tr class="${index<3?'top-row':''}">
      <td class="sticky-class class-name"><strong>${escapeHTML(row.label)}</strong></td>
      ${cell(row.areas.SUPW[1],"SUPW",false)}${cell(row.areas.SUPW[2],"SUPW",false)}${cell(row.areas.SUPW[3],"SUPW",false)}${cell(row.areas.SUPW.total,"SUPW",true)}
      ${cell(row.areas.Assembly[1],"Assembly",false)}${cell(row.areas.Assembly[2],"Assembly",false)}${cell(row.areas.Assembly[3],"Assembly",false)}${cell(row.areas.Assembly.total,"Assembly",true)}
      ${cell(row.areas.Classroom[1],"Classroom",false)}${cell(row.areas.Classroom[2],"Classroom",false)}${cell(row.areas.Classroom[3],"Classroom",false)}${cell(row.areas.Classroom.total,"Classroom",true)}
      ${cell(row.areas.Discipline[1],"Discipline",false)}${cell(row.areas.Discipline[2],"Discipline",false)}${cell(row.areas.Discipline[3],"Discipline",false)}${cell(row.areas.Discipline.total,"Discipline",true)}
      <td class="net-cell">${formatPoints(row.net)}</td>
      <td class="rank-cell">${rank}</td>
    </tr>`;
  }).join("");
}

function remark(index){
  return index===0?"Grand Champion":index===1?"Excellent":index===2?"Very Good":index<=4?"Good":index<=6?"Keep Improving":"Needs More Effort";
}
function renderSummary(rows){
  const list=document.getElementById("summaryList");
  if(!list) return;
  if(!rows.length){ list.innerHTML='<div class="empty-summary">No ranking data for this month.</div>'; return; }
  list.innerHTML=rows.map((row,index)=>{
    const medal=index===0?'🥇':index===1?'🥈':index===2?'🥉':'';
    return `<div class="summary-row ${index<3?'summary-top':''}">
      <div class="summary-rank">${medal||index+1}</div>
      <div class="summary-class">${escapeHTML(row.label)}<small>${remark(index)}</small></div>
      <div class="summary-points">${formatPoints(row.net)} <span>pts</span></div>
    </div>`;
  }).join("");
}

function populateMonths(){
  const select=document.getElementById("monthPicker");
  if(!select || select.options.length) return;
  const set=new Set();
  records().forEach(r=>{ const d=dateOf(r); if(d) set.add(monthKey(d.getFullYear(),d.getMonth())); });
  const now=new Date(); set.add(monthKey(now.getFullYear(),now.getMonth()));
  const months=[...set].sort().reverse();
  select.innerHTML=months.map(k=>{const [y,m]=k.split("-").map(Number);return `<option value="${k}">${monthLabel(y,m-1)}</option>`;}).join("");
  const current=monthKey(now.getFullYear(),now.getMonth());
  if(set.has(current)) select.value=current;
  select.addEventListener("change",render);
}

function render(){
  populateMonths();
  const period=selectedPeriod();
  const name=monthLabel(period.year,period.month);
  const rows=buildRows(period);
  const title=document.getElementById("rankingTitle");
  const summaryTitle=document.getElementById("summaryTitle");
  const infoMonth=document.getElementById("infoMonth");
  if(title) title.textContent=`Class Points in Detail – ${name}`;
  if(summaryTitle) summaryTitle.textContent=name;
  if(infoMonth) infoMonth.textContent=name;
  renderDetail(rows);
  renderSummary(rows);
}

function init(){
  const refresh=document.getElementById("refreshBtn");
  if(refresh) refresh.addEventListener("click",render);
  populateMonths();
  render();
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
window.addEventListener("storage",render);
})();
