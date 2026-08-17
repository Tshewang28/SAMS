
"use strict";

const RECORDS_KEY="sams_assessment_records";
const STUDENTS_KEY="sams_students";
const CLASSES_KEY="sams_classes";
const CRITERIA_KEY="sams_assessment_criteria";

const $=id=>document.getElementById(id);
const read=(key,fallback=[])=>{try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch(e){return fallback}};
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

function students(){return Array.isArray(read(STUDENTS_KEY,[]))?read(STUDENTS_KEY,[]):[]}
function classes(){return Array.isArray(read(CLASSES_KEY,[]))?read(CLASSES_KEY,[]):[]}
function records(){return Array.isArray(read(RECORDS_KEY,[]))?read(RECORDS_KEY,[]):[]}
function criteria(){return read(CRITERIA_KEY,[])}
function gradeOf(v){return String(v??"").trim()}
function sectionOf(v){return String(v??"").trim()}
function classKey(c,s){return `${gradeOf(c)}|${sectionOf(s)}`}
function studentId(s){return String(s.id||s.studentCode||s.name||"")}
function studentName(s){return String(s.name||s.studentName||s["Student Name"]||"Unnamed Student")}
function studentGrade(s){return gradeOf(s.Class??s.class??s.grade??s.Grade)}
function studentSection(s){return sectionOf(s["Section/Stream"]??s.section??s.stream??s.Section??s.Stream)}

function classList(){
  const out=[];
  classes().forEach(c=>out.push({grade:gradeOf(c.grade??c.className??c.class??c.Class),section:sectionOf(c.section??c.stream??c["Section/Stream"]??c.Section??c.Stream)}));
  students().forEach(s=>out.push({grade:studentGrade(s),section:studentSection(s)}));
  records().forEach(r=>out.push({grade:gradeOf(r.class??r.grade),section:sectionOf(r.section??r.stream)}));
  const map=new Map();
  out.filter(x=>x.grade).forEach(x=>map.set(classKey(x.grade,x.section),x));
  return [...map.values()].sort((a,b)=>a.grade.localeCompare(b.grade,undefined,{numeric:true})||a.section.localeCompare(b.section));
}
function sectionsFor(c){
  const vals=[];
  classList().filter(x=>x.grade===c).forEach(x=>{if(x.section)vals.push(x.section)});
  return [...new Set(vals)].sort((a,b)=>a.localeCompare(b));
}
function studentsFor(c,s){
  const classRows=classes();
  const ids=new Set(classRows.filter(x=>
    gradeOf(x.grade??x.className??x.class??x.Class)===c &&
    sectionOf(x.section??x.stream??x["Section/Stream"]??x.Section??x.Stream)===s
  ).map(x=>String(x.id||"")));
  return students().filter(st=>{
    if(st.classId&&ids.has(String(st.classId)))return true;
    return studentGrade(st)===c&&studentSection(st)===s;
  }).filter((s,i,a)=>a.findIndex(x=>studentId(x)===studentId(s))===i);
}
function volunteerRecords(){const x=read("sams_volunteer_records",[]);return Array.isArray(x)?x:[]}
function volunteerPointsForStudent(sid){return volunteerRecords().filter(x=>String(x.studentId)===String(sid)).reduce((sum,x)=>sum+(Number.isFinite(Number(x.points))?Number(x.points):2),0)}
function volunteerEntriesForStudent(sid){return volunteerRecords().filter(x=>String(x.studentId)===String(sid))}
function gamesSportsRecords(){
  const x=read("sams_games_sports_records",[]);
  return Array.isArray(x)?x:[];
}
function gamesSportsForStudent(sid){
  return gamesSportsRecords().filter(x=>String(x.studentId)===String(sid));
}
function sportsPositionPointsForStudent(sid){
  return gamesSportsForStudent(sid)
    .filter(x=>x.affectsClassTotal===true || (x.result&&x.result!=="Participation"&&x.individualOnly!==true))
    .reduce((sum,x)=>sum+(Number.isFinite(Number(x.points))?Number(x.points):0),0);
}
function sportsParticipationPointsForStudent(sid){
  return gamesSportsForStudent(sid)
    .filter(x=>x.result==="Participation" || x.affectsClassTotal===false || x.individualOnly===true)
    .reduce((sum,x)=>sum+(Number.isFinite(Number(x.points))?Number(x.points):0),0);
}
function sportsPositionPointsForClass(c,s){
  return gamesSportsRecords()
    .filter(x=>gradeOf(x.class??x.grade)===c&&sectionOf(x.section??x.stream)===s&&
      (x.affectsClassTotal===true || (x.result&&x.result!=="Participation"&&x.individualOnly!==true)))
    .reduce((sum,x)=>sum+(Number.isFinite(Number(x.points))?Number(x.points):0),0);
}
function criterionName(id){
  const c=criteria().find(x=>String(x.id)===String(id));
  return c?.name||"Assessment Criterion";
}
function recordRowsForClass(c,s){
  return records().filter(r=>gradeOf(r.class??r.grade)===c&&sectionOf(r.section??r.stream)===s);
}
function assessmentBasePoints(c,s){
  return recordRowsForClass(c,s).filter(r=>r.area!=="Discipline").reduce((sum,r)=>
    sum+(Array.isArray(r.records)?r.records:[]).reduce((a,x)=>a+(Number.isFinite(Number(x.point))?Number(x.point):0),0),0);
}
function baseClassPoints(c,s){
  return assessmentBasePoints(c,s)+sportsPositionPointsForClass(c,s);
}
function disciplineForStudent(c,s,sid){
  return recordRowsForClass(c,s).filter(r=>r.area==="Discipline").reduce((sum,r)=>
    sum+(Array.isArray(r.records)?r.records:[]).filter(x=>String(x.studentId||"")===String(sid)).reduce((a,x)=>a+(Number.isFinite(Number(x.point))?Number(x.point):0),0),0);
}
function allDisciplinePoints(c,s){
  return recordRowsForClass(c,s).filter(r=>r.area==="Discipline").reduce((sum,r)=>
    sum+(Array.isArray(r.records)?r.records:[]).reduce((a,x)=>a+(Number.isFinite(Number(x.point))?Number(x.point):0),0),0);
}
function areaPoints(c,s,area){
  return recordRowsForClass(c,s).filter(r=>r.area===area).reduce((sum,r)=>
    sum+(Array.isArray(r.records)?r.records:[]).reduce((a,x)=>a+(Number.isFinite(Number(x.point))?Number(x.point):0),0),0);
}

function fillClasses(){
  // Class/grade is selected only once. Section/Stream handles the divisions.
  // Example: VII appears once; A, B, C, etc. are selected in the next field.
  const uniqueGrades=[...new Set(classList().map(x=>x.grade).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const opts=uniqueGrades.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  [$("individualClass"),$("classReportClass")].forEach(el=>{
    const current=el.value;
    el.innerHTML='<option value="">Select Class</option>'+opts;
    if(uniqueGrades.includes(current)) el.value=current;
  });
}
function fillSections(classId,select){
  select.innerHTML='<option value="">Select Section / Stream</option>'+sectionsFor(classId).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  select.disabled=!classId;
}
function fillStudents(){
  const c=$("individualClass").value,s=$("individualSection").value;
  const list=studentsFor(c,s);
  $("individualStudent").innerHTML='<option value="">Select Student</option>'+list.map(x=>`<option value="${esc(studentId(x))}">${esc(studentName(x))}${x.studentCode?` — ${esc(x.studentCode)}`:""}</option>`).join("");
  $("individualStudent").disabled=!c||!s||!list.length;
}
function clearResult(id,emptyId){
  $(id).classList.add("hidden");$(emptyId).classList.remove("hidden");
}

function renderIndividual(){
  const c=$("individualClass").value,s=$("individualSection").value,sid=$("individualStudent").value;
  if(!c||!s||!sid){clearResult("individualResult","individualEmpty");return}
  const st=studentsFor(c,s).find(x=>studentId(x)===sid);
  if(!st){clearResult("individualResult","individualEmpty");return}
  const base=assessmentBasePoints(c,s),disc=disciplineForStudent(c,s,sid),volunteer=volunteerPointsForStudent(sid);
  const sportsPosition=sportsPositionPointsForStudent(sid);
  const sportsParticipation=sportsParticipationPointsForStudent(sid);
  const total=base+disc+volunteer+sportsParticipation;
  const areas=["Classroom","Assembly","SUPW"];
  const areaCards=areas.map(a=>`<div class="area-card"><small>${esc(a)}</small><strong>${areaPoints(c,s,a)}</strong></div>`).join("");
  const sportsCard=`<div class="area-card"><small>Games &amp; Sports</small><strong>+${sportsPosition+sportsParticipation}</strong><span class="report-subtext">Position +${sportsPosition} • Participation +${sportsParticipation}</span></div>`;
  const disciplineCard=`<div class="area-card discipline-card"><small>Discipline</small><strong class="${disc<0?"negative":""}">${disc}</strong></div>`;
  const volunteerCard=`<div class="area-card"><small>Volunteer</small><strong>+${volunteer}</strong></div>`;
  const disciplineRows=recordRowsForClass(c,s).filter(r=>r.area==="Discipline").flatMap(r=>(r.records||[]).filter(x=>String(x.studentId||"")===sid).map(x=>`<tr><td>${esc(criterionName(x.criterionId))}</td><td class="num negative">${Number(x.point)}</td><td>${esc(x.comment||"—")}</td></tr>`));
  $("individualResult").innerHTML=`
    <div class="report-title-card">
      <div><span class="eyebrow">STUDENT REPORT</span><h3>${esc(studentName(st))}</h3><p>Class ${esc(c)} • ${esc(s)}${st.studentCode?` • ${esc(st.studentCode)}`:""}</p></div>
      <div class="total-badge"><small>Total Points</small><strong>${total}</strong></div>
    </div>
    <div class="area-grid">${areaCards}${sportsCard}${disciplineCard}${volunteerCard}</div>
    <div class="discipline-note">Discipline deductions are applied <strong>only to this student</strong>. Other students' Discipline deductions are not included in this report.</div>
    ${disciplineRows.length?`<div class="report-table-wrap"><table class="report-table"><thead><tr><th>Discipline</th><th class="num">Points</th><th>Comment</th></tr></thead><tbody>${disciplineRows.join("")}</tbody></table></div>`:"<div class=\"empty-state\">No Discipline deduction recorded for this student.</div>"}
  `;
  $("individualResult").classList.remove("hidden");$("individualEmpty").classList.add("hidden");
}

function renderClass(){
  const c=$("classReportClass").value,s=$("classReportSection").value;
  if(!c||!s){clearResult("classResult","classEmpty");return}
  const sts=studentsFor(c,s),assessmentBase=assessmentBasePoints(c,s),sportsClassPoints=sportsPositionPointsForClass(c,s);
  const base=assessmentBase+sportsClassPoints,disc=allDisciplinePoints(c,s),total=base+disc;
  const rows=sts.map((st,i)=>{
    const sid=studentId(st),d=disciplineForStudent(c,s,sid),v=volunteerPointsForStudent(sid);
    const sp=sportsPositionPointsForStudent(sid),participation=sportsParticipationPointsForStudent(sid);
    const t=assessmentBase+d+v+sp+participation;
    return `<tr><td>${i+1}</td><td><strong>${esc(studentName(st))}</strong>${st.studentCode?`<small>${esc(st.studentCode)}</small>`:""}</td><td class="num">${assessmentBase}</td><td class="num">${sp}</td><td class="num">${participation}</td><td class="num ${d<0?"negative":""}">${d}</td><td class="num ${t<0?"negative":""}"><strong>${t}</strong></td></tr>`;
  }).join("");
  $("classResult").innerHTML=`
    <div class="report-title-card">
      <div><span class="eyebrow">CLASS REPORT</span><h3>Class ${esc(c)} • ${esc(s)}</h3><p>${sts.length} student${sts.length===1?"":"s"} in this class</p></div>
      <div class="total-badge"><small>Class Total</small><strong>${total}</strong></div>
    </div>
    <div class="class-summary">
      <div class="summary-box"><small>Assessment Points</small><strong>${assessmentBase}</strong></div>
      <div class="summary-box"><small>Games &amp; Sports Position</small><strong>${sportsClassPoints}</strong></div>
      <div class="summary-box"><small>Discipline Points</small><strong class="${disc<0?"negative":""}">${disc}</strong></div>
      <div class="summary-box"><small>Final Class Total</small><strong class="${total<0?"negative":""}">${total}</strong></div>
    </div>
    <div class="discipline-note">Games &amp; Sports participation points are individual-only and excluded from the class mark. Position points are included in the class mark. Each Discipline deduction is shown only against the student who received it.</div>
    <div class="report-table-wrap"><table class="report-table"><thead><tr><th>#</th><th>Student</th><th class="num">Assessment + Position</th><th class="num">Sports Position</th><th class="num">Sports Participation</th><th class="num">Discipline</th><th class="num">Student Total</th></tr></thead><tbody>${rows||'<tr><td colspan="7" class="empty-state">No students found in this class.</td></tr>'}</tbody></table></div>
  `;
  $("classResult").classList.remove("hidden");$("classEmpty").classList.add("hidden");
}

function init(){
  fillClasses();
  $("individualClass").addEventListener("change",()=>{fillSections($("individualClass").value,$("individualSection"));fillStudents();renderIndividual()});
  $("individualSection").addEventListener("change",()=>{fillStudents();renderIndividual()});
  $("individualStudent").addEventListener("change",renderIndividual);
  $("classReportClass").addEventListener("change",()=>{fillSections($("classReportClass").value,$("classReportSection"));renderClass()});
  $("classReportSection").addEventListener("change",renderClass);

  $("individualTab").addEventListener("click",()=>{
    $("individualTab").classList.add("active");$("classTab").classList.remove("active");
    $("individualReport").classList.remove("hidden");$("classReport").classList.add("hidden");
  });
  $("classTab").addEventListener("click",()=>{
    $("classTab").classList.add("active");$("individualTab").classList.remove("active");
    $("classReport").classList.remove("hidden");$("individualReport").classList.add("hidden");
  });
  window.addEventListener("storage",()=>{fillClasses();renderIndividual();renderClass()});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
