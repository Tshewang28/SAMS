(function(){
"use strict";

const RECORDS_KEY = "sams_assessment_records";
const CLASSES_KEY = "sams_classes";
const AREAS = ["SUPW","Assembly","Classroom","Discipline"];
const WEEKS = [1,2,3,4,5];
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

// A school ranking week runs Monday-Sunday.
// The result is declared on the following Monday.
// The declaration Monday determines BOTH the ranking month and week number.
// Example: Aug 31-Sep 6 -> declared Mon Sep 7 -> September Week 1.
function mondayOfWeek(date){
  if(!date) return null;
  const d=new Date(date);
  d.setHours(0,0,0,0);
  const day=d.getDay(); // Sun=0, Mon=1, ... Sat=6
  const diff=day===0 ? -6 : 1-day;
  d.setDate(d.getDate()+diff);
  return d;
}

function declarationMonday(date){
  const monday=mondayOfWeek(date);
  if(!monday) return null;
  monday.setDate(monday.getDate()+7);
  return monday;
}

function weekNumberForDeclaration(declarationDate){
  if(!declarationDate) return null;
  const first=new Date(declarationDate.getFullYear(),declarationDate.getMonth(),1);
  const day=first.getDay();
  const firstMonday=new Date(first);
  firstMonday.setDate(1 + (day===0 ? 1 : (8-day)%7));
  firstMonday.setHours(0,0,0,0);
  if(declarationDate < firstMonday) return null;
  return Math.floor((declarationDate-firstMonday)/(7*24*60*60*1000))+1;
}

function declarationInfo(date){
  const declaration=declarationMonday(date);
  if(!declaration) return null;
  const week=weekNumberForDeclaration(declaration);
  if(!week || week>5) return null;
  return {
    date: declaration,
    year: declaration.getFullYear(),
    month: declaration.getMonth(),
    week
  };
}

function declarationKey(info){
  return info ? `${info.year}-${String(info.month+1).padStart(2,"0")}` : "";
}

function declarationLabel(info){
  return info ? info.date.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}) : "";
}

function selectedPeriod(){
  const select=document.getElementById("monthPicker");
  const value=select?.value;
  if(value){ const [y,m]=value.split("-").map(Number); return {year:y,month:m-1}; }
  const now=new Date();
  // Default to the month in which the next Monday declaration falls.
  const info=declarationInfo(now);
  return info ? {year:info.year,month:info.month} : {year:now.getFullYear(),month:now.getMonth()};
}

function periodRecords(period){
  return records().filter(r=>{
    const info=declarationInfo(dateOf(r));
    if(!info) return false;
    return info.year===period.year && info.month===period.month;
  });
}

function buildRows(period){
  const map={};
  const ensure=(grade,section)=>{
    const key=classKey(grade,section);
    if(!grade) return null;
    if(!map[key]) map[key]={grade,section,label:label(grade,section),areas:{}};
    AREAS.forEach(a=>{
      if(!map[key].areas[a]) map[key].areas[a]={1:0,2:0,3:0,4:0,5:0,total:0,_count:{1:0,2:0,3:0,4:0,5:0,total:0}};
    });
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
    const info=declarationInfo(dateOf(r));
    if(!info || info.year!==period.year || info.month!==period.month || !WEEKS.includes(info.week)) return;
    const week=info.week;
    const points=pointsForRecord(r);
    row.areas[area][week]+=points;
    row.areas[area].total+=points;
    row.areas[area]._count[week]+=1;
    row.areas[area]._count.total+=1;
  });

  return Object.values(map).map(row=>{
    const net=AREAS.reduce((sum,a)=>sum+row.areas[a].total,0);
    const _recordCount=AREAS.reduce((sum,a)=>sum+(row.areas[a]._count?.total||0),0);
    return {...row,net,_recordCount};
  }).sort((a,b)=>b.net-a.net || a.label.localeCompare(b.label));
}

function formatPoints(value, empty=false){
  if(empty) return "—";
  const n=Number(value)||0;
  return n>0?`+${n}`:String(n);
}
function hasWeekData(areaObj,week){
  return Number(areaObj?._count?.[week]||0)>0;
}
function cell(value,area,total,hasData=true){
  const cls=[area.toLowerCase().replace(/\s+/g,"-"), total?"total-col":""].filter(Boolean).join(" ");
  return `<td class="${cls} ${area==='Discipline'?'negative-cell':''}">${formatPoints(value,!hasData)}</td>`;
}

function renderDetail(rows){
  const body=document.getElementById("detailBody");
  if(!body) return;
  if(!rows.length){
    body.innerHTML='<tr><td colspan="27" class="empty-row">No classes or assessment results are available for this declaration month.</td></tr>';
    return;
  }
  body.innerHTML=rows.map((row,index)=>{
    const medal=index===0?'🥇':index===1?'🥈':index===2?'🥉':'';
    const rank=medal||String(index+1);
    const weekCells=area=>{
      const obj=row.areas[area];
      return WEEKS.map(w=>cell(obj[w],area,false,hasWeekData(obj,w))).join("")+
             cell(obj.total,area,true,Number(obj._count?.total||0)>0);
    };
    return `<tr class="${index<3?'top-row':''}">
      <td class="sticky-class class-name"><strong>${escapeHTML(row.label)}</strong></td>
      ${weekCells("SUPW")}
      ${weekCells("Assembly")}
      ${weekCells("Classroom")}
      ${weekCells("Discipline")}
      <td class="net-cell">${formatPoints(row.net, row._recordCount===0)}</td>
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
  records().forEach(r=>{
    const info=declarationInfo(dateOf(r));
    if(info) set.add(monthKey(info.year,info.month));
  });
  const now=new Date();
  const currentInfo=declarationInfo(now);
  const currentMonth=currentInfo ? monthKey(currentInfo.year,currentInfo.month) : monthKey(now.getFullYear(),now.getMonth());
  set.add(currentMonth);
  const months=[...set].sort().reverse();
  select.innerHTML=months.map(k=>{const [y,m]=k.split("-").map(Number);return `<option value="${k}">${monthLabel(y,m-1)}</option>`;}).join("");
  if(set.has(currentMonth)) select.value=currentMonth;
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
