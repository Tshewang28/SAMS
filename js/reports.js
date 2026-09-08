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

/* =========================================================
   VOLUNTEER
   ========================================================= */

function volunteerRecords(){
  const x=read("sams_volunteer_records",[]);
  return Array.isArray(x)?x:[];
}

function volunteerEntriesForStudent(sid){
  return volunteerRecords().filter(x=>String(x.studentId)===String(sid));
}

function volunteerPointsForStudent(sid){
  return volunteerEntriesForStudent(sid).reduce((sum,x)=>
    sum+(Number.isFinite(Number(x.points))?Number(x.points):2),0);
}

/* =========================================================
   GAMES & SPORTS
   ========================================================= */

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

/* =========================================================
   ASSESSMENT / DISCIPLINE
   ========================================================= */

function criterionName(id){
  const c=criteria().find(x=>String(x.id)===String(id));
  return c?.name||"Assessment Criterion";
}

function normalizeArea(v){
  return String(v??"").trim().toLowerCase().replace(/\s+/g," ");
}

function isDisciplineArea(v){
  return normalizeArea(v)==="discipline";
}

function recordRowsForClass(c,s){
  return records().filter(r=>gradeOf(r.class??r.grade)===c&&sectionOf(r.section??r.stream)===s);
}

// Some earlier SAMS versions stored Discipline records in a separate key.
// Read both formats so old and new deductions appear in the reports.
function legacyDisciplineRowsForClass(c,s){
  const legacy=read("sams_discipline_records",[]);
  if(!Array.isArray(legacy)) return [];
  return legacy.filter(r=>
    gradeOf(r.class??r.grade??r.Class)===c &&
    sectionOf(r.section??r.stream??r.Section)===s
  );
}

function disciplineRowsForClass(c,s){
  const current=recordRowsForClass(c,s).filter(r=>isDisciplineArea(r.area));
  const legacy=legacyDisciplineRowsForClass(c,s);
  return [...current,...legacy];
}

function disciplineItems(row){
  if(Array.isArray(row?.records)) return row.records;
  // Support flat legacy discipline records as well.
  if(row && (row.point!==undefined || row.points!==undefined)) return [row];
  return [];
}

function disciplinePoint(item){
  const point=Number(item?.point??item?.points);
  if(!Number.isFinite(point)) return 0;
  // Discipline is always a deduction. If an old record was saved as +2,
  // treat it as -2 in reports instead of accidentally adding marks.
  return point>0 ? -point : point;
}

function studentMatchesDisciplineItem(item,sid){
  const wanted=String(sid??"").trim();
  if(!wanted) return false;
  return [item?.studentId,item?.studentCode,item?.studentName]
    .some(v=>String(v??"").trim()===wanted);
}

function assessmentBasePoints(c,s){
  return recordRowsForClass(c,s)
    .filter(r=>r.area!=="Discipline")
    .reduce((sum,r)=>sum+(Array.isArray(r.records)?r.records:[])
      .reduce((a,x)=>a+(Number.isFinite(Number(x.point))?Number(x.point):0),0),0);
}

function areaPointsForStudent(c,s,area,sid){
  const wantedId=String(sid??"").trim();
  if(!wantedId)return 0;

  return recordRowsForClass(c,s)
    .filter(r=>r.area===area)
    .reduce((sum,r)=>sum+(Array.isArray(r.records)?r.records:[])
      .filter(x=>String(x.studentId??"").trim()===wantedId)
      .reduce((a,x)=>a+(Number.isFinite(Number(x.point))?Number(x.point):0),0),0);
}

function areaPoints(c,s,area){
  return recordRowsForClass(c,s)
    .filter(r=>r.area===area)
    .reduce((sum,r)=>sum+(Array.isArray(r.records)?r.records:[])
      .reduce((a,x)=>a+(Number.isFinite(Number(x.point))?Number(x.point):0),0),0);
}

function disciplineForStudent(c,s,sid){
  const wantedId=String(sid??"").trim();
  if(!wantedId)return 0;

  return disciplineRowsForClass(c,s)
    .reduce((sum,r)=>sum+disciplineItems(r).reduce((a,x)=>{
      if(!studentMatchesDisciplineItem(x,wantedId)) return a;
      return a+disciplinePoint(x);
    },0),0);
}

function allDisciplinePoints(c,s){
  return disciplineRowsForClass(c,s)
    .reduce((sum,r)=>sum+disciplineItems(r).reduce((a,x)=>{
      if(x?.affectsClassTotal===false)return a;
      return a+disciplinePoint(x);
    },0),0);
}

/* =========================================================
   GRADING
   ========================================================= */

const GRADE_BANDS=[
  {min:85,grade:"A",label:"Excellent"},
  {min:70,grade:"B",label:"Very Good"},
  {min:55,grade:"C",label:"Good / Satisfactory"},
  {min:40,grade:"D",label:"Needs Improvement"},
  {min:0,grade:"E",label:"Poor / Unsatisfactory"}
];

function gradeFromPercent(p){
  const n=Math.max(0,Math.min(100,Number(p)||0));
  return GRADE_BANDS.find(x=>n>=x.min)||GRADE_BANDS[GRADE_BANDS.length-1];
}

function coreMaxPoints(c,s){
  const assessmentMax=recordRowsForClass(c,s)
    .filter(r=>r.area!=="Discipline")
    .reduce((sum,r)=>sum+((Array.isArray(r.records)?r.records:[]).length*5),0);

  const sportsMax=gamesSportsRecords()
    .filter(x=>gradeOf(x.class??x.grade)===c&&sectionOf(x.section??x.stream)===s&&
      (x.affectsClassTotal===true || (x.result&&x.result!=="Participation"&&x.individualOnly!==true)))
    .length*5;

  return assessmentMax+sportsMax;
}

function gradeForScore(score,max){
  const pct=max>0?(Number(score)||0)/max*100:0;
  return {percent:Math.max(0,Math.min(100,pct)),...gradeFromPercent(pct)};
}

/* =========================================================
   SERIOUS DISCIPLINE RULE
   ========================================================= */

const SERIOUS_DISCIPLINE_TYPES=[
  "bullying/fighting",
  "alcohol / substance-related violation",
  "smoking / tobacco-related violation",
  "damage to school property"
];

function normalizeDisciplineText(v){
  return String(v??"").trim().toLowerCase().replace(/[–—]/g,"-").replace(/\s+/g," ");
}

function seriousDisciplineIncidentCount(c,s,sid){
  const wantedId=String(sid??"").trim();
  if(!wantedId)return 0;

  return disciplineRowsForClass(c,s)
    .reduce((count,r)=>{
      const rows=disciplineItems(r);

      return count+rows.filter(x=>{
        if(!studentMatchesDisciplineItem(x,wantedId))return false;

        const name=normalizeDisciplineText(criterionName(x?.criterionId));

        return SERIOUS_DISCIPLINE_TYPES.some(type=>
          name===type || name.includes(type)
        );
      }).length;
    },0);
}

function applySeriousDisciplineGradeRule(grade,incidentCount){
  if(incidentCount>=6)return {percent:grade.percent,grade:"E",label:"Poor / Unsatisfactory"};
  if(incidentCount===5)return {percent:grade.percent,grade:"D",label:"Needs Improvement"};
  if(incidentCount===4)return {percent:grade.percent,grade:"C",label:"Good / Satisfactory"};
  if(incidentCount===3)return {percent:grade.percent,grade:"B",label:"Very Good"};
  return grade;
}

/* =========================================================
   SELECTORS
   ========================================================= */

function fillClasses(){
  const uniqueGrades=[...new Set(classList().map(x=>x.grade).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));

  const opts=uniqueGrades.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");

  [$('individualClass'),$('classReportClass')].forEach(el=>{
    const current=el.value;
    el.innerHTML='<option value="">Select Class</option>'+opts;
    if(uniqueGrades.includes(current))el.value=current;
  });
}

function fillSections(classId,select){
  select.innerHTML='<option value="">Select Section / Stream</option>'+
    sectionsFor(classId).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");

  select.disabled=!classId;
}

function fillStudents(){
  const c=$('individualClass').value;
  const s=$('individualSection').value;
  const list=studentsFor(c,s);

  $('individualStudent').innerHTML='<option value="">Select Student</option>'+
    list.map(x=>`<option value="${esc(studentId(x))}">${esc(studentName(x))}${x.studentCode?` — ${esc(x.studentCode)}`:""}</option>`).join("");

  $('individualStudent').disabled=!c||!s||!list.length;
}

function clearResult(id,emptyId){
  $(id).classList.add("hidden");
  $(emptyId).classList.remove("hidden");
}

/* =========================================================
   INDIVIDUAL REPORT
   ========================================================= */

function renderIndividual(){

  const c=$('individualClass').value;
  const s=$('individualSection').value;
  const sid=$('individualStudent').value;

  if(!c||!s||!sid){
    clearResult('individualResult','individualEmpty');
    return;
  }

  const st=studentsFor(c,s).find(x=>studentId(x)===sid);

  if(!st){
    clearResult('individualResult','individualEmpty');
    return;
  }

  /* ---------------- CORE POINTS ---------------- */

  const classroom=areaPointsForStudent(c,s,'Classroom',sid);
  const assembly=areaPointsForStudent(c,s,'Assembly',sid);
  const supw=areaPointsForStudent(c,s,'SUPW',sid);

  const discipline=disciplineForStudent(c,s,sid);
  const volunteer=volunteerPointsForStudent(sid);

  const sportsRecords=gamesSportsForStudent(sid);

  const positionRecords=sportsRecords.filter(x=>
    x.affectsClassTotal===true ||
    (x.result&&x.result!=="Participation"&&x.individualOnly!==true)
  );

  const participationRecords=sportsRecords.filter(x=>
    x.result==="Participation" ||
    x.affectsClassTotal===false ||
    x.individualOnly===true
  );

  const sportsPosition=positionRecords.reduce((sum,x)=>
    sum+(Number.isFinite(Number(x.points))?Number(x.points):0),0);

  const sportsParticipation=participationRecords.reduce((sum,x)=>
    sum+(Number.isFinite(Number(x.points))?Number(x.points):0),0);

  const gradingScore=
    classroom+
    assembly+
    supw+
    sportsPosition+
    discipline;

  const max=coreMaxPoints(c,s);

  const calculatedGrade=gradeForScore(gradingScore,max);

  const seriousIncidents=seriousDisciplineIncidentCount(c,s,sid);

  const grade=applySeriousDisciplineGradeRule(
    calculatedGrade,
    seriousIncidents
  );

  const total=
    classroom+
    assembly+
    supw+
    sportsPosition+
    sportsParticipation+
    volunteer+
    discipline;

  /* ---------------- RECORD LISTS ---------------- */

  const sportsPositionList=positionRecords.length
    ?positionRecords.map(x=>{
        const title=x.sport||x.game||x.event||x.activity||x.name||'Game / Sport';
        const result=x.result&&x.result!=="Participation"?` — ${x.result}`:"";
        const date=x.date||x.activityDate||x.createdAt||"";

        return `
          <li>
            <span>
              ${esc(title)}${esc(result)}
              ${date?`<small>${esc(date)}</small>`:""}
            </span>
            <strong>+${Number(x.points)||0}</strong>
          </li>
        `;
      }).join("")
    :`<li class="record-empty">No position records</li>`;

  const sportsParticipationList=participationRecords.length
    ?participationRecords.map(x=>{
        const title=x.sport||x.game||x.event||x.activity||x.name||'Participation';
        const date=x.date||x.activityDate||x.createdAt||"";

        return `
          <li>
            <span>
              ${esc(title)}
              ${date?`<small>${esc(date)}</small>`:""}
            </span>
            <strong>+${Number(x.points)||0}</strong>
          </li>
        `;
      }).join("")
    :`<li class="record-empty">No participation records</li>`;

  const disciplineRecords=disciplineRowsForClass(c,s)
    .flatMap(r=>disciplineItems(r)
      .filter(x=>studentMatchesDisciplineItem(x,sid))
      .map(x=>({
        criterion:criterionName(x.criterionId),
        points:disciplinePoint(x),
        comment:x.comment||''
      }))
    );

  const disciplineList=disciplineRecords.length
    ?disciplineRecords.map(x=>`
        <li>
          <span>
            ${esc(x.criterion)}
            ${x.comment?`<small>${esc(x.comment)}</small>`:""}
          </span>
          <strong class="negative">${x.points}</strong>
        </li>
      `).join("")
    :`<li class="record-empty">No discipline records</li>`;

  const volunteerRecords=volunteerEntriesForStudent(sid);

  const volunteerList=volunteerRecords.length
    ?volunteerRecords.map(x=>{
        const title=x.activity||x.volunteer||x.title||x.name||x.description||'Volunteer Activity';
        const date=x.date||x.activityDate||x.createdAt||"";

        return `
          <li>
            <span>
              ${esc(title)}
              ${date?`<small>${esc(date)}</small>`:""}
            </span>
            <strong>+${Number.isFinite(Number(x.points))?Number(x.points):2}</strong>
          </li>
        `;
      }).join("")
    :`<li class="record-empty">No volunteer records</li>`;

  /* ---------------- REPORT HTML ---------------- */

  $('individualResult').innerHTML=`

    <div class="modern-report">

      <!-- HEADER -->
      <div class="student-report-header">
        <div>
          <span class="student-report-kicker">STUDENT REPORT</span>
          <h3>${esc(studentName(st))}</h3>
          <p>
            Class ${esc(c)} • ${esc(s)}
            ${st.studentCode?` • ${esc(st.studentCode)}`:""}
          </p>
        </div>

        <div class="header-grade">
          <span>Grade</span>
          <strong>${grade.grade}</strong>
          <em>${grade.label}</em>
        </div>
      </div>


      <!-- FOUR SUMMARY CARDS -->
      <div class="modern-metrics">

        <div class="metric-card">
          <div class="metric-icon metric-blue">▣</div>
          <div>
            <span>Grading Score</span>
            <strong>${gradingScore}<small> / ${max}</small></strong>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon metric-green">%</div>
          <div>
            <span>Percentage</span>
            <strong>${calculatedGrade.percent.toFixed(1)}%</strong>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon metric-orange">★</div>
          <div>
            <span>Performance</span>
            <strong class="performance-value">${grade.label}</strong>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon metric-purple">▤</div>
          <div>
            <span>Total Points</span>
            <strong>${total}</strong>
          </div>
        </div>

      </div>


      <!-- AREA TITLE -->
      <div class="area-section-title">Points by Area</div>


      <!-- AREA CARDS -->
      <div class="modern-area-grid">

        <!-- CLASSROOM -->
        <div class="modern-area-card classroom-card">
          <div class="modern-area-icon classroom-icon">▣</div>
          <div class="modern-area-content">
            <div class="modern-area-title">Classroom</div>
            <div class="modern-area-score">${classroom}</div>
            <div class="modern-area-sub">Assessed Core Points</div>
          </div>
        </div>

        <!-- ASSEMBLY -->
        <div class="modern-area-card assembly-card">
          <div class="modern-area-icon assembly-icon">♟</div>
          <div class="modern-area-content">
            <div class="modern-area-title">Assembly</div>
            <div class="modern-area-score">${assembly}</div>
            <div class="modern-area-sub">Assessed Core Points</div>
          </div>
        </div>

        <!-- SUPW -->
        <div class="modern-area-card supw-card">
          <div class="modern-area-icon supw-icon">✦</div>
          <div class="modern-area-content">
            <div class="modern-area-title">SUPW</div>
            <div class="modern-area-score">${supw}</div>
            <div class="modern-area-sub">Assessed Core Points</div>
          </div>
        </div>

        <!-- GAMES & SPORTS -->
        <div class="modern-area-card sports-card record-card">
          <div class="modern-area-icon sports-icon">🏆</div>
          <div class="modern-area-content">
            <div class="modern-area-title">Games &amp; Sports</div>
            <div class="modern-area-score">+${sportsPosition+sportsParticipation}</div>
            <div class="modern-area-sub">
              Position +${sportsPosition} • Participation +${sportsParticipation}
            </div>

            <div class="record-breakdown">
              <div class="record-group">
                <div class="record-group-title">Position Points</div>
                <ul>${sportsPositionList}</ul>
              </div>

              <div class="record-group">
                <div class="record-group-title">Participation Points</div>
                <ul>${sportsParticipationList}</ul>
              </div>
            </div>
          </div>
        </div>

        <!-- DISCIPLINE -->
        <div class="modern-area-card discipline-card record-card">
          <div class="modern-area-icon discipline-icon">🛡</div>
          <div class="modern-area-content">
            <div class="modern-area-title">Discipline</div>
            <div class="modern-area-score negative">${discipline}</div>
            <div class="modern-area-sub">Deductions</div>

            <div class="record-breakdown">
              <div class="record-group">
                <div class="record-group-title">Discipline Deductions</div>
                <ul>${disciplineList}</ul>
              </div>
            </div>
          </div>
        </div>

        <!-- VOLUNTEER -->
        <div class="modern-area-card volunteer-card record-card">
          <div class="modern-area-icon volunteer-icon">♥</div>
          <div class="modern-area-content">
            <div class="modern-area-title">Volunteer</div>
            <div class="modern-area-score">+${volunteer}</div>
            <div class="modern-area-sub">Recognition Points</div>

            <div class="record-breakdown">
              <div class="record-group">
                <div class="record-group-title">Volunteer Activities</div>
                <ul>${volunteerList}</ul>
              </div>
            </div>
          </div>
        </div>

      </div>


      <!-- INFORMATION BOX -->
      <div class="report-info-box info-box">
        <div class="info-symbol">ⓘ</div>
        <div>
          Individual grading uses <strong>assessed core points</strong> — this student's
          Discipline deductions. Volunteer and Sports Participation points are shown as
          additional recognition points and are included in Total Points, but are not used
          to change the grading denominator.
        </div>
      </div>


      <!-- SERIOUS DISCIPLINE RULE -->
      <div class="report-info-box warning-box">
        <div class="info-symbol">!</div>
        <div>
          <strong>Serious discipline grading rule:</strong>
          ${seriousIncidents} qualifying incident${seriousIncidents===1?'':'s'} recorded
          (Bullying/Fighting, Alcohol / Substance-Related Violation,
          Smoking / Tobacco-Related Violation, or Damage to School Property).
          <strong>3 incidents cap the individual grade at B; 4 at C; 5 at D;
          6 or more result in E.</strong> Incidents may be recorded together or separately.
        </div>
      </div>


      <!-- GRADING SCALE -->
      <div class="grading-scale-title">Grading Scale</div>

      <div class="grading-scale">
        <div class="scale-a">
          <strong>A</strong>
          <span>85–100%</span>
          <em>Excellent</em>
        </div>
        <div class="scale-b">
          <strong>B</strong>
          <span>70–84%</span>
          <em>Very Good</em>
        </div>
        <div class="scale-c">
          <strong>C</strong>
          <span>55–69%</span>
          <em>Good / Satisfactory</em>
        </div>
        <div class="scale-d">
          <strong>D</strong>
          <span>40–54%</span>
          <em>Needs Improvement</em>
        </div>
        <div class="scale-e">
          <strong>E</strong>
          <span>0–39%</span>
          <em>Poor / Unsatisfactory</em>
        </div>
      </div>

    </div>
  `;

  $('individualResult').classList.remove('hidden');
  $('individualEmpty').classList.add('hidden');
}

/* =========================================================
   CLASS REPORT
   ========================================================= */

function getReportWeekKey(value){
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return "";
  const day=d.getDay();
  const diff=day===0 ? -6 : 1-day;
  d.setHours(0,0,0,0);
  d.setDate(d.getDate()+diff);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getReportMonthKey(value){
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function reportPeriodLabel(type,key){
  if(!key) return "";
  if(type==="month"){
    const [y,m]=key.split("-").map(Number);
    return new Date(y,m-1,1).toLocaleDateString(undefined,{month:"long",year:"numeric"});
  }
  const d=new Date(`${key}T00:00:00`);
  const end=new Date(d); end.setDate(end.getDate()+6);
  return `Week: ${d.toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"})} – ${end.toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"})}`;
}

function assessmentRecordsForClassPeriod(c,s,type,key){
  return records().filter(r=>{
    if(gradeOf(r.class??r.grade)!==c || sectionOf(r.section??r.stream)!==s) return false;
    const saved=r.savedAt||r.createdAt||r.date||r.timestamp;
    if(!saved) return false;
    return (type==="month" ? getReportMonthKey(saved) : getReportWeekKey(saved))===key;
  });
}

function periodOptionsForClass(c,s,type){
  const keys=new Map();
  records().forEach(r=>{
    if(gradeOf(r.class??r.grade)!==c || sectionOf(r.section??r.stream)!==s) return;
    const saved=r.savedAt||r.createdAt||r.date||r.timestamp;
    if(!saved) return;
    const d=new Date(saved);
    if(Number.isNaN(d.getTime())) return;
    const key=type==="month" ? getReportMonthKey(saved) : getReportWeekKey(saved);
    if(key && !keys.has(key)) keys.set(key,saved);
  });
  // Always offer the current period so the report controls are usable before a new entry is made.
  const now=new Date();
  const current=type==="month" ? getReportMonthKey(now) : getReportWeekKey(now);
  if(!keys.has(current)) keys.set(current,now.toISOString());
  return [...keys.keys()].sort((a,b)=>b.localeCompare(a));
}

function fillClassReportPeriods(){
  const c=$("classReportClass")?.value;
  const s=$("classReportSection")?.value;
  const type=$("classReportPeriodType")?.value||"week";
  const select=$("classReportPeriod");
  if(!select) return;
  select.innerHTML="";
  if(!c||!s){
    select.disabled=true;
    select.innerHTML='<option value="">Select Class and Section first</option>';
    return;
  }
  const keys=periodOptionsForClass(c,s,type);
  select.disabled=false;
  select.innerHTML=keys.map(k=>`<option value="${esc(k)}">${esc(reportPeriodLabel(type,k))}</option>`).join("");
}

function renderClass(){
  const c=$("classReportClass").value;
  const s=$("classReportSection").value;
  const type=$("classReportPeriodType")?.value||"week";
  const period=$("classReportPeriod")?.value||"";

  if(!c||!s||!period){
    clearResult("classResult","classEmpty");
    return;
  }

  const periodRows=assessmentRecordsForClassPeriod(c,s,type,period);
  const areaMap=new Map();
  const comments=[];
  const negative=[];

  periodRows.forEach(row=>{
    const area=String(row.area||"Other").trim()||"Other";
    if(!areaMap.has(area)) areaMap.set(area,{points:0,count:0});

    const nested=Array.isArray(row.records)?row.records:[];
    nested.forEach(item=>{
      const point=Number(item?.point);
      if(Number.isFinite(point)){
        areaMap.get(area).points+=point;
        areaMap.get(area).count++;
      }
      const comment=String(item?.comment||"").trim();
      if(comment){
        comments.push({area,comment});
      }
      // Only negative deductions reveal student identity. Assessor is never rendered.
      const deduction=Number(item?.point);
      if(area.toLowerCase()==="discipline" && Number.isFinite(deduction) && deduction<0){
        const student=item?.studentName||row.studentName||"";
        if(student){
          negative.push({
            student:String(student),
            area,
            deduction,
            reason:String(item?.comment||"").trim() || criterionName(item?.criterionId)
          });
        }
      }
    });
  });

  // Preserve every comment; remove only exact duplicate entries.
  const uniqueComments=[];
  const seenComments=new Set();
  comments.forEach(x=>{
    const k=x.area+"|"+x.comment;
    if(!seenComments.has(k)){seenComments.add(k);uniqueComments.push(x);}
  });

  const areaCards=[...areaMap.entries()].map(([area,data])=>{
    const mark=data.count ? data.points : 0;
    return `<div class="report-area-summary-card">
      <div class="report-area-summary-title">${esc(area)}</div>
      <div class="report-area-summary-mark">${Number.isInteger(mark)?mark:mark.toFixed(1)}</div>
      <div class="report-area-summary-meta">${data.count} recorded mark${data.count===1?"":"s"}</div>
    </div>`;
  }).join("");

  const commentHtml=uniqueComments.length
    ?uniqueComments.map(x=>`<article class="class-comment-item"><span class="class-comment-area">${esc(x.area)}</span><p>${esc(x.comment)}</p></article>`).join("")
    :'<div class="empty-state">No assessor comments recorded for this period.</div>';

  const negativeHtml=negative.length
    ?`<div class="report-table-wrap negative-report-wrap"><table class="report-table negative-report-table"><thead><tr><th>Student</th><th>Assessment Area</th><th>Negative Mark</th><th>Reason</th></tr></thead><tbody>${negative.map(x=>`<tr><td><strong>${esc(x.student)}</strong></td><td>${esc(x.area)}</td><td class="num negative">${esc(x.deduction)}</td><td>${esc(x.reason)}</td></tr>`).join("")}</tbody></table></div>`
    :'<div class="empty-state">No negative marks or deductions affected the class during this period.</div>';

  const totalMarks=[...areaMap.values()].reduce((sum,x)=>sum+x.points,0);
  const assessedAreas=areaMap.size;

  $("classResult").innerHTML=`
    <div class="report-title-card">
      <div>
        <span class="eyebrow">CLASS REPORT</span>
        <h3>Class ${esc(c)} • ${esc(s)}</h3>
        <p>${esc(reportPeriodLabel(type,period))}</p>
      </div>
      <div class="grade-badge"><small>Assessment Areas</small><strong>${assessedAreas}</strong><span>recorded</span></div>
    </div>

    <div class="class-summary period-summary">
      <div class="summary-box"><small>Assessment Areas</small><strong>${assessedAreas}</strong></div>
      <div class="summary-box"><small>Total Recorded Marks</small><strong>${Number.isInteger(totalMarks)?totalMarks:totalMarks.toFixed(1)}</strong></div>
      <div class="summary-box"><small>Comments</small><strong>${uniqueComments.length}</strong></div>
      <div class="summary-box"><small>Negative Deductions</small><strong class="${negative.length?"negative":""}">${negative.length}</strong></div>
    </div>

    <div class="period-report-note"><strong>Class report privacy:</strong> student names are not displayed in the normal assessment summary or comments. Student names appear only in the Negative Marks / Deductions section. Assessor names are not displayed.</div>

    <section class="class-report-section-block">
      <div class="section-block-heading"><h3>Assessment Marks by Area</h3><span>${esc(reportPeriodLabel(type,period))}</span></div>
      <div class="report-area-summary-grid">${areaCards||'<div class="empty-state">No assessment marks recorded for this period.</div>'}</div>
    </section>

    <section class="class-report-section-block">
      <div class="section-block-heading"><h3>Assessment Comments</h3><span>All comments for the selected period</span></div>
      <div class="class-comments-list">${commentHtml}</div>
    </section>

    <section class="class-report-section-block negative-section-block">
      <div class="section-block-heading"><h3>Negative Marks / Deductions</h3><span>Student details shown only here</span></div>
      ${negativeHtml}
    </section>
  `;

  $("classResult").classList.remove("hidden");
  $("classEmpty").classList.add("hidden");
}

/* =========================================================
   INITIALISATION
   ========================================================= */

function init(){
  fillClasses();

  $('individualClass').addEventListener('change',()=>{
    fillSections($('individualClass').value,$('individualSection'));
    fillStudents();
    renderIndividual();
  });

  $('individualSection').addEventListener('change',()=>{
    fillStudents();
    renderIndividual();
  });

  $('individualStudent').addEventListener('change',renderIndividual);

  $('classReportClass').addEventListener('change',()=>{
    fillSections($('classReportClass').value,$('classReportSection'));
    fillClassReportPeriods();
    renderClass();
  });

  $('classReportSection').addEventListener('change',()=>{
    fillClassReportPeriods();
    renderClass();
  });

  $('classReportPeriodType').addEventListener('change',()=>{
    fillClassReportPeriods();
    renderClass();
  });

  $('classReportPeriod').addEventListener('change',renderClass);

  $('individualTab').addEventListener('click',()=>{
    $('individualTab').classList.add('active');
    $('classTab').classList.remove('active');
    $('individualReport').classList.remove('hidden');
    $('classReport').classList.add('hidden');
  });

  $('classTab').addEventListener('click',()=>{
    $('classTab').classList.add('active');
    $('individualTab').classList.remove('active');
    $('classReport').classList.remove('hidden');
    $('individualReport').classList.add('hidden');
  });

  window.addEventListener('storage',()=>{
    fillClasses();
    renderIndividual();
    renderClass();
  });
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
}else{
  init();
}
