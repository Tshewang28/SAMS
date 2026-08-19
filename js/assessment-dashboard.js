
/* =====================================================
   ASSESSOR-ONLY ACCESS
   The assessment dashboard is for appointed assessors only.
   Administrators may still manage criteria through assessment.html.
   ===================================================== */
function getAccountsForAssessmentAccess(){
  try{
    const raw=localStorage.getItem("sams_accounts");
    const accounts=raw?JSON.parse(raw):[];
    return Array.isArray(accounts)?accounts:[];
  }catch(e){return [];}
}

function getCurrentUserForAssessmentAccess(){
  try{
    const saved=sessionStorage.getItem("sams_current_user");
    if(saved){
      const user=JSON.parse(saved);
      if(user && typeof user==="object") return user;
    }
  }catch(e){}
  const email=String(
    sessionStorage.getItem("sams_email") ||
    localStorage.getItem("sams_email") || ""
  ).trim().toLowerCase();
  if(!email) return null;
  return getAccountsForAssessmentAccess().find(a=>
    String(a.email||a.educationalEmail||a.educational_email||"").trim().toLowerCase()===email
  )||null;
}

function getAssessmentUserRole(user){
  return String(
    user?.role ||
    user?.staffRole ||
    user?.userRole ||
    user?.accountType ||
    user?.type ||
    ""
  ).trim().toLowerCase();
}

function isPrincipalUser(user){
  return getAssessmentUserRole(user)==="principal";
}

function isEligibleAppointedAssessor(user){
  const role=getAssessmentUserRole(user);
  return role==="vice principal" || role==="non-class teacher";
}

function isTrueAssessorFlag(value){
  return value===true || String(value ?? "").trim().toLowerCase()==="true";
}

function isAppointedAssessor(){
  const user=getCurrentUserForAssessmentAccess();
  if(!user) return false;

  // Principal access is limited to Discipline assessment.
  if(isPrincipalUser(user)) return true;

  // Only Vice Principal and Non-Class Teacher can be appointed assessors.
  // Class Teachers can never receive assessment access.
  if(!isEligibleAppointedAssessor(user)) return false;

  // Check the current session first.
  if(
    isTrueAssessorFlag(user.isAssessor) ||
    isTrueAssessorFlag(user.is_assessor)
  ) return true;

  // Then check the registered account by email. This handles cases where
  // Staff Management has updated the appointment but the current session
  // still contains an older user object.
  const email=String(
    user.email||user.educationalEmail||user.educational_email||
    sessionStorage.getItem("sams_email")||
    localStorage.getItem("sams_email")||""
  ).trim().toLowerCase();

  if(!email) return false;

  const account=getAccountsForAssessmentAccess().find(a=>
    String(a.email||a.educationalEmail||a.educational_email||"").trim().toLowerCase()===email
  );

  return !!account && (
    isTrueAssessorFlag(account.isAssessor) ||
    isTrueAssessorFlag(account.is_assessor)
  );
}

const assessmentUser=getCurrentUserForAssessmentAccess();
const assessmentRole=getAssessmentUserRole(assessmentUser);
const administrationAccess=["admin","administrator","administration"].includes(assessmentRole);
const principalDisciplineOnly=isPrincipalUser(assessmentUser);

if(!administrationAccess && !isAppointedAssessor()){
  alert("Access denied. Assessment access is limited to appointed assessors and Principal Discipline assessment.");
  window.location.replace("dashboard.html");
  throw new Error("ASSESSOR_ONLY_ACCESS");
}

const CRITERIA_KEY="sams_assessment_criteria";
const STUDENTS_KEY="sams_students";
const ROLE_KEY="sams_user_role";
const NAME_KEY="sams_user_name";

const classSelect=document.getElementById("classSelect");
const sectionSelect=document.getElementById("sectionSelect");
const areaSelect=document.getElementById("areaSelect");
const studentSelect=document.getElementById("studentSelect");
const classField=document.getElementById("classField");
const sectionField=document.getElementById("sectionField");
const assessmentPanel=document.getElementById("assessmentPanel");
const emptyPanel=document.getElementById("emptyPanel");
const criteriaList=document.getElementById("criteriaList");
const criteriaCount=document.getElementById("criteriaCount");
const title=document.getElementById("assessmentTitle");
const subtitle=document.getElementById("assessmentSubtitle");

const positiveAreas=["Classroom","Assembly","SUPW","Games & Sports"];

// Administration enters this page only to manage assessment criteria.
// Do not expose assessment recording controls to Administration.
if(administrationAccess){
  const roleLabel=document.getElementById("pageRoleLabel");
  if(roleLabel) roleLabel.textContent="ADMINISTRATION • ASSESSMENT CRITERIA MANAGEMENT";

  const selectionCard=document.querySelector(".selection-card");
  const emptyPanel=document.getElementById("emptyPanel");
  const assessmentPanel=document.getElementById("assessmentPanel");
  const criteriaBtn=document.getElementById("criteriaBtn");
  const saveBtn=document.getElementById("saveBtn");

  if(selectionCard) selectionCard.classList.add("hidden");
  if(emptyPanel) emptyPanel.classList.add("hidden");
  if(assessmentPanel) assessmentPanel.classList.remove("hidden");
  if(criteriaBtn){
    criteriaBtn.style.display="";
    criteriaBtn.textContent="Manage Assessment Criteria";
    criteriaBtn.onclick=()=>{ window.location.href="assessment.html"; };
  }
  if(saveBtn) saveBtn.style.display="none";

  const criteriaListEl=document.getElementById("criteriaList");
  if(criteriaListEl){
    criteriaListEl.innerHTML='<div class="no-criteria"><strong>Administration access</strong><br><br>Use <strong>Manage Assessment Criteria</strong> to create, edit and delete the criteria used by assessors.</div>';
  }
  const countEl=document.getElementById("criteriaCount");
  if(countEl) countEl.textContent="Administration";
}

// Principals assess Discipline only, but MUST still select the Class and Section.
// Do not hide or replace the Class/Section controls. Other roles keep their
// existing assessment behaviour unchanged.
if(principalDisciplineOnly){
  [...areaSelect.options].forEach(option=>{
    if(option.value && option.value!=="Discipline") option.remove();
  });

  areaSelect.value="Discipline";

  const roleLabel=document.getElementById("pageRoleLabel");
  if(roleLabel) roleLabel.textContent="PRINCIPAL • DISCIPLINE ASSESSMENT";
  const note=document.querySelector(".frequency-note");
  if(note) note.innerHTML="Principal can record <strong>Discipline</strong> assessment for the selected class and section.";
}

function readJSON(key,fallback=[]){try{return JSON.parse(localStorage.getItem(key))||fallback}catch(e){return fallback}}
function escapeHTML(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

document.getElementById("assessorName").textContent=localStorage.getItem(NAME_KEY)||"Assessor";
document.getElementById("welcomeName")?.remove?.();

const role=(localStorage.getItem(ROLE_KEY)||"Assessment Teacher").trim();
document.getElementById("assessorRole").textContent=role;

const admin=/administrator|admin/i.test(role);
const adminTools = document.getElementById("adminTools");
if (adminTools) {
  adminTools.style.display = admin ? "flex" : "none";
}

function normalizeGradeValue(v){
  let s=String(v ?? "").trim().toUpperCase();
  s=s.replace(/^GRADE\s*/,"").replace(/^CLASS\s*/,"").trim();
  const romanToNumber={IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12};
  const numberToRoman={4:"IV",5:"V",6:"VI",7:"VII",8:"VIII",9:"IX",10:"X",11:"XI",12:"XII"};
  if(romanToNumber[s]) return String(romanToNumber[s]);
  const n=parseInt(s,10);
  if(numberToRoman[n]) return String(n);
  return s;
}

function normalizeSectionValue(v){
  return String(v ?? "").trim().toUpperCase();
}

function getClassRows(){
  const rows=readJSON("sams_classes",[]);
  return Array.isArray(rows) ? rows : [];
}

// Return the unique grades/classes available in the shared class register.
// The assessment page previously called getAvailableClasses() without
// defining it, which stopped the assessment selection initialization and
// left the dependent Section / Stream selector empty.
function getAvailableClasses(){
  const rows=getClassRows();
  const found=[];
  const seen=new Set();

  rows.forEach(c=>{
    const grade=String(getClassGrade(c) ?? "").trim();
    if(!grade) return;

    const normalized=normalizeGradeValue(grade);
    const key=normalized || grade.toUpperCase();
    if(seen.has(key)) return;

    seen.add(key);
    found.push(grade.toUpperCase());
  });

  // Keep the selector usable even if the shared class register has not
  // reached localStorage yet. This does not alter the stored class data.
  if(!found.length){
    return ["IV","V","VI","VII","VIII","IX","X","XI","XII"];
  }

  const order=["IV","V","VI","VII","VIII","IX","X","XI","XII"];
  return found.sort((x,y)=>{
    const nx=normalizeGradeValue(x), ny=normalizeGradeValue(y);
    const ix=order.findIndex(v=>normalizeGradeValue(v)===nx);
    const iy=order.findIndex(v=>normalizeGradeValue(v)===ny);
    if(ix>=0 && iy>=0) return ix-iy;
    if(ix>=0) return -1;
    if(iy>=0) return 1;
    return x.localeCompare(y);
  });
}

function getStudents(){
  const rows=readJSON(STUDENTS_KEY,[]);
  return Array.isArray(rows) ? rows : [];
}

function getClassGrade(c){
  return c?.grade ?? c?.className ?? c?.class ?? c?.Class ?? c?.Grade ?? "";
}

function getClassSection(c){
  const section=String(c?.section ?? c?.Section ?? "").trim();
  const stream=String(c?.stream ?? c?.Stream ?? "").trim();
  return section || stream;
}

function getStudentGrade(s){
  return s?.Class ?? s?.class ?? s?.grade ?? s?.Grade ?? s?.className ?? s?.class_name ?? s?.gradeName ?? s?.grade_name ?? "";
}

function getStudentSection(s){
  return s?.["Section/Stream"] ?? s?.section ?? s?.stream ?? s?.Section ?? s?.Stream ?? s?.sectionStream ?? s?.section_stream ?? s?.sectionName ?? s?.section_name ?? "";
}

function getStudentClassId(s){
  return s?.classId ?? s?.class_id ?? s?.classID ?? s?.classid ?? "";
}

function getStudentIdValue(s){
  return s?.id ?? s?.studentId ?? s?.student_id ?? s?.studentCode ?? s?.student_code ?? s?.code ?? s?.name ?? s?.studentName ?? s?.student_name ?? "";
}

function getStudentNameValue(s){
  return s?.name ?? s?.studentName ?? s?.student_name ?? s?.["Student Name"] ?? "Unnamed Student";
}

function getStudentCodeValue(s){
  return s?.studentCode ?? s?.student_code ?? s?.code ?? "";
}

function getStudentsForSelection(selectedClass, selectedSection){
  const all=getStudents();
  const classRows=getClassRows();
  const wantedClass=normalizeGradeValue(selectedClass);
  const wantedSection=normalizeSectionValue(selectedSection);
  if(!wantedClass || !wantedSection) return [];

  // Resolve every class record matching the selected Grade + Section/Stream.
  // Older SAMS records may use id, classId, class_id, or may have no id at all.
  const matchingClasses=classRows.filter(c => {
    const grade=normalizeGradeValue(getClassGrade(c));
    const section=normalizeSectionValue(c?.section ?? c?.Section ?? "");
    const stream=normalizeSectionValue(c?.stream ?? c?.Stream ?? "");
    return grade===wantedClass && (section===wantedSection || stream===wantedSection);
  });
  const matchingIds=new Set();
  matchingClasses.forEach(c=>{
    [c?.id,c?.classId,c?.class_id,c?.classID].forEach(v=>{
      if(v!==undefined && v!==null && String(v).trim()) matchingIds.add(String(v).trim());
    });
  });

  const result=all.filter(st=>{
    const sid=String(getStudentClassId(st)).trim();

    // Strongest match: the student's class id points to a selected class.
    if(sid && matchingIds.has(sid)) return true;

    // Direct student grade + section fields (supports imported spreadsheets).
    const sg=normalizeGradeValue(getStudentGrade(st));
    const ss=normalizeSectionValue(getStudentSection(st));
    if(sg===wantedClass && ss===wantedSection) return true;

    // Resolve the student's class reference even when the class id is stored
    // under an older field name.
    if(sid){
      const cls=classRows.find(c=>[c?.id,c?.classId,c?.class_id,c?.classID].some(v=>String(v??"").trim()===sid));
      if(cls){
        const cg=normalizeGradeValue(getClassGrade(cls));
        const cs=normalizeSectionValue(cls?.section ?? cls?.Section ?? "");
        const ct=normalizeSectionValue(cls?.stream ?? cls?.Stream ?? "");
        if(cg===wantedClass && (cs===wantedSection || ct===wantedSection)) return true;
      }
    }

    return false;
  });

  const seen=new Set();
  return result.filter(st=>{
    const key=String(getStudentIdValue(st)).trim();
    if(!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getSections(selectedClass){
  const wantedClass=normalizeGradeValue(selectedClass);
  if(!wantedClass) return [];

  const values=[];
  const classRows=getClassRows();
  const students=getStudents();

  // Primary source: the class register.
  classRows.forEach(c=>{
    if(normalizeGradeValue(getClassGrade(c))!==wantedClass) return;

    const section=String(c?.section ?? c?.Section ?? "").trim();
    const stream=String(c?.stream ?? c?.Stream ?? "").trim();
    const value=section || stream;
    if(!value) return;

    const label=(stream && stream.toUpperCase()!=="GENERAL" && section)
      ? `${section} / ${stream}`
      : value;

    if(!values.some(x=>normalizeSectionValue(x.value)===normalizeSectionValue(value))){
      values.push({value,label});
    }
  });

  // Fallback: imported student records may contain class/section directly.
  students.forEach(s=>{
    if(normalizeGradeValue(getStudentGrade(s))!==wantedClass) return;

    const section=String(getStudentSection(s)).trim();
    if(section && !values.some(v=>normalizeSectionValue(v.value)===normalizeSectionValue(section))){
      values.push({value:section,label:section});
    }
  });

  // Last-resort school section choices if no class register exists yet.
  if(!values.length){
    ["A","B","C","D","E","F"].forEach(x=>values.push({value:x,label:x}));
    if(wantedClass==="11" || wantedClass==="12"){
      ["Arts","Commerce","Science"].forEach(x=>{
        if(!values.some(v=>normalizeSectionValue(v.value)===normalizeSectionValue(x))){
          values.push({value:x,label:x});
        }
      });
    }
  }

  const order=["A","B","C","D","E","F","G","Arts","Commerce","Science"];
  return values.sort((a,b)=>{
    const ia=order.findIndex(x=>normalizeSectionValue(x)===normalizeSectionValue(a.value));
    const ib=order.findIndex(x=>normalizeSectionValue(x)===normalizeSectionValue(b.value));
    if(ia>=0 && ib>=0) return ia-ib;
    if(ia>=0) return -1;
    if(ib>=0) return 1;
    return a.label.localeCompare(b.label);
  });
}

function populateStudents(preserveValue=""){
  if(!studentSelect) return;

  const c=classSelect.value;
  const s=sectionSelect.value;

  if(!c || !s){
    studentSelect.disabled=true;
    studentSelect.innerHTML='<option value="">Select Class and Section first</option>';
    return;
  }

  const students=getStudentsForSelection(c,s);
  studentSelect.disabled=students.length===0;

  studentSelect.innerHTML=
    '<option value="">'+
    (students.length ? 'Select Student' : 'No students found for this class and section')+
    '</option>'+
    students.map(st=>{
      const id=getStudentIdValue(st);
      const code=getStudentCodeValue(st);
      const name=getStudentNameValue(st);
      const label=code ? `${name} — ${code}` : name;
      return `<option value="${escapeHTML(id)}">${escapeHTML(label)}</option>`;
    }).join("");

  if(preserveValue && students.some(st=>String(getStudentIdValue(st))===String(preserveValue))){
    studentSelect.value=preserveValue;
  }
}

function populateClasses(){
  classSelect.innerHTML=
    '<option value="">Select Class</option>'+
    getAvailableClasses().map(x=>`<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join("");
}

function populateSections(){
  const c=classSelect.value;
  const sections=getSections(c);

  // Explicitly enable the selector. This is important after cloud/local
  // data loading because older builds left the dependent selector disabled.
  sectionSelect.disabled=false;
  sectionSelect.innerHTML=
    '<option value="">Select Section / Stream</option>'+
    sections.map(x=>`<option value="${escapeHTML(x.value)}">${escapeHTML(x.label)}</option>`).join("");

  if(studentSelect){
    studentSelect.disabled=true;
    studentSelect.innerHTML='<option value="">Select Class and Section first</option>';
  }

  areaSelect.value="";
  resetAssessment();
}

function updateStudentSelection(){
  populateStudents();
}
function resetAssessment(){
  assessmentPanel.classList.add("hidden");
  emptyPanel.classList.remove("hidden");
}
function getCriteriaForArea(area){
  return readJSON(CRITERIA_KEY,[]).filter(x=>x.area===area);
}


function getGamesSportsRecords() {
  return readJSON("sams_assessment_records", []).filter(x => x.area === "Games & Sports");
}

function normalizeSportName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Position uniqueness is enforced separately for each Sports Category + Sport.
// Example: Junior Football can have one 1st, while Senior Football can also have one 1st.
function getPositionAvailability(category, sportName) {
  const used = new Set();
  const normalizedSport = normalizeSportName(sportName);

  getGamesSportsRecords().forEach(record => {
    const r=record.records?.[0];
    if(r && r.sportsCategory===category &&
       normalizeSportName(r.gameSport)===normalizedSport && r.position) {
      used.add(r.position);
    }
  });
  return used;
}

function renderAssessment(){
  const c=classSelect.value,s=sectionSelect.value,a=areaSelect.value;
  if(!c||!s||!a){resetAssessment();return}

  const previousStudentId=studentSelect?.value||"";
  populateStudents(previousStudentId);
  const criteria=getCriteriaForArea(a);
  assessmentPanel.classList.remove("hidden");
  emptyPanel.classList.add("hidden");
  title.textContent=`${a} Assessment`;
  const selectedStudent = studentSelect?.selectedOptions?.[0]?.textContent || "";
  subtitle.textContent = `Class ${c} • Section / Stream ${s}` +
    (selectedStudent && !/^Select |^No students/.test(selectedStudent) ? ` • ${selectedStudent}` : "");
  criteriaCount.textContent=`${criteria.length} Criteria`;

  if(!criteria.length){
    criteriaList.innerHTML='<div class="no-criteria">No criteria have been created for this area yet. Please contact the Administrator.</div>';
    return;
  }

  if(a==="Games & Sports"){
    criteriaList.innerHTML=`
      <div class="sports-entry">
        <div class="sports-header">
          <div>
            <div class="criteria-number">GAMES & SPORTS</div>
            <div class="criteria-name">Games & Sports Achievement</div>
            <div class="criteria-description">
              Select the sports category, game/sport and position.
              1st = 5 points, 2nd = 4 points and 3rd = 3 points.
              Position awarding is separate for Primary, Junior and Senior.
            </div>
          </div>
          <div class="point-auto">Automatic Points<br><strong id="sportsAutoPoint">—</strong></div>
        </div>
        <div class="sports-fields">
          <div>
            <label for="sportsCategory">Sports Category</label>
            <select id="sportsCategory">
              <option value="">Select category</option>
              <option value="Primary">Primary</option>
              <option value="Junior">Junior</option>
              <option value="Senior">Senior</option>
            </select>
          </div>
          <div>
            <label for="sportsPosition">Position</label>
            <select id="sportsPosition" disabled>
              <option value="">Select category and sport first</option>
            </select>
          </div>
          <div>
            <label for="sportsType">Type of Game / Sport</label>
            <input id="sportsType" type="text" maxlength="100" placeholder="e.g. Football, Table Tennis, Cross Country">
            <small>Names are automatically formatted: Football, Table Tennis, Cross Country.</small>
          </div>
          <div>
            <label for="sportsComment">Assessor Comment</label>
            <textarea id="sportsComment" rows="4" placeholder="Write assessor comment..."></textarea>
          </div>
        </div>
      </div>`;

    const category=document.getElementById("sportsCategory");
    const pos=document.getElementById("sportsPosition");
    const sport=document.getElementById("sportsType");
    const auto=document.getElementById("sportsAutoPoint");

    function refreshSportsPositions(){
      const cat=category.value;
      const sportName=normalizeSportName(sport.value);
      if(!cat || !sportName){
        pos.disabled=true;
        pos.innerHTML='<option value="">Select category and sport first</option>';
        auto.textContent="—";
        return;
      }

      const used=getPositionAvailability(cat,sportName);
      const positions=[
        {value:"1",label:"1st",points:5},
        {value:"2",label:"2nd",points:4},
        {value:"3",label:"3rd",points:3}
      ];

      pos.disabled=false;
      pos.innerHTML='<option value="">Select position</option>'+
        positions.map(p=>{
          const disabled=used.has(p.label)?"disabled":"";
          return `<option value="${p.value}" ${disabled}>${p.label} (+${p.points})${disabled?" — Already awarded":""}</option>`;
        }).join("");

      // Default to the next available position to prevent accidental duplicate awarding.
      const available=positions.find(p=>!used.has(p.label));
      pos.value=available ? available.value : "";
      auto.textContent=pos.value ? `+${positions.find(p=>p.value===pos.value).points}` : "No position available";
    }

    category.addEventListener("change",refreshSportsPositions);
    sport.addEventListener("input",()=>{
      sport.value=normalizeSportName(sport.value);
      refreshSportsPositions();
    });
    sport.addEventListener("blur",()=>{
      sport.value=normalizeSportName(sport.value);
      refreshSportsPositions();
    });
    pos.addEventListener("change",()=>{
      const points={1:5,2:4,3:3};
      auto.textContent=pos.value ? `+${points[pos.value]}` : "—";
    });
    return;
  }

  // Discipline is a student-specific deduction that also contributes once to the class total.
  // Each criterion is assigned to the selected student only; it is never copied to other students.
  if(a==="Discipline"){
    const students=getStudentsForSelection(c,s);

    // Discipline uses the MAIN Student selector at the top of the page.
    // The criteria below are a compact checklist; there is no repeated
    // student dropdown for every criterion.
    criteriaList.innerHTML=`
      <div class="discipline-checklist-intro">
        <div>
          <div class="criteria-number">INDIVIDUAL DISCIPLINE</div>
          <div class="criteria-name">Select the student, then tick the applicable discipline criteria.</div>
          <div class="criteria-description">Only the selected student's report is affected. The sum of all checked deductions is also deducted once from the class total.</div>
        </div>
        <div class="discipline-student-count">${students.length} student${students.length===1?"":"s"} available in Class ${escapeHTML(c)} • ${escapeHTML(s)}</div>
      </div>
      <div class="discipline-checklist">
        <div class="discipline-checklist-header"><span></span><strong>Criterion</strong><strong>Deduction</strong></div>
        ${criteria.map((x,i)=>`
          <label class="discipline-check-row" data-id="${escapeHTML(x.id)}">
            <span class="discipline-check-select"><input type="checkbox" class="discipline-check" data-id="${escapeHTML(x.id)}"></span>
            <span class="discipline-check-name"><strong>${escapeHTML(x.name)}</strong>${x.description?`<small>${escapeHTML(x.description)}</small>`:""}</span>
            <span class="discipline-check-point">${x.point!==undefined && x.point!==null && x.point!=="" ? escapeHTML(String(x.point)) : "Not configured"}</span>
          </label>`).join("")}
      </div>
      <div class="discipline-total-bar">
        <span><strong id="disciplineSelectedCount">0</strong> criteria selected</span>
        <span>Total Discipline Deduction: <strong id="disciplineTotal">0</strong></span>
      </div>
      <div class="discipline-comment-wrap">
        <label>Discipline / Assessor Comment</label>
        <textarea id="disciplineComment" rows="3" placeholder="Write one comment for this discipline entry..."></textarea>
      </div>`;

    const checks=[...criteriaList.querySelectorAll('.discipline-check')];
    const countEl=document.getElementById('disciplineSelectedCount');
    const totalEl=document.getElementById('disciplineTotal');
    const updateTotal=()=>{
      let total=0;
      checks.forEach(ch=>{
        if(!ch.checked) return;
        const criterion=criteria.find(x=>String(x.id)===String(ch.dataset.id));
        const n=Number(criterion?.point);
        if(Number.isFinite(n)) total+=n;
      });
      if(countEl) countEl.textContent=String(checks.filter(x=>x.checked).length);
      if(totalEl){
        totalEl.textContent=total>0?`+${total}`:String(total);
        totalEl.classList.toggle('negative',total<0);
      }
    };
    checks.forEach(ch=>ch.addEventListener('change',updateTotal));
    updateTotal();
    return;
  }

  // Other assessment areas continue to use positive 0 to 5 points.
  const points=[0,1,2,3,4,5];
  criteriaList.innerHTML=criteria.map((x,i)=>`
    <article class="criteria-card" data-id="${escapeHTML(x.id)}">
      <div class="criteria-main">
        <div>
          <div class="criteria-number">CRITERION ${i+1}</div>
          <div class="criteria-name">${escapeHTML(x.name)}</div>
          <div class="criteria-description">${escapeHTML(x.description)||"No description provided."}</div>
        </div>
        <div class="point-select">
          <label>Point</label>
          <select class="score">
            <option value="">Select</option>
            ${points.map(p=>`<option value="${p}">${p}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="comment-box">
        <label>Assessor Comment</label>
        <textarea class="comment" placeholder="Write assessor comment for this criterion..."></textarea>
      </div>
    </article>
  `).join("");
}

function getWeekKey(dateValue){
  const d=new Date(dateValue);
  if(Number.isNaN(d.getTime())) return "";
  // Use the local calendar week (Monday-Sunday) so a normal school week
  // allows one assessment for Classroom, Assembly and SUPW.
  const day=d.getDay();
  const diff=day===0 ? -6 : 1-day;
  d.setHours(0,0,0,0);
  d.setDate(d.getDate()+diff);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function hasWeeklyAssessment(c,s,a){
  if(a==="Discipline" || a==="Games & Sports") return false;
  const currentWeek=getWeekKey(new Date());
  return readJSON("sams_assessment_records",[]).some(record=>
    record.class===c &&
    record.section===s &&
    record.area===a &&
    getWeekKey(record.savedAt)===currentWeek
  );
}

function saveAssessment(){
  const c=classSelect.value,s=sectionSelect.value,a=areaSelect.value;
  if(principalDisciplineOnly){
    // Principal uses the hidden internal ALL values.
    if(!a) return alert("Discipline assessment is not available.");
  }else if(!c||!s||!a){
    return alert("Please select Class, Section/Stream and Area of Assessment.");
  }

  if(principalDisciplineOnly && a!=="Discipline"){
    return alert("Principals are permitted to assess Discipline only.");
  }

  // Classroom, Assembly and SUPW are assessed once per week for each
  // class/section. Discipline and Games & Sports have no frequency limit.
  if(hasWeeklyAssessment(c,s,a)){
    return alert(`${a} assessment has already been recorded for Class ${c}, Section/Stream ${s} this week. It can be assessed again next week.`);
  }

  let records=[];

  if(a==="Games & Sports"){
    const category=document.getElementById("sportsCategory")?.value;
    const position=document.getElementById("sportsPosition")?.value;
    const sport=normalizeSportName(document.getElementById("sportsType")?.value||"");
    const comment=document.getElementById("sportsComment")?.value.trim()||"";
    const points={1:5,2:4,3:3};

    if(!category)return alert("Please select Primary, Junior or Senior sports category.");
    if(!sport)return alert("Please enter the type of game or sport.");
    if(!position)return alert("No position is available for this sport in the selected category.");

    const positionLabel=`${position}${position==="1"?"st":position==="2"?"nd":"rd"}`;
    if(getPositionAvailability(category,sport).has(positionLabel)){
      return alert(`${positionLabel} has already been awarded for ${sport} in the ${category} category.`);
    }

    records=[{
      criterionId:"GAMES-SPORTS-POSITION",
      sportsCategory:category,
      position:positionLabel,
      gameSport:sport,
      point:points[position],
      comment
    }];
  }else if(a==="Discipline"){
    const selectedId=studentSelect?.value||"";
    if(!selectedId) return alert("Please select a student before recording Discipline.");

    const students=getStudentsForSelection(c,s);
    const selectedStudent=students.find(st=>String(getStudentIdValue(st))===String(selectedId));
    if(!selectedStudent) return alert("The selected student could not be found in the selected class/section.");

    const selectedChecks=[...document.querySelectorAll(".discipline-check:checked")];
    if(!selectedChecks.length) return alert("Please tick at least one discipline criterion.");

    const criteriaSource=readJSON("sams_assessment_criteria",[]);
    const comment=document.getElementById("disciplineComment")?.value.trim()||"";
    records=[];

    for(const check of selectedChecks){
      const criterion=criteriaSource.find(x=>String(x.id)===String(check.dataset.id));
      const deduction=criterion?.point;
      if(deduction===undefined || deduction===null || deduction==="" || Number.isNaN(Number(deduction))){
        return alert(`No deduction point has been configured for discipline criterion "${criterion?.name||"Unknown"}". Please configure it in Assessment Criteria.`);
      }
      records.push({
        criterionId:check.dataset.id,
        point:Number(deduction),
        comment,
        studentId:getStudentIdValue(selectedStudent),
        studentName:getStudentNameValue(selectedStudent),
        studentCode:getStudentCodeValue(selectedStudent),
        individualOnly:true,
        affectsClassTotal:true
      });
    }

  }else{
    records=[...document.querySelectorAll(".criteria-card")].map(card=>({
      criterionId:card.dataset.id,
      point:card.querySelector(".score").value===""?null:Number(card.querySelector(".score").value),
      comment:card.querySelector(".comment").value.trim()
    }));

    if(records.some(x=>x.point===null))
      return alert("Please enter a point for every criterion before saving.");
  }

  const selectedStudentId = studentSelect?.value || "";
  const selectedStudents = getStudentsForSelection(c,s);
  const selectedStudent = selectedStudents.find(st => String(getStudentIdValue(st)) === String(selectedStudentId));

  const all=readJSON("sams_assessment_records",[]);
  all.push({
    id:"AR-"+Date.now(),
    class:c,
    section:s,
    area:a,
    studentId: selectedStudent ? getStudentIdValue(selectedStudent) : "",
    studentName: selectedStudent ? getStudentNameValue(selectedStudent) : "",
    studentCode: selectedStudent ? getStudentCodeValue(selectedStudent) : "",
    assessor:localStorage.getItem(NAME_KEY)||"Assessor",
    assessorRole:role,
    records,
    individualOnly:a==="Discipline",
    affectsClassTotal:true,
    savedAt:new Date().toISOString()
  });
  localStorage.setItem("sams_assessment_records",JSON.stringify(all));

  const btn=document.getElementById("saveBtn");
  const old=btn.textContent;
  btn.textContent="Saved ✓";
  btn.classList.add("success");
  setTimeout(()=>{btn.textContent=old;btn.classList.remove("success")},1600);
}


classSelect.addEventListener("change",populateSections);
sectionSelect.addEventListener("change",()=>{ populateStudents(); renderAssessment(); });
studentSelect?.addEventListener("change",renderAssessment);
areaSelect.addEventListener("change",renderAssessment);
document.getElementById("saveBtn").addEventListener("click",saveAssessment);
document.getElementById("criteriaBtn").addEventListener("click",()=>location.href="assessment.html");


// Compact Discipline checklist styling. Injected here so the redesign works
// even when the deployed assessment stylesheet is an older version.
(function injectDisciplineChecklistStyles(){
  if(document.getElementById("disciplineChecklistStyles")) return;
  const style=document.createElement("style");
  style.id="disciplineChecklistStyles";
  style.textContent=`
    .discipline-checklist-intro{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding:18px 20px;margin-bottom:14px;border:1px solid #dbe5f0;border-radius:14px;background:#f8fbff}
    .discipline-student-count{font-size:13px;font-weight:700;color:#4f6b86;white-space:nowrap}
    .discipline-checklist{border:1px solid #dbe5f0;border-radius:14px;overflow:hidden;background:#fff}
    .discipline-checklist-header,.discipline-check-row{display:grid;grid-template-columns:56px 1fr 130px;align-items:center;gap:12px;padding:13px 16px}
    .discipline-checklist-header{background:#f4f7fb;color:#31506d;font-size:13px;text-transform:uppercase;letter-spacing:.04em}
    .discipline-check-row{border-top:1px solid #e6edf4;cursor:pointer;transition:background .15s}
    .discipline-check-row:hover{background:#f8fbff}
    .discipline-check-row:has(input:checked){background:#eef6ff}
    .discipline-check-select{display:flex;justify-content:center}
    .discipline-check{width:20px;height:20px;cursor:pointer}
    .discipline-check-name{display:flex;flex-direction:column;gap:3px;color:#183b5b}
    .discipline-check-name small{font-size:12px;font-weight:400;color:#6d8296;line-height:1.4}
    .discipline-check-point{text-align:right;font-weight:800;color:#b42318}
    .discipline-total-bar{display:flex;justify-content:space-between;gap:16px;margin-top:14px;padding:14px 18px;border-radius:12px;background:#f4f7fb;color:#38556f}
    .discipline-total-bar #disciplineTotal{font-size:18px;color:#b42318}
    .discipline-comment-wrap{margin-top:14px}
    .discipline-comment-wrap textarea{width:100%;box-sizing:border-box}
    @media(max-width:700px){.discipline-checklist-intro,.discipline-total-bar{flex-direction:column}.discipline-student-count{white-space:normal}.discipline-checklist-header,.discipline-check-row{grid-template-columns:42px 1fr 90px;padding:12px 10px}.discipline-check-point{font-size:13px}}
  `;
  document.head.appendChild(style);
})();

// Load the shared class/student register before building the dependent
// dropdowns. The cloud bridge is asynchronous, so populating the Section
// and Student controls immediately on page load can happen before
// sams_classes and sams_students have arrived in localStorage.
async function initializeAssessmentSelections(){
  try{
    if(window.samsCloud && typeof window.samsCloud.pullAll === "function"){
      await window.samsCloud.pullAll();
    }
  }catch(e){
    console.warn("SAMS assessment cloud data could not be refreshed; using local data.",e);
  }

  const previousClass=classSelect.value;
  populateClasses();

  // Preserve a class already selected by the user/browser if it still exists.
  if(previousClass && [...classSelect.options].some(o=>o.value===previousClass)){
    classSelect.value=previousClass;
  }

  populateSections();

  if(principalDisciplineOnly){
    // Keep the normal Class and Section selectors visible for Principal.
    // Only the assessment area is restricted to Discipline.
    areaSelect.innerHTML='<option value="Discipline">Discipline</option>';
    areaSelect.value="Discipline";
    resetAssessment();
  }
}

initializeAssessmentSelections();