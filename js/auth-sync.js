(function(){
  "use strict";

  const ACCOUNT_KEY="sams_accounts";
  const SESSION_KEYS=[
    "sams_current_user","sams_email","sams_user_name",
    "sams_user_role","sams_logged_in"
  ];

  function accounts(){
    try{
      const x=JSON.parse(localStorage.getItem(ACCOUNT_KEY)||"[]");
      return Array.isArray(x)?x:[];
    }catch(e){ return []; }
  }

  function accountEmail(a){
    return String(a?.email||a?.educationalEmail||a?.educational_email||"")
      .trim().toLowerCase();
  }

  function accountName(a){
    return String(a?.name||a?.fullName||a?.staffName||a?.displayName||"")
      .trim();
  }

  function accountRole(a){
    return String(a?.role||a?.staffRole||a?.userRole||a?.accountType||"")
      .trim();
  }

  function getByEmail(email){
    const e=String(email||"").trim().toLowerCase();
    if(!e) return null;
    return accounts().find(a=>accountEmail(a)===e)||null;
  }

  function sync(){
    // The logged-in email is the stable identity. Never trust a stale
    // role/name in sessionStorage when the account record exists.
    const sessionEmail=String(sessionStorage.getItem("sams_email")||"")
      .trim().toLowerCase();

    let account=getByEmail(sessionEmail);

    // Recover an older session once, then immediately canonicalise it.
    if(!account){
      try{
        const old=JSON.parse(sessionStorage.getItem("sams_current_user")||"null");
        account=getByEmail(accountEmail(old));
        if(!account && old?.name){
          const n=String(old.name).trim().toLowerCase();
          account=accounts().find(a=>accountName(a).toLowerCase()===n)||null;
        }
      }catch(e){}
    }

    if(!account) return null;

    const canonical={
      ...account,
      id:account.id||"",
      name:accountName(account),
      email:accountEmail(account),
      role:accountRole(account),
      accountType:String(account.accountType||"Staff").trim(),
      status:String(account.status||"active").trim()
    };

    sessionStorage.setItem("sams_current_user",JSON.stringify(canonical));
    sessionStorage.setItem("sams_email",canonical.email);
    sessionStorage.setItem("sams_user_name",canonical.name);
    sessionStorage.setItem("sams_user_role",canonical.role);
    sessionStorage.setItem("sams_logged_in","true");

    return canonical;
  }

  function logout(){
    SESSION_KEYS.forEach(k=>{
      try{sessionStorage.removeItem(k)}catch(e){}
      // Older SAMS builds accidentally wrote session identity to localStorage.
      try{localStorage.removeItem(k)}catch(e){}
    });
    try{sessionStorage.clear()}catch(e){}
    window.location.replace("index.html");
  }


  function isStudentAccount(user){
    const u=user||sync();
    const role=String(
      u?.role||u?.staffRole||u?.userRole||u?.accountType||u?.type||""
    ).trim().toLowerCase();
    const type=String(
      u?.accountType||u?.type||""
    ).trim().toLowerCase();
    return role==="student" || role==="learner" ||
           type==="student" || type==="learner";
  }

  function applyStudentReadOnly(){
    const user=sync();
    if(!isStudentAccount(user)) return;

    document.documentElement.classList.add("sams-student-readonly");
    document.body?.classList.add("sams-student-readonly");

    // Students may view/filter data, but may not type or edit anything.
    document.querySelectorAll(
      "textarea, input[type='text'], input[type='email'], input[type='password'], " +
      "input[type='number'], input[type='date'], input[type='file'], " +
      "input[type='tel'], input[type='url'], [contenteditable='true']"
    ).forEach(el=>{
      el.disabled=true;
      el.readOnly=true;
      el.setAttribute("aria-readonly","true");
    });

    // Do not allow record/edit controls to be used by students.
    const mutationSelector = [
      ".admin-only",
      ".staff-only",
      "[data-action='edit']",
      "[data-action='delete']",
      "[data-student-action='edit']",
      "[data-student-action='delete']",
      "[data-save-volunteer-id]",
      "#saveDescriptionBtn",
      "#saveSportsRecordBtn",
      "#addClassBtn",
      "#addStudentBtn",
      "#importStudentsBtn",
      "#importWorkbookBtn",
      "#xlsxWholeFile",
      "#importStudentsFile",
      "#enableVolunteerRecord",
      "#enableSportsRecord",
      "#assessmentForm",
      "#saveAssessmentBtn",
      "#submitAssessmentBtn",
      "#approveBtn",
      "#rejectBtn",
      "#appointAssessorBtn"
    ].join(",");

    document.querySelectorAll(mutationSelector).forEach(el=>{
      if(el instanceof HTMLInputElement || el instanceof HTMLButtonElement ||
         el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement){
        el.disabled=true;
      }else{
        el.hidden=true;
      }
    });

    // Catch dynamically-created mutation controls that do not have stable IDs.
    document.querySelectorAll("button").forEach(btn=>{
      const label=String(btn.textContent||"").trim().toLowerCase();
      if(/^(save|delete|edit|add|create|import|upload|approve|reject|appoint|record|submit|update|remove)\b/.test(label)){
        btn.disabled=true;
      }
    });

    // Prevent form submission by a student even if a page adds a form later.
    document.querySelectorAll("form").forEach(form=>{
      if(form.dataset.samsStudentReadonlyBound==="1") return;
      form.dataset.samsStudentReadonlyBound="1";
      form.addEventListener("submit",e=>{
        e.preventDefault();
        e.stopImmediatePropagation();
      },true);
    });
  }

  function updateHeader(){
    const u=sync();
    if(!u) return;

    const name=document.getElementById("userName");
    const role=document.getElementById("userRole");
    const avatar=document.getElementById("userAvatar");

    if(name) name.textContent=u.name||"User";
    if(role) role.textContent=u.role||"User";
    if(avatar) avatar.textContent=(u.name||"U").charAt(0).toUpperCase();
  }

  function bindLogout(){
    document.querySelectorAll("#logoutBtn,#logoutButton,.logout-item")
      .forEach(btn=>{
        if(btn.dataset.samsLogoutBound==="1") return;
        btn.dataset.samsLogoutBound="1";
        btn.addEventListener("click",function(e){
          e.preventDefault();
          e.stopPropagation();
          logout();
        });
      });
  }

  window.SAMS_AUTH={
    sync,logout,updateHeader,
    getCurrentUser:sync,
    getAccounts:accounts,
    isStudent:isStudentAccount,
    applyStudentReadOnly:applyStudentReadOnly,
    isAdmin:function(){
      const r=String(sync()?.role||"").trim().toLowerCase();
      return r==="administrator" || r==="admin" || r==="administration";
    }
  };
  window.SAMS_AUTH_SYNC={sync};

  function init(){
    updateHeader();
    bindLogout();
    applyStudentReadOnly();

    // Keep the student account read-only even when page content is
    // rendered dynamically after login.
    if(!window.__SAMS_STUDENT_RO_OBSERVER){
      const observer=new MutationObserver(()=>applyStudentReadOnly());
      observer.observe(document.body,{childList:true,subtree:true});
      window.__SAMS_STUDENT_RO_OBSERVER=observer;
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",init);
  }else{
    init();
  }

  // Re-read the staff account whenever a page becomes active again.
  window.addEventListener("pageshow",function(){
    updateHeader();
    bindLogout();
    applyStudentReadOnly();
  });
  window.addEventListener("focus",function(){
    updateHeader();
    bindLogout();
    applyStudentReadOnly();
  });
})();
