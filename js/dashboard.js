
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


    /* =========================================================
       WEEKLY ASSESSMENT PROGRESS
       Classroom + Assembly + SUPW, Monday-Sunday.
       This is a read-only dashboard view and is intentionally
       visible to every authenticated SAMS user, including students.
       ========================================================= */

    const WEEKLY_AREAS = ["SUPW", "Classroom", "Assembly"];
    const WEEKLY_SERIES = [
        { key: "SUPW", label: "SUPW", color: "#1976d2", className: "supw" },
        { key: "Classroom", label: "Classroom", color: "#12a85b", className: "classroom" },
        { key: "Assembly", label: "Assembly", color: "#7052c7", className: "assembly" },
        { key: "Overall", label: "Overall", color: "#f7941d", className: "overall" }
    ];

    function assessmentWeekStart(dateValue = new Date()) {
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return null;
        date.setHours(0, 0, 0, 0);
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        date.setDate(date.getDate() + diff);
        return date;
    }

    function assessmentWeekEnd(dateValue = new Date()) {
        const start = assessmentWeekStart(dateValue);
        if (!start) return null;
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return end;
    }

    function formatWeekRange() {
        const start = assessmentWeekStart();
        const end = assessmentWeekEnd();
        if (!start || !end) return "Current week";
        const options = { day: "2-digit", month: "short", year: "numeric" };
        const left = start.toLocaleDateString("en-GB", options);
        const right = end.toLocaleDateString("en-GB", options);
        return `${left} – ${right}`;
    }

    function assessmentRecordDate(record) {
        const value = record?.savedAt || record?.createdAt || record?.timestamp || record?.date;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function isDateInRange(date, start, end) {
        return !!date && !!start && !!end && date >= start && date <= end;
    }

    function sameClassSection(record, classRow) {
        const recordGrade = classGrade({
            grade: record?.class || record?.grade || record?.Class
        });
        const recordSection = classSection({
            section: record?.section || record?.stream || record?.Section || record?.Stream
        });

        return recordGrade === classGrade(classRow) &&
               normalizeLower(recordSection) === normalizeLower(classSection(classRow));
    }

    function weeklyAreaDone(classRow, area, records, start, end) {
        return records.some(record =>
            isDateInRange(assessmentRecordDate(record), start, end) &&
            normalizeLower(record?.area) === normalizeLower(area) &&
            sameClassSection(record, classRow)
        );
    }

    function classDisplayLabel(classRow) {
        const grade = classGrade(classRow);
        const section = classSection(classRow);
        const stream = classStream(classRow);
        const suffix = section || stream;
        return `Grade ${grade}${suffix ? ` • ${suffix}` : ""}`;
    }

    function sortClasses(a, b) {
        const gradeCompare = classGrade(a).localeCompare(
            classGrade(b), undefined, { numeric: true }
        );
        if (gradeCompare) return gradeCompare;
        return classSection(a).localeCompare(classSection(b), undefined, { numeric: true });
    }

    function weeklyStatusCell(done) {
        return done
            ? `<span class="weekly-status done"><span class="status-check">✓</span> Done</span>`
            : `<span class="weekly-status pending"><span class="status-check">–</span> Pending</span>`;
    }

    function getThreeAssessmentWeeks() {
        const currentStart = assessmentWeekStart();
        if (!currentStart) return [];
        return [2, 1, 0].map((weeksAgo, index) => {
            const start = new Date(currentStart);
            start.setDate(start.getDate() - (weeksAgo * 7));
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            return {
                number: index + 1,
                start,
                end,
                label: `Week ${index + 1}`,
                rangeLabel: `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`
            };
        });
    }

    function calculateWeeklyPercentages(classes, records, week) {
        const values = {};
        WEEKLY_AREAS.forEach(area => {
            const completed = classes.filter(classRow =>
                weeklyAreaDone(classRow, area, records, week.start, week.end)
            ).length;
            values[area] = classes.length ? Math.round((completed / classes.length) * 100) : 0;
        });
        values.Overall = Math.round(
            (values.SUPW + values.Classroom + values.Assembly) / WEEKLY_AREAS.length
        );
        return values;
    }

    function renderWeeklyProgressChart(classes, records) {
        const container = $("weeklyProgressChart");
        if (!container) return;

        const weeks = getThreeAssessmentWeeks();
        if (!weeks.length || !classes.length) {
            container.innerHTML = `<div class="chart-loading">No class data available for the weekly chart.</div>`;
            return;
        }

        const points = weeks.map(week => calculateWeeklyPercentages(classes, records, week));
        const width = 700;
        const height = 330;
        const left = 58;
        const right = 18;
        const top = 24;
        const bottom = 58;
        const plotWidth = width - left - right;
        const plotHeight = height - top - bottom;
        const xPositions = weeks.map((_, i) => left + (plotWidth * i / Math.max(1, weeks.length - 1)));
        const y = value => top + ((100 - value) / 100) * plotHeight;

        const grid = [0, 20, 40, 60, 80, 100].map(value => `
            <line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" class="chart-grid-line" />
            <text x="${left - 10}" y="${y(value) + 4}" class="chart-axis-label" text-anchor="end">${value}%</text>
        `).join("");

        const xLabels = weeks.map((week, i) => `
            <text x="${xPositions[i]}" y="${height - 30}" class="chart-week-label" text-anchor="middle">${week.label}</text>
            <text x="${xPositions[i]}" y="${height - 13}" class="chart-date-label" text-anchor="middle">${escapeHTML(week.rangeLabel)}</text>
        `).join("");

        const seriesSvg = WEEKLY_SERIES.map(series => {
            const polyline = points.map((point, i) => `${xPositions[i]},${y(point[series.key])}`).join(" ");
            const circles = points.map((point, i) => `
                <circle cx="${xPositions[i]}" cy="${y(point[series.key])}" r="4.5" fill="${series.color}" class="chart-point">
                    <title>${series.label}, ${weeks[i].label}: ${point[series.key]}%</title>
                </circle>
            `).join("");
            return `<polyline points="${polyline}" fill="none" stroke="${series.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="chart-series ${series.className}" />${circles}`;
        }).join("");

        container.innerHTML = `
            <svg class="weekly-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Whole class weekly assessment completion line chart">
                <g>${grid}</g>
                <line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" class="chart-axis-line" />
                <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" class="chart-axis-line" />
                <g>${seriesSvg}</g>
                <g>${xLabels}</g>
            </svg>
        `;
    }

    function renderWeeklyProgress() {
        const body = $("weeklyProgressBody");
        if (!body) return;

        const classes = getClasses().slice().sort(sortClasses);
        const records = getAssessmentRecords();
        const range = $("weeklyRangeTop");
        if (range) range.textContent = formatWeekRange();
        if ($("weeklyClassCount")) $("weeklyClassCount").textContent = `${classes.length} Classes`;

        if (!classes.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="4" class="weekly-empty-cell">No classes are registered yet.</td>
                </tr>`;
            ["supwSummary", "classroomSummary", "assemblySummary", "overallSummary"].forEach(id => {
                if ($(id)) $(id).textContent = "0%";
            });
            renderWeeklyProgressChart([], records);
            return;
        }

        const currentStart = assessmentWeekStart();
        const currentEnd = assessmentWeekEnd();
        const completed = { SUPW: 0, Classroom: 0, Assembly: 0 };

        const rows = classes.map(classRow => {
            const status = {};
            WEEKLY_AREAS.forEach(area => {
                status[area] = weeklyAreaDone(classRow, area, records, currentStart, currentEnd);
                if (status[area]) completed[area] += 1;
            });
            return { classRow, status };
        });

        body.innerHTML = rows.map(row => `
            <tr>
                <th scope="row"><span class="class-label">${escapeHTML(classDisplayLabel(row.classRow))}</span></th>
                <td>${weeklyStatusCell(row.status.SUPW)}</td>
                <td>${weeklyStatusCell(row.status.Classroom)}</td>
                <td>${weeklyStatusCell(row.status.Assembly)}</td>
            </tr>
        `).join("");

        const percentages = {};
        WEEKLY_AREAS.forEach(area => {
            percentages[area] = Math.round((completed[area] / classes.length) * 100);
        });
        percentages.Overall = Math.round(
            (percentages.SUPW + percentages.Classroom + percentages.Assembly) / WEEKLY_AREAS.length
        );

        const summaryMap = [
            ["SUPW", "supwSummary", "supwPercent", "supwMeter"],
            ["Classroom", "classroomSummary", "classroomPercent", "classroomMeter"],
            ["Assembly", "assemblySummary", "assemblyPercent", "assemblyMeter"],
            ["Overall", "overallSummary", "overallPercent", "overallMeter"]
        ];

        summaryMap.forEach(([key, valueId, percentId, meterId]) => {
            const count = key === "Overall" ? percentages[key] : completed[key];
            if ($(valueId)) $(valueId).textContent = key === "Overall" ? `${percentages[key]}%` : `${count} / ${classes.length}`;
            if ($(percentId)) $(percentId).textContent = `${percentages[key]}% ${key === "Overall" ? "overall completion" : "classes completed"}`;
            if ($(meterId)) $(meterId).style.width = `${percentages[key]}%`;
        });

        renderWeeklyProgressChart(classes, records);
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

    function refreshDashboard() {
        updateUserDisplay();
        updateCounts();
        updateDate();
        updateFooterYear();
        renderWeeklyProgress();
        setupNavigation();
    }

    async function initialize() {
        // Pull the shared SAMS data first so the weekly table is identical
        // across phones, laptops and user accounts. If the cloud is
        // unavailable, the existing local cache is used as a fallback.
        try {
            if (window.samsCloud && typeof window.samsCloud.pullAll === "function") {
                await window.samsCloud.pullAll();
            }
        } catch (error) {
            console.warn("SAMS weekly dashboard could not refresh cloud data; using local cache.", error);
        }

        refreshDashboard();
        setupMenu();
        setupNotifications();
        setupLogout();

        // Keep the read-only progress board current if another SAMS page
        // records an assessment in this browser/device.
        window.setInterval(refreshDashboard, 3000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }

    window.addEventListener("sams-cloud-ready", refreshDashboard);
    window.addEventListener("storage", refreshDashboard);
    window.addEventListener("pageshow", refreshDashboard);
    window.addEventListener("focus", refreshDashboard);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) refreshDashboard();
    });
})();
