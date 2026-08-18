/* =========================================================
   SAMS - STAFF MANAGEMENT.JS

   Handles ONLY staff-management.html

   PERMISSIONS
   ---------------------------------------------------------
   Administrator   -> Full Staff Management
   Principal       -> Full Staff Management
   Vice Principal  -> Full Staff Management
   Class Teacher   -> View Only
   Non-Class Teacher -> View Only

   ASSESSOR
   ---------------------------------------------------------
   Only Vice Principals can be appointed as Assessors.

   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STORAGE KEY
       ===================================================== */

    const ACCOUNTS_KEY = "sams_accounts";


    /* =====================================================
       GET ACCOUNTS
       ===================================================== */

    function getAccounts() {

        try {

            const saved =
                localStorage.getItem(
                    ACCOUNTS_KEY
                );

            if (!saved) {
                return [];
            }

            const accounts =
                JSON.parse(saved);

            return Array.isArray(accounts)
                ? accounts
                : [];

        }

        catch (error) {

            console.error(
                "Unable to read SAMS accounts:",
                error
            );

            return [];

        }

    }


    /* =====================================================
       SAVE ACCOUNTS
       ===================================================== */

    function saveAccounts(accounts) {

        localStorage.setItem(
            ACCOUNTS_KEY,
            JSON.stringify(accounts)
        );

    }


    /* =====================================================
       SYNC STAFF PERMISSION TO SUPABASE

       Local storage remains the UI cache, but role/status/assessor
       permissions must also be written to the central profile so the
       same account works on another computer or phone.
       ===================================================== */

    async function syncProfileToCloud(account, changes) {
        try {
            if (!window.samsSupabase || !account) return;

            const email = String(
                account?.email ||
                account?.educationalEmail ||
                account?.educational_email ||
                ""
            ).trim().toLowerCase();

            if (!email) return;

            let profileId = String(account?.id || "").trim();

            if (!profileId) {
                const lookup = await window.samsSupabase
                    .from("profiles")
                    .select("id")
                    .eq("email", email)
                    .maybeSingle();

                if (lookup.error || !lookup.data?.id) {
                    console.warn("Could not find Supabase profile for", email, lookup.error);
                    return;
                }
                profileId = String(lookup.data.id);
                account.id = profileId;
            }

            const payload = { ...changes };
            if (payload.role) {
                const roleMap = {
                    "Administrator":"admin",
                    "Principal":"principal",
                    "Vice Principal":"vice_principal",
                    "Class Teacher":"class_teacher",
                    "Non-Class Teacher":"non_class_teacher"
                };
                payload.role = roleMap[payload.role] || payload.role;
            }

            const result = await window.samsSupabase
                .from("profiles")
                .update(payload)
                .eq("id", profileId);

            if (result.error) {
                console.error("SAMS profile sync failed:", result.error);
            }
        } catch (error) {
            console.error("SAMS profile sync error:", error);
        }
    }


    async function syncAllStaffProfilesToCloud() {
        if (!window.samsSupabase) return;
        const staff = getAccounts().filter(isStaff);
        for (const account of staff) {
            await syncProfileToCloud(account, {
                role: account.role,
                active: String(account.status || "").trim().toLowerCase() === "active",
                status: String(account.status || "").trim() || "Pending",
                is_assessor: account.isAssessor === true
            });
        }
    }


    /* =====================================================
       LOAD ALL REGISTERED USERS FROM SUPABASE
       ===================================================== */

    function mapCloudRole(role) {

        const value =
            String(role || "")
                .trim()
                .toLowerCase()
                .replace(/[-_]+/g, " ")
                .replace(/\s+/g, " ");

        const roleMap = {
            "admin": "Administrator",
            "administrator": "Administrator",
            "administration": "Administrator",
            "principal": "Principal",
            "vice principal": "Vice Principal",
            "viceprincipal": "Vice Principal",
            "vp": "Vice Principal",
            "class teacher": "Class Teacher",
                "non class teacher": "Non-Class Teacher",
            "non-class teacher": "Non-Class Teacher",
            "assessor": "Assessor",
            "student": "Student"
        };

        return roleMap[value] || "";
    }


    function isExplicitStudent(profile) {

        const role =
            String(
                profile?.role ||
                profile?.user_role ||
                profile?.userRole ||
                profile?.accountType ||
                profile?.account_type ||
                profile?.type ||
                profile?.user_type ||
                profile?.userType ||
                ""
            )
            .trim()
            .toLowerCase()
            .replace(/[-_]+/g, " ")
            .replace(/\s+/g, " ");

        return role === "student";

    }


    function cloudProfileToAccount(profile, existingAccount) {

        const mappedRole =
            mapCloudRole(
                profile?.role ||
                profile?.user_role ||
                profile?.userRole ||
                profile?.accountType ||
                profile?.account_type
            );

        const rawStatus =
            String(
                profile?.status ||
                profile?.account_status ||
                profile?.accountStatus ||
                ""
            )
            .trim()
            .toLowerCase();

        let status = "";

        if (
            rawStatus === "active" ||
            rawStatus === "approved"
        ) {
            status = "active";
        }
        else if (rawStatus === "rejected") {
            status = "rejected";
        }
        else if (rawStatus === "pending") {
            status = "pending";
        }
        else {
            status =
                profile?.active === true
                    ? "active"
                    : "pending";
        }

        const name =
            profile?.full_name ||
            profile?.fullName ||
            profile?.name ||
            profile?.staffName ||
            profile?.display_name ||
            profile?.displayName ||
            profile?.email ||
            "Unnamed Staff";

        const email =
            String(
                profile?.email ||
                profile?.educationalEmail ||
                profile?.educational_email ||
                ""
            )
            .trim()
            .toLowerCase();

        const employeeId =
            profile?.employee_code ||
            profile?.employeeCode ||
            profile?.employee_id ||
            profile?.employeeId ||
            profile?.employeeID ||
            existingAccount?.employeeId ||
            "";

        return {

            ...(existingAccount || {}),

            id:
                profile?.id ||
                existingAccount?.id,

            name:
                name,

            fullName:
                name,

            staffName:
                name,

            email:
                email,

            educationalEmail:
                email,

            educational_email:
                email,

            employeeId:
                employeeId,

            employeeID:
                employeeId,

            employee_id:
                employeeId,

            role:
                mappedRole,

            staffRole:
                mappedRole,

            userRole:
                mappedRole,

            accountType:
                isExplicitStudent(profile)
                    ? "student"
                    : "staff",

            userType:
                isExplicitStudent(profile)
                    ? "student"
                    : "staff",

            status:
                status,

            active:
                status === "active",

            isAssessor:
                profile?.is_assessor === true ||
                profile?.isAssessor === true ||
                existingAccount?.isAssessor === true,

            assignedClass:
                profile?.assigned_class ||
                profile?.assignedClass ||
                existingAccount?.assignedClass ||
                "",

            assignedStream:
                profile?.assigned_stream ||
                profile?.assignedStream ||
                existingAccount?.assignedStream ||
                "",

            assignedSection:
                profile?.assigned_section ||
                profile?.assignedSection ||
                existingAccount?.assignedSection ||
                "No Section"

        };

    }


    async function loadAllProfilesFromCloud() {

        const tbody =
            document.getElementById(
                "staffTableBody"
            );

        /* Always render the local staff cache first so the table is never
           left on a permanent "Loading" state while Supabase responds. */
        renderStaff();

        if (!window.samsSupabase) {

            console.warn(
                "SAMS Supabase client is not available. Using local cache."
            );

            updateSummary();
            renderStaff();
            return;

        }

        try {

            /*
             * SUPABASE IS NOW THE SOURCE OF TRUTH.
             * All registered non-student profiles are loaded.
             */
            const result =
                await window.samsSupabase
                    .from("profiles")
                    .select("*");

            if (result.error) {

                console.error(
                    "Unable to load registered SAMS users:",
                    result.error
                );

                updateSummary();
                renderStaff();
                return;

            }

            const profiles =
                Array.isArray(result.data)
                    ? result.data
                    : [];

            const oldAccounts =
                getAccounts();

            const oldByEmail =
                new Map();

            oldAccounts.forEach(
                account => {

                    const email =
                        String(
                            account?.email ||
                            account?.educationalEmail ||
                            account?.educational_email ||
                            ""
                        )
                        .trim()
                        .toLowerCase();

                    if (email) {
                        oldByEmail.set(
                            email,
                            account
                        );
                    }

                }
            );


            /*
             * A newly registered user with no role is deliberately
             * shown as Staff + Pending. The Administrator can then
             * assign the correct role and press Approve.
             */
            const cloudAccounts =
                profiles
                    .filter(
                        profile =>
                            !isExplicitStudent(profile)
                    )
                    .map(
                        profile => {

                            const email =
                                String(
                                    profile?.email ||
                                    profile?.educationalEmail ||
                                    profile?.educational_email ||
                                    ""
                                )
                                .trim()
                                .toLowerCase();

                            return cloudProfileToAccount(
                                profile,
                                oldByEmail.get(email)
                            );

                        }
                    );


            /*
             * Keep old local-only staff records so manually-created
             * staff do not disappear if they are not yet in Supabase.
             */
            const cloudIds =
                new Set(
                    cloudAccounts.map(
                        account =>
                            String(
                                account?.id || ""
                            )
                    )
                );

            const cloudEmails =
                new Set(
                    cloudAccounts.map(
                        account =>
                            String(
                                account?.email || ""
                            )
                            .trim()
                            .toLowerCase()
                    )
                );

            oldAccounts
                .filter(isStaff)
                .forEach(
                    account => {

                        const id =
                            String(
                                account?.id || ""
                            );

                        const email =
                            String(
                                account?.email ||
                                account?.educationalEmail ||
                                account?.educational_email ||
                                ""
                            )
                            .trim()
                            .toLowerCase();

                        if (
                            (!id || !cloudIds.has(id)) &&
                            (!email || !cloudEmails.has(email))
                        ) {
                            cloudAccounts.push(
                                account
                            );
                        }

                    }
                );


            saveAccounts(
                cloudAccounts
            );

            updateCurrentUser();
            updateSummary();
            renderStaff();

            console.log(
                `SAMS: loaded ${cloudAccounts.length} registered staff profile(s) from Supabase.`
            );

        }

        catch (error) {

            console.error(
                "SAMS cloud profile loading failed:",
                error
            );

            updateSummary();
            renderStaff();

        }

    }


    function setupCloudRefresh() {

        document.addEventListener(
            "visibilitychange",
            function () {

                if (
                    document.visibilityState === "visible"
                ) {
                    loadAllProfilesFromCloud();
                }

            }
        );

        window.addEventListener(
            "focus",
            function () {
                loadAllProfilesFromCloud();
            }
        );

    }


    /* =====================================================
       NORMALIZE ROLE
       ===================================================== */

    function normalizeRole(account) {

        return String(

            account?.role ||
            account?.staffRole ||
            account?.userRole ||
            account?.designation ||
            account?.position ||
            account?.accountType ||
            ""

        )
        .trim()
        .toLowerCase()
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ");

    }


    /* =====================================================
       CURRENT USER

       IMPORTANT:
       Always resolve the user from the canonical
       sams_accounts record first.

       This prevents a stale session object from
       giving the user the wrong role.
       ===================================================== */

    function getCurrentUser() {

        const accounts =
            getAccounts();


        /*
         * -------------------------------------------------
         * 1. Get logged-in email
         * -------------------------------------------------
         */

        const sessionEmail =
            String(
                sessionStorage.getItem(
                    "sams_email"
                ) ||
                ""
            )
            .trim()
            .toLowerCase();


        /*
         * -------------------------------------------------
         * 2. Find canonical account by email
         * -------------------------------------------------
         */

        if (sessionEmail) {

            const canonicalAccount =
                accounts.find(
                    account => {

                        const email =
                            String(
                                account?.email ||
                                account?.educationalEmail ||
                                account?.educational_email ||
                                ""
                            )
                            .trim()
                            .toLowerCase();


                        return (
                            email ===
                            sessionEmail
                        );

                    }
                );


            if (canonicalAccount) {

                return canonicalAccount;

            }

        }


        /*
         * -------------------------------------------------
         * 3. Try SAMS_AUTH
         * -------------------------------------------------
         */

        try {

            if (
                window.SAMS_AUTH &&
                typeof window.SAMS_AUTH.getCurrentUser ===
                    "function"
            ) {

                const authenticatedUser =
                    window.SAMS_AUTH.getCurrentUser();


                if (authenticatedUser) {

                    const authenticatedEmail =
                        String(
                            authenticatedUser.email ||
                            authenticatedUser.educationalEmail ||
                            authenticatedUser.educational_email ||
                            ""
                        )
                        .trim()
                        .toLowerCase();


                    if (authenticatedEmail) {

                        const matchedAccount =
                            accounts.find(
                                account => {

                                    const email =
                                        String(
                                            account?.email ||
                                            account?.educationalEmail ||
                                            account?.educational_email ||
                                            ""
                                        )
                                        .trim()
                                        .toLowerCase();


                                    return (
                                        email ===
                                        authenticatedEmail
                                    );

                                }
                            );


                        if (matchedAccount) {

                            return matchedAccount;

                        }

                    }


                    return authenticatedUser;

                }

            }

        }

        catch (error) {

            console.warn(
                "SAMS_AUTH resolution failed:",
                error
            );

        }


        /*
         * -------------------------------------------------
         * 4. Fallback to saved session user
         * -------------------------------------------------
         */

        try {

            const savedUser =
                JSON.parse(
                    sessionStorage.getItem(
                        "sams_current_user"
                    ) ||
                    "null"
                );


            if (
                savedUser &&
                typeof savedUser === "object"
            ) {

                return savedUser;

            }

        }

        catch (error) {

            console.warn(
                "SAMS saved-user lookup failed:",
                error
            );

        }


        return null;

    }


    /* =====================================================
       CURRENT USER ROLE
       ===================================================== */

    function getCurrentUserRole() {

        const user =
            getCurrentUser();


        if (!user) {

            return "";

        }


        return normalizeRole(user);

    }


    /* =====================================================
       DISPLAY CURRENT USER
       ===================================================== */

    function updateCurrentUser() {

        const user =
            getCurrentUser();


        const nameElement =
            document.getElementById(
                "userName"
            );


        const roleElement =
            document.getElementById(
                "userRole"
            );


        const avatarElement =
            document.getElementById(
                "userAvatar"
            );


        if (!user) {

            if (nameElement) {

                nameElement.textContent =
                    "Administrator";

            }


            if (roleElement) {

                roleElement.textContent =
                    "Administrator";

            }


            if (avatarElement) {

                avatarElement.textContent =
                    "A";

            }


            return;

        }


        const name =
            String(
                user.name ||
                user.fullName ||
                user.staffName ||
                user.displayName ||
                user.email ||
                "User"
            )
            .trim();


        const displayRole =
            String(
                user.role ||
                user.staffRole ||
                user.userRole ||
                user.designation ||
                user.position ||
                user.accountType ||
                "User"
            )
            .trim();


        if (nameElement) {

            nameElement.textContent =
                name;

        }


        if (roleElement) {

            roleElement.textContent =
                displayRole;

        }


        if (avatarElement) {

            avatarElement.textContent =
                name
                    .charAt(0)
                    .toUpperCase();

        }

    }


    /* =====================================================
       FULL STAFF MANAGEMENT ACCESS

       Administrator
       Principal
       Vice Principal

       All three have full access.
       ===================================================== */

    function hasFullStaffManagementAccess() {

        const role =
            getCurrentUserRole();


        return (

            role === "administrator" ||
            role === "administration" ||
            role === "admin" ||

            role === "principal" ||

            role === "vice principal" ||
            role === "viceprincipal" ||
            role === "vp"

        );

    }


    /* =====================================================
       CAN APPOINT ASSESSOR

       Administrator, Principal and Vice Principal
       can appoint an assessor.

       HOWEVER:
       Only a Vice Principal can actually become
       an assessor.
       ===================================================== */

    function canAppointAssessor() {

        return hasFullStaffManagementAccess();

    }


    /* =====================================================
       ASSESSOR ELIGIBILITY

       Administrator, Principal and Vice Principal manage
       appointments. Eligible assessors are Vice Principals
       and Non-Class Teachers. Class Teachers are never assessors.
       ===================================================== */

    function isAssessorEligible(account) {
        const role = normalizeRole(account);
        return (
            role === "vice principal" ||
            role === "non class teacher" ||
            role === "non-class teacher"
        );
    }


    /* =====================================================
       CAN APPROVE STAFF

       Administrator, Principal and Vice Principal
       have staff-management approval access.
       ===================================================== */

    function canApproveStaff() {

        return hasFullStaffManagementAccess();

    }


    /* =====================================================
       CAN CHANGE STAFF ROLE

       Administrator, Principal and Vice Principal
       can change staff roles.
       ===================================================== */

    function canChangeStaffRole() {

        return hasFullStaffManagementAccess();

    }


    /* =====================================================
       CAN DELETE STAFF

       Administrator, Principal and Vice Principal
       can delete staff.
       ===================================================== */

    function canDeleteStaff() {

        return hasFullStaffManagementAccess();

    }


    /* =====================================================
       ACCOUNT IS STAFF
       ===================================================== */

    function isStaff(account) {

        const email =
            String(
                account?.email ||
                account?.educationalEmail ||
                account?.educational_email ||
                ""
            )
            .trim()
            .toLowerCase();

        const type =
            String(
                account?.accountType ||
                account?.type ||
                account?.userType ||
                ""
            )
            .trim()
            .toLowerCase()
            .replace(/[-_]+/g, " ")
            .replace(/\\s+/g, " ");

        const role =
            String(
                account?.role ||
                account?.staffRole ||
                account?.userRole ||
                ""
            )
            .trim()
            .toLowerCase()
            .replace(/[-_]+/g, " ")
            .replace(/\\s+/g, " ");

        /*
         * Every registered non-student account is a STAFF APPLICANT.
         * A NULL role is intentional: the Administrator assigns the role.
         */
        if (!email) {
            return false;
        }

        if (
            type === "student" ||
            role === "student"
        ) {
            return false;
        }

        return true;

    }


    /* =====================================================
       GET STAFF
       ===================================================== */

    function getStaff() {

        return getAccounts().filter(
            account =>
                isStaff(account)
        );

    }


    /* =====================================================
       COUNT SUMMARY
       ===================================================== */

    function updateSummary() {

        const staff =
            getStaff();


        const pending =
            staff.filter(
                account =>

                    String(
                        account.status || ""
                    )
                    .trim()
                    .toLowerCase()
                    === "pending"

            ).length;


        const active =
            staff.filter(
                account =>

                    String(
                        account.status || ""
                    )
                    .trim()
                    .toLowerCase()
                    === "active"

            ).length;


        const rejected =
            staff.filter(
                account =>

                    String(
                        account.status || ""
                    )
                    .trim()
                    .toLowerCase()
                    === "rejected"

            ).length;


        const pendingElement =
            document.getElementById(
                "pendingStaffCount"
            );


        const activeElement =
            document.getElementById(
                "activeStaffCount"
            );


        const rejectedElement =
            document.getElementById(
                "rejectedCount"
            );


        const totalElement =
            document.getElementById(
                "totalStaffCount"
            );


        const entryElement =
            document.getElementById(
                "pageDescription"
            );


        const notificationElement =
            document.getElementById(
                "notificationCount"
            );


        if (pendingElement) {

            pendingElement.textContent =
                pending;

        }


        if (activeElement) {

            activeElement.textContent =
                active;

        }


        if (rejectedElement) {

            rejectedElement.textContent =
                rejected;

        }


        if (totalElement) {

            totalElement.textContent =
                staff.length;

        }


        if (entryElement) {

            entryElement.textContent =
                `Showing ${staff.length} staff account${staff.length === 1 ? "" : "s"}`;

        }


        if (notificationElement) {

            notificationElement.textContent =
                pending;

        }

    }


    /* =====================================================
       INITIALS
       ===================================================== */

    function getInitials(name) {

        const words =
            String(
                name || "User"
            )
            .trim()
            .split(/\s+/);


        if (words.length === 1) {

            return words[0]
                .substring(0, 2)
                .toUpperCase();

        }


        return (

            words[0].charAt(0) +
            words[words.length - 1].charAt(0)

        )
        .toUpperCase();

    }


    /* =====================================================
       CREATE ROLE OPTIONS
       ===================================================== */

    function roleOptions(selectedRole) {

        const roles = [

            "Administrator",
            "Principal",
            "Vice Principal",
            "Class Teacher",
            "Non-Class Teacher"

        ];


        const selected =
            String(
                selectedRole || ""
            )
            .trim()
            .toLowerCase();


        return `

            <option value="">
                Select Role
            </option>

            ${roles.map(role => `

                <option
                    value="${role}"
                    ${
                        String(role)
                            .toLowerCase()
                        === selected
                            ? "selected"
                            : ""
                    }
                >
                    ${role}
                </option>

            `).join("")}

        `;

    }


    /* =====================================================
       CLASS OPTIONS
       ===================================================== */

    function classOptions(selectedClass) {

        let html =
            `<option value="">Class</option>`;


        for (
            let i = 7;
            i <= 12;
            i++
        ) {

            html += `

                <option
                    value="${i}"
                    ${
                        String(selectedClass)
                        === String(i)
                            ? "selected"
                            : ""
                    }
                >
                    ${i}
                </option>

            `;

        }


        return html;

    }


    /* =====================================================
       STREAM OPTIONS
       ===================================================== */

    function streamOptions(selectedStream) {

        const streams = [

            "Science",
            "Arts",
            "Commerce"

        ];


        let html =
            `<option value="">Stream</option>`;


        streams.forEach(
            stream => {

                html += `

                    <option
                        value="${stream}"
                        ${
                            stream === selectedStream
                                ? "selected"
                                : ""
                        }
                    >
                        ${stream}
                    </option>

                `;

            }
        );


        return html;

    }


    /* =====================================================
       SECTION OPTIONS
       ===================================================== */

    function sectionOptions(selectedSection) {

        const sections = [

            "A",
            "B",
            "C",
            "D",
            "No Section"

        ];


        let html =
            `<option value="">Section</option>`;


        sections.forEach(
            section => {

                html += `

                    <option
                        value="${section}"
                        ${
                            section === selectedSection
                                ? "selected"
                                : ""
                        }
                    >
                        ${section}
                    </option>

                `;

            }
        );


        return html;

    }


    /* =====================================================
       ASSIGNMENT HTML
       ===================================================== */

    function assignmentHTML(
        account,
        index
    ) {

        const role =
            String(
                account.role ||
                account.staffRole ||
                ""
            ).trim();


        /*
         * Only Class Teachers need
         * class/stream/section assignment.
         */

        if (
            role !==
            "Class Teacher"
        ) {

            return `

                <div class="no-assignment">

                    —
                    <span style="margin-left:5px;">
                        No class assignment
                    </span>

                </div>

            `;

        }


        const selectedClass =
            account.assignedClass ||
            account.classAssignment ||
            "";


        const selectedStream =
            account.assignedStream ||
            account.stream ||
            "";


        const selectedSection =
            account.assignedSection ||
            account.section ||
            "No Section";


        const classNumber =
            Number(selectedClass);


        /*
         * Class Teacher / Non-Class Teacher
         * cannot edit assignments.
         */

        if (
            !canChangeStaffRole()
        ) {

            let assignmentText =
                selectedClass
                    ? `Class ${selectedClass}`
                    : "Class not assigned";


            if (
                classNumber === 11 ||
                classNumber === 12
            ) {

                if (selectedStream) {

                    assignmentText +=
                        ` • ${selectedStream}`;

                }

            }


            if (
                selectedSection &&
                selectedSection !==
                    "No Section"
            ) {

                assignmentText +=
                    ` • Section ${selectedSection}`;

            }


            return `

                <div
                    class="no-assignment read-only-assignment"
                    title="Class Teacher and other staff have view-only access."
                >

                    ${escapeHTML(
                        assignmentText
                    )}

                </div>

            `;

        }


        /*
         * Grade 11 / 12
         * need Stream.
         */

        if (
            classNumber === 11 ||
            classNumber === 12
        ) {

            return `

                <div
                    class="assignment-inline"
                    data-assignment="${index}"
                >

                    <div
                        class="assignment-field class-field"
                    >

                        <label>
                            Class
                        </label>

                        <select
                            class="assignment-select assignment-class"
                            data-index="${index}"
                        >

                            ${classOptions(
                                selectedClass
                            )}

                        </select>

                    </div>


                    <div
                        class="assignment-field stream-field"
                    >

                        <label>
                            Stream
                        </label>

                        <select
                            class="assignment-select assignment-stream"
                            data-index="${index}"
                        >

                            ${streamOptions(
                                selectedStream
                            )}

                        </select>

                    </div>


                    <div
                        class="assignment-field section-field"
                    >

                        <label>
                            Section
                        </label>

                        <select
                            class="assignment-select assignment-section"
                            data-index="${index}"
                        >

                            ${sectionOptions(
                                selectedSection
                            )}

                        </select>

                    </div>

                </div>

            `;

        }


        /*
         * Grades 7-10
         * do not need Stream.
         */

        return `

            <div
                class="assignment-inline"
                data-assignment="${index}"
            >

                <div
                    class="assignment-field class-field"
                >

                    <label>
                        Class
                    </label>

                    <select
                        class="assignment-select assignment-class"
                        data-index="${index}"
                    >

                        ${classOptions(
                            selectedClass
                        )}

                    </select>

                </div>


                <div
                    class="assignment-field section-field"
                >

                    <label>
                        Section
                    </label>

                    <select
                        class="assignment-select assignment-section"
                        data-index="${index}"
                    >

                        ${sectionOptions(
                            selectedSection
                        )}

                    </select>

                </div>

            </div>

        `;

    }


    /* =====================================================
       ACTION HTML
       ===================================================== */

    function actionHTML(
        account,
        index
    ) {

        const assessorAllowed =
            canAppointAssessor() &&
            isAssessorEligible(
                account
            );


        const deleteAllowed =
            canDeleteStaff();


        const approvalAllowed =
            canApproveStaff();


        const isAssessor =
            account.isAssessor === true;


        const status =
            String(
                account.status || ""
            )
            .trim()
            .toLowerCase();


        const isPending =
            status === "pending";


        return `

            <div class="action-buttons">


                <!-- APPROVE / REJECT -->

                ${
                    approvalAllowed &&
                    isPending

                    ?

                    `

                    <button
                        type="button"
                        class="action-button approve-button"
                        data-action="approve"
                        data-index="${index}"
                    >
                        ✓ Approve
                    </button>


                    <button
                        type="button"
                        class="action-button reject-button"
                        data-action="reject"
                        data-index="${index}"
                    >
                        Reject
                    </button>

                    `

                    :

                    ``
                }


                <!-- ASSESSOR -->

                ${
                    assessorAllowed

                    ?

                    `

                    <button
                        type="button"
                        class="action-button assessor-button"
                        data-action="assessor"
                        data-index="${index}"
                    >

                        ${
                            isAssessor
                                ? "✓ Assessor"
                                : "Appoint Assessor"
                        }

                    </button>

                    `

                    :

                    ``
                }


                <!-- DELETE -->

                ${
                    deleteAllowed

                    ?

                    `

                    <button
                        type="button"
                        class="action-button delete-button"
                        data-action="delete"
                        data-index="${index}"
                    >
                        Delete
                    </button>

                    `

                    :

                    ``
                }


            </div>

        `;

    }


    /* =====================================================
       RENDER STAFF TABLE
       ===================================================== */

    function renderStaff() {

        const staff = getStaff();
        const tbody = document.getElementById("staffTableBody");
        if (!tbody) return;

        if (!staff.length) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="6" class="empty-state">No staff accounts found.</td>
                </tr>`;
            updateSummary();
            return;
        }

        tbody.innerHTML = staff.map((account, index) => {
            const name = String(
                account.name || account.fullName || account.staffName || "Unnamed Staff"
            ).trim();
            const employeeId = String(
                account.employeeId || account.employeeID || account.employee_id || "Not provided"
            ).trim();
            const email = String(
                account.email || account.educationalEmail || account.educational_email || ""
            ).trim();
            const role = String(
                account.role || account.staffRole || account.userRole || ""
            ).trim();
            const status = String(account.status || "pending").trim().toLowerCase();
            const statusLabel = status === "active" ? "Active" : status === "rejected" ? "Rejected" : "Pending";
            const isAssessor = account.isAssessor === true;

            return `
                <tr>
                    <td class="sl-number">${index + 1}</td>
                    <td>
                        <div class="staff-person">
                            <div class="staff-avatar">${getInitials(name)}</div>
                            <div>
                                <div class="staff-name">${escapeHTML(name)}</div>
                                <div class="staff-email">${escapeHTML(email)}</div>
                                <div class="employee-id">Employee ID: ${escapeHTML(employeeId)}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        ${canChangeStaffRole()
                            ? `<select class="role-select" data-index="${index}" title="Change staff role">${roleOptions(role)}</select>`
                            : `<div class="read-only-role">${escapeHTML(role || "Not assigned")}</div>`}
                    </td>
                    <td>${assignmentHTML(account, index)}</td>
                    <td>
                        <span class="assessor-badge ${isAssessor ? "yes" : "no"}">${isAssessor ? "Yes" : "No"}</span>
                    </td>
                    <td>
                        <span class="status-badge ${status}">${statusLabel}</span>
                    </td>
                    <td>${actionHTML(account, index)}</td>
                </tr>`;
        }).join("");

        updateSummary();
        attachTableEvents();
    }


    /* =====================================================
       ESCAPE HTML
       ===================================================== */

    function escapeHTML(value) {

        return String(
            value ?? ""
        )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

    }


    /* =====================================================
       CHANGE STAFF ROLE
       ===================================================== */

    function changeRole(
        staffIndex,
        newRole
    ) {

        if (
            !canChangeStaffRole()
        ) {

            alert(
                "Only the Administrator, Principal or Vice Principal can change staff roles."
            );


            renderStaff();


            return;

        }


        const accounts =
            getAccounts();


        const staffIndexes =
            accounts
                .map(
                    (
                        account,
                        index
                    ) =>

                        isStaff(account)
                            ? index
                            : -1

                )
                .filter(
                    index =>
                        index !== -1
                );


        const actualIndex =
            staffIndexes[
                staffIndex
            ];


        if (
            actualIndex ===
            undefined
        ) {

            return;

        }


        const account =
            accounts[
                actualIndex
            ];


        const requestedRole =
            String(
                newRole || ""
            )
            .trim()
            .toLowerCase();


        const adminRoles = [

            "administrator",
            "admin",
            "administration"

        ];


        /*
         * Only one Administrator.
         */

        if (
            adminRoles.includes(
                requestedRole
            )
        ) {

            const anotherAdmin =
                accounts.some(
                    (
                        a,
                        i
                    ) => {

                        if (
                            i ===
                            actualIndex
                        ) {

                            return false;

                        }


                        const r =
                            normalizeRole(
                                a
                            );


                        return adminRoles.includes(
                            r
                        );

                    }
                );


            if (
                anotherAdmin
            ) {

                alert(
                    "SAMS allows only one Administrator."
                );


                renderStaff();


                return;

            }

        }


        const oldRole =
            normalizeRole(
                account
            );


        /*
         * Do not remove the only Administrator.
         */

        if (
            adminRoles.includes(
                oldRole
            ) &&
            !adminRoles.includes(
                requestedRole
            )
        ) {

            const anotherAdmin =
                accounts.some(
                    (
                        a,
                        i
                    ) => {

                        if (
                            i ===
                            actualIndex
                        ) {

                            return false;

                        }


                        const r =
                            normalizeRole(
                                a
                            );


                        return adminRoles.includes(
                            r
                        );

                    }
                );


            if (
                !anotherAdmin
            ) {

                alert(
                    "The system must always have one Administrator."
                );


                renderStaff();


                return;

            }

        }


        /*
         * Save new role.
         */

        account.role =
            newRole;

        const roleStatus =
            String(
                account.status || ""
            )
            .trim()
            .toLowerCase();

        /*
         * Role and class assignment must be written to Supabase together.
         * Staff Management is the single source of truth for Class Teacher
         * assignments used by Classes & Students.
         */
        const cloudRoleChanges = {
            role: account.role,
            active: roleStatus === "active",
            status: roleStatus === "active" ? "Active" : "Pending",
            is_assessor: account.isAssessor === true
        };

        if (newRole === "Class Teacher") {
            cloudRoleChanges.assigned_class = account.assignedClass || "";
            cloudRoleChanges.assigned_section = account.assignedSection || "";
            cloudRoleChanges.assigned_stream = account.assignedStream || "";
        } else {
            /* Leaving Class Teacher must also clear the central assignment. */
            account.assignedClass = "";
            account.assignedSection = "";
            account.assignedStream = "";
            cloudRoleChanges.assigned_class = "";
            cloudRoleChanges.assigned_section = "";
            cloudRoleChanges.assigned_stream = "";
        }

        saveAccounts(accounts);

        syncProfileToCloud(account, cloudRoleChanges);


        /*
         * Update current session if
         * the logged-in account itself
         * was changed.
         */

        const currentUser =
            getCurrentUser();


        if (
            currentUser &&
            String(
                currentUser.email ||
                currentUser.educationalEmail ||
                ""
            )
            .trim()
            .toLowerCase()
            ===
            String(
                account.email ||
                account.educationalEmail ||
                ""
            )
            .trim()
            .toLowerCase()
        ) {

            currentUser.role =
                newRole;


            sessionStorage.setItem(
                "sams_current_user",
                JSON.stringify(
                    currentUser
                )
            );

        }


        renderStaff();

    }


    /* =====================================================
       SAVE ASSIGNMENT
       ===================================================== */

    function saveAssignment(
        staffIndex,
        field,
        value
    ) {

        if (
            !canChangeStaffRole()
        ) {

            alert(
                "Only the Administrator, Principal or Vice Principal can change class, stream or section assignments."
            );


            renderStaff();


            return;

        }


        const accounts =
            getAccounts();


        const staffIndexes =
            accounts
                .map(
                    (
                        account,
                        index
                    ) =>

                        isStaff(account)
                            ? index
                            : -1

                )
                .filter(
                    index =>
                        index !== -1
                );


        const actualIndex =
            staffIndexes[
                staffIndex
            ];


        if (
            actualIndex ===
            undefined
        ) {

            return;

        }


        const account =
            accounts[
                actualIndex
            ];


        if (
            field ===
            "class"
        ) {

            account.assignedClass =
                value;


            /*
             * Clear stream if class
             * is not Grade 11 or 12.
             */

            if (
                value !== "11" &&
                value !== "12"
            ) {

                account.assignedStream =
                    "";

            }

        }


        if (
            field ===
            "stream"
        ) {

            account.assignedStream =
                value;

        }


        if (
            field ===
            "section"
        ) {

            account.assignedSection =
                value;

        }


        saveAccounts(
            accounts
        );

        const cloudChanges = {};

        if (field === "class") {
            cloudChanges.assigned_class =
                account.assignedClass || "";
        }

        if (field === "stream") {
            cloudChanges.assigned_stream =
                account.assignedStream || "";
        }

        if (field === "section") {
            cloudChanges.assigned_section =
                account.assignedSection || "";
        }

        if (
            Object.keys(cloudChanges).length > 0
        ) {
            syncProfileToCloud(
                account,
                cloudChanges
            );
        }


        renderStaff();

    }


    /* =====================================================
       APPOINT / REMOVE ASSESSOR
       ===================================================== */

    function toggleAssessor(
        staffIndex
    ) {

        if (
            !canAppointAssessor()
        ) {

            alert(
                "Only an Administrator, Principal or Vice Principal can appoint an assessor."
            );


            return;

        }


        const accounts =
            getAccounts();


        const staffIndexes =
            accounts
                .map(
                    (
                        account,
                        index
                    ) =>

                        isStaff(account)
                            ? index
                            : -1

                )
                .filter(
                    index =>
                        index !== -1
                );


        const actualIndex =
            staffIndexes[
                staffIndex
            ];


        if (
            actualIndex ===
            undefined
        ) {

            return;

        }


        const account =
            accounts[
                actualIndex
            ];


        /*
         * IMPORTANT:
         * Only Vice Principals can be assessors.
         */

        if (
            !isAssessorEligible(
                account
            )
        ) {

            alert(
                "Only Vice Principals and Non-Class Teachers can be appointed as assessors. Class Teachers can never be assessors."
            );


            return;

        }


        account.isAssessor =
            account.isAssessor !==
            true;


        saveAccounts(
            accounts
        );

        syncProfileToCloud(account, {
            is_assessor: account.isAssessor === true
        });

        renderStaff();

    }


    /* =====================================================
       APPROVE STAFF
       ===================================================== */

    function approveStaff(
        staffIndex
    ) {

        if (
            !canApproveStaff()
        ) {

            alert(
                "Only the Administrator, Principal or Vice Principal can approve staff registrations."
            );


            return;

        }


        const accounts =
            getAccounts();


        const staffIndexes =
            accounts
                .map(
                    (
                        account,
                        index
                    ) =>

                        isStaff(account)
                            ? index
                            : -1

                )
                .filter(
                    index =>
                        index !== -1
                );


        const actualIndex =
            staffIndexes[
                staffIndex
            ];


        if (
            actualIndex ===
            undefined
        ) {

            return;

        }


        const account =
            accounts[
                actualIndex
            ];


        if (
            String(
                account.status ||
                ""
            )
            .trim()
            .toLowerCase()
            !==
            "pending"
        ) {

            return;

        }


        account.status =
            "active";


        saveAccounts(
            accounts
        );

        syncProfileToCloud(account, {
            active: true,
            status: "Active",
            role: account.role || ""
        });


        renderStaff();

    }


    /* =====================================================
       REJECT STAFF
       ===================================================== */

    function rejectStaff(
        staffIndex
    ) {

        if (
            !canApproveStaff()
        ) {

            alert(
                "Only the Administrator, Principal or Vice Principal can reject staff registrations."
            );


            return;

        }


        const accounts =
            getAccounts();


        const staffIndexes =
            accounts
                .map(
                    (
                        account,
                        index
                    ) =>

                        isStaff(account)
                            ? index
                            : -1

                )
                .filter(
                    index =>
                        index !== -1
                );


        const actualIndex =
            staffIndexes[
                staffIndex
            ];


        if (
            actualIndex ===
            undefined
        ) {

            return;

        }


        const account =
            accounts[
                actualIndex
            ];


        const name =
            account.name ||
            account.fullName ||
            account.staffName ||
            account.email ||
            "this staff member";


        if (
            !confirm(
                `Reject the staff registration for ${name}?`
            )
        ) {

            return;

        }


        account.status =
            "rejected";

        account.active =
            false;


        saveAccounts(
            accounts
        );

        syncProfileToCloud(account, {
            active: false,
            status: "Rejected",
            role: account.role || ""
        });


        renderStaff();

    }


    /* =====================================================
       DELETE STAFF
       ===================================================== */

    function deleteStaff(
        staffIndex
    ) {

        if (
            !canDeleteStaff()
        ) {

            alert(
                "You do not have permission to delete staff accounts."
            );


            return;

        }


        const accounts =
            getAccounts();


        const staffIndexes =
            accounts
                .map(
                    (
                        account,
                        index
                    ) =>

                        isStaff(account)
                            ? index
                            : -1

                )
                .filter(
                    index =>
                        index !== -1
                );


        const actualIndex =
            staffIndexes[
                staffIndex
            ];


        if (
            actualIndex ===
            undefined
        ) {

            return;

        }


        const account =
            accounts[
                actualIndex
            ];


        const name =
            account.name ||
            account.fullName ||
            account.staffName ||
            account.email ||
            "this staff member";


        const confirmed =
            confirm(
                `Are you sure you want to delete ${name}?\n\nThis will remove the staff account from SAMS.`
            );


        if (!confirmed) {

            return;

        }


        accounts.splice(
            actualIndex,
            1
        );


        saveAccounts(
            accounts
        );

        if (
            window.samsSupabase &&
            account?.id
        ) {

            window.samsSupabase
                .from("profiles")
                .delete()
                .eq("id", account.id)
                .then(
                    result => {

                        if (result.error) {
                            console.error(
                                "SAMS profile deletion failed:",
                                result.error
                            );
                        }

                    }
                );

        }


        renderStaff();

    }


    /* =====================================================
       TABLE EVENTS
       ===================================================== */

    function attachTableEvents() {


        /* -------------------------------------------------
           ROLE
           ------------------------------------------------- */

        document
            .querySelectorAll(
                ".role-select"
            )
            .forEach(
                select => {

                    select.addEventListener(
                        "change",
                        function () {

                            changeRole(

                                Number(
                                    this.dataset.index
                                ),

                                this.value

                            );

                        }
                    );

                }
            );


        /* -------------------------------------------------
           CLASS ASSIGNMENT
           ------------------------------------------------- */

        document
            .querySelectorAll(
                ".assignment-class"
            )
            .forEach(
                select => {

                    select.addEventListener(
                        "change",
                        function () {

                            saveAssignment(

                                Number(
                                    this.dataset.index
                                ),

                                "class",

                                this.value

                            );

                        }
                    );

                }
            );


        /* -------------------------------------------------
           STREAM ASSIGNMENT
           ------------------------------------------------- */

        document
            .querySelectorAll(
                ".assignment-stream"
            )
            .forEach(
                select => {

                    select.addEventListener(
                        "change",
                        function () {

                            saveAssignment(

                                Number(
                                    this.dataset.index
                                ),

                                "stream",

                                this.value

                            );

                        }
                    );

                }
            );


        /* -------------------------------------------------
           SECTION ASSIGNMENT
           ------------------------------------------------- */

        document
            .querySelectorAll(
                ".assignment-section"
            )
            .forEach(
                select => {

                    select.addEventListener(
                        "change",
                        function () {

                            saveAssignment(

                                Number(
                                    this.dataset.index
                                ),

                                "section",

                                this.value

                            );

                        }
                    );

                }
            );


        /* -------------------------------------------------
           APPROVE
           ------------------------------------------------- */

        document
            .querySelectorAll(
                "[data-action='approve']"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            approveStaff(

                                Number(
                                    this.dataset.index
                                )

                            );

                        }
                    );

                }
            );


        /* -------------------------------------------------
           REJECT
           ------------------------------------------------- */

        document
            .querySelectorAll(
                "[data-action='reject']"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            rejectStaff(

                                Number(
                                    this.dataset.index
                                )

                            );

                        }
                    );

                }
            );


        /* -------------------------------------------------
           ASSESSOR
           ------------------------------------------------- */

        document
            .querySelectorAll(
                "[data-action='assessor']"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            toggleAssessor(

                                Number(
                                    this.dataset.index
                                )

                            );

                        }
                    );

                }
            );


        /* -------------------------------------------------
           DELETE
           ------------------------------------------------- */

        document
            .querySelectorAll(
                "[data-action='delete']"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            deleteStaff(

                                Number(
                                    this.dataset.index
                                )

                            );

                        }
                    );

                }
            );

    }

/* =====================================================
   ADD STAFF MODAL
   ===================================================== */

function openAddStaffModal() {

    if (!hasFullStaffManagementAccess()) {
        alert(
            "Only the Administrator, Principal or Vice Principal can add staff."
        );
        return;
    }

    const modal = document.getElementById("staffModal");

    if (!modal) {
        alert("Staff form is not available.");
        return;
    }

    const title = document.getElementById("modalTitle");
    const staffId = document.getElementById("staffId");
    const staffName = document.getElementById("staffName");
    const staffEmail = document.getElementById("staffEmail");
    const staffRole = document.getElementById("staffRole");

    if (title) {
        title.textContent = "Add Staff";
    }

    if (staffId) {
        staffId.value = "";
    }

    if (staffName) {
        staffName.value = "";
    }

    if (staffEmail) {
        staffEmail.value = "";
    }

    if (staffRole) {
        staffRole.value = "";
    }

    modal.classList.add("show");

    setTimeout(() => {
        if (staffName) {
            staffName.focus();
        }
    }, 50);
}


/* =====================================================
   CLOSE STAFF MODAL
   ===================================================== */

function closeStaffModal() {

    const modal =
        document.getElementById("staffModal");

    if (modal) {
        modal.classList.remove("show");
    }

}


/* =====================================================
   SAVE NEW STAFF
   ===================================================== */

function saveNewStaff() {

    if (!hasFullStaffManagementAccess()) {

        alert(
            "Only the Administrator, Principal or Vice Principal can add staff."
        );

        return;
    }


    const name =
        String(
            document.getElementById("staffName")?.value || ""
        ).trim();


    const email =
        String(
            document.getElementById("staffEmail")?.value || ""
        ).trim().toLowerCase();


    const role =
        String(
            document.getElementById("staffRole")?.value || ""
        ).trim();


    if (!name) {

        alert("Please enter the staff member's full name.");

        document.getElementById("staffName")?.focus();

        return;
    }


    if (!email) {

        alert("Please enter the educational email.");

        document.getElementById("staffEmail")?.focus();

        return;
    }


    if (!role) {

        alert("Please select a staff role.");

        document.getElementById("staffRole")?.focus();

        return;
    }


    const accounts =
        getAccounts();


    /* -------------------------------------------------
       CHECK DUPLICATE EMAIL
       ------------------------------------------------- */

    const duplicate =
        accounts.some(account => {

            const existingEmail =
                String(
                    account?.email ||
                    account?.educationalEmail ||
                    account?.educational_email ||
                    ""
                )
                .trim()
                .toLowerCase();

            return existingEmail === email;

        });


    if (duplicate) {

        alert(
            "A SAMS account already exists for this email address."
        );

        return;
    }


    /* -------------------------------------------------
       ONLY ONE ADMINISTRATOR
       ------------------------------------------------- */

    const requestedRole =
        role.toLowerCase();


    if (
        requestedRole === "administrator" ||
        requestedRole === "admin" ||
        requestedRole === "administration"
    ) {

        const existingAdministrator =
            accounts.some(account => {

                const existingRole =
                    normalizeRole(account);

                return (
                    existingRole === "administrator" ||
                    existingRole === "admin" ||
                    existingRole === "administration"
                );

            });


        if (existingAdministrator) {

            alert(
                "SAMS allows only one Administrator."
            );

            return;
        }

    }


    /* -------------------------------------------------
       CREATE STAFF ACCOUNT
       ------------------------------------------------- */

    const newStaff = {

        id:
            "staff-" +
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 8),

        name:
            name,

        fullName:
            name,

        staffName:
            name,

        email:
            email,

        educationalEmail:
            email,

        educational_email:
            email,

        role:
            role,

        staffRole:
            role,

        accountType:
            "staff",

        userType:
            "staff",

        status:
            "active",

        isAssessor:
            false,

        employeeId:
            "STAFF-" +
            Date.now()

    };


    accounts.push(newStaff);


    saveAccounts(accounts);

    if (window.samsSupabase) {

        const roleMap = {
            "Administrator": "admin",
            "Principal": "principal",
            "Vice Principal": "vice_principal",
            "Class Teacher": "class_teacher",
            "Non-Class Teacher": "non_class_teacher"
        };

        window.samsSupabase
            .from("profiles")
            .upsert(
                {
                    full_name: name,
                    email: email,
                    employee_code:
                        newStaff.employeeId,
                    role:
                        roleMap[role] || role,
                    active: true,
                    status: "Active"
                },
                {
                    onConflict: "email"
                }
            )
            .then(
                result => {

                    if (result.error) {
                        console.error(
                            "SAMS manual staff profile sync failed:",
                            result.error
                        );
                    }

                }
            );

    }


    closeStaffModal();


    renderStaff();


    updateCurrentUser();


    alert(
        `${name} has been added successfully.`
    );

}


/* =====================================================
   CONNECT ADD STAFF BUTTON
   ===================================================== */

function setupStaffModal() {

    const addButton =
        document.getElementById(
            "addStaffButton"
        );


    const saveButton =
        document.getElementById(
            "saveStaffButton"
        );


    const closeButton =
        document.getElementById(
            "closeModalButton"
        );


    const cancelButton =
        document.getElementById(
            "cancelStaffButton"
        );


    const modal =
        document.getElementById(
            "staffModal"
        );


    if (addButton) {

        addButton.onclick =
            function () {

                openAddStaffModal();

            };

    }


    if (saveButton) {

        saveButton.onclick =
            function () {

                saveNewStaff();

            };

    }


    if (closeButton) {

        closeButton.onclick =
            function () {

                closeStaffModal();

            };

    }


    if (cancelButton) {

        cancelButton.onclick =
            function () {

                closeStaffModal();

            };

    }


    if (modal) {

        modal.addEventListener(
            "click",
            function (event) {

                if (
                    event.target === modal
                ) {

                    closeStaffModal();

                }

            }
        );

    }


    /* Allow Enter key to save */

    const formInputs =
        document.querySelectorAll(
            "#staffModal input, #staffModal select"
        );


    formInputs.forEach(
        input => {

            input.addEventListener(
                "keydown",
                function (event) {

                    if (
                        event.key === "Enter"
                    ) {

                        event.preventDefault();

                        saveNewStaff();

                    }

                }
            );

        }
    );


    /* Make the function available to the HTML button */

    window.addStaff =
        openAddStaffModal;

}


/* =====================================================
   EXPOSE STAFF FUNCTIONS
   ===================================================== */

window.addStaff =
    openAddStaffModal;

    /* =====================================================
       BACK TO DASHBOARD
       ===================================================== */

    function setupBackButton() {

        const button =
            document.getElementById(
                "backDashboard"
            );


        if (!button) {

            return;

        }


        button.addEventListener(
            "click",
            function () {

                window.location.href =
                    "dashboard.html";

            }
        );

    }


    /* =====================================================
       FOOTER YEAR
       ===================================================== */

    function updateFooterYear() {

        const element =
            document.getElementById(
                "footerYear"
            );


        if (element) {

            element.textContent =
                new Date().getFullYear();

        }

    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    function initialize() {

        updateCurrentUser();

        updateSummary();

        renderStaff();

        setupStaffModal();

        setupBackButton();

        updateFooterYear();

        setupCloudRefresh();

        /*
         * IMPORTANT:
         * Supabase is the source of truth for registered users.
         * Staff Management loads them automatically on opening.
         */
        loadAllProfilesFromCloud();

    }


    /* =====================================================
       START
       ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );

    }

    else {

        initialize();

    }


})();
