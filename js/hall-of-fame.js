// Negative totals are valid and must still appear in Hall of Fame rankings.
(function(){
"use strict";
const RECORDS_KEY="sams_assessment_records";
const CLASSES_KEY="sams_classes";
const DIVISIONS=[
  {id:"4-6",label:"Classes 4–6",grades:["IV","V","VI"]},
  {id:"7-9",label:"Classes 7–9",grades:["VII","VIII","IX"]},
  {id:"10-12",label:"Classes 10–12",grades:["X","XI","XII"]}
];

function read(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch(e){return fallback}}
function records(){return Array.isArray(read(RECORDS_KEY,[]))?read(RECORDS_KEY,[]):[]}
function classes(){return Array.isArray(read(CLASSES_KEY,[]))?read(CLASSES_KEY,[]):[]}
function dateOf(r){const d=new Date(r.savedAt);return isNaN(d)?null:d}
function mondayStart(d){const x=new Date(d);x.setHours(0,0,0,0);const day=x.getDay();x.setDate(x.getDate()-(day===0?6:day-1));return x}
// Assessment weeks run Monday-Sunday. The result is declared on the following Monday.
// The declaration Monday determines the ranking month and week.
function declarationMonday(d){if(!d)return null;const x=mondayStart(d);x.setDate(x.getDate()+7);return x}
function latestDeclaration(){const today=new Date();today.setHours(0,0,0,0);return mondayStart(today)}
function isDeclared(d){const declaration=declarationMonday(d);return !!declaration&&declaration<=latestDeclaration()}
function declarationWeekStart(d){const declaration=declarationMonday(d);return declaration?new Date(declaration.getFullYear(),declaration.getMonth(),declaration.getDate()-7):null}
function isThisWeek(d){if(!d||!isDeclared(d))return false;const declaration=declarationMonday(d);const latest=latestDeclaration();return declaration.getTime()===latest.getTime()}
function isThisMonth(d){if(!d||!isDeclared(d))return false;const declaration=declarationMonday(d);const latest=latestDeclaration();return declaration.getFullYear()===latest.getFullYear()&&declaration.getMonth()===latest.getMonth()}
function pointsForRecord(r){
  // Discipline is included in the class total even for records saved by an
  // earlier version with affectsClassTotal:false. Other explicitly excluded
  // records remain excluded.
  if(r.area!=="Discipline" && r.affectsClassTotal===false)return 0;
  return (Array.isArray(r.records)?r.records:[]).reduce((sum,x)=>{
    const p=Number(x.point);
    return Number.isFinite(p)?sum+p:sum;
  },0);
}
function classKey(grade,section){return `${String(grade||"").trim()}|${String(section||"").trim()}`}
function classLabel(c){return `${c.grade||""} ${c.section||c.stream||""}`.trim()}
function makeClassMap(){
  const map={};
  classes().forEach(c=>{map[classKey(c.grade,c.section||c.stream)]=c});
  return map;
}
function divisionForGrade(grade){
  if(["IV","V","VI"].includes(grade))return "4-6";
  if(["VII","VIII","IX"].includes(grade))return "7-9";
  if(["X","XI","XII"].includes(grade))return "10-12";
  return null;
}
function aggregate(filterFn){
  const map={};
  records().forEach(r=>{
    const d=dateOf(r); if(!isDeclared(d))return; if(!filterFn(d,r))return;
    const key=classKey(r.class,r.section);
    if(!map[key])map[key]={grade:r.class,section:r.section,points:0};
    map[key].points+=pointsForRecord(r);
  });
  return Object.values(map);
}
function winnerForDivision(div,filterFn){
  const map=makeClassMap();
  const rows=aggregate(filterFn).filter(x=>div.grades.includes(x.grade));
  rows.forEach(x=>{if(!x.section && map[classKey(x.grade,"")])x.section=map[classKey(x.grade,"")].section});
  rows.sort((a,b)=>b.points-a.points || String(a.grade).localeCompare(String(b.grade)) || String(a.section).localeCompare(String(b.section)));
  return rows[0]||null;
}
function allTimeWinner(){
  const rows=aggregate(()=>true);
  rows.sort((a,b)=>b.points-a.points || String(a.grade).localeCompare(String(b.grade)) || String(a.section).localeCompare(String(b.section)));
  return rows[0]||null;
}
function card(div,winner){
  if(!winner)return `<article class="division-card"><div class="medal">🏅</div><h3>${div.label}</h3><div class="empty">No assessment results recorded yet.</div></article>`;
  const label=`${winner.grade} ${winner.section||""}`.trim();
  return `<article class="division-card"><div class="medal">🥇</div><h3>${div.label}</h3><div class="winner">${escapeHTML(label)}</div><div class="winner-score">${winner.points} point${winner.points===1?"":"s"} • Champion</div></article>`;
}
function escapeHTML(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function render(){
  const grand=allTimeWinner();
  document.getElementById("grandChampion").textContent=grand?`${grand.grade} ${grand.section||""}`.trim():"No results yet";
  document.getElementById("grandScore").textContent=grand?`${grand.points} points • #1 overall`:"0 points";
  const week=document.getElementById("weekGrid"), month=document.getElementById("monthGrid");
  const latest=latestDeclaration();
  const weekStart=new Date(latest); weekStart.setDate(weekStart.getDate()-7);
  const weekHeading=document.querySelector('.period-card:nth-of-type(1) h2');
  const monthHeading=document.querySelector('.period-card:nth-of-type(2) h2');
  if(weekHeading) weekHeading.textContent=`Champion of the Week • Week ${Math.floor((latest.getDate()-1)/7)+1}`;
  if(monthHeading) monthHeading.textContent=`Champion of the Month • ${latest.toLocaleDateString(undefined,{month:"long",year:"numeric"})}`;
  week.innerHTML=DIVISIONS.map(d=>card(d,winnerForDivision(d,isThisWeek))).join("");
  month.innerHTML=DIVISIONS.map(d=>card(d,winnerForDivision(d,isThisMonth))).join("");
}

function allClassRankings(){
  const map={};

  classes().forEach(c=>{
    const grade=String(c.grade??c.className??c.class??c.Grade??"").trim();
    const section=String(c.section??c.stream??c["Section/Stream"]??c.Section??c.Stream??"").trim();
    if(!grade)return;
    const key=classKey(grade,section);
    if(!map[key])map[key]={grade,section,points:0,label:`${grade}${section?` ${section}`:""}`.trim()};
  });

  records().forEach(r=>{
    const grade=String(r.class??r.grade??r.Class??"").trim();
    const section=String(r.section??r.stream??r["Section/Stream"]??"").trim();
    if(!grade)return;
    const key=classKey(grade,section);
    if(!map[key])map[key]={grade,section,points:0,label:`${grade}${section?` ${section}`:""}`.trim()};
    map[key].points+=pointsForRecord(r);
  });

  return Object.values(map).sort((a,b)=>
    b.points-a.points ||
    String(a.grade).localeCompare(String(b.grade)) ||
    String(a.section).localeCompare(String(b.section))
  );
}

function renderYourClassRanking(){
  const el=document.getElementById("yourClassRanking");
  if(!el)return;
  el.innerHTML="View complete class ranking →";
}

function renderFullClassRanking(){
  const list=document.getElementById("classRankingList");
  if(!list)return;
  const rows=allClassRankings();
  if(!rows.length){
    list.innerHTML='<div class="empty">No classes have been configured yet.</div>';
    return;
  }
  list.innerHTML=rows.map((row,index)=>{
    const medal=index===0?'🥇':index===1?'🥈':index===2?'🥉':'';
    const status=index===0?'Grand Champion Class':index===1?'2nd Place':index===2?'3rd Place':'Overall standing';
    return `<div class="rank-row ${index<3?'top-three':''}">
      <div class="rank-number">${medal||index+1}</div>
      <div><div class="rank-class">${escapeHTML(row.label)}</div><small>${status}</small></div>
      <div class="rank-points">${row.points} pts</div>
    </div>`;
  }).join("");
}

function setupClassRanking(){
  const card=document.getElementById("yourClassRankingCard");
  const panel=document.getElementById("classRankingPanel");
  const close=document.getElementById("closeClassRanking");
  if(!card||!panel)return;
  card.addEventListener("click",()=>{
    const opening=panel.hidden;
    panel.hidden=!opening;
    card.setAttribute("aria-expanded",String(opening));
    if(opening){
      renderFullClassRanking();
      panel.scrollIntoView({behavior:"smooth",block:"start"});
    }
  });
  if(close)close.addEventListener("click",()=>{
    panel.hidden=true;
    card.setAttribute("aria-expanded","false");
  });
}

function render(){
  const grand=allTimeWinner();
  const grandEl=document.getElementById("grandChampion");
  const scoreEl=document.getElementById("grandScore");
  if(grandEl)grandEl.textContent=grand?`${grand.grade} ${grand.section||""}`.trim():"No results yet";
  if(scoreEl)scoreEl.textContent=grand?`${grand.points} points • #1 overall`:"0 points";
  const week=document.getElementById("weekGrid");
  const month=document.getElementById("monthGrid");
  const latest=latestDeclaration();
  const weekHeading=document.querySelector('.period-card:nth-of-type(1) h2');
  const monthHeading=document.querySelector('.period-card:nth-of-type(2) h2');
  if(weekHeading) weekHeading.textContent=`Champion of the Week • Week ${Math.floor((latest.getDate()-1)/7)+1}`;
  if(monthHeading) monthHeading.textContent=`Champion of the Month • ${latest.toLocaleDateString(undefined,{month:"long",year:"numeric"})}`;
  if(week)week.innerHTML=DIVISIONS.map(d=>card(d,winnerForDivision(d,isThisWeek))).join("");
  if(month)month.innerHTML=DIVISIONS.map(d=>card(d,winnerForDivision(d,isThisMonth))).join("");
  renderYourClassRanking();
  renderFullClassRanking();
}

function init(){
  const refresh=document.getElementById("refreshBtn");
  if(refresh)refresh.addEventListener("click",render);
  setupClassRanking();
  render();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
else init();
window.addEventListener("storage",render);
})();
