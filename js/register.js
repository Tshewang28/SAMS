// ============================================================
// SAMS REGISTER.JS
// Supabase-first registration
// ============================================================

(function () {

    "use strict";


    // =========================================================
    // ELEMENTS
    // =========================================================

    const typeStaff =
        document.getElementById("typeStaff");

    const typeStudent =
        document.getElementById("typeStudent");

    const typeAdministrator =
        document.getElementById("typeAdministrator");

    const staffSection =
        document.getElementById("staffSection");

    const studentSection =
        document.getElementById("studentSection");

    const administratorSection =
        document.getElementById("administratorSection");

    const registerButton =
        document.getElementById("registerButton");

    const registerMessage =
        document.getElementById("registerMessage");

    const backToLoginBtn =
        document.getElementById("backToLoginBtn");


    // =========================================================
    // MESSAGE
    // =========================================================

    function showMessage(message, type = "") {

        if (!registerMessage) {
            return;
        }

        registerMessage.textContent = message;

        registerMessage.className =
            "register-message " + type;
    }


    // =========================================================
    // ACCOUNT TYPE
    // =========================================================

    function getAccountType() {

        const selected =
            document.querySelector(
                'input[name="accountType"]:checked'
            );

        return selected
            ? selected.value
            : null;
    }


    // =========================================================
    // SHOW / HIDE SECTIONS
    // =========================================================

    function updateAccountSections() {

        const type =
            getAccountType();


        if (staffSection) {

            staffSection.style.display =
                type === "Staff"
                    ? "block"
                    : "none";

        }


        if (studentSection) {

            studentSection.style.display =
                type === "Student"
                    ? "block"
                    : "none";

        }


        if (administratorSection) {

            administratorSection.style.display =
                type === "Administrator"
                    ? "block"
                    : "none";

        }


        showMessage("");

    }


    if (typeStaff) {

        typeStaff.addEventListener(
            "change",
            updateAccountSections
        );

    }


    if (typeStudent) {

        typeStudent.addEventListener(
            "change",
            updateAccountSections
        );

    }


    if (typeAdministrator) {

        typeAdministrator.addEventListener(
            "change",
            updateAccountSections
        );

    }


    // =========================================================
    // PASSWORD SHOW / HIDE
    // =========================================================

    const passwordToggles =
        document.querySelectorAll(
            ".register-password-toggle"
        );


    passwordToggles.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const targetId =
                        button.getAttribute(
                            "data-target"
                        );

                    const input =
                        document.getElementById(
                            targetId
                        );


                    if (!input) {
                        return;
                    }


                    if (
                        input.type ===
                        "password"
                    ) {

                        input.type =
                            "text";

                        button.textContent =
                            "Hide";

                    } else {

                        input.type =
                            "password";

                        button.textContent =
                            "Show";

                    }

                }
            );

        }
    );


    // =========================================================
    // EMAIL VALIDATION
    // =========================================================

    function isEducationalEmail(email) {

        const allowedDomains = [

            "@education.gov.bt",
            "@moesd.gov.bt",
            "@edu.gov.bt",
            "@school.gov.bt"

        ];


        const value =
            String(email || "")
                .trim()
                .toLowerCase();


        return allowedDomains.some(
            function (domain) {

                return value.endsWith(
                    domain
                );

            }
        );

    }


    // =========================================================
    // PASSWORD VALIDATION
    // =========================================================

    function validatePassword(
        password,
        confirmPassword
    ) {

        if (!password) {

            showMessage(
                "Please create a password.",
                "error"
            );

            return false;

        }


        if (password.length < 6) {

            showMessage(
                "Password must contain at least 6 characters.",
                "error"
            );

            return false;

        }


        if (
            password !==
            confirmPassword
        ) {

            showMessage(
                "Passwords do not match.",
                "error"
            );

            return false;

        }


        return true;

    }


    // =========================================================
    // GET STAFF DATA
    // =========================================================

    function getStaffData() {

        return {

            employeeCode:
                document
                    .getElementById(
                        "staffEmployeeId"
                    )
                    ?.value
                    .trim(),

            fullName:
                document
                    .getElementById(
                        "staffName"
                    )
                    ?.value
                    .trim(),

            email:
                document
                    .getElementById(
                        "staffEmail"
                    )
                    ?.value
                    .trim()
                    .toLowerCase(),

            password:
                document
                    .getElementById(
                        "staffPassword"
                    )
                    ?.value,

            confirmPassword:
                document
                    .getElementById(
                        "staffConfirmPassword"
                    )
                    ?.value

        };

    }


    // =========================================================
    // GET STUDENT DATA
    // =========================================================

    function getStudentData() {

        return {

            studentCode:
                document
                    .getElementById(
                        "studentCode"
                    )
                    ?.value
                    .trim(),

            fullName:
                document
                    .getElementById(
                        "studentName"
                    )
                    ?.value
                    .trim(),

            email:
                document
                    .getElementById(
                        "studentEmail"
                    )
                    ?.value
                    .trim()
                    .toLowerCase(),

            password:
                document
                    .getElementById(
                        "studentPassword"
                    )
                    ?.value,

            confirmPassword:
                document
                    .getElementById(
                        "studentConfirmPassword"
                    )
                    ?.value

        };

    }


    // =========================================================
    // GET ADMINISTRATOR DATA
    // =========================================================

    function getAdministratorData() {

        return {

            fullName:
                document
                    .getElementById(
                        "administratorName"
                    )
                    ?.value
                    .trim(),

            email:
                document
                    .getElementById(
                        "administratorEmail"
                    )
                    ?.value
                    .trim()
                    .toLowerCase(),

            password:
                document
                    .getElementById(
                        "administratorPassword"
                    )
                    ?.value,

            confirmPassword:
                document
                    .getElementById(
                        "administratorConfirmPassword"
                    )
                    ?.value

        };

    }


    // =========================================================
    // VALIDATE STAFF
    // =========================================================

    function validateStaff(data) {

        if (!data.employeeCode) {

            showMessage(
                "Please enter your Employee ID.",
                "error"
            );

            return false;

        }


        if (!data.fullName) {

            showMessage(
                "Please enter your full name.",
                "error"
            );

            return false;

        }


        if (!data.email) {

            showMessage(
                "Please enter your educational email.",
                "error"
            );

            return false;

        }


        if (
            !isEducationalEmail(
                data.email
            )
        ) {

            showMessage(
                "Please use your official educational email.",
                "error"
            );

            return false;

        }


        return validatePassword(
            data.password,
            data.confirmPassword
        );

    }


    // =========================================================
    // VALIDATE STUDENT
    // =========================================================

    function validateStudent(data) {

        if (!data.studentCode) {

            showMessage(
                "Please enter your Student Code.",
                "error"
            );

            return false;

        }


        if (!data.fullName) {

            showMessage(
                "Please enter your full name.",
                "error"
            );

            return false;

        }


        if (!data.email) {

            showMessage(
                "Please enter your educational email.",
                "error"
            );

            return false;

        }


        if (
            !isEducationalEmail(
                data.email
            )
        ) {

            showMessage(
                "Please use your official educational email.",
                "error"
            );

            return false;

        }


        return validatePassword(
            data.password,
            data.confirmPassword
        );

    }


    // =========================================================
    // VALIDATE ADMINISTRATOR
    // =========================================================

    function validateAdministrator(data) {

        if (!data.fullName) {

            showMessage(
                "Please enter your full name.",
                "error"
            );

            return false;

        }


        if (!data.email) {

            showMessage(
                "Please enter your educational email.",
                "error"
            );

            return false;

        }


        if (
            !isEducationalEmail(
                data.email
            )
        ) {

            showMessage(
                "Please use your official educational email.",
                "error"
            );

            return false;

        }


        return validatePassword(
            data.password,
            data.confirmPassword
        );

    }


    // =========================================================
    // CHECK SUPABASE
    // =========================================================

    function checkSupabase() {

        if (
            !window.samsSupabase
        ) {

            showMessage(
                "SAMS connection is not available. Please try again.",
                "error"
            );

            return false;

        }

        return true;

    }


    // =========================================================
    // CREATE AUTH USER
    // =========================================================

    async function createAuthUser(
        email,
        password,
        metadata
    ) {

        const result =
            await window.samsSupabase
                .auth
                .signUp({

                    email:
                        email,

                    password:
                        password,

                    options: {

                        data:
                            metadata

                    }

                });


        if (result.error) {

            throw result.error;

        }


        if (!result.data?.user) {

            throw new Error(
                "Supabase did not return a user account."
            );

        }

        /*
         * Supabase can return a user with no identities when an
         * email is already registered. Treat that as a duplicate.
         */
        if (
            Array.isArray(result.data.user.identities) &&
            result.data.user.identities.length === 0
        ) {
            throw new Error(
                "This email address is already registered in Supabase."
            );
        }

        return result.data;

    }
    // =========================================================
    // REGISTER ADMINISTRATOR
    // =========================================================

    async function registerAdministrator() {

        const data = getAdministratorData();

        if (!validateAdministrator(data)) {
            return;
        }

        showMessage(
            "Creating Administrator account...",
            ""
        );

        /*
         * IMPORTANT:
         * The Supabase database trigger creates the profiles row.
         * The browser must NOT insert a second profiles row.
         *
         * account_type = Administrator
         * -> role   = admin
         * -> active = true
         */

        const authData = await createAuthUser(
            data.email,
            data.password,
            {
                account_type: "Administrator",
                full_name: data.fullName
            }
        );

        if (!authData?.user) {
            throw new Error(
                "Supabase did not return the Administrator account."
            );
        }

        showMessage(
            "Administrator account created successfully. You can now sign in.",
            "success"
        );
    }


    // =========================================================
    // REGISTER STAFF
    // =========================================================

    async function registerStaff() {

        const data = getStaffData();

        if (!validateStaff(data)) {
            return;
        }

        showMessage(
            "Creating staff account...",
            ""
        );

        /*
         * The database trigger creates the profile.
         *
         * Staff registration starts as:
         *   role   = non_class_teacher
         *   active = false
         *   is_assessor = false
         *
         * The Administrator later approves the account and
         * assigns the permanent staff role.
         */

        const authData = await createAuthUser(
            data.email,
            data.password,
            {
                account_type: "Staff",
                full_name: data.fullName,
                employee_code: data.employeeCode
            }
        );

        if (!authData?.user) {
            throw new Error(
                "Supabase did not return the Staff account."
            );
        }

        showMessage(
            "Registration successful. Your account is waiting for Administrator approval.",
            "success"
        );
    }


    // =========================================================
    // REGISTER STUDENT
    // =========================================================

    async function registerStudent() {

        const data = getStudentData();

        if (!validateStudent(data)) {
            return;
        }

        showMessage(
            "Creating student account...",
            ""
        );

        /*
         * The database trigger creates the profile.
         *
         * account_type = Student
         * -> role   = student
         * -> active = true
         */

        const authData = await createAuthUser(
            data.email,
            data.password,
            {
                account_type: "Student",
                full_name: data.fullName,
                student_code: data.studentCode
            }
        );

        if (!authData?.user) {
            throw new Error(
                "Supabase did not return the Student account."
            );
        }

        showMessage(
            "Registration successful. Your student account is ready. You can now sign in.",
            "success"
        );
    }


    // =========================================================
    // CREATE ACCOUNT BUTTON

    // =========================================================

    if (registerButton) {

        registerButton.addEventListener(

            "click",

            async function () {

                const accountType =
                    getAccountType();


                if (!accountType) {

                    showMessage(

                        "Please select an Account Type.",

                        "error"

                    );

                    return;

                }


                if (
                    !checkSupabase()
                ) {

                    return;

                }


                const originalText =
                    registerButton.textContent;


                registerButton.disabled =
                    true;


                registerButton.textContent =
                    "Creating Account...";


                try {

                    if (
                        accountType ===
                        "Administrator"
                    ) {

                        await registerAdministrator();

                    }

                    else if (
                        accountType ===
                        "Staff"
                    ) {

                        await registerStaff();

                    }

                    else if (
                        accountType ===
                        "Student"
                    ) {

                        await registerStudent();

                    }

                    else {

                        showMessage(

                            "Invalid account type.",

                            "error"

                        );

                    }

                }

                catch (error) {

                    console.error(
                        "SAMS registration error:",
                        error
                    );


                    let message =
                        "Unable to create the account.";


                    if (
                        error &&
                        error.message
                    ) {

                        message =
                            error.message;

                    }


                    const lower =
                        message.toLowerCase();


                    if (
                        lower.includes(
                            "already registered"
                        )
                    ) {

                        message =
                            "This email address is already registered in Supabase.";

                    }

                    else if (
                        lower.includes(
                            "duplicate"
                        )
                    ) {

                        message =
                            "This account or profile already exists.";

                    }

                    else if (
                        lower.includes(
                            "row-level security"
                        ) ||
                        lower.includes(
                            "permission denied"
                        )
                    ) {

                        message =
                            "Supabase security policy prevented the SAMS profile from being created.";

                    }

                    else if (
                        lower.includes("user_role") ||
                        lower.includes("invalid input value for enum") ||
                        lower.includes("pending")
                    ) {

                        message =
                            "SAMS registration could not be completed because the database role configuration is incorrect. Please run the SAMS registration fix SQL in Supabase.";

                    }
                    else if (
                        lower.includes("email rate limit") ||
                        lower.includes("rate limit exceeded")
                    ) {

                        message =
                            "Supabase has temporarily limited registration emails. Please wait before trying another registration.";

                    }
                    else if (
                        lower.includes("violates")
                    ) {

                        message =
                            "The SAMS database rejected the account information. Please check the Supabase registration trigger and profiles table.";

                    }


                    showMessage(
                        message,
                        "error"
                    );

                }

                finally {

                    registerButton.disabled =
                        false;

                    registerButton.textContent =
                        originalText;

                }

            }

        );

    }


    // =========================================================
    // BACK TO LOGIN
    // =========================================================

    if (backToLoginBtn) {

        backToLoginBtn.addEventListener(

            "click",

            function () {

                window.location.href =
                    "index.html";

            }

        );

    }


    // =========================================================
    // INITIAL STATE
    // =========================================================

    updateAccountSections();


})();
