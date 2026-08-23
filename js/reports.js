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

function recordRowsForClass(c,s){
  return records().filter(r=>gradeOf(r.class??r.grade)===c&&sectionOf(r.section??r.stream)===s);
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

  return recordRowsForClass(c,s)
    .filter(r=>r.area==="Discipline")
    .reduce((sum,r)=>{
      const rows=Array.isArray(r.records)?r.records:[];
      return sum+rows.reduce((a,x)=>{
        if(String(x?.studentId??"").trim()!==wantedId)return a;
        const point=Number(x?.point);
        return a+(Number.isFinite(point)?point:0);
      },0);
    },0);
}

function allDisciplinePoints(c,s){
  return recordRowsForClass(c,s)
    .filter(r=>r.area==="Discipline")
    .reduce((sum,r)=>{
      const rows=Array.isArray(r.records)?r.records:[];
      return sum+rows.reduce((a,x)=>{
        if(x?.affectsClassTotal===false)return a;
        const point=Number(x?.point);
        return a+(Number.isFinite(point)?point:0);
      },0);
    },0);
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

  return recordRowsForClass(c,s)
    .filter(r=>r.area==="Discipline")
    .reduce((count,r)=>{
      const rows=Array.isArray(r.records)?r.records:[];

      return count+rows.filter(x=>{
        if(String(x?.studentId??"").trim()!==wantedId)return false;

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

  const disciplineRecords=recordRowsForClass(c,s)
    .filter(r=>r.area==='Discipline')
    .flatMap(r=>(Array.isArray(r.records)?r.records:[])
      .filter(x=>String(x.studentId||'')===String(sid))
      .map(x=>({
        criterion:criterionName(x.criterionId),
        points:Number(x.point)||0,
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

function renderClass(){
  const c=$('classReportClass').value;
  const s=$('classReportSection').value;

  if(!c||!s){
    clearResult('classResult','classEmpty');
    return;
  }

  const sts=studentsFor(c,s);
  const assessmentBase=assessmentBasePoints(c,s);
  const sportsClassPoints=sportsPositionPointsForClass(c,s);
  const base=assessmentBase+sportsClassPoints;
  const disc=allDisciplinePoints(c,s);
  const total=base+disc;
  const max=coreMaxPoints(c,s);
  const gradingScore=base+disc;
  const grade=gradeForScore(gradingScore,max);

  const rows=sts.map((st,i)=>{
    const sid=studentId(st);
    const d=disciplineForStudent(c,s,sid);
    const v=volunteerPointsForStudent(sid);
    const sp=sportsPositionPointsForStudent(sid);
    const participation=sportsParticipationPointsForStudent(sid);
    const t=assessmentBase+d+v+sp+participation;
    const sg=gradeForScore(assessmentBase+d+sp,max);

    return `
      <tr>
        <td>${i+1}</td>
        <td>
          <strong>${esc(studentName(st))}</strong>
          ${st.studentCode?`<small>${esc(st.studentCode)}</small>`:""}
        </td>
        <td class="num">${assessmentBase}</td>
        <td class="num">${sp}</td>
        <td class="num">${participation}</td>
        <td class="num ${d<0?'negative':''}">${d}</td>
        <td class="num"><strong>${t}</strong></td>
        <td class="num"><strong>${sg.percent.toFixed(1)}%</strong></td>
        <td><span class="table-grade">${sg.grade}</span></td>
      </tr>
    `;
  }).join('');

  $('classResult').innerHTML=`
    <div class="report-title-card">
      <div>
        <span class="eyebrow">CLASS REPORT</span>
        <h3>Class ${esc(c)} • ${esc(s)}</h3>
        <p>${sts.length} student${sts.length===1?'':'s'} in this class</p>
      </div>
      <div class="grade-badge">
        <small>Class Grade</small>
        <strong>${grade.grade}</strong>
        <span>${grade.label}</span>
      </div>
    </div>

    <div class="class-summary">
      <div class="summary-box"><small>Grading Score</small><strong>${gradingScore} / ${max}</strong></div>
      <div class="summary-box"><small>Percentage</small><strong>${grade.percent.toFixed(1)}%</strong></div>
      <div class="summary-box"><small>Performance</small><strong>${grade.label}</strong></div>
      <div class="summary-box"><small>Final Class Total</small><strong class="${total<0?'negative':''}">${total}</strong></div>
    </div>

    <div class="grade-legend">
      <strong>Grading Scale</strong>
      <span>A 85–100% Excellent</span>
      <span>B 70–84% Very Good</span>
      <span>C 55–69% Good / Satisfactory</span>
      <span>D 40–54% Needs Improvement</span>
      <span>E 0–39% Poor / Unsatisfactory</span>
    </div>

    <div class="discipline-note">
      Class grading uses <strong>all assessed core points − all Discipline deductions</strong>.
      A Discipline deduction affects the student's individual grade and is also deducted once
      from the class score. Sports Participation and Volunteer points remain individual
      recognition points.
    </div>

    <div class="report-table-wrap">
      <table class="report-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Student</th>
            <th class="num">Assessment</th>
            <th class="num">Sports Position</th>
            <th class="num">Participation</th>
            <th class="num">Discipline</th>
            <th class="num">Total Points</th>
            <th class="num">%</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>
          ${rows||'<tr><td colspan="9" class="empty-state">No students found in this class.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  $('classResult').classList.remove('hidden');
  $('classEmpty').classList.add('hidden');
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
    renderClass();
  });

  $('classReportSection').addEventListener('change',renderClass);

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
