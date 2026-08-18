
/* SAMS FINAL DASHBOARD ASSESSMENT POLICY
   Principal + Vice Principal: Assessment -> Discipline only.
   Other staff: Assessment only when appointed assessor.
   Volunteer/Games permissions are handled separately on Classes.
*/
function samsAssessmentAccessPolicy(user) {
    const role = samsNormaliseRole(
        user?.role || user?.staffRole || user?.userRole || user?.user_role || user?.position || ""
    );
    const principal = role === "principal";
    const vicePrincipal = role === "vice principal" || role === "viceprincipal" || role === "vp";
    const assessor = user?.isAssessor === true ||
        user?.is_assessor === true ||
        String(user?.isAssessor ?? user?.is_assessor ?? "").trim().toLowerCase() === "true";

    if (principal || vicePrincipal) {
        return { allowed: true, areas: ["discipline"] };
    }
    if (assessor) {
        return { allowed: true, areas: ["assigned"] };
    }
    return { allowed: false, areas: [] };
}

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
        const nonClassTeacher = ["non-class teacher", "non class teacher"].includes(currentRole);
        const appointedAssessor =
            (vicePrincipal || nonClassTeacher) &&
            current?.isAssessor === true;
        const disciplineOnly = principal || (vicePrincipal && !appointedAssessor);
        const assessmentVisible = principal || vicePrincipal || appointedAssessor;

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

    function startOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day; // Monday as first day
        d.setDate(d.getDate() + diff);
        return d;
    }

    function endOfWeek(date) {
        const d = startOfWeek(date);
        d.setDate(d.getDate() + 6);
        d.setHours(23, 59, 59, 999);
        return d;
    }

    function weekLabel(date = new Date()) {
        const start = startOfWeek(date);
        const end = endOfWeek(date);
        const sameYear = start.getFullYear() === end.getFullYear();

        const startText = start.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: sameYear ? undefined : "numeric"
        });
        const endText = end.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });

        return `${startText} – ${endText}`;
    }

    function updateDate() {
        const dateElement = $("currentDate");
        if (!dateElement) return;

        dateElement.textContent = weekLabel();
    }

    function normalizeClassKey(value) {
        return normalize(value)
            .toUpperCase()
            .replace(/^GRADE\s*/, "")
            .replace(/^CLASS\s*/, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function normalizeSectionKey(value) {
        return normalize(value)
            .toUpperCase()
            .replace(/SECTION\s*\/\s*STREAM/i, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function recordBelongsToClass(record, classRow) {
        const recordGrade = normalizeClassKey(record?.class || record?.grade);
        const recordSection = normalizeSectionKey(record?.section || record?.stream);

        const rowGrade = normalizeClassKey(classGrade(classRow));
        const rowSection = normalizeSectionKey(classSection(classRow));

        if (recordGrade !== rowGrade || recordSection !== rowSection) return false;

        // Keep the match strict for the same grade/section, while allowing
        // older records that did not store the stream explicitly.
        const rowStream = normalizeSectionKey(classRow?.stream);
        const recordStream = normalizeSectionKey(record?.stream);
        if (rowStream && rowStream !== "GENERAL" && recordStream &&
            recordStream !== "GENERAL" && rowStream !== recordStream) {
            return false;
        }

        return true;
    }

    function assessmentDate(record) {
        const raw = record?.savedAt || record?.createdAt || record?.timestamp || record?.date;
        if (!raw) return null;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function weeklyAssessmentStatus(classRow, area, now = new Date()) {
        const start = startOfWeek(now);
        const end = endOfWeek(now);

        const matches = getAssessmentRecords()
            .filter(record =>
                normalizeLower(record?.area) === normalizeLower(area) &&
                recordBelongsToClass(record, classRow)
            )
            .map(record => ({ record, date: assessmentDate(record) }))
            .filter(item => item.date && item.date >= start && item.date <= end)
            .sort((a, b) => b.date.getTime() - a.date.getTime());

        return {
            done: matches.length > 0,
            date: matches.length ? matches[0].date : null
        };
    }

    function formatAssessmentDate(date) {
        if (!date) return "";
        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short"
        });
    }

    function renderWeeklyAssessmentProgress() {
        const container = $("weeklyAssessmentProgress");
        if (!container) return;

        const classes = getClasses().slice().sort((a, b) => {
            const gradeCompare = classGrade(a).localeCompare(
                classGrade(b), undefined, { numeric: true }
            );
            return gradeCompare ||
                classSection(a).localeCompare(classSection(b), undefined, { numeric: true });
        });

        const areas = ["SUPW", "Classroom", "Assembly"];
        const totals = { SUPW: 0, Classroom: 0, Assembly: 0 };

        const rows = classes.map(classRow => {
            const status = {};
            areas.forEach(area => {
                status[area] = weeklyAssessmentStatus(classRow, area);
                if (status[area].done) totals[area] += 1;
            });

            const completed = areas.filter(area => status[area].done).length;
            return {
                classRow,
                status,
                completed,
                progress: Math.round((completed / areas.length) * 100)
            };
        });

        const totalClasses = rows.length;
        const cardData = [
            {
                key: "Classes",
                value: totalClasses,
                label: "Total Classes",
                percent: 100,
                color: "blue",
                icon: "🏫"
            },
            {
                key: "SUPW",
                value: totals.SUPW,
                label: "Assessments Done",
                percent: totalClasses ? Math.round((totals.SUPW / totalClasses) * 100) : 0,
                color: "green",
                icon: "🌱"
            },
            {
                key: "Classroom",
                value: totals.Classroom,
                label: "Assessments Done",
                percent: totalClasses ? Math.round((totals.Classroom / totalClasses) * 100) : 0,
                color: "orange",
                icon: "🧑‍🏫"
            },
            {
                key: "Assembly",
                value: totals.Assembly,
                label: "Assessments Done",
                percent: totalClasses ? Math.round((totals.Assembly / totalClasses) * 100) : 0,
                color: "purple",
                icon: "📣"
            }
        ];

        const cards = $("weeklySummaryCards");
        if (cards) {
            cards.innerHTML = cardData.map(card => `
                <article class="weekly-summary-card ${card.color}">
                    <div class="weekly-card-top">
                        <span class="weekly-card-icon" aria-hidden="true">${card.icon}</span>
                        <div>
                            <div class="weekly-card-title">${escapeHTML(card.key)}</div>
                            <div class="weekly-card-number">${card.value}</div>
                            <div class="weekly-card-label">${escapeHTML(card.label)}</div>
                        </div>
                    </div>
                    <div class="weekly-card-progress">
                        <strong>${card.value}/${totalClasses}</strong>
                        <span class="weekly-progress-track">
                            <span style="width:${card.percent}%"></span>
                        </span>
                        <strong>${card.percent}%</strong>
                    </div>
                </article>
            `).join("");
        }

        const table = $("weeklyAssessmentTable");
        if (!table) return;

        if (!rows.length) {
            table.innerHTML = `
                <div class="weekly-empty">
                    <strong>No classes are registered yet.</strong>
                    <span>Add classes from the Classes page and weekly assessment progress will appear here.</span>
                </div>`;
            return;
        }

        table.innerHTML = `
            <div class="weekly-table-wrap">
                <table class="weekly-table">
                    <thead>
                        <tr>
                            <th>Class / Section</th>
                            <th>SUPW</th>
                            <th>Classroom</th>
                            <th>Assembly</th>
                            <th>Overall Progress</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => {
                            const c = row.classRow;
                            const label = `Grade ${classGrade(c)} • ${classSection(c)}`;
                            return `
                                <tr>
                                    <td class="weekly-class-name">
                                        <strong>${escapeHTML(label)}</strong>
                                    </td>
                                    ${areas.map(area => {
                                        const item = row.status[area];
                                        return `
                                            <td>
                                                <span class="weekly-status ${item.done ? "done" : "pending"}">
                                                    <span class="weekly-status-icon">${item.done ? "✓" : "×"}</span>
                                                    <span>
                                                        <strong>${item.done ? "Done" : "Pending"}</strong>
                                                        ${item.done ? `<small>${formatAssessmentDate(item.date)}</small>` : ""}
                                                    </span>
                                                </span>
                                            </td>`;
                                    }).join("")}
                                    <td>
                                        <div class="weekly-overall">
                                            <span class="weekly-ring" style="--progress:${row.progress * 3.6}deg; --ring-color:${row.progress === 100 ? "#12a85b" : row.progress >= 67 ? "#f7941d" : "#e33d49"}">
                                                <span>${row.progress}%</span>
                                            </span>
                                        </div>
                                    </td>
                                </tr>`;
                        }).join("")}
                    </tbody>
                </table>
            </div>
            <div class="weekly-table-footer">
                <div class="weekly-legend">
                    <span><i class="legend-dot done"></i> Done</span>
                    <span><i class="legend-dot pending"></i> Pending</span>
                    <span><i class="legend-dot na"></i> Not Applicable</span>
                </div>
                <span class="weekly-updated">Week: ${escapeHTML(weekLabel())}</span>
            </div>`;
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
        const nonClassTeacher = ["non-class teacher", "non class teacher"].includes(role);
        const appointedAssessor =
            (vicePrincipal || nonClassTeacher) &&
            current?.isAssessor === true;

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
        const nonClassTeacher = ["non-class teacher", "non class teacher"].includes(currentRole);
        const appointedAssessor =
            (vicePrincipal || nonClassTeacher) &&
            current?.isAssessor === true;
        const assessmentVisible = principal || vicePrincipal || appointedAssessor;
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

    let cloudLoaded = false;

    async function loadSharedDashboardData() {
        if (cloudLoaded) return;
        try {
            if (window.samsCloud && typeof window.samsCloud.pullAll === "function") {
                await window.samsCloud.pullAll();
            }
        } catch (error) {
            console.warn("SAMS weekly assessment data could not be refreshed from cloud; using local data.", error);
        } finally {
            cloudLoaded = true;
        }
    }

    function refreshDashboard() {
        updateUserDisplay();
        updateCounts();
        updateDate();
        updateFooterYear();
        renderWeeklyAssessmentProgress();
        renderRecentActivities();
        setupNavigation();
    }

    async function initialize() {
        await loadSharedDashboardData();
        refreshDashboard();
        setupMenu();
        setupNotifications();
        setupLogout();

        // Some SAMS pages modify localStorage in the same browser tab.
        // The storage event does not fire in that same tab, so a light refresh
        // interval keeps the dashboard synchronized without requiring a reload.
        window.setInterval(refreshDashboard, 5000);

        // Refresh the shared weekly status from Supabase periodically so that
        // the dashboard stays useful on different phones/computers and for
        // users who are viewing while an assessor records an assessment.
        window.setInterval(async () => {
            cloudLoaded = false;
            await loadSharedDashboardData();
            refreshDashboard();
        }, 30000);
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
