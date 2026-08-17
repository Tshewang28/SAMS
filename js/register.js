// ============================================================
// SAMS REGISTER.JS
// Supabase-first registration
// Profile creation is handled by Supabase database trigger
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
    // CHECK PROFILE BY EMAIL
    // =========================================================

    async function profileExistsByEmail(email) {

        const result =
            await window.samsSupabase
                .from("profiles")
                .select(
                    "id, email, role"
                )
                .ilike(
                    "email",
                    email
                )
                .limit(1);


        if (result.error) {

            throw result.error;
        }


        return (
            result.data &&
            result.data.length > 0
        );

    }


    // =========================================================
    // CHECK EXISTING ADMINISTRATOR
    // =========================================================

    async function administratorExists() {

        const result =
            await window.samsSupabase
                .from("profiles")
                .select(
                    "id",
                    {
                        count: "exact",
                        head: true
                    }
                )
                .eq(
                    "role",
                    "admin"
                );


        if (result.error) {

            throw result.error;
        }


        return (
            Number(
                result.count || 0
            ) > 0
        );

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


        return result.data;

    }


    // =========================================================
    // REGISTER ADMINISTRATOR
    // =========================================================

    async function registerAdministrator() {

        const data =
            getAdministratorData();


        if (
            !validateAdministrator(data)
        ) {

            return;
        }


        showMessage(
            "Checking Administrator availability...",
            ""
        );


        const adminExists =
            await administratorExists();


        if (adminExists) {

            showMessage(

                "An Administrator account already exists. Only one Administrator account is permitted.",

                "error"
            );

            return;
        }


        const existingProfile =
            await profileExistsByEmail(
                data.email
            );


        if (existingProfile) {

            showMessage(

                "A SAMS profile already exists for this email address.",

                "error"
            );

            return;
        }


        showMessage(
            "Creating Administrator account...",
            ""
        );


        await createAuthUser(

            data.email,

            data.password,

            {

                account_type:
                    "Administrator",

                full_name:
                    data.fullName

            }

        );


        showMessage(

            "Administrator account created successfully. You can now sign in.",

            "success"
        );

    }


    // =========================================================
    // REGISTER STAFF
    // =========================================================

    async function registerStaff() {

        const data =
            getStaffData();


        if (
            !validateStaff(data)
        ) {

            return;
        }


        showMessage(
            "Checking staff account...",
            ""
        );


        const existingProfile =
            await profileExistsByEmail(
                data.email
            );


        if (existingProfile) {

            showMessage(

                "A SAMS profile already exists for this email address.",

                "error"
            );

            return;
        }


        showMessage(
            "Creating staff account...",
            ""
        );


        await createAuthUser(

            data.email,

            data.password,

            {

                account_type:
                    "Staff",

                full_name:
                    data.fullName,

                employee_code:
                    data.employeeCode

            }

        );


        showMessage(

            "Staff account created successfully. Your account is now waiting for Administrator approval.",

            "success"
        );

    }


    // =========================================================
    // REGISTER STUDENT
    // =========================================================

    async function registerStudent() {

        const data =
            getStudentData();


        if (
            !validateStudent(data)
        ) {

            return;
        }


        showMessage(
            "Checking student account...",
            ""
        );


        const existingProfile =
            await profileExistsByEmail(
                data.email
            );


        if (existingProfile) {

            showMessage(

                "A SAMS profile already exists for this email address.",

                "error"
            );

            return;
        }


        showMessage(
            "Creating student account...",
            ""
        );


        await createAuthUser(

            data.email,

            data.password,

            {

                account_type:
                    "Student",

                full_name:
                    data.fullName,

                student_code:
                    data.studentCode

            }

        );


        showMessage(

            "Student account created successfully. You can now sign in.",

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
                            "Supabase security policy prevented this operation.";

                    }

                    else if (
                        lower.includes(
                            "violates"
                        )
                    ) {

                        message =
                            "The SAMS database rejected the registration information.";

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
