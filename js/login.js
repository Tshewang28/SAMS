// ============================================================
// SAMS LOGIN SYSTEM - SUPABASE
// ============================================================

(function () {

    "use strict";


    // =========================================================
    // ELEMENTS
    // =========================================================

    const loginForm =
        document.getElementById("loginForm");

    const emailInput =
        document.getElementById("loginEmail");

    const passwordInput =
        document.getElementById("loginPassword");

    const togglePassword =
        document.getElementById("togglePassword");

    const rememberMe =
        document.getElementById("rememberMe");

    const forgotPasswordBtn =
        document.getElementById("forgotPasswordBtn");

    const createAccountBtn =
        document.getElementById("createAccountBtn");

    const loginMessage =
        document.getElementById("loginMessage");


    // =========================================================
    // SHOW MESSAGE
    // =========================================================

    function showMessage(message, type = "") {

        if (!loginMessage) {
            return;
        }

        loginMessage.textContent = message;

        loginMessage.className =
            "login-message " + type;
    }


    // =========================================================
    // SHOW / HIDE PASSWORD
    // =========================================================

    if (togglePassword) {

        togglePassword.addEventListener(
            "click",
            function () {

                if (
                    passwordInput.type ===
                    "password"
                ) {

                    passwordInput.type =
                        "text";

                    togglePassword.textContent =
                        "Hide";

                    togglePassword.setAttribute(
                        "aria-label",
                        "Hide password"
                    );

                }

                else {

                    passwordInput.type =
                        "password";

                    togglePassword.textContent =
                        "Show";

                    togglePassword.setAttribute(
                        "aria-label",
                        "Show password"
                    );
                }

            }
        );
    }


    // =========================================================
    // REMEMBERED EMAIL
    // =========================================================

    try {

        const rememberedEmail =
            localStorage.getItem(
                "sams_remembered_email"
            );

        if (
            rememberedEmail &&
            emailInput
        ) {

            emailInput.value =
                rememberedEmail;

            if (rememberMe) {
                rememberMe.checked = true;
            }
        }

    }

    catch (error) {

        console.warn(
            "Unable to read remembered email.",
            error
        );

    }


    // =========================================================
    // EDUCATIONAL EMAIL VALIDATION
    // =========================================================

    function isEducationalEmail(email) {

        const allowedDomains = [

            "@education.gov.bt",

            "@moesd.gov.bt",

            "@edu.gov.bt",

            "@school.gov.bt"

        ];


        return allowedDomains.some(
            function (domain) {

                return email.endsWith(
                    domain
                );

            }
        );
    }


    // =========================================================
    // NORMALISE ROLE
    // =========================================================

    function normalizeRole(value) {

        const raw =
            String(value || "")
                .trim()
                .toLowerCase()
                .replace(/[-]+/g, "_")
                .replace(/\s+/g, "_");


        const roleMap = {

            administrator:
                "Administrator",

            admin:
                "Administrator",

            administration:
                "Administrator",

            principal:
                "Principal",

            vice_principal:
                "Vice Principal",

            vp:
                "Vice Principal",

            class_teacher:
                "Class Teacher",

            non_class_teacher:
                "Non-Class Teacher",

            assessor:
                "Non-Class Teacher",

            student:
                "Student"

        };


        return (
            roleMap[raw] ||
            String(value || "").trim()
        );
    }


    // =========================================================
    // VALIDATE SAMS ROLE
    // =========================================================

    function isAllowedRole(role) {

        const normalized =
            String(role || "")
                .trim()
                .toLowerCase()
                .replace(/[-]+/g, "_")
                .replace(/\s+/g, "_");


        const allowedRoles = [

            "administrator",

            "admin",

            "administration",

            "principal",

            "vice_principal",

            "vp",

            "class_teacher",

            "non_class_teacher",

            "student"

        ];


        return allowedRoles.includes(
            normalized
        );
    }


    // =========================================================
    // CREATE SESSION
    // =========================================================

    async function createSAMSSession(
        authUser,
        profile,
        loginEmail
    ) {

        const role =
            normalizeRole(profile.role);


        // -----------------------------------------------------
        // Verify role
        // -----------------------------------------------------

        if (!isAllowedRole(profile.role)) {

            console.error(
                "Invalid SAMS role:",
                profile.role
            );

            await window.samsSupabase.auth.signOut();

            showMessage(
                "Your SAMS role has not been configured correctly. Please contact the administrator.",
                "error"
            );

            return false;
        }


        // -----------------------------------------------------
        // Remember email
        // -----------------------------------------------------

        if (
            rememberMe &&
            rememberMe.checked
        ) {

            localStorage.setItem(
                "sams_remembered_email",
                loginEmail
            );

        }

        else {

            localStorage.removeItem(
                "sams_remembered_email"
            );

        }


        // -----------------------------------------------------
        // Current user
        // -----------------------------------------------------

        const currentUser = {

            id:
                authUser.id,

            name:
                profile.full_name || "",

            email:
                profile.email ||
                authUser.email ||
                loginEmail,

            employeeCode:
                profile.employee_code || "",

            accountType:
                role,

            role:
                role,

            isAssessor:
                profile.is_assessor === true ||
                String(profile.role)
                    .toLowerCase()
                    === "assessor",

            status:
                profile.active === true
                    ? "Active"
                    : "Inactive",

            loginTime:
                new Date().toISOString()

        };


        // -----------------------------------------------------
        // SAMS session
        // -----------------------------------------------------

        sessionStorage.setItem(
            "sams_current_user",
            JSON.stringify(currentUser)
        );


        sessionStorage.setItem(
            "sams_logged_in",
            "true"
        );


        sessionStorage.setItem(
            "sams_email",
            currentUser.email
        );


        sessionStorage.setItem(
            "sams_user_name",
            currentUser.name
        );


        sessionStorage.setItem(
            "sams_user_role",
            role
        );


        // -----------------------------------------------------
        // Compatibility accounts
        // -----------------------------------------------------

        try {

            localStorage.setItem(
                "sams_accounts",
                JSON.stringify([
                    {

                        id:
                            authUser.id,

                        name:
                            currentUser.name,

                        email:
                            currentUser.email,

                        username:
                            currentUser.email,

                        employeeId:
                            profile.employee_code || "",

                        employeeCode:
                            profile.employee_code || "",

                        role:
                            role,

                        accountType:
                            role,

                        status:
                            currentUser.status,

                        isAssessor:
                            currentUser.isAssessor

                    }
                ])
            );

        }

        catch (error) {

            console.warn(
                "Unable to save compatibility account.",
                error
            );

        }


        // -----------------------------------------------------
        // Pull cloud data
        // -----------------------------------------------------

        try {

            if (
                window.samsCloud &&
                typeof window.samsCloud.pullAll ===
                "function"
            ) {

                await window.samsCloud.pullAll();

            }

        }

        catch (error) {

            console.warn(
                "SAMS cloud synchronisation failed:",
                error
            );

        }


        return true;
    }


    // =========================================================
    // LOGIN
    // =========================================================

    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();


                // ------------------------------------------------
                // GET EMAIL
                // ------------------------------------------------

                let email = "";


                if (emailInput) {

                    email =
                        String(
                            emailInput.value || ""
                        )
                            .trim()
                            .toLowerCase();

                }


                // ------------------------------------------------
                // FALLBACK TO FORM DATA
                // ------------------------------------------------

                if (!email) {

                    try {

                        const formData =
                            new FormData(
                                loginForm
                            );

                        email =
                            String(
                                formData.get(
                                    "email"
                                ) || ""
                            )
                                .trim()
                                .toLowerCase();

                    }

                    catch (error) {

                        console.warn(
                            "Unable to read form email.",
                            error
                        );

                    }
                }


                // ------------------------------------------------
                // GET PASSWORD
                // ------------------------------------------------

                const password =
                    passwordInput
                        ? passwordInput.value
                        : "";


                // ------------------------------------------------
                // VALIDATION
                // ------------------------------------------------

                if (!email) {

                    showMessage(
                        "Please enter your educational email.",
                        "error"
                    );

                    if (emailInput) {
                        emailInput.focus();
                    }

                    return;
                }


                if (!password) {

                    showMessage(
                        "Please enter your password.",
                        "error"
                    );

                    if (passwordInput) {
                        passwordInput.focus();
                    }

                    return;
                }


                // ------------------------------------------------
                // EMAIL DOMAIN
                // ------------------------------------------------

                if (
                    !isEducationalEmail(email)
                ) {

                    showMessage(
                        "Please use your official educational email.",
                        "error"
                    );

                    emailInput.focus();

                    return;
                }


                // ------------------------------------------------
                // SUPABASE CHECK
                // ------------------------------------------------

                if (
                    !window.samsSupabase
                ) {

                    console.error(
                        "SAMS Supabase client is not available."
                    );

                    showMessage(
                        "SAMS connection is not available. Please try again.",
                        "error"
                    );

                    return;
                }


                // ------------------------------------------------
                // BUTTON
                // ------------------------------------------------

                const loginButton =
                    loginForm.querySelector(
                        'button[type="submit"]'
                    );


                const originalButtonText =
                    loginButton
                        ? loginButton.textContent
                        : "Sign In";


                if (loginButton) {

                    loginButton.disabled =
                        true;

                    loginButton.textContent =
                        "Signing in...";

                }


                showMessage(
                    "Signing in...",
                    ""
                );


                // =================================================
                // SUPABASE LOGIN
                // =================================================

                try {

                    const {
                        data,
                        error
                    } =
                        await window
                            .samsSupabase
                            .auth
                            .signInWithPassword({

                                email:
                                    email,

                                password:
                                    password

                            });


                    // ------------------------------------------------
                    // AUTH ERROR
                    // ------------------------------------------------

                    if (error) {

                        console.error(
                            "SAMS login error:",
                            error
                        );


                        const errorText =
                            String(
                                error.message ||
                                ""
                            ).toLowerCase();


                        if (
                            errorText.includes(
                                "email not confirmed"
                            )
                        ) {

                            showMessage(
                                "Please confirm your email before signing in.",
                                "error"
                            );

                        }

                        else {

                            showMessage(
                                "Incorrect email or password.",
                                "error"
                            );

                        }

                        return;
                    }


                    // ------------------------------------------------
                    // USER CHECK
                    // ------------------------------------------------

                    if (
                        !data ||
                        !data.user
                    ) {

                        showMessage(
                            "Unable to sign in. Please try again.",
                            "error"
                        );

                        return;
                    }


                    const authUser =
                        data.user;


                    // =================================================
                    // GET PROFILE
                    // =================================================

                    const {

                        data: profile,

                        error: profileError

                    } =
                        await window
                            .samsSupabase
                            .from("profiles")
                            .select(
                                `
                                id,
                                full_name,
                                email,
                                employee_code,
                                role,
                                active,
                                is_assessor
                                `
                            )
                            .eq(
                                "id",
                                authUser.id
                            )
                            .maybeSingle();


                    // ------------------------------------------------
                    // PROFILE ERROR
                    // ------------------------------------------------

                    if (profileError) {

                        console.error(
                            "SAMS profile error:",
                            profileError
                        );


                        await window
                            .samsSupabase
                            .auth
                            .signOut();


                        showMessage(
                            "Unable to load your SAMS profile. Please contact the administrator.",
                            "error"
                        );

                        return;
                    }


                    // ------------------------------------------------
                    // PROFILE NOT FOUND
                    // ------------------------------------------------

                    if (!profile) {

                        await window
                            .samsSupabase
                            .auth
                            .signOut();


                        showMessage(
                            "Your SAMS profile has not been activated yet. Please contact the administrator.",
                            "error"
                        );

                        return;
                    }


                    // ------------------------------------------------
                    // ACTIVE CHECK
                    // ------------------------------------------------

                    if (
                        profile.active !== true
                    ) {

                        await window
                            .samsSupabase
                            .auth
                            .signOut();


                        showMessage(
                            "Your SAMS account is inactive. Please contact the administrator.",
                            "error"
                        );

                        return;
                    }


                    // =================================================
                    // CREATE SAMS SESSION
                    // =================================================

                    const sessionCreated =
                        await createSAMSSession(
                            authUser,
                            profile,
                            email
                        );


                    if (!sessionCreated) {
                        return;
                    }


                    // =================================================
                    // SUCCESS
                    // =================================================

                    showMessage(
                        "Login successful. Opening SAMS...",
                        "success"
                    );


                    setTimeout(
                        function () {

                            window.location.href =
                                "dashboard.html";

                        },
                        300
                    );


                }


                // =================================================
                // UNEXPECTED ERROR
                // =================================================

                catch (error) {

                    console.error(
                        "Unexpected SAMS login error:",
                        error
                    );


                    showMessage(
                        "An unexpected error occurred. Please try again.",
                        "error"
                    );

                }


                finally {

                    if (loginButton) {

                        loginButton.disabled =
                            false;

                        loginButton.textContent =
                            originalButtonText;

                    }

                }

            }
        );
    }


    // =========================================================
    // FORGOT PASSWORD
    // =========================================================

    if (forgotPasswordBtn) {

        forgotPasswordBtn.addEventListener(
            "click",
            async function () {

                let email =
                    emailInput
                        ? String(
                            emailInput.value || ""
                        )
                            .trim()
                            .toLowerCase()
                        : "";


                if (!email) {

                    showMessage(
                        "Enter your educational email first.",
                        "error"
                    );

                    if (emailInput) {
                        emailInput.focus();
                    }

                    return;
                }


                if (
                    !isEducationalEmail(email)
                ) {

                    showMessage(
                        "Please enter your official educational email.",
                        "error"
                    );

                    return;
                }


                if (
                    !window.samsSupabase
                ) {

                    showMessage(
                        "SAMS connection is not available.",
                        "error"
                    );

                    return;
                }


                try {

                    const {
                        error
                    } =
                        await window
                            .samsSupabase
                            .auth
                            .resetPasswordForEmail(
                                email,
                                {
                                    redirectTo:
                                        window.location.origin +
                                        "/reset-password.html"
                                }
                            );


                    if (error) {

                        console.error(
                            "Password reset error:",
                            error
                        );

                        showMessage(
                            error.message ||
                            "Unable to send password reset email.",
                            "error"
                        );

                        return;
                    }


                    showMessage(
                        "Password reset instructions have been sent to your email.",
                        "success"
                    );

                }

                catch (error) {

                    console.error(
                        "Unexpected password reset error:",
                        error
                    );

                    showMessage(
                        "Unable to send password reset instructions.",
                        "error"
                    );

                }

            }
        );
    }


    // =========================================================
    // CREATE ACCOUNT
    // =========================================================

    if (createAccountBtn) {

        createAccountBtn.addEventListener(
            "click",
            function () {

                window.location.href =
                    "register.html";

            }
        );
    }


})();
