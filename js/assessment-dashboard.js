
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
  return s?.Class ?? s?.class ?? s?.grade ?? s?.Grade ?? "";
}

function getStudentSection(s){
  return s?.["Section/Stream"] ?? s?.section ?? s?.stream ?? s?.Section ?? s?.Stream ?? "";
}

function getStudentsForSelection(selectedClass, selectedSection){
  const all=getStudents();
  const classRows=getClassRows();

  const wantedClass=normalizeGradeValue(selectedClass);
  const wantedSection=normalizeSectionValue(selectedSection);

  if(!wantedClass || !wantedSection) return [];

  // Build the exact class IDs belonging to the selected Grade + Section/Stream.
  const matchingClassIds=new Set(
    classRows
      .filter(c =>
        normalizeGradeValue(getClassGrade(c))===wantedClass &&
        normalizeSectionValue(getClassSection(c))===wantedSection
      )
      .map(c=>String(c?.id ?? "").trim())
      .filter(Boolean)
  );

  const result=all.filter(s=>{
    // 1. Preferred source: student.classId -> sams_classes.
    if(s?.classId && matchingClassIds.has(String(s.classId).trim())) return true;

    // 2. Direct imported student fields.
    const studentGrade=normalizeGradeValue(getStudentGrade(s));
    const studentSection=normalizeSectionValue(getStudentSection(s));
    if(studentGrade===wantedClass && studentSection===wantedSection) return true;

    // 3. Resolve classId even when the class table uses numeric/Roman grade names.
    if(s?.classId){
      const cls=classRows.find(c=>String(c?.id ?? "").trim()===String(s.classId).trim());
      if(cls){
        return normalizeGradeValue(getClassGrade(cls))===wantedClass &&
               normalizeSectionValue(getClassSection(cls))===wantedSection;
      }
    }

    return false;
  });

  const seen=new Set();
  return result.filter(s=>{
    const key=String(s?.id ?? s?.studentCode ?? s?.code ?? s?.name ?? "").trim();
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

function populateStudents(){
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
      const id=st?.id || st?.studentCode || st?.code || st?.name || "";
      const code=st?.studentCode || st?.code || "";
      const name=st?.name || st?.studentName || st?.["Student Name"] || "Unnamed Student";
      const label=code ? `${name} — ${code}` : name;
      return `<option value="${escapeHTML(id)}">${escapeHTML(label)}</option>`;
    }).join("");
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

  populateStudents();
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
  // Compact checklist design: select one student, then tick only applicable criteria.
  if(a==="Discipline"){
    const students=getStudentsForSelection(c,s);
    const studentOptions=students.map(st=>{
      const id=st.id||st.studentCode||st.name||"";
      const code=st.studentCode||st.code||"";
      const name=st.name||st.studentName||st["Student Name"]||"Unnamed Student";
      const label=code ? `${name} — ${code}` : name;
      return `<option value="${escapeHTML(id)}">${escapeHTML(label)}</option>`;
    }).join("");

    if(studentSelect){
      studentSelect.innerHTML='<option value="">Select Student</option>'+studentOptions;
      studentSelect.disabled=!students.length;
    }

    if(!document.getElementById("compactDisciplineStyles")){
      const style=document.createElement("style");
      style.id="compactDisciplineStyles";
      style.textContent=`
        .discipline-checklist{display:flex;flex-direction:column;gap:8px;margin-top:16px}
        .discipline-check-row{border:1px solid #e5e7eb;border-radius:10px;background:#fff;overflow:hidden;transition:.15s ease}
        .discipline-check-row.selected{border-color:#cbd5e1;box-shadow:0 2px 8px rgba(0,0,0,.05)}
        .discipline-check-main{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px 14px}
        .discipline-check-main input{width:19px;height:19px;cursor:pointer}
        .discipline-check-name{font-weight:700;color:#111827}
        .discipline-check-description{font-size:.82rem;color:#6b7280;margin-top:3px}
        .discipline-check-points{font-weight:800;white-space:nowrap;color:#b91c1c}
        .discipline-comment-wrap{display:none;padding:0 14px 13px 58px}
        .discipline-check-row.selected .discipline-comment-wrap{display:block}
        .discipline-comment-wrap label{display:block;font-size:.8rem;font-weight:700;margin-bottom:5px}
        .discipline-comment-wrap textarea{width:100%;min-height:68px;resize:vertical}
        .discipline-summary{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:14px;padding:13px 15px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0}
        .discipline-summary strong{font-size:1.05rem}.discipline-total{color:#b91c1c}
        .discipline-empty-note{padding:14px;border-radius:10px;background:#f8fafc;color:#64748b;text-align:center;margin-top:12px}
        @media(max-width:600px){.discipline-check-main{grid-template-columns:30px minmax(0,1fr) auto;padding:11px 10px}.discipline-comment-wrap{padding-left:50px;padding-right:10px}.discipline-summary{align-items:flex-start;flex-direction:column}}
      `;
      document.head.appendChild(style);
    }

    criteriaList.innerHTML=`
      <div class="discipline-student-box">
        <div class="discipline-student-info">
          <div class="criteria-number">INDIVIDUAL DISCIPLINE</div>
          <div class="criteria-name">Select the student, then tick the applicable discipline criteria.</div>
          <div class="criteria-description">Only checked criteria are recorded. Each deduction affects this student only and is counted once in the class total.</div>
          <div class="discipline-student-count">${students.length} student${students.length===1?"":"s"} available${principalDisciplineOnly ? " across all classes and sections" : ` in Class ${escapeHTML(c)} • ${escapeHTML(s)}`}</div>
        </div>
      </div>
      <div class="discipline-checklist" id="disciplineChecklist">
        ${criteria.map(x=>{
          const point=(x.point!==undefined&&x.point!==null&&x.point!=="")?Number(x.point):null;
          const pointText=point===null||Number.isNaN(point)?"Not configured":`${point>0?"-":""}${Math.abs(point)}`;
          return `<article class="discipline-check-row" data-id="${escapeHTML(x.id)}">
            <div class="discipline-check-main">
              <input type="checkbox" class="discipline-check" aria-label="Select ${escapeHTML(x.name)}">
              <div><div class="discipline-check-name">${escapeHTML(x.name)}</div>${x.description?`<div class="discipline-check-description">${escapeHTML(x.description)}</div>`:""}</div>
              <div class="discipline-check-points">${escapeHTML(pointText)}</div>
            </div>
            <div class="discipline-comment-wrap"><label>Comment <span class="muted">(optional)</span></label><textarea class="discipline-comment" placeholder="Write a brief comment about this incident..."></textarea></div>
          </article>`;
        }).join("")}
      </div>
      <div class="discipline-summary"><div><span id="disciplineSelectedCount">0</span> incident<span id="disciplinePlural">s</span> selected</div><div>Total Discipline Deduction: <strong class="discipline-total" id="disciplineTotal">0</strong></div></div>
      <div class="discipline-empty-note" id="disciplineStudentHint">Select a student above before selecting a discipline criterion.</div>
    `;

    const checklist=document.getElementById("disciplineChecklist");
    const updateSummary=()=>{
      const selected=[...checklist.querySelectorAll(".discipline-check:checked")];
      let total=0;
      selected.forEach(box=>{
        const row=box.closest(".discipline-check-row");
        const criterion=criteria.find(x=>String(x.id)===String(row?.dataset.id));
        const p=Number(criterion?.point);
        if(Number.isFinite(p)) total+=p;
      });
      document.getElementById("disciplineSelectedCount").textContent=selected.length;
      document.getElementById("disciplinePlural").textContent=selected.length===1?"":"s";
      document.getElementById("disciplineTotal").textContent=total;
    };
    checklist.querySelectorAll(".discipline-check").forEach(box=>box.addEventListener("change",()=>{
      const row=box.closest(".discipline-check-row"); row.classList.toggle("selected",box.checked);
      if(!box.checked){const comment=row.querySelector(".discipline-comment");if(comment)comment.value="";}
      updateSummary();
    }));
    const applyStudentState=()=>{
      const hasStudent=!!studentSelect?.value;
      checklist.querySelectorAll(".discipline-check").forEach(box=>{box.disabled=!hasStudent;if(!hasStudent&&box.checked){box.checked=false;box.closest(".discipline-check-row")?.classList.remove("selected")}});
      const hint=document.getElementById("disciplineStudentHint");
      if(hint)hint.textContent=hasStudent?"Tick every discipline criterion that applies to this student.":"Select a student above before selecting a discipline criterion.";
      updateSummary();
    };
    studentSelect?.addEventListener("change",applyStudentState);
    applyStudentState();
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
    const students=getStudentsForSelection(c,s);
    const selectedStudentId=studentSelect?.value||"";
    const selectedStudent=students.find(st=>String(st.id||st.studentCode||st.name)===String(selectedStudentId));
    const cards=[...document.querySelectorAll(".discipline-check-row")];

    if(!selectedStudent) return alert("Please select a student before recording Discipline.");
    const checked=cards.filter(card=>card.querySelector(".discipline-check")?.checked);
    if(!checked.length) return alert("Please tick at least one discipline criterion.");

    records=[];
    for(const card of checked){
      const criterion=readJSON("sams_assessment_criteria",[]).find(x=>String(x.id)===String(card.dataset.id));
      const deduction=criterion?.point;
      if(deduction===undefined||deduction===null||deduction===""||Number.isNaN(Number(deduction)))
        return alert(`No deduction point has been configured for discipline criterion "${criterion?.name||"Unknown"}". Please configure it in Assessment Criteria.`);
      records.push({
        criterionId:card.dataset.id,
        point:Number(deduction),
        comment:card.querySelector(".discipline-comment")?.value.trim()||"",
        studentId:selectedStudent.id||selectedStudent.studentCode||selectedStudent.name,
        studentName:selectedStudent.name||selectedStudent.studentName||selectedStudent["Student Name"]||"",
        studentCode:selectedStudent.studentCode||selectedStudent.code||"",
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
  const selectedStudent = selectedStudents.find(st => String(st.id||st.studentCode||st.name) === String(selectedStudentId));

  const all=readJSON("sams_assessment_records",[]);
  all.push({
    id:"AR-"+Date.now(),
    class:c,
    section:s,
    area:a,
    studentId: selectedStudent ? (selectedStudent.id||selectedStudent.studentCode||selectedStudent.name) : "",
    studentName: selectedStudent ? (selectedStudent.name||selectedStudent.studentName||selectedStudent["Student Name"]||"") : "",
    studentCode: selectedStudent ? (selectedStudent.studentCode||selectedStudent.code||"") : "",
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
