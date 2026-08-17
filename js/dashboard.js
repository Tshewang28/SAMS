/* =========================================================
   SAMS - DASHBOARD.JS
   Dashboard data, notifications, statistics and activities.
   ========================================================= */

(function () {
    "use strict";

    const KEYS = {
        accounts: "sams_accounts",
        students: "sams_students",
        classes: "sams_classes",
        assessments: "sams_assessment_records",
        volunteer: "sams_volunteer_records",
        gamesSports: "sams_games_sports_records"
    };

    const DEFAULT_CLASSES = [
        ["4-6","IV","A","General"],["4-6","IV","B","General"],["4-6","IV","C","General"],
        ["4-6","V","A","General"],["4-6","V","B","General"],["4-6","V","C","General"],
        ["4-6","VI","A","General"],["4-6","VI","B","General"],["4-6","VI","C","General"],["4-6","VI","D","General"],
        ["7-9","VII","A","General"],["7-9","VII","B","General"],["7-9","VII","C","General"],
        ["7-9","VIII","A","General"],["7-9","VIII","B","General"],["7-9","VIII","C","General"],
        ["7-9","IX","A","General"],["7-9","IX","B","General"],["7-9","IX","C","General"],
        ["10-12","X","A","General"],["10-12","X","B","General"],["10-12","X","C","General"],
        ["10-12","XI","Arts","Arts"],["10-12","XI","Commerce","Commerce"],["10-12","XI","Science","Science"],
        ["10-12","XII","Arts","Arts"],["10-12","XII","Science","Science"]
    ];

    const $ = id => document.getElementById(id);

    function read(key, fallback = []) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return Array.isArray(value) ? value : fallback;
        } catch (error) {
            console.warn("SAMS dashboard could not read", key, error);
            return fallback;
        }
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char]));
    }

    function normalize(value) {
        return String(value ?? "").trim();
    }

    function normalizeLower(value) {
        return normalize(value).toLowerCase();
    }

    function accountName(account) {
        return normalize(
            account?.name ||
            account?.fullName ||
            account?.staffName ||
            account?.displayName ||
            account?.email ||
            "User"
        );
    }

    function accountRole(account) {
        return normalize(
            account?.role ||
            account?.staffRole ||
            account?.userRole ||
            account?.accountType ||
            "User"
        );
    }

    function accountEmail(account) {
        return normalizeLower(
            account?.email ||
            account?.educationalEmail ||
            account?.educational_email
        );
    }

    function isStudent(student) {
        const type = normalizeLower(
            student?.accountType ||
            student?.type ||
            student?.userType ||
            student?.user_type
        );
        return type === "student" || type === "learner" || !!student?.studentCode ||
               !!student?.student_code || !!student?.["Students Code"];
    }

    function studentName(student) {
        return normalize(
            student?.name ||
            student?.studentName ||
            student?.fullName ||
            student?.["Student Name"] ||
            "Unnamed Student"
        );
    }

    function studentCode(student) {
        return normalize(
            student?.studentCode ||
            student?.student_code ||
            student?.["Students Code"] ||
            student?.code
        );
    }

    function studentGrade(student) {
        return normalize(
            student?.Class ||
            student?.class ||
            student?.grade ||
            student?.Grade
        ).toUpperCase();
    }

    function studentSection(student) {
        return normalize(
            student?.["Section/Stream"] ||
            student?.section ||
            student?.stream ||
            student?.Section ||
            student?.Stream
        );
    }

    function classGrade(row) {
        return normalize(
            row?.grade ||
            row?.className ||
            row?.class ||
            row?.Class
        ).toUpperCase();
    }

    function classSection(row) {
        return normalize(
            row?.section ||
            row?.stream ||
            row?.["Section/Stream"] ||
            row?.Section ||
            row?.Stream
        );
    }

    function classStream(row) {
        return normalize(row?.stream || row?.Stream || "General") || "General";
    }

    function getClasses() {
        const stored = read(KEYS.classes, []);
        if (stored.length) return stored;

        // Keep the dashboard consistent with Classes > default class structure.
        return DEFAULT_CLASSES.map((row, index) => ({
            id: `class-${row[1].toLowerCase()}-${row[2].toLowerCase()}-${index}`,
            division: row[0],
            grade: row[1],
            section: row[2],
            stream: row[3],
            classTeacher: "",
            academicYear: "2026"
        }));
    }

    function getStudents() {
        return read(KEYS.students, []);
    }

    function getAccounts() {
        return read(KEYS.accounts, []);
    }

    function getAssessmentRecords() {
        return read(KEYS.assessments, []);
    }

    function getVolunteerRecords() {
        return read(KEYS.volunteer, []);
    }

    function getCurrentUser() {
        try {
            if (window.SAMS_AUTH && typeof window.SAMS_AUTH.getCurrentUser === "function") {
                const user = window.SAMS_AUTH.getCurrentUser();
                if (user) return user;
            }
        } catch (error) {
            console.warn("SAMS_AUTH lookup failed:", error);
        }

        const sessionEmail = normalizeLower(sessionStorage.getItem("sams_email"));
        const accounts = getAccounts();

        if (sessionEmail) {
            const found = accounts.find(account => accountEmail(account) === sessionEmail);
            if (found) return found;
        }

        try {
            const saved = JSON.parse(sessionStorage.getItem("sams_current_user") || "null");
            if (saved && typeof saved === "object") return saved;
        } catch (error) {}

        return null;
    }

    function updateUserDisplay() {
        const user = getCurrentUser();
        const name = user ? accountName(user) : "User";
        const role = user ? accountRole(user) : "Administrator";

        if ($("userName")) $("userName").textContent = name;
        if ($("userRole")) $("userRole").textContent = role;
        if ($("userAvatar")) $("userAvatar").textContent = name.charAt(0).toUpperCase();
    }

    function updateCounts() {
        const students = getStudents();
        const accounts = getAccounts();
        const classes = getClasses();
        const assessments = getAssessmentRecords();

        const studentCount = $("studentCount");
        const staffCount = $("staffCount");
        const classCount = $("classCount");
        const assessmentCount = $("assessmentCount");

        if (studentCount) studentCount.textContent = students.length;

        const staff = accounts.filter(account => {
            const role = normalizeLower(accountRole(account));
            const type = normalizeLower(account?.accountType || account?.type || account?.userType);
            return type === "staff" || type === "teacher" ||
                   ["administrator","principal","vice principal","class teacher","non-class teacher"].includes(role);
        });

        if (staffCount) staffCount.textContent = staff.length;
        if (classCount) classCount.textContent = classes.length;

        const current = getCurrentUser();
        const currentRole = normalizeLower(
            current?.role ||
            current?.staffRole ||
            current?.userRole ||
            current?.accountType ||
            current?.type
        );
        const principal = currentRole === "principal";
        const vicePrincipal = ["vice principal", "viceprincipal", "vp"].includes(currentRole);
        const appointedAssessor = vicePrincipal && current?.isAssessor === true;
        const disciplineOnly = principal || (vicePrincipal && !appointedAssessor);
        const assessmentVisible = principal || vicePrincipal;

        if (assessmentCount) {
            if (!assessmentVisible) {
                const assessmentCard = assessmentCount.closest(".summary-card");
                if (assessmentCard) assessmentCard.style.display = "none";
            } else {
                const assessmentCard = assessmentCount.closest(".summary-card");
                if (assessmentCard) assessmentCard.style.display = "";
                assessmentCount.textContent = disciplineOnly
                    ? assessments.filter(record => normalizeLower(record?.area) === "discipline").length
                    : assessments.length;
            }
        }

        updateNotifications(accounts);
    }

    function pendingStaff(accounts = getAccounts()) {
        return accounts.filter(account =>
            ["pending","awaiting approval","awaiting_approval"].includes(
                normalizeLower(account?.status || account?.approvalStatus)
            )
        );
    }

    function updateNotifications(accounts = getAccounts()) {
        const pending = pendingStaff(accounts);
        const count = $("notificationCount");
        if (count) count.textContent = pending.length;

        const list = $("notificationList");
        if (!list) return;

        if (!pending.length) {
            list.innerHTML = `
                <div class="notification-empty">
                    <div class="notification-empty-icon">✓</div>
                    <strong>No new notifications</strong>
                    <span>There are no staff approvals waiting for action.</span>
                </div>`;
            return;
        }

        list.innerHTML = pending.map(account => `
            <a class="notification-item" href="staff-management.html">
                <span class="notification-item-icon">!</span>
                <span>
                    <strong>Staff approval required</strong>
                    <small>${escapeHTML(accountName(account))} is waiting for approval.</small>
                </span>
            </a>
        `).join("");
    }

    function setupNotifications() {
        const bell = $("notificationBell");
        const panel = $("notificationPanel");
        const close = $("closeNotifications");

        if (!bell || !panel) return;

        function toggle(force) {
            const open = typeof force === "boolean"
                ? force
                : panel.classList.contains("hidden");

            panel.classList.toggle("hidden", !open);
            bell.setAttribute("aria-expanded", String(open));
        }

        bell.addEventListener("click", event => {
            if (event.target.closest("#closeNotifications")) return;
            toggle();
        });

        bell.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggle();
            }
        });

        if (close) close.addEventListener("click", event => {
            event.stopPropagation();
            toggle(false);
        });

        document.addEventListener("click", event => {
            if (!bell.contains(event.target)) toggle(false);
        });
    }

    function updateDate() {
        const dateElement = $("currentDate");
        if (!dateElement) return;

        dateElement.textContent = new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
    }

    function updateFooterYear() {
        if ($("footerYear")) $("footerYear").textContent = new Date().getFullYear();
    }

    function setupMenu() {
        const button = $("menuButton");
        const sidebar = $("sidebar");
        if (!button || !sidebar) return;

        button.addEventListener("click", () => sidebar.classList.toggle("open"));
    }

    function setupLogout() {
        const button = $("logoutButton");
        if (!button) return;

        if (window.SAMS_AUTH && typeof window.SAMS_AUTH.logout === "function") return;

        button.addEventListener("click", () => {
            if (!confirm("Are you sure you want to logout?")) return;
            sessionStorage.clear();
            localStorage.removeItem("sams_logged_in");
            window.location.replace("index.html");
        });
    }

    function setupNavigation() {
        const current = getCurrentUser();
        const role = normalizeLower(
            current?.role ||
            current?.staffRole ||
            current?.userRole ||
            current?.accountType ||
            current?.type
        );

        const administrator = ["administrator", "admin", "administration"].includes(role);
        const principal = role === "principal";

        // Assessment Criteria is an Administrator-only configuration area.
        const criteriaNav = document.getElementById("criteriaNav");
        const criteriaQuickAction = document.getElementById("criteriaQuickAction");
        if (criteriaNav) {
            criteriaNav.style.display = administrator ? "" : "none";
        }
        if (criteriaQuickAction) {
            criteriaQuickAction.style.display = administrator ? "" : "none";
        }
        const vicePrincipal = ["vice principal", "viceprincipal", "vp"].includes(role);
        const appointedAssessor = vicePrincipal && current?.isAssessor === true;

        /*
         * Assessment access rules:
         * Administrator  -> no assessment navigation
         * Principal      -> Discipline only
         * Vice Principal -> Discipline; full assessment when appointed assessor
         * Everyone else  -> no assessment navigation
         */
        document.querySelectorAll('a[href="assessment-dashboard.html"]').forEach(link => {
            const label = link.querySelector("span:last-child") || link;

            if (administrator) {
                // Administration can open the Assessment Dashboard to manage criteria.
                // It cannot record assessments; the dashboard will show the admin-only
                // criteria management action.
                link.href = "assessment-dashboard.html";
                link.style.display = "";
                if (label) label.textContent = "Assessment";
            } else if (principal) {
                link.href = "assessment-dashboard.html";
                link.style.display = "";
                if (label) label.textContent = "Assessment";
            } else if (appointedAssessor) {
                link.href = "assessment-dashboard.html";
                link.style.display = "";
                if (label) label.textContent = "Assessment";
            } else {
                link.style.display = "none";
            }
        });

        /*
         * Staff Management rules:
         * Administrator / Principal / Vice Principal -> full access
         * Everyone else -> view only
         */
        document.querySelectorAll('a[href="staff-management.html"]').forEach(link => {
            link.style.display = "";
        });

        /* Principal dashboard card is Discipline-only. */
        const card = document.getElementById("assessmentCount")?.closest(".summary-card");
        if (card) {
            const label = card.querySelector(".card-label");
            const link = card.querySelector(".card-link a");

            if (principal) {
                if (label) label.textContent = "Assessment Records";
                if (link) {
                    link.textContent = "View assessment records →";
                    link.href = "assessment-dashboard.html";
                }
            } else if (appointedAssessor) {
                if (label) label.textContent = "Assessment Records";
                if (link) {
                    link.textContent = "View assessment records →";
                    link.href = "assessment-dashboard.html";
                }
            } else {
                if (label) label.textContent = "Assessment Records";
                if (link) link.href = "assessment.html";
            }
        }

        /* Quick Actions must follow the same rules as the sidebar. */
        document.querySelectorAll('.quick-actions a[href="assessment.html"], .quick-actions a[href="assessment-dashboard.html"]').forEach(link => {
            if (principal) {
                link.href = "assessment-dashboard.html";
                link.style.display = "";
                link.textContent = "Assessment";
            } else if (appointedAssessor) {
                link.href = "assessment-dashboard.html";
                link.style.display = "";
                link.textContent = "Assessment";
            } else {
                link.style.display = "none";
            }
        });

        /* Assessment Criteria is exposed only to the Administrator. */
    }

    function classStudentCount(classRow, students) {
        const classId = normalize(classRow?.id);

        return students.filter(student => {
            if (student?.classId && classId && normalize(student.classId) === classId) {
                return true;
            }

            return studentGrade(student) === classGrade(classRow) &&
                   studentSection(student).toUpperCase() === classSection(classRow).toUpperCase();
        }).length;
    }

    function renderStudentsOverview() {
        const container = $("studentsOverview");
        if (!container) return;

        const students = getStudents();
        const classes = getClasses();

        if (!students.length) {
            container.innerHTML = `
                <div class="overview-empty">
                    <div class="overview-empty-icon">👨‍🎓</div>
                    <strong>No students registered yet</strong>
                    <span>Add/import students from the Classes page and their statistics will appear here.</span>
                    <a href="classes.html">Go to Classes →</a>
                </div>`;
            return;
        }

        const rows = classes.map(classRow => ({
            classRow,
            count: classStudentCount(classRow, students)
        })).filter(item => item.count > 0)
          .sort((a, b) => {
              const gradeCompare = classGrade(a.classRow).localeCompare(
                  classGrade(b.classRow), undefined, { numeric: true }
              );
              return gradeCompare || classSection(a.classRow).localeCompare(classSection(b.classRow));
          });

        const max = Math.max(...rows.map(row => row.count), 1);

        if (!rows.length) {
            container.innerHTML = `
                <div class="overview-empty">
                    <strong>${students.length} student${students.length === 1 ? "" : "s"} registered</strong>
                    <span>Students are present, but their class/section could not be matched to the class register.</span>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="overview-summary">
                <div>
                    <span>Total registered students</span>
                    <strong>${students.length}</strong>
                </div>
                <div>
                    <span>Classes with students</span>
                    <strong>${rows.length}</strong>
                </div>
            </div>
            <div class="student-bars">
                ${rows.map(row => {
                    const c = row.classRow;
                    const label = `Grade ${classGrade(c)} • ${classSection(c)}`;
                    const stream = classStream(c);
                    const width = Math.max(8, Math.round((row.count / max) * 100));
                    return `
                        <div class="student-bar-row">
                            <div class="student-bar-label">
                                <span>${escapeHTML(label)}${stream !== "General" ? ` • ${escapeHTML(stream)}` : ""}</span>
                                <strong>${row.count}</strong>
                            </div>
                            <div class="student-bar-track">
                                <div class="student-bar-fill" style="width:${width}%"></div>
                            </div>
                        </div>`;
                }).join("")}
            </div>`;
    }

    function activityDate(record) {
        const value = record?.savedAt || record?.createdAt || record?.date || record?.timestamp;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function activityTime(record) {
        const date = activityDate(record);
        if (!date) return "";
        return date.toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function renderRecentActivities() {
        const container = $("recentActivities");
        if (!container) return;

        const activities = [];
        const current = getCurrentUser();
        const currentRole = normalizeLower(
            current?.role ||
            current?.staffRole ||
            current?.userRole ||
            current?.accountType ||
            current?.type
        );
        const principal = currentRole === "principal";
        const vicePrincipal = ["vice principal", "viceprincipal", "vp"].includes(currentRole);
        const appointedAssessor = vicePrincipal && current?.isAssessor === true;
        const assessmentVisible = principal || vicePrincipal;
        const disciplineOnly = principal || (vicePrincipal && !appointedAssessor);

        getAssessmentRecords().forEach(record => {
            if (!assessmentVisible) return;
            if (disciplineOnly && normalizeLower(record?.area) !== "discipline") return;
            activities.push({
                date: activityDate(record),
                icon: "✓",
                title: `${normalize(record.area) || "Assessment"} assessment recorded`,
                detail: `Grade ${normalize(record.class)} • ${normalize(record.section)}${record.assessor ? ` • ${normalize(record.assessor)}` : ""}`,
                href: "assessment-dashboard.html"
            });
        });

        getVolunteerRecords().forEach(record => {
            activities.push({
                date: activityDate(record),
                icon: "★",
                title: "Volunteer activity recorded",
                detail: `${normalize(record.studentName) || "Student"}${record.volunteer ? ` • ${normalize(record.volunteer)}` : ""}`,
                href: "classes.html"
            });
        });

        read(KEYS.gamesSports, []).forEach(record => {
            activities.push({
                date: activityDate(record),
                icon: "⚽",
                title: `Games & Sports: ${normalize(record.result) || "Result"}`,
                detail: `${normalize(record.studentName) || "Student"} • ${normalize(record.sport) || "Sport"} • +${Number(record.points) || 0} points`,
                href: "classes.html"
            });
        });

        pendingStaff().forEach(account => {
            activities.push({
                date: activityDate(account) || new Date(0),
                icon: "!",
                title: "Staff approval pending",
                detail: `${accountName(account)} requires approval`,
                href: "staff-management.html"
            });
        });

        activities.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

        if (!activities.length) {
            container.innerHTML = `
                <div class="activity-empty">
                    <strong>No recent activities yet.</strong>
                    <span>Assessment and volunteer activities will appear here after they are recorded.</span>
                </div>`;
            return;
        }

        container.innerHTML = activities.slice(0, 10).map(activity => `
            <a class="activity-item" href="${activity.href}">
                <span class="activity-icon">${escapeHTML(activity.icon)}</span>
                <span class="activity-body">
                    <strong>${escapeHTML(activity.title)}</strong>
                    <small>${escapeHTML(activity.detail)}</small>
                    <em>${escapeHTML(activityTime({ savedAt: activity.date?.toISOString() }))}</em>
                </span>
            </a>
        `).join("");
    }

    function refreshDashboard() {
        updateUserDisplay();
        updateCounts();
        updateDate();
        updateFooterYear();
        renderStudentsOverview();
        renderRecentActivities();
        setupNavigation();
    }

    function initialize() {
        refreshDashboard();
        setupMenu();
        setupNotifications();
        setupLogout();

        // Some SAMS pages modify localStorage in the same browser tab.
        // The storage event does not fire in that same tab, so a light refresh
        // interval keeps the dashboard synchronized without requiring a reload.
        window.setInterval(refreshDashboard, 1500);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }

    window.addEventListener("storage", refreshDashboard);
    window.addEventListener("pageshow", refreshDashboard);
    window.addEventListener("focus", refreshDashboard);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) refreshDashboard();
    });
})();
