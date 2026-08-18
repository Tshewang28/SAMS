
"use strict";
const SETTINGS_KEY="sams_system_settings";
const SCHOOL_KEY="sams_school_settings";
const $=id=>document.getElementById(id);

function currentUser(){
  const email=(sessionStorage.getItem("sams_email")||localStorage.getItem("sams_email")||"").trim().toLowerCase();
  try{
    const accounts=JSON.parse(localStorage.getItem("sams_accounts")||"[]");
    const a=Array.isArray(accounts)?accounts.find(x=>String(x.email||x.educationalEmail||x.educational_email||"").trim().toLowerCase()===email):null;
    if(a){sessionStorage.setItem("sams_current_user",JSON.stringify(a));return a;}
  }catch(e){}
  try{const s=sessionStorage.getItem("sams_current_user");if(s)return JSON.parse(s)}catch(e){}
  return null;
}
function isAdmin(){
  const u=currentUser();
  const role=String(u?.role||u?.userRole||"").trim().toLowerCase();
  return role==="administrator" || role==="admin" || role==="administration";
}
function read(key,fallback){
  try{return JSON.parse(localStorage.getItem(key)||"null")||fallback}catch(e){return fallback}
}
function save(key,value){localStorage.setItem(key,JSON.stringify(value))}
function applyAccess(){
  const admin=isAdmin();
  document.querySelectorAll("#schoolForm input,#schoolForm textarea,#systemForm input").forEach(el=>el.disabled=!admin);
  document.querySelectorAll(".save-btn").forEach(b=>b.disabled=!admin);
  if(!admin){
    $("accessNotice").textContent="Settings are view-only for your account. Only Administration can change system settings.";
    $("accessNotice").classList.remove("hidden");
  }
}
function load(){
  const school=read(SCHOOL_KEY,{});
  $("schoolName").value=school.name||"";
  $("academicYear").value=school.academicYear||"";
  $("schoolEmail").value=school.email||"";
  $("schoolPhone").value=school.phone||"";
  $("schoolAddress").value=school.address||"";

  const system=read(SETTINGS_KEY,{});
  $("systemName").value=system.systemName||"Student Assessment Management System";
  $("defaultYear").value=system.defaultYear||school.academicYear||"";
  $("showHallOfFame").checked=system.showHallOfFame!==false;
  $("showReports").checked=system.showReports!==false;
  applyAccess();
}
function init(){
  load();
  $("schoolForm").addEventListener("submit",e=>{
    e.preventDefault();if(!isAdmin())return;
    save(SCHOOL_KEY,{name:$("schoolName").value.trim(),academicYear:$("academicYear").value.trim(),email:$("schoolEmail").value.trim(),phone:$("schoolPhone").value.trim(),address:$("schoolAddress").value.trim()});
    alert("School information saved.");
  });
  $("systemForm").addEventListener("submit",e=>{
    e.preventDefault();if(!isAdmin())return;
    save(SETTINGS_KEY,{systemName:$("systemName").value.trim(),defaultYear:$("defaultYear").value.trim(),showHallOfFame:$("showHallOfFame").checked,showReports:$("showReports").checked});
    alert("System settings saved.");
  });
}
/* =========================================================
   SYSTEM MANAGEMENT
   Backup / Restore / Reset / Factory Reset
   Administration only
   ========================================================= */
const SAMS_DATA_KEYS = [
  "sams_accounts",
  "sams_students",
  "sams_classes",
  "sams_assessment_criteria",
  "sams_assessment_records",
  "sams_games_sports_records",
  "sams_discipline_records",
  "sams_volunteer_records",
  "sams_reports",
  "sams_hall_of_fame_records",
  "sams_class_ranking",
  "sams_recent_activities",
  "sams_school_settings",
  "sams_system_settings",
  "sams_current_user",
  "sams_email",
  "sams_user_name",
  "sams_user_role"
];

function systemAdminOnly(){
  if(isAdmin()) return true;
  alert("Only Administration can use Backup, Restore, Reset or Factory Reset.");
  return false;
}

function collectSamsData(){
  const data={version:"SAMS-BACKUP-1",createdAt:new Date().toISOString(),data:{}};
  SAMS_DATA_KEYS.forEach(key=>{
    const raw=localStorage.getItem(key);
    if(raw!==null){
      try{data.data[key]=JSON.parse(raw)}
      catch(e){data.data[key]=raw}
    }
  });
  return data;
}

function downloadBackup(){
  if(!systemAdminOnly())return;
  const data=collectSamsData();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  const date=new Date().toISOString().slice(0,10);
  a.href=url;a.download=`SAMS_Backup_${date}.json`;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

function restoreBackup(file){
  if(!systemAdminOnly())return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const backup=JSON.parse(reader.result);
      if(!backup || backup.version!=="SAMS-BACKUP-1" || !backup.data){
        throw new Error("Invalid SAMS backup file.");
      }
      const confirmed=confirm(
        "RESTORE BACKUP\n\nThis will replace the current SAMS stored data with the selected backup.\n\nContinue?"
      );
      if(!confirmed)return;
      Object.entries(backup.data).forEach(([key,value])=>{
        if(SAMS_DATA_KEYS.includes(key))localStorage.setItem(key,JSON.stringify(value));
      });
      alert("SAMS backup restored successfully. The page will now reload.");
      location.reload();
    }catch(e){
      alert("Could not restore this file. Please select a valid SAMS backup.");
    }
  };
  reader.readAsText(file);
}

async function resetData(){
  if(!systemAdminOnly())return;

  const confirmed=confirm(
    "RESET ASSESSMENT DATA\n\nThis will permanently clear ALL recorded assessment results, including Classroom, Assembly, SUPW, Discipline, and Games & Sports assessment records. It will also clear assessment-related dashboard activity history.\n\nStaff accounts, students, classes, assessment criteria, school settings and system settings will remain.\n\nAre you sure?"
  );
  if(!confirmed)return;

  const second=confirm(
    "FINAL CONFIRMATION\n\nClear all assessment results and Games & Sports assessment records?\n\nThis cannot be undone unless you first made a backup."
  );
  if(!second)return;

  // Assessment data is stored in separate keys. Clearing only
  // sams_assessment_records leaves Games & Sports data behind, which means
  // Reports and other assessment-derived views can still show old results.
  const ASSESSMENT_RESET_KEYS = [
    // Core assessment records
    "sams_assessment_records",
    "sams_games_sports_records",
    "sams_discipline_records",
    "sams_volunteer_records",

    // Assessment-derived / cached records. These are included defensively
    // so Reset remains complete even if a future build stores derived data.
    "sams_reports",
    "sams_hall_of_fame_records",
    "sams_class_ranking",
    "sams_recent_activities"
  ];

  ASSESSMENT_RESET_KEYS.forEach(key=>localStorage.removeItem(key));

  // sams-cloud.js watches localStorage.removeItem() and synchronizes the
  // deletion to the shared Supabase sams_store. Explicitly wait for each
  // sync as well, so a page reload cannot immediately pull the old records
  // back from the cloud.
  if(window.samsCloud && typeof window.samsCloud.syncKey === "function") {
    try {
      await Promise.all(ASSESSMENT_RESET_KEYS.map(key=>window.samsCloud.syncKey(key)));
    } catch(error) {
      console.warn("SAMS assessment reset cloud sync warning:", error);
    }
  }

  alert("All assessment-connected data has been reset successfully. Assessment records, Games & Sports, Discipline, Volunteer records, Reports, Hall of Fame, Class Ranking and recent assessment activity were cleared. Staff, students, classes, criteria and settings were kept.");
  location.reload();
}

function factoryReset(){
  if(!systemAdminOnly())return;
  const first=confirm(
    "FACTORY RESET\n\nThis will permanently clear SAMS stored data and return the system to a fresh state.\n\nA backup is strongly recommended first.\n\nContinue?"
  );
  if(!first)return;
  const phrase=prompt('Type FACTORY RESET to confirm.');
  if(phrase!=="FACTORY RESET"){
    alert("Factory reset cancelled. The confirmation text did not match.");
    return;
  }
  SAMS_DATA_KEYS.forEach(key=>localStorage.removeItem(key));
  sessionStorage.clear();
  alert("SAMS has been reset to its initial data state.");
  location.href="index.html";
}

function setupSystemManagement(){
  const backup=$("backupBtn"),restore=$("restoreBtn"),file=$("restoreFile");
  const reset=$("resetBtn"),factory=$("factoryResetBtn");
  [backup,restore,reset,factory].forEach(btn=>{if(btn)btn.disabled=!isAdmin()});
  if(backup)backup.addEventListener("click",downloadBackup);
  if(restore)restore.addEventListener("click",()=>{if(systemAdminOnly())file.click()});
  if(file)file.addEventListener("change",e=>{
    const f=e.target.files?.[0];if(f)restoreBackup(f);e.target.value="";
  });
  if(reset)reset.addEventListener("click",resetData);
  if(factory)factory.addEventListener("click",factoryReset);
}

const oldInit=init;
init=function(){
  oldInit();
  setupSystemManagement();
};

function startSettingsPage(){
  init();
  setupSystemManagement();
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",startSettingsPage);
}else{
  startSettingsPage();
}
