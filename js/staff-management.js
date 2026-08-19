// SAMS - Staff Management
// Uses Supabase profiles as the central staff registry.
// Grade IV-X  -> Section A/B/C/D
// Grade XI-XII -> Stream Arts/Science/Commerce

(function () {
    "use strict";

    const $ = id => document.getElementById(id);

    let currentUser = null;
    let currentRole = "";
    let staffList = [];
    let editingId = null;

    const ROLE_LABELS = {
        admin: "Administrator",
        administrator: "Administrator",
        principal: "Principal",
        vice_principal: "Vice Principal",
        "vice principal": "Vice Principal",
        class_teacher: "Class Teacher",
        "class teacher": "Class Teacher",
        non_class_teacher: "Non-Class Teacher",
        "non class teacher": "Non-Class Teacher",
        "non-class teacher": "Non-Class Teacher"
    };

    function norm(value) {
        return String(value ?? "").trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
    }

    function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, ch => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[ch]));
    }

    function attr(value) {
        return esc(value).replace(/`/g, "&#096;");
    }

    function getCurrentUser() {
        try {
            const raw = sessionStorage.getItem("sams_current_user");
            if (raw) return JSON.parse(raw);
        } catch (_) {}

        return null;
    }

    function roleOf(user) {
        return norm(
            user?.role ||
            user?.userRole ||
            user?.staffRole ||
            user?.account_role ||
            ""
        );
    }

    function isManager() {
        return ["admin", "administrator", "principal", "vice principal"]
            .includes(norm(currentRole));
    }

    function isAssessorEligible(staff) {
        const role = norm(staff.role);
        return role === "vice principal" || role === "non class teacher";
    }

    function getAssignment(staff) {
        const grade = String(staff.assignedClass || "").trim();
        const section = String(staff.assignedSection || "").trim();
        const stream = String(staff.assignedStream || "").trim();

        if (!grade) return "—";

        const roman = grade.replace(/^Grade\s+/i, "").trim().toUpperCase();
        if (roman === "XI" || roman === "XII") {
            return stream ? `${grade} • ${stream}` : grade;
        }

        return section ? `${grade} • ${section}` : grade;
    }

    function statusLabel(staff) {
        if (staff.active === true) return "Active";
        return "Pending";
    }

    function statusClass(staff) {
        return staff.active === true ? "active" : "pending";
    }

    function roleLabel(role) {
        const key = norm(role);
        return ROLE_LABELS[key] || String(role || "Pending");
    }

    function getInitials(name) {
        const parts = String(name || "User").trim().split(/\s+/).filter(Boolean);
        return parts.slice(0, 2).map(x => x.charAt(0).toUpperCase()).join("") || "U";
    }

    async function loadStaff() {
        const body = $("staffTableBody");
        if (body) {
            body.innerHTML = '<tr><td colspan="7" class="empty-state">Loading registered staff...</td></tr>';
        }

        if (!window.samsSupabase) {
            showError("Supabase connection is not available.");
            return;
        }

        try {
            const result = await window.samsSupabase
                .from("profiles")
                .select(`
                    id,
                    full_name,
                    email,
                    employee_code,
                    role,
                    active,
                    is_assessor,
                    assigned_class,
                    assigned_section,
                    assigned_stream,
                    created_at
                `)
                .order("created_at", { ascending: true });

            if (result.error) throw result.error;

            staffList = (result.data || [])
                .filter(profile => norm(profile.role) !== "student")
                .map(profile => ({
                    id: profile.id,
                    name: profile.full_name || profile.email || "Unnamed Staff",
                    email: profile.email || "",
                    employeeCode: profile.employee_code || "",
                    role: profile.role || "",
                    active: profile.active === true,
                    assessor: profile.is_assessor === true,
                    assignedClass: profile.assigned_class || "",
                    assignedSection: profile.assigned_section || "",
                    assignedStream: profile.assigned_stream || "",
                    createdAt: profile.created_at || "",
                    raw: profile
                }));

            render();
        } catch (error) {
            console.error("Unable to load SAMS staff:", error);
            if (body) {
                body.innerHTML = `<tr><td colspan="7" class="empty-state">Unable to load staff from the central database.</td></tr>`;
            }
            alert("Unable to load staff from Supabase. Please check the database connection and permissions.");
        }
    }

    function render() {
        const body = $("staffTableBody");
        if (!body) return;

        const active = staffList.filter(x => x.active).length;
        const pending = staffList.filter(x => !x.active).length;

        if ($("totalStaffCount")) $("totalStaffCount").textContent = staffList.length;
        if ($("activeStaffCount")) $("activeStaffCount").textContent = active;
        if ($("pendingStaffCount")) $("pendingStaffCount").textContent = pending;
        if ($("notificationCount")) $("notificationCount").textContent = pending;

        if (!staffList.length) {
            body.innerHTML = '<tr><td colspan="7" class="empty-state"><strong>No staff users found</strong><br>Registered staff accounts will appear here.</td></tr>';
            return;
        }

        body.innerHTML = staffList.map((staff, index) => {
            const actions = isManager() ? `
                <div class="action-group">
                    ${!staff.active ? `<button class="action-btn approve" type="button" data-action="approve" data-id="${attr(staff.id)}">✓ Approve</button>` : ""}
                    ${!staff.active ? `<button class="action-btn reject" type="button" data-action="reject" data-id="${attr(staff.id)}">Reject</button>` : ""}
                    <button class="action-btn edit" type="button" data-action="edit" data-id="${attr(staff.id)}">Edit</button>
                    ${isAssessorEligible(staff) ? `<button class="action-btn assessor" type="button" data-action="assessor" data-id="${attr(staff.id)}">${staff.assessor ? "Remove Assessor" : "Appoint Assessor"}</button>` : ""}
                    <button class="action-btn delete" type="button" data-action="delete" data-id="${attr(staff.id)}">Delete</button>
                </div>
            ` : "";

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        <div class="staff-person">
                            <div class="staff-avatar">${esc(getInitials(staff.name))}</div>
                            <div>
                                <div class="staff-name">${esc(staff.name)}</div>
                                <div class="staff-email">${esc(staff.email || "—")}</div>
                                ${staff.employeeCode ? `<div class="employee-id">${esc(staff.employeeCode)}</div>` : ""}
                            </div>
                        </div>
                    </td>
                    <td><span class="role-badge">${esc(roleLabel(staff.role))}</span></td>
                    <td>${esc(getAssignment(staff))}</td>
                    <td>${staff.assessor ? '<span class="assessor-badge yes">Yes</span>' : '<span class="assessor-badge no">No</span>'}</td>
                    <td><span class="status-badge ${statusClass(staff)}">${statusLabel(staff)}</span></td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join("");
    }

    function setupRoleOptions() {
        const role = $("staffRole");
        if (!role) return;

        role.innerHTML = `
            <option value="class_teacher">Class Teacher</option>
            <option value="non_class_teacher">Non-Class Teacher</option>
            <option value="vice_principal">Vice Principal</option>
            <option value="principal">Principal</option>
            <option value="admin">Administrator</option>
        `;
    }

    function updateAssignmentFields() {
        const role = norm($("staffRole")?.value || "");
        const classSelect = $("staffClass");
        const sectionSelect = $("staffSection");
        const streamGroup = $("staffStreamGroup");
        const streamSelect = $("staffStream");

        if (!classSelect || !sectionSelect || !streamGroup || !streamSelect) return;

        const needsAssignment = role === "class teacher";
        const isSeniorClass = ["grade xi", "grade xii"].includes(norm(classSelect.value));

        classSelect.disabled = !needsAssignment;
        sectionSelect.disabled = !needsAssignment || isSeniorClass;
        streamSelect.disabled = !needsAssignment || !isSeniorClass;

        classSelect.style.opacity = needsAssignment ? "1" : "0.65";
        sectionSelect.style.opacity = needsAssignment && !isSeniorClass ? "1" : "0.65";
        streamSelect.style.opacity = needsAssignment && isSeniorClass ? "1" : "0.65";

        streamGroup.style.display = needsAssignment && isSeniorClass ? "flex" : "none";

        if (!needsAssignment) {
            classSelect.value = "";
            sectionSelect.value = "";
            streamSelect.value = "";
        } else if (isSeniorClass) {
            sectionSelect.value = "";
        } else {
            streamSelect.value = "";
        }
    }

    function openModal(staff = null) {
        if (!isManager()) {
            alert("Staff management changes are not available for your role.");
            return;
        }

        setupRoleOptions();
        editingId = staff?.id || null;

        $("modalTitle").textContent = staff ? "Edit Staff" : "Add Staff";
        $("staffId").value = staff?.id || "";
        $("staffName").value = staff?.name || "";
        $("staffEmail").value = staff?.email || "";
        $("staffRole").value = norm(staff?.role || "class teacher").replace(/ /g, "_");
        $("staffClass").value = staff?.assignedClass || "";
        $("staffSection").value = staff?.assignedSection || "";
        $("staffStream").value = staff?.assignedStream || "";
        $("staffStatus").value = staff?.active ? "active" : "pending";

        updateAssignmentFields();
        $("staffModal").classList.add("show");
    }

    function closeModal() {
        $("staffModal")?.classList.remove("show");
        editingId = null;
    }

    async function findProfileByEmail(email) {
        const result = await window.samsSupabase
            .from("profiles")
            .select("id, full_name, email, employee_code, role, active, is_assessor, assigned_class, assigned_section, assigned_stream")
            .eq("email", email)
            .maybeSingle();

        if (result.error) throw result.error;
        return result.data || null;
    }

    async function updateProfile(profileId, changes) {
        const result = await window.samsSupabase
            .from("profiles")
            .update(changes)
            .eq("id", profileId);

        if (result.error) throw result.error;
    }

    async function saveStaff() {
        if (!isManager()) return;

        const name = $("staffName").value.trim();
        const email = $("staffEmail").value.trim().toLowerCase();
        const role = norm($("staffRole").value).replace(/ /g, "_");
        const assignedClass = $("staffClass").value;
        const assignedSection = $("staffSection").value;
        const assignedStream = $("staffStream").value;
        const active = $("staffStatus").value === "active";

        if (!name) return alert("Please enter the staff member's name.");
        if (!email) return alert("Please enter the educational email.");
        if (!role) return alert("Please select a role.");

        const senior = ["grade xi", "grade xii"].includes(norm(assignedClass));

        if (role === "class_teacher") {
            if (!assignedClass) return alert("Please select a Class.");
            if (senior && !assignedStream) {
                return alert("Please select Arts, Science or Commerce for Grade XI/XII.");
            }
            if (!senior && !assignedSection) {
                return alert("Please select Section A, B, C or D for Grade IV-X.");
            }
        }

        try {
            let profile = editingId
                ? staffList.find(x => String(x.id) === String(editingId))?.raw
                : null;

            if (!profile) {
                profile = await findProfileByEmail(email);
            }

            if (!profile?.id) {
                alert("This email is not registered in SAMS yet. Register the staff account first, then assign the role/class here.");
                return;
            }

            const duplicate = staffList.find(x =>
                String(x.email).toLowerCase() === email &&
                String(x.id) !== String(profile.id)
            );
            if (duplicate) {
                alert("A SAMS account already exists for this email address.");
                return;
            }

            if (role === "admin") {
                const anotherAdmin = staffList.find(x =>
                    String(x.id) !== String(profile.id) &&
                    ["admin", "administrator"].includes(norm(x.role))
                );
                if (anotherAdmin) {
                    alert("SAMS allows only one Administrator.");
                    return;
                }
            }

            const changes = {
                full_name: name,
                email,
                role,
                active,
                assigned_class: role === "class_teacher" ? assignedClass : null,
                assigned_section: role === "class_teacher" && !senior ? assignedSection : null,
                assigned_stream: role === "class_teacher" && senior ? assignedStream : null
            };

            await updateProfile(profile.id, changes);

            closeModal();
            await loadStaff();
            alert("Staff record saved to the central SAMS database.");
        } catch (error) {
            console.error("SAMS staff save failed:", error);
            alert(`The staff record could not be saved.\n\n${error?.message || "Please check Supabase permissions."}`);
        }
    }

    async function setActive(id, active) {
        if (!isManager()) return;

        try {
            await updateProfile(id, { active });
            await loadStaff();
        } catch (error) {
            console.error("SAMS staff status update failed:", error);
            alert(`The status could not be saved.\n\n${error?.message || "Please try again."}`);
        }
    }

    async function toggleAssessor(id) {
        if (!isManager()) return;

        const staff = staffList.find(x => String(x.id) === String(id));
        if (!staff) return;

        if (!isAssessorEligible(staff)) {
            alert("Only Vice Principals and Non-Class Teachers can be appointed as assessors.");
            return;
        }

        try {
            await updateProfile(id, { is_assessor: !staff.assessor });
            await loadStaff();
        } catch (error) {
            console.error("SAMS assessor update failed:", error);
            alert(`The assessor appointment could not be saved.\n\n${error?.message || "Please try again."}`);
        }
    }

    async function deleteStaff(id) {
        if (!isManager()) return;

        const staff = staffList.find(x => String(x.id) === String(id));
        if (!staff) return;

        if (!confirm(`Delete ${staff.name}'s SAMS account?\n\nThis permanently removes the Auth account and profile.`)) {
            return;
        }

        try {
            if (!window.samsSupabase?.functions) {
                throw new Error("Supabase Edge Functions are not available.");
            }

            const result = await window.samsSupabase.functions.invoke(
                "delete-sams-user",
                { body: { userId: id } }
            );

            if (result.error) throw result.error;
            if (!result.data?.success) {
                throw new Error(result.data?.message || "The account could not be deleted.");
            }

            await loadStaff();
            alert("Staff account deleted successfully.");
        } catch (error) {
            console.error("SAMS staff deletion failed:", error);
            alert(`The user was NOT deleted.\n\n${error?.message || "Please try again."}`);
        }
    }

    function logout() {
        if (!confirm("Are you sure you want to logout?")) return;

        if (window.SAMS_AUTH?.logout) {
            window.SAMS_AUTH.logout();
            return;
        }

        if (window.samsSupabase) {
            window.samsSupabase.auth.signOut().finally(() => {
                sessionStorage.clear();
                window.location.href = "index.html";
            });
        }
    }

    function applyPermissions() {
        const fullAccess = isManager();
        const actionsHeader = document.querySelector(".staff-table th:last-child");
        const notice = document.querySelector(".view-only-notice");
        const addButton = $("principalActions");

        if (addButton) addButton.style.display = fullAccess ? "flex" : "none";
        if (actionsHeader) actionsHeader.style.display = fullAccess ? "table-cell" : "none";
        if (notice) notice.style.display = fullAccess ? "none" : "block";

        document.body.classList.toggle("view-only", !fullAccess);
    }

    function updateUserDisplay() {
        const name = currentUser?.name || currentUser?.full_name || currentUser?.email || "User";
        const role = roleLabel(currentRole);

        if ($("userName")) $("userName").textContent = name;
        if ($("userRole")) $("userRole").textContent = role;
        if ($("userAvatar")) $("userAvatar").textContent = getInitials(name).charAt(0);
    }

    function attachEvents() {
        $("backDashboard")?.addEventListener("click", () => {
            window.location.href = "dashboard.html";
        });

        $("addStaffButton")?.addEventListener("click", () => openModal());

        $("closeModalButton")?.addEventListener("click", closeModal);
        $("cancelModalButton")?.addEventListener("click", closeModal);
        $("saveStaffButton")?.addEventListener("click", saveStaff);
        $("logoutButton")?.addEventListener("click", logout);

        $("staffRole")?.addEventListener("change", updateAssignmentFields);
        $("staffClass")?.addEventListener("change", updateAssignmentFields);

        $("staffModal")?.addEventListener("click", event => {
            if (event.target === $("staffModal")) closeModal();
        });

        $("staffTableBody")?.addEventListener("click", async event => {
            const button = event.target.closest("button[data-action]");
            if (!button) return;

            const id = button.dataset.id;
            const action = button.dataset.action;
            const staff = staffList.find(x => String(x.id) === String(id));

            if (action === "edit") openModal(staff);
            if (action === "approve") await setActive(id, true);
            if (action === "reject") await setActive(id, false);
            if (action === "assessor") await toggleAssessor(id);
            if (action === "delete") await deleteStaff(id);
        });
    }

    async function initialise() {
        currentUser = getCurrentUser();

        // If the session object is unavailable, ask Supabase for the current
        // user and then load the corresponding profile.
        if (!currentUser && window.samsSupabase) {
            const auth = await window.samsSupabase.auth.getUser();
            if (auth.data?.user) {
                const profile = await window.samsSupabase
                    .from("profiles")
                    .select("*")
                    .eq("id", auth.data.user.id)
                    .maybeSingle();

                if (profile.data) {
                    currentUser = {
                        ...profile.data,
                        name: profile.data.full_name,
                        role: profile.data.role
                    };
                }
            }
        }

        currentRole = roleOf(currentUser);
        updateUserDisplay();
        applyPermissions();
        setupRoleOptions();

        // Wait for the shared cloud bridge when possible.
        if (window.samsCloud?.ready) {
            await window.samsCloud.ready;
        }

        await loadStaff();
    }

    attachEvents();
    initialise();

    // Public hooks for existing SAMS UI buttons.
    window.addStaff = () => openModal();
    window.editStaff = id => openModal(staffList.find(x => String(x.id) === String(id)));
    window.saveStaff = saveStaff;
    window.deleteStaff = deleteStaff;
    window.toggleAssessor = toggleAssessor;
    window.closeModal = closeModal;
})();
