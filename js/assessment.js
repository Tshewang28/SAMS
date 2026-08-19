const KEY = "sams_assessment_criteria";
const R = {
  Classroom: [0, 1, 2, 3, 4, 5],
  Assembly: [0, 1, 2, 3, 4, 5],
  SUPW: [0, 1, 2, 3, 4, 5],
  Discipline: [-1, -2, -3, -4, -5],
  "Games & Sports": null
};

const $ = id => document.getElementById(id);
const get = () => JSON.parse(localStorage.getItem(KEY) || "[]");
const save = x => localStorage.setItem(KEY, JSON.stringify(x));
const isAdmin = () => {
  const u = window.SAMS_AUTH?.currentUser?.() || window.SAMS_AUTH?.getCurrentUser?.() || null;
  const role = String(
    u?.role ||
    u?.staffRole ||
    u?.userRole ||
    u?.accountType ||
    u?.type ||
    sessionStorage.getItem("sams_user_role") ||
    ""
  ).trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  return ["administrator", "admin", "administration"].includes(role);
};

const esc = x => String(x ?? "").replace(/[&<>"']/g, m => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[m]));

function points(selected = "") {
  const a = $("assessmentArea").value;
  const p = $("point");
  const group = $("pointGroup");
  const note = $("gamesSportsNote");

  p.innerHTML = "";

  if (a === "Games & Sports") {
    p.disabled = true;
    p.innerHTML = '<option value="auto">Automatic: 1st +5 / 2nd +4 / 3rd +3</option>';
    p.value = "auto";
    if (group) group.classList.add("special-point");
    if (note) note.classList.remove("hidden");
    return;
  }

  if (group) group.classList.remove("special-point");
  if (note) note.classList.add("hidden");

  if (!R[a]) {
    p.disabled = true;
    p.innerHTML = "<option value=''>Select area first</option>";
    return;
  }

  p.disabled = false;
  p.innerHTML = "<option value=''>Select point</option>" +
    R[a].map(v => `<option value="${v}" ${String(v) === String(selected) ? "selected" : ""}>${v > 0 ? "+" : ""}${v}</option>`).join("");
}

function render() {
  const filter = $("filterArea").value;
  const rows = get().filter(x => filter === "all" || x.area === filter);
  const admin = isAdmin();
  const actionHeader = $("actionHeader");
  const addButton = $("addCriteriaBtn");

  // Only Administration can configure criteria.
  if (addButton) addButton.classList.toggle("hidden", !admin);
  if (actionHeader) actionHeader.classList.toggle("hidden", !admin);

  $("criteriaTable").innerHTML = rows.length
    ? rows.map(x => {
        const action = admin
          ? `<button class="action" onclick="edit('${esc(x.id)}')">Edit</button><button class="action" onclick="del('${esc(x.id)}')">Delete</button>`
          : "";
        return `<tr>
          <td><b>${esc(x.area)}</b></td>
          <td>${esc(x.name)}</td>
          <td>${esc(x.description) || "—"}</td>
          <td>${x.area === "Discipline"
            ? ((x.point !== undefined && x.point !== null && x.point !== "") ? String(x.point) : "Not set")
            : "0 to 5"}</td>
          <td class="action-cell${admin ? "" : " hidden"}">${action}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="5" class="empty">No criteria created.</td></tr>`;
}

function openM(x = null) {
  if (!isAdmin()) {
    alert("Only Administration can add or edit assessment criteria.");
    return;
  }
  $("criteriaModal").classList.remove("hidden");
  $("modalTitle").textContent = x ? "Edit Criteria" : "Add Criteria";
  $("criteriaId").value = x?.id || "";
  $("assessmentArea").value = x?.area || "";
  points(x?.point ?? "");
  $("criteriaName").value = x?.name || "";
  $("description").value = x?.description || "";
}

function closeM() {
  $("criteriaModal").classList.add("hidden");
  $("criteriaForm").reset();
  points();
}

function edit(id) {
  if (!isAdmin()) {
    alert("Only Administration can edit assessment criteria.");
    return;
  }
  const x = get().find(v => v.id === id);
  if (x) openM(x);
}

function del(id) {
  if (!isAdmin()) {
    alert("Only Administration can delete assessment criteria.");
    return;
  }
  const a = get();
  const x = a.find(v => v.id === id);
  if (x && confirm(`Delete "${x.name}"?`)) {
    save(a.filter(v => v.id !== id));
    if (!isAdmin()) {
  alert("Access denied. Assessment Criteria can only be managed by the Administrator.");
  window.location.replace("dashboard.html");
} else {
  render();
}
  }
}

window.edit = edit;
window.del = del;

$("addCriteriaBtn").onclick = () => openM();
$("closeModal").onclick = closeM;
$("cancelBtn").onclick = closeM;
$("assessmentArea").onchange = () => points();
$("filterArea").onchange = render;

$("criteriaForm").onsubmit = e => {
  e.preventDefault();

  if (!isAdmin()) {
    alert("Only Administration can save assessment criteria.");
    closeM();
    return;
  }

  const area = $("assessmentArea").value;
  const p = Number($("point").value);
  const name = $("criteriaName").value.trim();
  const description = $("description").value.trim();
  const id = $("criteriaId").value;

  if (!area || !name) return alert("Complete Area and Criteria.");
  if (area !== "Games & Sports" && (!R[area] || !R[area].includes(p))) {
    return alert("Please select a valid point.");
  }

  const a = get();
  const o = {
    id: id || "CR-" + Date.now(),
    area,
    point: area === "Games & Sports" ? null : p,
    name,
    description,
    scoringMode: area === "Games & Sports" ? "position" : "points"
  };

  if (id) {
    const i = a.findIndex(v => v.id === id);
    if (i >= 0) a[i] = o;
  } else {
    a.push(o);
  }

  save(a);
  closeM();
  render();
};

render();
