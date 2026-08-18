function classSection(c){return String(c?.section||c?.stream||'');}
function classGrade(c){return String(c?.grade||c?.className||c?.class||'');}
function studentName(s){return String(s?.name||s?.studentName||s?.fullName||'Unnamed Student');}
function readLS(key,fallback=[]){
  try{
    const v=JSON.parse(localStorage.getItem(key)||'null');
    return Array.isArray(v)?v:(v||fallback);
  }catch(e){return fallback;}
}
function writeLS(key,value){
  localStorage.setItem(key,JSON.stringify(value));
}
(function(){
'use strict';

const CLASSES_KEY='sams_classes';
const ACCOUNTS_KEY='sams_accounts';
const STUDENTS_KEY='sams_students';
const $=id=>document.getElementById(id);

const divisionGrades={
  '4-6':['IV','V','VI'],
  '7-9':['VII','VIII','IX'],
  '10-12':['X','XI','XII']
};
const divisionNames={'4-6':'4–6','7-9':'7–9','10-12':'10–12'};
let selectedDivision='4-6';
let selectedClassId=null;

// Matches the uploaded Lamgong HSS Data Base 2026.xlsx structure.
const EXCEL_HEADERS=['Name','Class','Gender','Students Code','Section/Stream'];

const defaultClassRows=[
  ['4-6','IV','A','General'],['4-6','IV','B','General'],['4-6','IV','C','General'],
  ['4-6','V','A','General'],['4-6','V','B','General'],['4-6','V','C','General'],
  ['4-6','VI','A','General'],['4-6','VI','B','General'],['4-6','VI','C','General'],['4-6','VI','D','General'],
  ['7-9','VII','A','General'],['7-9','VII','B','General'],['7-9','VII','C','General'],
  ['7-9','VIII','A','General'],['7-9','VIII','B','General'],['7-9','VIII','C','General'],
  ['7-9','IX','A','General'],['7-9','IX','B','General'],['7-9','IX','C','General'],
  ['10-12','X','A','General'],['10-12','X','B','General'],['10-12','X','C','General'],
  ['10-12','XI','Arts','Arts'],['10-12','XI','Commerce','Commerce'],['10-12','XI','Science','Science'],
  ['10-12','XII','Arts','Arts'],['10-12','XII','Science','Science']
];

function makeDefaultClasses(){
  return defaultClassRows.map((r,i)=>({
    id:`class-${r[1].toLowerCase()}-${String(r[2]).toLowerCase()}-${i}`,
    division:r[0],grade:r[1],section:r[2],stream:r[3],classTeacher:'',academicYear:'2026'
  }));
}
function read(k,f){try{const x=localStorage.getItem(k);return x?JSON.parse(x):f}catch(e){return f}}
function saveClasses(x){localStorage.setItem(CLASSES_KEY,JSON.stringify(x))}
function classes(){
  let x=read(CLASSES_KEY,null);
  // If an older/empty browser session has sams_classes as [], rebuild the
  // standard class structure so the Class Teacher workspace is never blank.
  if(!Array.isArray(x)||x.length===0){
    x=makeDefaultClasses();
    saveClasses(x);
  }
  // Normalize older records without changing their assignments.
  x=x.map((c,i)=>{
    const grade=String(c?.grade||'').trim().toUpperCase();
    const section=String(c?.section||'').trim().toUpperCase();
    const stream=String(c?.stream||'General').trim()||'General';
    return {
      ...c,
      id:c?.id||`class-${grade.toLowerCase()}-${section.toLowerCase()}-${i}`,
      division:c?.division||divisionForGrade(grade)||'4-6',
      grade,section,stream,
      classTeacher:c?.classTeacher||'',
      academicYear:c?.academicYear||'2026'
    };
  });
  return x;
}
function students(){return read(STUDENTS_KEY,[])}
function saveStudents(x){localStorage.setItem(STUDENTS_KEY,JSON.stringify(x))}
function accounts(){return read(ACCOUNTS_KEY,[])}
function normalizeRole(value){
  const r=String(value||'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
  const map={
    admin:'Administrator', administrator:'Administrator',
    principal:'Principal',
    'vice principal':'Vice Principal', viceprincipal:'Vice Principal',
    'class teacher':'Class Teacher', classteacher:'Class Teacher',
    'non class teacher':'Non-Class Teacher', nonclassteacher:'Non-Class Teacher'
  };
  return map[r]||String(value||'').trim();
}
function currentUser(){
  // The email in the active session is the stable identity. Local storage is
  // only a cache; a fresh Supabase profile is hydrated during init below.
  const sessionEmail=String(sessionStorage.getItem('sams_email')||'').trim().toLowerCase();
  const sessionName=String(sessionStorage.getItem('sams_user_name')||'').trim().toLowerCase();
  const list=accounts();
  let a=null;
  if(sessionEmail) a=list.find(x=>String(x.email||x.educationalEmail||x.educational_email||'').trim().toLowerCase()===sessionEmail)||null;
  if(!a && sessionName) a=list.find(x=>String(x.name||x.fullName||x.staffName||'').trim().toLowerCase()===sessionName)||null;
  if(a){
    const canonical={...a,role:normalizeRole(a.role||a.staffRole||a.userRole||a.accountType||'')};
    sessionStorage.setItem('sams_current_user',JSON.stringify(canonical));
    sessionStorage.setItem('sams_user_role',canonical.role||'');
    sessionStorage.setItem('sams_user_name',canonical.name||canonical.fullName||canonical.staffName||'');
    return canonical;
  }
  try{
    const x=sessionStorage.getItem('sams_current_user');
    if(x){const u=JSON.parse(x);if(u&&typeof u==='object')return {...u,role:normalizeRole(u.role||u.staffRole||u.userRole||u.accountType||'')};}
  }catch(e){}
  return null;
}
function userRole(){return String(currentUser()?.role||currentUser()?.staffRole||currentUser()?.userRole||currentUser()?.accountType||'').trim().toLowerCase()}

// Supabase profiles are the authoritative source for class/section assignment.
// This prevents stale localStorage from making an assigned Class Teacher appear
// as "Not assigned" or from denying Games & Sports on another device.
let cloudUserHydrated=false;
let cloudTeacherAssignments=[];

function profileRoleIsClassTeacher(p){
  const r=String(p?.role||p?.staffRole||p?.userRole||p?.accountType||'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
  return r==='class teacher';
}

function profileMatchesClass(p,c){
  if(!p||!c)return false;
  const ac=String(p.assigned_class??p.assignedClass??'').trim();
  const as=String(p.assigned_section??p.assignedSection??'').trim();
  const ast=String(p.assigned_stream??p.assignedStream??'').trim();
  if(!ac || String(romanGradeNumber(c.grade))!==String(romanGradeNumber(ac)))return false;
  if(as && !/^no section$/i.test(as) && !same(as,c.section))return false;
  if(ast && !/^general$/i.test(ast) && !same(ast,c.stream))return false;
  return true;
}

function cloudClassTeacher(c){
  if(!c)return '';
  const p=cloudTeacherAssignments.find(x=>profileRoleIsClassTeacher(x)&&profileMatchesClass(x,c));
  return p ? teacherName(p) : '';
}

function effectiveClassTeacher(c){
  return cloudClassTeacher(c) || String(c?.classTeacher||'').trim();
}

async function hydrateClassTeacherAssignmentsFromCloud(){
  if(!window.samsSupabase)return;
  try{
    const {data,error}=await window.samsSupabase
      .from('profiles')
      .select('id,full_name,email,name,display_name,role,assigned_class,assigned_section,assigned_stream')
      .limit(1000);
    if(error){
      console.warn('SAMS class-teacher assignment hydration failed:',error);
      return;
    }
    cloudTeacherAssignments=Array.isArray(data)?data.filter(profileRoleIsClassTeacher):[];
    // Keep the browser cache aligned with the authoritative profile data for
    // the current device, but never use it as the source of truth.
    const list=accounts();
    cloudTeacherAssignments.forEach(p=>{
      const email=String(p.email||'').trim().toLowerCase();
      if(!email)return;
      const idx=list.findIndex(a=>String(a.email||a.educationalEmail||a.educational_email||'').trim().toLowerCase()===email);
      const merged={
        ...(idx>=0?list[idx]:{}),
        id:p.id||'',
        name:p.full_name||p.fullName||p.name||p.display_name||'',
        email:p.email||email,
        role:normalizeRole(p.role||'Class Teacher'),
        assignedClass:p.assigned_class??'',
        assignedSection:p.assigned_section??'',
        assignedStream:p.assigned_stream??''
      };
      if(idx>=0)list[idx]=merged; else list.push(merged);
    });
    writeLS(ACCOUNTS_KEY,list);
  }catch(e){console.warn('SAMS class-teacher assignment hydration error:',e)}
}

async function hydrateCurrentUserFromCloud(){
  if(cloudUserHydrated)return currentUser();
  cloudUserHydrated=true;
  const email=String(sessionStorage.getItem('sams_email')||currentUser()?.email||'').trim().toLowerCase();
  if(!email||!window.samsSupabase)return currentUser();
  try{
    const {data,error}=await window.samsSupabase.from('profiles').select('*').eq('email',email).maybeSingle();
    if(error){console.warn('SAMS profile hydration failed:',error);return currentUser();}
    if(!data)return currentUser();
    const old=currentUser()||{};
    const merged={
      ...old,
      id:data.id||old.id||'',
      name:data.full_name||data.fullName||data.name||data.display_name||old.name||old.fullName||old.staffName||'',
      email:data.email||email,
      role:normalizeRole(data.role||old.role||old.staffRole||old.userRole||old.accountType||''),
      status:data.status||old.status||'active',
      active:data.active ?? old.active ?? true,
      isAssessor:data.is_assessor ?? data.isAssessor ?? old.isAssessor ?? false,
      assignedClass:data.assigned_class ?? data.assignedClass ?? old.assignedClass ?? '',
      assignedSection:data.assigned_section ?? data.assignedSection ?? old.assignedSection ?? '',
      assignedStream:data.assigned_stream ?? data.assignedStream ?? old.assignedStream ?? ''
    };
    const list=accounts();
    const idx=list.findIndex(a=>String(a.email||a.educationalEmail||a.educational_email||'').trim().toLowerCase()===email);
    if(idx>=0)list[idx]={...list[idx],...merged};else list.push(merged);
    writeLS(ACCOUNTS_KEY,list);
    sessionStorage.setItem('sams_current_user',JSON.stringify(merged));
    sessionStorage.setItem('sams_email',String(merged.email||email).toLowerCase());
    sessionStorage.setItem('sams_user_name',teacherName(merged));
    sessionStorage.setItem('sams_user_role',merged.role||'');
    return merged;
  }catch(e){console.warn('SAMS profile hydration error:',e);return currentUser();}
}
function isAdmin(){return userRole().includes('admin')}
function teacherName(t){return String(t?.name||t?.fullName||t?.staffName||[t?.firstName,t?.lastName].filter(Boolean).join(' ')||t?.email||'').trim()}
function loggedInTeacherName(){return teacherName(currentUser())}
function same(a,b){return String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase()}
function romanGradeNumber(v){
  const s=String(v||'').trim().toUpperCase();
  const m={IV:'4',V:'5',VI:'6',VII:'7',VIII:'8',IX:'9',X:'10',XI:'11',XII:'12'};
  return m[s]||s;
}
function assignedClassMatches(c,u){
  if(!c||!u)return false;
  const ac=String(u.assignedClass??u.assigned_class??u.classAssignment??'').trim();
  const as=String(u.assignedSection??u.assigned_section??u.section??'').trim();
  const ast=String(u.assignedStream??u.assigned_stream??u.stream??'').trim();
  if(!ac)return false;
  if(String(romanGradeNumber(c.grade))!==String(romanGradeNumber(ac)))return false;
  if(as && !/^no section$/i.test(as) && !same(as,c.section))return false;
  if(ast && !/^general$/i.test(ast) && !same(ast,c.stream))return false;
  return true;
}
function teacherCanManage(c){
  const u=currentUser();
  return isAdmin() || !!(c && (
    (effectiveClassTeacher(c) && same(effectiveClassTeacher(c),loggedInTeacherName())) ||
    assignedClassMatches(c,u) ||
    cloudTeacherAssignments.some(p=>profileRoleIsClassTeacher(p) && same(p.email,u?.email) && profileMatchesClass(p,c))
  ));
}
// Games & Sports is deliberately stricter than the general Classes workspace:
// ONLY an account whose role is exactly "Class Teacher" may enter/delete records.
// Principal, Vice Principal, Administrator, Non-Class Teacher and other staff
// are never permitted, even if they have administrator/assignment access.
function isClassTeacherRole(){
  const role=userRole().replace(/[_-]+/g,' ').replace(/\\s+/g,' ').trim();
  return role==='class teacher';
}
function canManageGamesSports(c){
  return isClassTeacherRole() && !!c && teacherCanManage(c) && !isAdmin();
}
function canManageVolunteerRecord(c){
  // Volunteer RECORD entry is Class Teacher-only.
  // The separate Volunteer Programme Description remains available to
  // authenticated staff who organise a programme, as required previously.
  return isClassTeacherRole() && !!c && teacherCanManage(c) && !isAdmin();
}
function volunteerRecordEnabledKey(classId){
  return `sams_volunteer_record_enabled_${classId}`;
}
function volunteerRecordEnabled(classId){
  return classId ? localStorage.getItem(volunteerRecordEnabledKey(classId)) === '1' : false;
}
function setVolunteerRecordEnabled(classId, enabled){
  if(!classId)return;
  if(enabled)localStorage.setItem(volunteerRecordEnabledKey(classId),'1');
  else localStorage.removeItem(volunteerRecordEnabledKey(classId));
}
function classStudents(id){return students().filter(s=>s.classId===id)}
function setupUser(){
  const u=currentUser();
  $('userName').textContent=teacherName(u)||'User';
  $('userRole').textContent=String(u?.role||u?.accountType||'User');
  $('userAvatar').textContent=(teacherName(u)||'U').charAt(0).toUpperCase();
  const addClassBtn=$('addClassBtn');
  if(addClassBtn) addClassBtn.hidden=!isAdmin();
  const wholeImportBtn=$('importWorkbookBtn');
  if(wholeImportBtn) wholeImportBtn.hidden=!isAdmin();
  const note=$('teacherWorkspaceNote');
  if(note) note.hidden=isAdmin();
}
function renderDivisionCounts(){
  const all=classes();
  ['4-6','7-9','10-12'].forEach(d=>{
    const n=all.filter(c=>c.division===d && classVisible(c)).length;
    $('count'+d.replace('-','')).textContent=`${n} class${n===1?'':'es'}`;
  });
}
function classVisible(c){return isAdmin() || teacherCanManage(c)}
function populateTeachers(selected=''){
  const sel=$('classTeacher');
  const staff=accounts().filter(a=>!String(a.role||a.accountType||'').toLowerCase().includes('admin'));
  sel.innerHTML='<option value="">Not assigned</option>'+staff.map(a=>`<option value="${escapeHtml(teacherName(a))}">${escapeHtml(teacherName(a))}</option>`).join('');
  sel.value=selected||'';
}
function populateGrades(div,selected=''){
  $('grade').innerHTML=divisionGrades[div].map(g=>`<option value="${g}">${g}</option>`).join('');
  if(selected) $('grade').value=selected;
}
function render(){
  const all=classes(), q=$('searchInput').value.toLowerCase(), stream=$('streamFilter').value;
  let visible=all.filter(c=>c.division===selectedDivision&&classVisible(c));
  visible=visible.filter(c=>(!q||`${c.grade} ${c.section} ${c.stream} ${c.classTeacher}`.toLowerCase().includes(q))&&(stream==='all'||c.stream===stream));
  const body=$('classTableBody'); body.innerHTML=''; $('emptyState').hidden=visible.length>0;
  visible.forEach(c=>{
    const n=classStudents(c.id).length;
    const teacherActions=isAdmin()?`<button class="icon-button" data-action="edit" data-id="${c.id}" title="Edit class">✎</button>`:'';
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><span class="class-name">Grade ${escapeHtml(c.grade)} – ${escapeHtml(c.section)}</span></td><td>${escapeHtml(c.section)}</td><td><span class="badge ${String(c.stream).toLowerCase()}">${escapeHtml(c.stream)}</span></td><td class="teacher">${c.classTeacher?escapeHtml(c.classTeacher):'<span class="muted">Not assigned</span>'}</td><td><strong>${n}</strong></td><td>${escapeHtml(c.academicYear||'2026')}</td><td><div class="actions"><button class="icon-button" data-action="students" data-id="${c.id}" title="Open class dashboard">👥</button>${teacherActions}<button class="icon-button delete" data-action="delete" data-id="${c.id}" title="Delete class">⌫</button></div></td>`;
    body.appendChild(tr);
  });
  $('totalClasses').textContent=visible.length;
  $('assignedTeachers').textContent=visible.filter(c=>c.classTeacher).length;
  $('totalStudents').textContent=visible.reduce((a,c)=>a+classStudents(c.id).length,0);
  $('divisionLabel').textContent=divisionNames[selectedDivision];
  $('divisionTitle').textContent=`Classes ${divisionNames[selectedDivision]}`;
  renderDivisionCounts();
  populateStreamFilter(all.filter(c=>c.division===selectedDivision));
}
function populateStreamFilter(items){
  const old=$('streamFilter').value;
  const vals=[...new Set(items.map(c=>c.stream).filter(Boolean))];
  $('streamFilter').innerHTML='<option value="all">All streams</option>'+vals.map(v=>`<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join('');
  if(vals.includes(old))$('streamFilter').value=old;
}
function openModal(id,item){
  const m=$(id);m.classList.add('show');m.setAttribute('aria-hidden','false');
  if(id==='classModal'){
    populateTeachers(item?.classTeacher||'');
    populateGrades(item?.division||selectedDivision,item?.grade||'');
    $('classId').value=item?.id||'';$('division').value=item?.division||selectedDivision;$('section').value=item?.section||'';
    $('stream').value=item?.stream||'General';$('academicYear').value=item?.academicYear||'2026';
    $('modalTitle').textContent=item?'Edit Class':'Create Class';
  }
}
function closeModal(id){const m=$(id);if(!m)return;m.classList.remove('show');m.setAttribute('aria-hidden','true')}
function saveClass(e){
  e.preventDefault();if(!isAdmin())return;
  const arr=classes(),id=$('classId').value||`class-${Date.now()}`;
  const r={id,division:$('division').value,grade:$('grade').value,section:$('section').value.trim().toUpperCase(),stream:$('stream').value,classTeacher:$('classTeacher').value,academicYear:$('academicYear').value.trim()};
  const dup=arr.find(c=>c.id!==id&&c.division===r.division&&c.grade===r.grade&&c.section===r.section&&c.stream===r.stream);
  if(dup)return alert('This class already exists.');
  const i=arr.findIndex(c=>c.id===id);if(i>=0)arr[i]=r;else arr.push(r);saveClasses(arr);
  closeModal('classModal');selectedDivision=r.division;syncDivisionButtons();render();
}
function deleteClass(id){
  const c=classes().find(x=>x.id===id);if(!c||!teacherCanManage(c))return;
  if(!confirm(`Delete Grade ${c.grade} – ${c.section}? This removes the class and all students in it.`))return;
  saveClasses(classes().filter(x=>x.id!==id));saveStudents(students().filter(s=>s.classId!==id));
  if(selectedClassId===id){selectedClassId=null;closeModal('studentModal')};render();
}
function openStudents(id){
  const c=classes().find(x=>x.id===id);if(!c||!teacherCanManage(c))return;
  selectedClassId=id;
  $('studentModalTitle').textContent=`Grade ${c.grade} – ${c.section}`;
  $('studentModalSub').textContent=`${c.stream} • Class Teacher: ${c.classTeacher||'Not assigned'}`;
  $('deleteWholeClassBtn').disabled=!teacherCanManage(c);
  $('deleteAllStudentsBtn').hidden=!isAdmin();
  $('importWorkbookClassBtn').hidden=false;
  $('studentSearch').value='';
  renderStudents();openModal('studentModal');
}
function renderStudents(){
  const q=$('studentSearch').value.toLowerCase();
  const all=classStudents(selectedClassId);
  const arr=all.filter(s=>`${s.studentCode} ${s.name} ${s.gender}`.toLowerCase().includes(q));
  const body=$('studentTableBody');body.innerHTML='';$('studentEmpty').hidden=arr.length>0;
  $('studentCountLabel').textContent=`${all.length} student${all.length===1?'':'s'}`;
  arr.forEach((s,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${i+1}</td><td>${escapeHtml(s.studentCode)}</td><td><strong>${escapeHtml(s.name)}</strong></td><td>${escapeHtml(s.gender)}</td><td><input class="volunteer-input" data-volunteer-id="${s.id}" value="${escapeAttr(s.volunteer||'')}" placeholder="Volunteer / role"></td><td><button type="button" class="save-volunteer-button" data-save-volunteer-id="${s.id}">Save</button></td><td><div class="actions"><button class="icon-button" data-student-action="edit" data-id="${s.id}">✎</button><button class="icon-button delete" data-student-action="delete" data-id="${s.id}">⌫</button></div></td>`;
    body.appendChild(tr);
  });
}
function openStudentForm(s){
  $('studentFormTitle').textContent=s?'Edit Student':'Add Student';$('studentId').value=s?.id||'';$('studentCode').value=s?.studentCode||'';$('studentName').value=s?.name||'';$('studentGender').value=s?.gender||'Male';
  openModal('studentFormModal');setTimeout(()=>$('studentCode').focus(),50);
}
function saveStudent(e){
  e.preventDefault();const c=classes().find(x=>x.id===selectedClassId);if(!c||!teacherCanManage(c))return;
  const arr=students(),id=$('studentId').value||`student-${Date.now()}`,code=$('studentCode').value.trim(),name=$('studentName').value.trim(),gender=$('studentGender').value;
  if(!code||!name)return;
  const dup=arr.find(s=>s.classId===selectedClassId&&same(s.studentCode,code)&&s.id!==id);if(dup)return alert('Student Code already exists in this class.');
  const existing=arr.find(s=>s.id===id);const rec={id,classId:selectedClassId,studentCode:code,name,gender,volunteer:existing?.volunteer||''};const i=arr.findIndex(s=>s.id===id);if(i>=0)arr[i]=rec;else arr.push(rec);
  saveStudents(arr);closeModal('studentFormModal');renderStudents();render();
}
function deleteStudent(id){
  const c=classes().find(x=>x.id===selectedClassId);if(!c||!teacherCanManage(c))return;
  const s=students().find(x=>x.id===id);if(!s)return;if(!confirm(`Delete ${s.name} from this class?`))return;
  saveStudents(students().filter(x=>x.id!==id));renderStudents();render();
}
function saveVolunteerValue(studentId,value){
  const c=classes().find(x=>x.id===selectedClassId);if(!c||!teacherCanManage(c))return;
  const arr=students();const i=arr.findIndex(x=>String(x.id)===String(studentId));if(i<0)return;
  arr[i].volunteer=String(value??'').trim();saveStudents(arr);
}

// ---------- Excel import based on the uploaded workbook ----------
function normalizeHeader(v){return String(v??'').trim().toLowerCase().replace(/\s+/g,' ')}
function cleanValue(v){return String(v??'').trim()}
function parseExcelFile(file,onRows){
  if(typeof XLSX==='undefined')return alert('Excel support is not loaded. Check your internet connection and reload the page.');
  if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
      if(!rows.length)return alert('The Excel file has no student records.');
      const normalizedHeaders=Object.keys(rows[0]).map(normalizeHeader);
      const required=EXCEL_HEADERS.map(normalizeHeader);
      const missing=required.filter(h=>!normalizedHeaders.includes(h));
      if(missing.length)return alert(`Incorrect Excel format. Missing column(s): ${missing.join(', ')}`);
      onRows(rows);
    }catch(err){console.error(err);alert('Could not read the Excel file. Please use the supplied Lamgong HSS format.')}
  };
  reader.readAsArrayBuffer(file);
}
function rowValue(row,header){
  const key=Object.keys(row).find(k=>normalizeHeader(k)===normalizeHeader(header));
  return key===undefined?'':cleanValue(row[key]);
}
function divisionForGrade(g){
  if(['IV','V','VI'].includes(g))return '4-6';
  if(['VII','VIII','IX'].includes(g))return '7-9';
  if(['X','XI','XII'].includes(g))return '10-12';
  return null;
}
function findOrCreateClass(grade,section,stream,allowCreate=true){
  const arr=classes();
  let c=arr.find(x=>same(x.grade,grade)&&same(x.section,section)&&same(x.stream,stream));
  if(c)return c;
  if(!allowCreate)return null;
  const div=divisionForGrade(grade);if(!div)return null;
  c={id:`class-${grade.toLowerCase()}-${section.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,division:div,grade,section,stream,classTeacher:'',academicYear:'2026'};
  arr.push(c);saveClasses(arr);return c;
}
function importSelectedClass(file,classId=null){
  const id=classId||selectedClassId;
  const c=classes().find(x=>x.id===id);if(!c||!teacherCanManage(c))return;
  parseExcelFile(file,rows=>{
    const matching=rows.filter(r=>{
      const grade=rowValue(r,'Class').toUpperCase();
      const sec=rowValue(r,'Section/Stream');
      return same(grade,c.grade)&&same(sec,c.section);
    });
    if(!matching.length)return alert(`No rows in the Excel file match Grade ${c.grade} – ${c.section}.`);
    if(!confirm(`Replace all ${classStudents(c.id).length} existing students in Grade ${c.grade} – ${c.section} with ${matching.length} students from the Excel file?`))return;
    const others=students().filter(s=>s.classId!==c.id);
    const imported=buildStudentRecords(matching,c,classStudents(c.id));
    saveStudents([...others,...imported]);
    renderStudents();render();
    alert(`Class imported successfully: ${imported.length} students loaded.`);
  });
}
function importWholeWorkbook(file){
  if(!isAdmin()||!file)return;
  parseExcelFile(file,rows=>{
    const grouped=new Map();
    rows.forEach(r=>{
      const grade=rowValue(r,'Class').toUpperCase();
      const section=rowValue(r,'Section/Stream');
      if(!grade||!section)return;
      const div=divisionForGrade(grade);if(!div)return;
      const stream=['XI','XII'].includes(grade)?section:'General';
      const key=`${grade}|${section}`;
      if(!grouped.has(key))grouped.set(key,{grade,section,stream,rows:[]});
      grouped.get(key).rows.push(r);
    });
    if(!grouped.size)return alert('No valid Grade/Class and Section/Stream records were found.');
    const summary=[...grouped.values()].map(g=>`${g.grade}-${g.section}: ${g.rows.length}`).join('\n');
    if(!confirm(`This will REPLACE the students in these classes with the Excel data:\n\n${summary}\n\nContinue?`))return;
    let allStudents=students();
    let total=0;
    grouped.forEach(g=>{
      const c=findOrCreateClass(g.grade,g.section,g.stream,true);
      if(!c)return;
      allStudents=allStudents.filter(s=>s.classId!==c.id);
      const existingForClass=allStudents.filter(s=>s.classId===c.id);const imported=buildStudentRecords(g.rows,c,existingForClass);allStudents.push(...imported);total+=imported.length;
    });
    saveStudents(allStudents);render();
    if(selectedClassId&&grouped.size)renderStudents();
    alert(`Whole database import completed. ${total} students imported across ${grouped.size} classes.`);
  });
}
function buildStudentRecords(rows,c,existingStudents=[]){
  const seen=new Set();const out=[];const oldByCode=new Map(existingStudents.map(s=>[String(s.studentCode||'').trim().toLowerCase(),s]));
  rows.forEach((r,i)=>{
    const name=rowValue(r,'Name');const code=rowValue(r,'Students Code');const gender=rowValue(r,'Gender')||'Male';
    if(!name||!code)return;
    const key=code.toLowerCase();if(seen.has(key))return;seen.add(key);
    const old=oldByCode.get(key);out.push({id:old?.id||`student-${Date.now()}-${i}-${Math.random().toString(36).slice(2,8)}`,classId:c.id,studentCode:code,name,gender,volunteer:old?.volunteer||''});
  });
  return out;
}
function deleteAllStudents(){
  const c=classes().find(x=>x.id===selectedClassId);if(!c||!isAdmin())return;
  const n=classStudents(c.id).length;if(!n)return alert('There are no students to delete in this class.');
  if(!confirm(`Delete ALL ${n} students from Grade ${c.grade} – ${c.section}? The class itself will remain.`))return;
  saveStudents(students().filter(s=>s.classId!==c.id));renderStudents();render();
}
function downloadTemplate(){
  if(typeof XLSX==='undefined')return alert('Excel support is not loaded. Reload the page and try again.');
  const rows=[EXCEL_HEADERS,['Sample Student','IV','Male','206.00043.21.0004','A']];
  const ws=XLSX.utils.aoa_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'For App');
  XLSX.writeFile(wb,'Lamgong_HSS_Student_Import_Template.xlsx');
}
function syncDivisionButtons(){document.querySelectorAll('.division-card').forEach(x=>x.classList.toggle('active',x.dataset.division===selectedDivision))}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function escapeAttr(v){return escapeHtml(v)}
function logout(){
  ['sams_current_user','sams_email','sams_user_name','sams_user_role','sams_logged_in'].forEach(k=>sessionStorage.removeItem(k));
  ['sams_current_user','sams_email','sams_user_name','sams_user_role','sams_logged_in'].forEach(k=>localStorage.removeItem(k));
  window.location.replace('index.html');
}


const VOLUNTEER_KEY='sams_volunteer_records';
const VOLUNTEER_PROGRAM_KEY='sams_volunteer_programs';
let workspaceClassId=null;

function volunteerRecords(){
  const x=read(VOLUNTEER_KEY,[]);
  return Array.isArray(x)?x:[];
}
function saveVolunteerRecords(x){localStorage.setItem(VOLUNTEER_KEY,JSON.stringify(x))}

function volunteerPrograms(){
  const x=read(VOLUNTEER_PROGRAM_KEY,{});
  return x && typeof x==='object' && !Array.isArray(x) ? x : {};
}
function saveVolunteerPrograms(x){
  localStorage.setItem(VOLUNTEER_PROGRAM_KEY,JSON.stringify(x));
}
function getVolunteerProgram(classId){
  return volunteerPrograms()[String(classId)] || {};
}
function saveVolunteerProgramDescription(classId,description){
  if(!classId) return;
  const programs=volunteerPrograms();
  const u=currentUser();
  const clean=String(description||'').trim();
  const existing=programs[String(classId)]||{};
  programs[String(classId)]={
    ...existing,
    description:clean,
    updatedBy:teacherName(u),
    updatedByEmail:u?.email||'',
    updatedAt:new Date().toISOString()
  };
  saveVolunteerPrograms(programs);
}
function canEnterVolunteerProgramme(){
  // Volunteer programme entry is available to every authenticated staff
  // member. It is not restricted by Class Teacher status.
  const u=currentUser();
  if(!u) return false;
  const role=String(u.role||u.staffRole||u.accountType||'').trim().toLowerCase();
  return !!role || !!u.email;
}
function workspaceClasses(){
  return classes().slice().sort((a,b)=>{
    const ga=Number(romanGradeNumber(a.grade)),gb=Number(romanGradeNumber(b.grade));
    return ga-gb||String(a.section||'').localeCompare(String(b.section||''));
  });
}
function workspaceClassOptions(){
  const sel=$('workspaceClass');if(!sel)return;
  const list=workspaceClasses();
  const oldGrade=sel.value;
  const grades=[...new Set(list.map(c=>String(c.grade||'').trim().toUpperCase()).filter(Boolean))]
    .sort((a,b)=>Number(romanGradeNumber(a))-Number(romanGradeNumber(b)));
  sel.innerHTML='<option value="">Select Class</option>'+
    grades.map(g=>`<option value="${escapeAttr(g)}">${escapeHtml(g)}</option>`).join('');
  if(oldGrade&&grades.includes(oldGrade))sel.value=oldGrade;
}
function workspaceSectionOptions(grade){
  const sel=$('workspaceSection');if(!sel)return;
  const g=String(grade||'').trim().toUpperCase();
  if(!g){
    sel.innerHTML='<option value="">Select Section</option>';
    sel.disabled=true;
    return;
  }
  const list=classes()
    .filter(x=>same(x.grade,g))
    .sort((a,b)=>String(a.section||'').localeCompare(String(b.section||'')));
  sel.innerHTML='<option value="">Select Section</option>'+
    list.map(x=>`<option value="${escapeAttr(x.id)}">${escapeHtml(x.section)}${x.stream&&x.stream!=='General'?` • ${escapeHtml(x.stream)}`:''}</option>`).join('');
  sel.disabled=false;
}
function workspaceOwnClass(){
  const u=currentUser();
  return classes().find(c=>assignedClassMatches(c,u)) ||
         classes().find(c=>cloudTeacherAssignments.some(p=>profileRoleIsClassTeacher(p)&&same(p.email,u?.email)&&profileMatchesClass(p,c))) ||
         classes().find(c=>effectiveClassTeacher(c)&&same(effectiveClassTeacher(c),loggedInTeacherName()))||null;
}
function renderWorkspace(){
  const body=$('workspaceStudentBody');if(!body)return;
  const badge=$('workspaceRoleBadge');
  const editable=canEnterVolunteerProgramme();
  const c=classes().find(x=>x.id===workspaceClassId);
  syncVolunteerRecordPanel();
  badge.textContent=editable?'Volunteer Programme Entry':'View Only';
  badge.classList.toggle('editable',editable);
  body.innerHTML='';
  if(!c){
    $('workspaceClassTitle').textContent='—';
    $('workspaceTeacher').textContent='—';
    $('workspaceStudentCount').textContent='0';
    $('workspaceEmpty').hidden=false;
    return;
  }

  const sts=classStudents(c.id);
  $('workspaceClassTitle').textContent=`Grade ${c.grade} • Section ${c.section}${c.stream&&c.stream!=='General'?` • ${c.stream}`:''}`;

  // Supabase staff assignment is authoritative. The local class record is
  // only a fallback for legacy classes. This keeps every device consistent.
  let teacher=effectiveClassTeacher(c);
  if(!teacher){
    const assigned=accounts().find(a=>profileRoleIsClassTeacher(a)&&assignedClassMatches(c,a));
    if(assigned)teacher=teacherName(assigned);
  }
  $('workspaceTeacher').textContent=teacher||'Not assigned';
  $('workspaceStudentCount').textContent=String(sts.length);

  const programme=getVolunteerProgram(c.id);
  const descriptionField=$('volunteerProgramDescription');
  const descriptionMeta=$('volunteerProgramMeta');
  if(descriptionField){
    descriptionField.value=String(programme.description||'');
    descriptionField.disabled=!canEnterVolunteerProgramme();
  }
  if(descriptionMeta){
    if(programme.updatedAt){
      const when=new Date(programme.updatedAt);
      const by=programme.updatedBy||'Staff member';
      descriptionMeta.textContent=`Last updated by ${by} on ${when.toLocaleDateString()}`;
    }else{
      descriptionMeta.textContent='No programme description has been added yet.';
    }
  }

  $('workspaceEmpty').hidden=sts.length>0;

  const recs=volunteerRecords();
  sts.forEach((s,i)=>{
    const studentRecs=recs
      .filter(r=>String(r.studentId)===String(s.id))
      .sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
    const points=studentRecs.reduce((a,r)=>a+(Number(r.points)||2),0);
    const value=String(s.volunteer||'');
    const field=editable
      ? `<textarea class="workspace-volunteer" rows="1" data-volunteer-student="${escapeAttr(s.id)}" placeholder="Enter volunteer name / activity">${escapeHtml(value)}</textarea>`
      : `<div class="workspace-volunteer workspace-volunteer-readonly">${escapeHtml(value||'—')}</div>`;
    const pointBadge=points?` <span class="volunteer-point">+${points}</span>`:'';
    const action=editable
      ? `<div class="volunteer-actions">
           <button type="button" class="volunteer-save-button" data-volunteer-save="${escapeAttr(s.id)}">Save</button>
           <button type="button" class="volunteer-delete-button" data-volunteer-delete="${escapeAttr(s.id)}">Delete</button>
         </div>`
      : `<span class="volunteer-view-only">View only</span>`;
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${i+1}</td><td>${escapeHtml(s.studentCode)}</td><td><strong>${escapeHtml(s.name)}</strong></td><td>${escapeHtml(s.gender)}</td><td>${field}${pointBadge}</td><td>${action}</td>`;
    body.appendChild(tr);
  });
}

function saveWorkspaceVolunteer(studentId,value){
  const c=classes().find(x=>x.id===workspaceClassId);
  if(!canManageVolunteerRecord(c)){
    alert('Volunteer records can be entered only by the Class Teacher of the selected class.');
    renderWorkspace();
    return;
  }
  const clean=String(value||'').trim();
  if(!clean){alert('Enter a volunteer name or activity before saving.');return}

  const s=students().find(x=>String(x.id)===String(studentId));
  if(!c||!s)return;

  const u=currentUser();
  const recs=volunteerRecords();
  const sameActivity=recs.find(r=>
    String(r.studentId)===String(s.id) &&
    same(r.volunteer,clean)
  );

  // Do not award another +2 when the same volunteer record is saved again.
  if(!sameActivity){
    recs.push({
      id:`vol-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      studentId:s.id,
      studentName:s.name,
      classId:c.id,
      class:c.grade,
      section:c.section,
      stream:c.stream||'',
      volunteer:clean,
      points:2,
      recordedBy:teacherName(u),
      recordedByEmail:u?.email||'',
      date:new Date().toISOString().slice(0,10),
      createdAt:new Date().toISOString()
    });
    saveVolunteerRecords(recs);
  }

  const arr=students();
  const i=arr.findIndex(x=>String(x.id)===String(s.id));
  if(i>=0){
    arr[i].volunteer=clean;
    saveStudents(arr);
  }
  renderWorkspace();
}

function deleteWorkspaceVolunteer(studentId){
  const c=classes().find(x=>x.id===workspaceClassId);
  if(!canManageVolunteerRecord(c)){
    alert('Only the Class Teacher of the selected class can delete volunteer records.');
    return;
  }

  const s=students().find(x=>String(x.id)===String(studentId));
  if(!s)return;

  const recs=volunteerRecords()
    .filter(r=>String(r.studentId)===String(s.id))
    .sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));

  if(!recs.length){
    const arr=students();
    const i=arr.findIndex(x=>String(x.id)===String(s.id));
    if(i>=0){arr[i].volunteer='';saveStudents(arr);}
    renderWorkspace();
    return;
  }

  const latest=recs[recs.length-1];
  if(!confirm(`Delete the latest volunteer record for ${s.name}? This will remove its +2 points.`))return;

  const latestId=String(latest.id);
  saveVolunteerRecords(volunteerRecords().filter(r=>String(r.id)!==latestId));

  const remaining=recs.slice(0,-1);
  const arr=students();
  const i=arr.findIndex(x=>String(x.id)===String(s.id));
  if(i>=0){
    arr[i].volunteer=remaining.length?String(remaining[remaining.length-1].volunteer||''):'';
    saveStudents(arr);
  }
  renderWorkspace();
}

function initWorkspace(){
  workspaceClassOptions();
  const own=workspaceOwnClass();
  if(own){
    workspaceClassId=own.id;
    $('workspaceClass').value=own.grade;
    workspaceSectionOptions(own.grade);
    $('workspaceSection').value=own.id;
  }else{
    workspaceClassId=null;
    workspaceSectionOptions('');
  }
  renderWorkspace();
  syncVolunteerRecordPanel();
  if($('enableSportsRecord')?.checked && isClassTeacherRole()){renderSportsStudents();renderSportsHistory();}

  $('workspaceClass').addEventListener('change',e=>{
    workspaceClassId=null;
    workspaceSectionOptions(e.target.value);
    renderWorkspace();
    syncRecordMode();
    if($('enableSportsRecord')?.checked && isClassTeacherRole()){renderSportsStudents();renderSportsHistory();}
  });
  $('workspaceSection').addEventListener('change',e=>{
    workspaceClassId=e.target.value||null;
    renderWorkspace();
    syncRecordMode();
    syncVolunteerRecordPanel();
    if($('enableSportsRecord')?.checked && isClassTeacherRole()){renderSportsStudents();renderSportsHistory();}
  });

  const volunteerToggle=$('enableVolunteerRecord');
  if(volunteerToggle){
    volunteerToggle.addEventListener('change',()=>{
      if(volunteerToggle.checked) setRecordMode('volunteer');
      else setRecordMode('none');
    });
  }

  const sportsToggle=$('enableSportsRecord');
  if(sportsToggle){
    sportsToggle.addEventListener('change',()=>{
      if(sportsToggle.checked) setRecordMode('sports');
      else setRecordMode('none');
    });
  }

  $('workspaceStudentBody').addEventListener('click',e=>{
    const save=e.target.closest('[data-volunteer-save]');
    if(save){
      const id=save.dataset.volunteerSave;
      const field=document.querySelector(`[data-volunteer-student="${CSS.escape(id)}"]`);
      if(field)saveWorkspaceVolunteer(id,field.value);
      return;
    }
    const del=e.target.closest('[data-volunteer-delete]');
    if(del){
      deleteWorkspaceVolunteer(del.dataset.volunteerDelete);
    }
  });

  const saveProgramBtn=$('saveVolunteerProgramBtn');
  if(saveProgramBtn){
    saveProgramBtn.addEventListener('click',()=>{
      if(!canEnterVolunteerProgramme()){
        alert('You must be logged in as a staff member to save the programme description.');
        return;
      }
      if(!workspaceClassId){
        alert('Select a class and section first.');
        return;
      }
      const field=$('volunteerProgramDescription');
      saveVolunteerProgramDescription(workspaceClassId,field?.value||'');
      renderWorkspace();
      alert('Volunteer programme description saved.');
    });
  }

  const importBtn=$('importStudentsBtn');
  const importFile=$('importStudentsFile');
  if(importBtn&&importFile){
    importBtn.addEventListener('click',()=>{
      const c=classes().find(x=>x.id===workspaceClassId);
      if(!c){alert('Select a class and section first.');return}
      if(!isAdmin()&&!teacherCanManage(c)){
        // Student importing remains restricted to the user's assigned class;
        // volunteer programme entry itself is available to all staff.
        alert('Import is available only for your assigned class.');
        return;
      }
      importFile.click();
    });
    importFile.addEventListener('change',e=>{
      const f=e.target.files?.[0];if(!f)return;
      importSelectedClass(f,workspaceClassId);e.target.value='';
    });
  }
}

// ---------- Volunteer student record: Class Teacher only ----------
function syncVolunteerRecordPanel(){
  syncRecordMode();
}


// ---------- Final Games & Sports save handler ----------
function saveGamesSportsRecordFinal(){
  const c=classes().find(x=>x.id===workspaceClassId);
  if(!canManageGamesSports(c)){
    alert('Games & Sports records can be entered only by the Class Teacher of the selected class.');
    return;
  }

  const sportEl=$('sportsGame') || $('sportsName') || $('gameSport') || document.querySelector('[name="gameSport"]');
  const resultEl=$('sportsResult') || $('sportsOutcome') || $('gameResult') || document.querySelector('[name="sportsResult"]');
  const dateEl=$('sportsDate') || $('gameDate') || document.querySelector('[name="sportsDate"]');

  const sport=String(sportEl?.value || '').trim();
  const result=String(resultEl?.value || '').trim();
  const date=String(dateEl?.value || '').trim();

  const selected=[...document.querySelectorAll(
    '#sportsStudentList input[type="checkbox"][data-student-id]:checked,' +
    '#sportsStudents input[type="checkbox"][data-student-id]:checked,' +
    '.sports-student-list input[type="checkbox"][data-student-id]:checked'
  )];

  if(!sport){
    alert('Please enter the Game / Sport.');
    sportEl?.focus();
    return;
  }
  if(!result || /select result/i.test(result)){
    alert('Please select a result.');
    resultEl?.focus();
    return;
  }
  if(!date){
    alert('Please select a date.');
    dateEl?.focus();
    return;
  }
  if(!selected.length){
    alert('Please select at least one student.');
    return;
  }

  // Match the existing SAMS scoring rules.
  const normalized=result.toLowerCase();
  let points=2;
  let affectsClassMark=false;
  if(/\b1st\b|first/.test(normalized)){ points=5; affectsClassMark=true; }
  else if(/\b2nd\b|second/.test(normalized)){ points=4; affectsClassMark=true; }
  else if(/\b3rd\b|third/.test(normalized)){ points=3; affectsClassMark=true; }
  else if(/participation|participated/.test(normalized)){ points=2; affectsClassMark=false; }

  let records=readLS('sams_games_sports_records',[]);
  const createdAt=new Date().toISOString();
  let added=0, skipped=0;

  selected.forEach(cb=>{
    const studentId=String(cb.dataset.studentId);
    const student=students().find(s=>String(s.id)===studentId);
    if(!student){ skipped++; return; }

    const duplicate=records.some(r =>
      String(r.studentId)===studentId &&
      String(r.classId||'')===String(workspaceClassId||'') &&
      String(r.sport||'').trim().toLowerCase()===sport.toLowerCase() &&
      String(r.result||'').trim().toLowerCase()===result.toLowerCase() &&
      String(r.date||'')===date
    );
    if(duplicate){ skipped++; return; }

    records.push({
      id:'sports-'+Date.now()+'-'+Math.random().toString(36).slice(2,9),
      studentId,
      studentName:studentName(student),
      classId:workspaceClassId,
      class:classGrade(c),
      section:classSection(c),
      sport,
      result,
      date,
      points,
      affectsClassMark,
      recordedBy:loggedInTeacherName(),
      createdAt
    });
    added++;
  });

  writeLS('sams_games_sports_records',records);

  // Also create a dashboard activity if the current SAMS build uses activity storage.
  try{
    const activities=readLS('sams_recent_activities',[]);
    activities.unshift({
      id:'sports-activity-'+Date.now(),
      type:'games-sports',
      title:'Games & Sports record added',
      detail:`${sport} — ${result} — ${added} student${added===1?'':'s'}`,
      createdAt
    });
    writeLS('sams_recent_activities',activities.slice(0,50));
  }catch(e){}

  // Clear only selected student boxes and refresh the history.
  selected.forEach(cb=>{cb.checked=false;});
  const selectedCount=$('sportsSelectedCount');
  if(selectedCount) selectedCount.textContent='0 students selected';

  renderSportsStudents();
  renderSportsHistory();

  if(added){
    alert(`${added} Games & Sports record${added===1?'':'s'} saved successfully.${skipped?' '+skipped+' duplicate record(s) were skipped.':''}`);
  }else{
    alert('No new record was saved. The selected record(s) may already exist.');
  }
}

// ---------- Class Teacher record mode controller ----------
function setRecordMode(mode){
  const volunteer=$('enableVolunteerRecord');
  const sports=$('enableSportsRecord');
  const volunteerPanel=$('volunteerRecordStudentsPanel');
  const sportsPanel=$('sportsRecordForm');
  const c=classes().find(x=>x.id===workspaceClassId);

  // Volunteer records are available to every authenticated staff member.
  // Games & Sports remains restricted to the Class Teacher.
  if(!c){
    if(volunteer) volunteer.checked=false;
    if(sports) sports.checked=false;
    if(volunteerPanel) volunteerPanel.hidden=true;
    if(sportsPanel) sportsPanel.hidden=true;
    return;
  }

  if(mode==='volunteer'){
    if(volunteer) volunteer.checked=true;
    if(sports) sports.checked=false;
    if(volunteerPanel) volunteerPanel.hidden=false;
    if(sportsPanel) sportsPanel.hidden=true;
    renderWorkspace();
  }else if(mode==='sports'){
    if(!canManageGamesSports(c)){
      if(sports) sports.checked=false;
      if(sportsPanel) sportsPanel.hidden=true;
      return;
    }
    if(sports) sports.checked=true;
    if(volunteer) volunteer.checked=false;
    if(volunteerPanel) volunteerPanel.hidden=true;
    if(sportsPanel) sportsPanel.hidden=false;
    renderSportsStudents();
    renderSportsHistory();
  }else{
    if(volunteer) volunteer.checked=false;
    if(sports) sports.checked=false;
    if(volunteerPanel) volunteerPanel.hidden=true;
    if(sportsPanel) sportsPanel.hidden=true;
  }
}

function syncRecordMode(){
  const volunteer=$('enableVolunteerRecord');
  const sports=$('enableSportsRecord');
  const volunteerPanel=$('volunteerRecordStudentsPanel');
  const sportsPanel=$('sportsRecordForm');
  const c=classes().find(x=>x.id===workspaceClassId);

  // Volunteer records: all authenticated staff.
  // Games & Sports: Class Teacher only.
  if(!c){
    if(volunteer) volunteer.checked=false;
    if(sports) sports.checked=false;
    if(volunteerPanel) volunteerPanel.hidden=true;
    if(sportsPanel) sportsPanel.hidden=true;
    return;
  }

  // If Sports is checked by a non-Class Teacher, immediately turn it off.
  if(sports?.checked && !canManageGamesSports(c)){
    sports.checked=false;
  }

  // Keep only one record mode visible at a time.
  const v=!!volunteer?.checked;
  const s=!!sports?.checked;
  if(v && s){
    if(sports) sports.checked=false;
  }

  if(volunteerPanel) volunteerPanel.hidden=!(volunteer?.checked);
  if(sportsPanel) sportsPanel.hidden=!!(sports?.checked) && canManageGamesSports(c);
}

// ---------- Games & Sports class-teacher record ----------
const GAMES_SPORTS_KEY='sams_games_sports_records';
const SPORTS_POINTS={Participation:2,'1st':5,'2nd':4,'3rd':3};

function gamesSportsRecords(){
  const x=read(GAMES_SPORTS_KEY,[]);
  return Array.isArray(x)?x:[];
}
function saveGamesSportsRecords(x){
  localStorage.setItem(GAMES_SPORTS_KEY,JSON.stringify(x));
}
function sportsPoint(result){
  return Number(SPORTS_POINTS[String(result||'')])||0;
}
function sportsAffectsClassMark(result){
  // Participation is an individual participation award only.
  // It must NOT increase the class mark. Position awards do.
  return String(result||'')!=='Participation';
}
function normalizeSportName(value){
  return String(value||'').trim().replace(/\s+/g,' ');
}
function formatDate(value){
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return String(value||'');
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function selectedSportsStudents(){
  return [...document.querySelectorAll('[data-sports-student]:checked')].map(x=>String(x.dataset.sportsStudent));
}
function renderSportsStudents(){
  const box=$('sportsStudentList');
  if(!box)return;
  const c=classes().find(x=>x.id===workspaceClassId);
  if(!c){
    box.innerHTML='<div class="sports-empty">Select a class and section first.</div>';
    updateSportsSelectedCount();
    return;
  }
  const sts=classStudents(c.id);
  if(!sts.length){
    box.innerHTML='<div class="sports-empty">No students are registered in this class.</div>';
    updateSportsSelectedCount();
    return;
  }
  box.innerHTML=sts.map(s=>`
    <label class="sports-student-option">
      <input type="checkbox" data-sports-student="${escapeAttr(s.id)}">
      <span>
        <strong>${escapeHtml(s.name)}</strong>
        <small>${escapeHtml(s.studentCode||'')}</small>
      </span>
    </label>
  `).join('');
  updateSportsSelectedCount();
}
function updateSportsSelectedCount(){
  const n=selectedSportsStudents().length;
  const el=$('sportsSelectedCount');
  if(el)el.textContent=`${n} student${n===1?'':'s'} selected`;
}
function updateSportsPointPreview(){
  const result=$('sportsRecordResult')?.value||'';
  const preview=$('sportsPointPreview');
  if(!preview)return;
  if(!result){
    preview.textContent='Select a result';
    preview.className='sports-point-preview';
    return;
  }
  const p=sportsPoint(result);
  const classMark=sportsAffectsClassMark(result);
  preview.textContent=`Automatic: +${p} ${classMark?'• Included in class mark':'• Participation only — not in class mark'}`;
  preview.className=`sports-point-preview ${classMark?'position':'participation'}`;
}
function saveSportsRecord(){
  const c=classes().find(x=>x.id===workspaceClassId);
  if(!c)return alert('Select a class and section first.');
  if(!canManageGamesSports(c)){
    alert('Games & Sports records can be entered only by the Class Teacher of the selected class. Principal, Vice Principal, Administrator and other staff cannot enter these records.');
    return;
  }

  const sport=normalizeSportName($('sportsRecordSport')?.value||'');
  const result=$('sportsRecordResult')?.value||'';
  const date=$('sportsRecordDate')?.value||new Date().toISOString().slice(0,10);
  const ids=selectedSportsStudents();

  if(!sport)return alert('Enter the game or sport.');
  if(!result)return alert('Select Participation, 1st, 2nd or 3rd.');
  if(!ids.length)return alert('Select at least one student.');
  if(!sportsPoint(result))return alert('The selected result has no points.');

  const all=gamesSportsRecords();
  const u=currentUser();
  const existing=all.filter(r=>
    String(r.classId)===String(c.id) &&
    String(r.sport||'').toLowerCase()===sport.toLowerCase() &&
    String(r.result||'')===result &&
    String(r.date||'')===date
  );
  const duplicateIds=new Set(existing.map(r=>String(r.studentId)));
  const newIds=ids.filter(id=>!duplicateIds.has(String(id)));

  if(!newIds.length){
    return alert(`The selected students already have ${result} recorded for ${sport} on ${formatDate(date)}.`);
  }

  const sts=classStudents(c.id);
  newIds.forEach(id=>{
    const s=sts.find(x=>String(x.id)===String(id));
    if(!s)return;
    all.push({
      id:`GS-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      studentId:s.id,
      studentName:s.name,
      studentCode:s.studentCode||'',
      classId:c.id,
      class:c.grade,
      section:c.section,
      stream:c.stream||'',
      sport,
      result,
      points:sportsPoint(result),
      affectsClassTotal:sportsAffectsClassMark(result),
      individualOnly:!sportsAffectsClassMark(result),
      date,
      recordedBy:teacherName(u),
      recordedByEmail:u?.email||'',
      createdAt:new Date().toISOString()
    });
  });

  saveGamesSportsRecords(all);
  document.querySelectorAll('[data-sports-student]:checked').forEach(x=>x.checked=false);
  renderSportsStudents();
  renderSportsHistory();
  updateSportsPointPreview();
  render();
  alert(`${newIds.length} student${newIds.length===1?'':'s'} recorded for ${sport}: ${result} (+${sportsPoint(result)} each).`);
}
window.SAMS_saveGamesSportsRecord=saveSportsRecord;
function deleteSportsRecord(id){
  const all=gamesSportsRecords();
  const r=all.find(x=>String(x.id)===String(id));
  if(!r)return;
  const c=classes().find(x=>String(x.id)===String(r.classId));
  if(!canManageGamesSports(c)){
    alert('Only the Class Teacher of this class can delete Games & Sports records.');
    return;
  }
  if(!confirm(`Delete ${r.result} for ${r.studentName} in ${r.sport}? This removes +${r.points} points.`))return;
  saveGamesSportsRecords(all.filter(x=>String(x.id)!==String(id)));
  renderSportsHistory();
  renderSportsStudents();
  render();
}
function renderSportsHistory(){
  const box=$('sportsRecordHistory');
  if(!box)return;
  const c=classes().find(x=>x.id===workspaceClassId);
  if(!c){
    box.innerHTML='';
    return;
  }
  const rows=gamesSportsRecords()
    .filter(r=>String(r.classId)===String(c.id))
    .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));

  if(!rows.length){
    box.innerHTML='<div class="sports-history-empty">No Games &amp; Sports records have been saved for this class yet.</div>';
    return;
  }

  box.innerHTML=`
    <div class="sports-history-title">Recent Games &amp; Sports Records</div>
    <div class="sports-history-table-wrap">
      <table class="sports-history-table">
        <thead><tr><th>DATE</th><th>STUDENT</th><th>SPORT</th><th>RESULT</th><th>POINTS</th><th></th></tr></thead>
        <tbody>
          ${rows.slice(0,30).map(r=>`
            <tr>
              <td>${escapeHtml(formatDate(r.date))}</td>
              <td><strong>${escapeHtml(r.studentName)}</strong></td>
              <td>${escapeHtml(r.sport)}</td>
              <td>${escapeHtml(r.result)}</td>
              <td><span class="sports-history-points ${r.affectsClassTotal?'position':'participation'}">+${Number(r.points)||0}</span></td>
              <td><button type="button" class="sports-delete-button" data-delete-sports="${escapeAttr(r.id)}">Delete</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <small class="sports-history-note">Participation points are individual-only and excluded from the class mark. Position points are included in the class mark.</small>
  `;
}
function initSportsRecord(){
  const toggle=$('enableSportsRecord');
  const form=$('sportsRecordForm');
  const panel=$('sportsRecordPanel');
  if(!toggle||!form)return;

  // Hard UI restriction: only Class Teacher accounts see Games & Sports entry.
  // This is reinforced by canManageGamesSports() on every write/delete action.
  const allowed=isClassTeacherRole();
  if(panel) panel.hidden=!allowed;
  if(!allowed){
    toggle.checked=false;
    form.hidden=true;
    return;
  }

  const today=new Date().toISOString().slice(0,10);
  if($('sportsRecordDate'))$('sportsRecordDate').value=today;

  toggle.addEventListener('change',()=>{
    if(toggle.checked){
      const c=classes().find(x=>x.id===workspaceClassId);
      if(!c){
        toggle.checked=false;
        alert('Select a class and section first.');
        return;
      }
      if(!canManageGamesSports(c)){
        toggle.checked=false;
        form.hidden=true;
        alert('Games & Sports records are available only to the Class Teacher of the selected class.');
        return;
      }
      form.hidden=false;
      renderSportsStudents();
      renderSportsHistory();
      updateSportsPointPreview();
    }else{
      form.hidden=true;
    }
  });

  $('sportsRecordResult')?.addEventListener('change',updateSportsPointPreview);
  $('sportsStudentList')?.addEventListener('change',e=>{
    if(e.target.matches('[data-sports-student]'))updateSportsSelectedCount();
  });
  $('selectAllSportsStudents')?.addEventListener('click',()=>{
    const boxes=[...document.querySelectorAll('[data-sports-student]')];
    const shouldSelect=boxes.some(x=>!x.checked);
    boxes.forEach(x=>x.checked=shouldSelect);
    updateSportsSelectedCount();
  });
  const sportsSaveButton=$('saveSportsRecordBtn');
  if(sportsSaveButton){
    // Bind exactly one click handler so the save routine runs only once.
    sportsSaveButton.addEventListener('click',saveSportsRecord);
  }
  $('sportsRecordHistory')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-delete-sports]');
    if(btn)deleteSportsRecord(btn.dataset.deleteSports);
  });
}

async function init(){
  await hydrateCurrentUserFromCloud();
  await hydrateClassTeacherAssignmentsFromCloud();
  setupUser();
  const backDashboard=$('backDashboard');
  if(backDashboard) backDashboard.addEventListener('click',()=>window.location.href='dashboard.html');
  populateGrades('4-6');populateTeachers();render();initWorkspace();initSportsRecord();
  document.querySelectorAll('.division-card').forEach(b=>b.addEventListener('click',()=>{selectedDivision=b.dataset.division;syncDivisionButtons();$('searchInput').value='';render()}));
  $('division').addEventListener('change',e=>populateGrades(e.target.value));
  $('addClassBtn').addEventListener('click',()=>openModal('classModal'));
  $('downloadTemplateBtn').addEventListener('click',downloadTemplate);
  $('searchInput').addEventListener('input',render);$('streamFilter').addEventListener('change',render);
  $('classTableBody').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;if(a==='students')openStudents(b.dataset.id);if(a==='edit'&&isAdmin())openModal('classModal',classes().find(c=>c.id===b.dataset.id));if(a==='delete')deleteClass(b.dataset.id)});
  $('addStudentBtn').addEventListener('click',()=>openStudentForm());$('studentSearch').addEventListener('input',renderStudents);
  $('studentTableBody').addEventListener('click',e=>{const b=e.target.closest('[data-student-action]');if(!b)return;const s=students().find(x=>x.id===b.dataset.id);b.dataset.studentAction==='edit'?openStudentForm(s):deleteStudent(b.dataset.id)});
  $('studentTableBody').addEventListener('click',e=>{
    const save=e.target.closest('[data-save-volunteer-id]');
    if(!save) return;
    const input=$(`[data-volunteer-id="${save.dataset.saveVolunteerId}"]`);
    if(input) saveVolunteerValue(save.dataset.saveVolunteerId,input.value,save);
  });
  $('studentForm').addEventListener('submit',saveStudent);
  $('importWorkbookClassBtn').addEventListener('click',()=>$('xlsxClassFile').click());
  $('xlsxClassFile').addEventListener('change',e=>{importSelectedClass(e.target.files[0]);e.target.value=''});
  const wholeImportBtn=$('importWorkbookBtn');
  const wholeImportFile=$('xlsxWholeFile');
  if(wholeImportBtn&&wholeImportFile){
    wholeImportBtn.addEventListener('click',()=>$('xlsxWholeFile').click());
    wholeImportFile.addEventListener('change',e=>{importWholeWorkbook(e.target.files[0]);e.target.value=''});
  }
  $('deleteAllStudentsBtn').addEventListener('click',deleteAllStudents);
  $('deleteWholeClassBtn').addEventListener('click',()=>deleteClass(selectedClassId));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
  document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal('classModal');closeModal('studentModal');closeModal('studentFormModal')}});

}
document.addEventListener('DOMContentLoaded',init);
})();

document.addEventListener("DOMContentLoaded", function(){
  try{
    const current=JSON.parse(sessionStorage.getItem("sams_current_user")||localStorage.getItem("sams_current_user")||"null");
    const accounts=JSON.parse(localStorage.getItem("sams_accounts")||"[]");
    const email=String(current?.email||sessionStorage.getItem("sams_email")||localStorage.getItem("sams_email")||"").trim().toLowerCase();
    const account=accounts.find(a=>String(a.email||a.educationalEmail||a.educational_email||"").trim().toLowerCase()===email);
    if(current?.isAssessor===true||account?.isAssessor===true){
      document.querySelectorAll('a[href="assessment.html"]').forEach(a=>a.href="assessment-dashboard.html");
    }
  }catch(e){}
});
