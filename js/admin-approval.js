// =====================================================
// SAMS - ADMINISTRATOR STAFF MANAGEMENT
// =====================================================

(function () {

    'use strict';


    // =================================================
    // GET ACCOUNTS
    // =================================================

    function getAccounts() {

        const saved =
            localStorage.getItem('sams_accounts');

        if (!saved) {
            return [];
        }

        try {

            const accounts =
                JSON.parse(saved);

            if (!Array.isArray(accounts)) {
                return [];
            }

            return accounts;

        } catch (error) {

            console.error(
                'Could not read SAMS accounts:',
                error
            );

            return [];

        }
    }



    // =================================================
    // SYNC STAFF PROFILE TO SUPABASE
    // =================================================
    // Keeps the approved/assigned staff account available
    // on other devices. This does NOT create a new Auth
    // account; it only updates the existing profiles row
    // when the account already has the Supabase Auth UUID.
    // =================================================

    async function syncStaffProfileToSupabase(account) {

        if (!window.samsSupabase || !account) {
            return false;
        }

        try {

            const email = String(
                account.email ||
                account.educationalEmail ||
                account.educational_email ||
                ''
            ).trim().toLowerCase();

            const authId = String(
                account.id || ''
            ).trim();

            const role = String(
                account.role || ''
            ).trim();

            if (!email && !authId) {
                return false;
            }


            // -------------------------------------------------
            // Convert SAMS display roles to Supabase enum roles
            // -------------------------------------------------

            const normalizedRole =
                role
                    .toLowerCase()
                    .replace(/[-_]/g, ' ')
                    .trim();


            const roleMap = {

                'administrator':
                    'admin',

                'admin':
                    'admin',

                'principal':
                    'principal',

                'vice principal':
                    'vice_principal',

                'vp':
                    'vice_principal',

                'class teacher':
                    'class_teacher',

                'non class teacher':
                    'non_class_teacher',

                'teacher':
                    'class_teacher',

                'assessor':
                    'assessor',

                'student':
                    'student'

            };


            /*
             * "Pending" is a SAMS UI/approval state.
             *
             * It is NOT a value in the Supabase user_role enum.
             *
             * Therefore, an unassigned staff member is stored
             * as non_class_teacher until an Administrator assigns
             * the permanent role.
             */

            const databaseRole =
                roleMap[normalizedRole] ||
                'non_class_teacher';


            const profileData = {

                full_name:
                    account.name ||
                    account.full_name ||
                    '',

                email:
                    email || null,

                employee_code:
                    account.employeeId ||
                    account.employeeCode ||
                    '',

                role:
                    databaseRole,

                active:
                    String(
                        account.status ||
                        ''
                    ).toLowerCase() === 'active',

                is_assessor:
                    account.isAssessor === true ||
                    account.is_assessor === true ||
                    account.appointedAssessor === true ||
                    account.appointed_assessor === true

            };


            // -------------------------------------------------
            // Prefer the Auth UUID when available
            // -------------------------------------------------

            if (
                authId &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                    authId
                )
            ) {

                profileData.id =
                    authId;


                const result =
                    await window.samsSupabase
                        .from('profiles')
                        .upsert(
                            profileData,
                            {
                                onConflict:
                                    'id'
                            }
                        );


                if (result.error) {

                    throw result.error;

                }


                return true;

            }


            // -------------------------------------------------
            // If there is no Auth UUID, update an existing
            // profile by email.
            //
            // We deliberately do NOT invent a UUID.
            // -------------------------------------------------

            if (email) {

                const found =
                    await window.samsSupabase
                        .from('profiles')
                        .select('id')
                        .eq(
                            'email',
                            email
                        )
                        .maybeSingle();


                if (found.error) {

                    throw found.error;

                }


                if (found.data?.id) {

                    const result =
                        await window.samsSupabase
                            .update(
                                profileData
                            )
                            .eq(
                                'id',
                                found.data.id
                            );


                    if (result.error) {

                        throw result.error;

                    }


                    return true;

                }

            }


            return false;

        } catch (error) {

            console.error(
                'Could not sync staff profile to Supabase:',
                error
            );

            return false;

        }

    }



    // =================================================
    // SAVE ACCOUNTS
    // =================================================

    function saveAccounts(accounts) {

        localStorage.setItem(
            'sams_accounts',
            JSON.stringify(accounts)
        );

    }



    // =================================================
    // FIND STAFF
    // =================================================

    function findStaffByEmployeeId(
        employeeId
    ) {

        const accounts =
            getAccounts();

        return accounts.find(
            function (account) {

                return String(
                    account.employeeId ||
                    account.employee_code ||
                    ''
                ).trim() === String(
                    employeeId
                ).trim();

            }
        ) || null;

    }



    // =================================================
    // MESSAGE
    // =================================================

    function showMessage(
        message,
        type = 'success'
    ) {

        const element =
            document.getElementById(
                'adminMessage'
            );


        if (!element) {
            return;
        }


        element.textContent =
            message;


        element.className =
            'admin-message ' +
            type;

    }



    // =================================================
    // ESCAPE HTML
    // =================================================

    function escapeHTML(value) {

        return String(
            value ?? ''
        )
        .replace(
            /&/g,
            '&amp;'
        )
        .replace(
            /</g,
            '&lt;'
        )
        .replace(
            />/g,
            '&gt;'
        )
        .replace(
            /"/g,
            '&quot;'
        )
        .replace(
            /'/g,
            '&#039;'
        );

    }



    // =================================================
    // ROLE OPTIONS
    // =================================================

    function createRoleSelect(
        employeeId,
        currentRole
    ) {

        const selectedRole =
            currentRole ||
            'Pending';


        return `

            <select
                class="role-select"
                data-employee-id="${escapeHTML(
                    employeeId
                )}"
            >

                <option
                    value="Pending"
                    ${selectedRole === 'Pending'
                        ? 'selected'
                        : ''}
                >
                    Pending
                </option>


                <option
                    value="Vice Principal"
                    ${selectedRole === 'Vice Principal'
                        ? 'selected'
                        : ''}
                >
                    Vice Principal
                </option>


                <option
                    value="Class Teacher"
                    ${selectedRole === 'Class Teacher'
                        ? 'selected'
                        : ''}
                >
                    Class Teacher
                </option>


                <option
                    value="Non-Class Teacher"
                    ${selectedRole === 'Non-Class Teacher'
                        ? 'selected'
                        : ''}
                >
                    Non-Class Teacher
                </option>


                <option
                    value="Principal"
                    ${selectedRole === 'Principal'
                        ? 'selected'
                        : ''}
                >
                    Principal
                </option>


                <option
                    value="Administrator"
                    ${selectedRole === 'Administrator'
                        ? 'selected'
                        : ''}
                >
                    Administrator
                </option>

            </select>

        `;

    }



    // =================================================
    // ACTION BUTTONS
    // =================================================

    function createActionButtons(
        account
    ) {

        const status =
            String(
                account.status ||
                ''
            )
            .toLowerCase();


        const employeeId =
            account.employeeId ||
            '';


        let html = '';


        // ---------------------------------------------
        // PENDING
        // ---------------------------------------------

        if (
            status ===
            'pending'
        ) {

            html += `

                <button
                    type="button"
                    class="approval-btn approve"
                    data-action="approve"
                    data-employee-id="${escapeHTML(
                        employeeId
                    )}"
                >
                    Approve
                </button>


                <button
                    type="button"
                    class="approval-btn reject"
                    data-action="reject"
                    data-employee-id="${escapeHTML(
                        employeeId
                    )}"
                >
                    Reject
                </button>

            `;

        }


        // ---------------------------------------------
        // ACTIVE
        // ---------------------------------------------

        else if (
            status ===
            'active'
        ) {

            html += `

                <button
                    type="button"
                    class="approval-btn edit"
                    data-action="role"
                    data-employee-id="${escapeHTML(
                        employeeId
                    )}"
                >
                    Assign Role
                </button>

            `;

        }


        return html;

    }



    // =================================================
    // RENDER STAFF
    // =================================================

    function renderStaff() {

        const tableBody =
            document.getElementById(
                'staffTableBody'
            );


        if (!tableBody) {
            return;
        }


        const accounts =
            getAccounts();


        const staff =
            accounts.filter(
                function (account) {

                    return (
                        String(
                            account.accountType ||
                            account.type ||
                            ''
                        ).toLowerCase()
                        === 'staff'
                    );

                }
            );


        tableBody.innerHTML =
            '';


        if (
            staff.length ===
            0
        ) {

            tableBody.innerHTML = `

                <tr>

                    <td
                        colspan="6"
                        class="empty-state"
                    >
                        No staff accounts found.
                    </td>

                </tr>

            `;

            updateSummary();

            return;

        }


        staff.forEach(
            function (account) {

                const employeeId =
                    account.employeeId ||
                    account.employee_code ||
                    'Not available';


                const name =
                    account.name ||
                    account.full_name ||
                    'Not available';


                const email =
                    account.email ||
                    account.educationalEmail ||
                    account.educational_email ||
                    'Not available';


                const status =
                    account.status ||
                    'Pending';


                const role =
                    account.role ||
                    'Pending';


                const row =
                    document.createElement(
                        'tr'
                    );


                row.innerHTML = `

                    <td>

                        <strong>
                            ${escapeHTML(
                                employeeId
                            )}
                        </strong>

                    </td>


                    <td>

                        ${escapeHTML(
                            name
                        )}

                    </td>


                    <td>

                        ${escapeHTML(
                            email
                        )}

                    </td>


                    <td>

                        ${createRoleSelect(
                            employeeId,
                            role
                        )}

                    </td>


                    <td>

                        <span
                            class="status-badge
                            ${String(
                                status
                            )
                            .toLowerCase()
                            .replace(
                                /\s+/g,
                                '-'
                            )}"
                        >

                            ${escapeHTML(
                                status
                            )}

                        </span>

                    </td>


                    <td>

                        <div
                            class="approval-actions"
                        >

                            ${createActionButtons(
                                account
                            )}

                        </div>

                    </td>

                `;


                tableBody.appendChild(
                    row
                );

            }
        );


        updateSummary();

    }



    // =================================================
    // UPDATE SUMMARY
    // =================================================

    function updateSummary() {

        const accounts =
            getAccounts();


        const staff =
            accounts.filter(
                function (account) {

                    return (
                        String(
                            account.accountType ||
                            account.type ||
                            ''
                        ).toLowerCase()
                        === 'staff'
                    );

                }
            );


        const pending =
            staff.filter(
                function (account) {

                    return (
                        String(
                            account.status ||
                            ''
                        ).toLowerCase()
                        === 'pending'
                    );

                }
            ).length;


        const active =
            staff.filter(
                function (account) {

                    return (
                        String(
                            account.status ||
                            ''
                        ).toLowerCase()
                        === 'active'
                    );

                }
            ).length;


        const pendingElement =
            document.getElementById(
                'pendingCount'
            );


        const activeElement =
            document.getElementById(
                'activeCount'
            );


        const totalElement =
            document.getElementById(
                'totalStaffCount'
            );


        if (pendingElement) {

            pendingElement.textContent =
                pending;

        }


        if (activeElement) {

            activeElement.textContent =
                active;

        }


        if (totalElement) {

            totalElement.textContent =
                staff.length;

        }

    }



    // =================================================
    // APPROVE STAFF
    // =================================================

    async function approveStaff(
        employeeId
    ) {

        const accounts =
            getAccounts();


        const account =
            findStaffByEmployeeId(
                employeeId
            );


        if (!account) {

            showMessage(
                'Staff account could not be found using Employee ID.',
                'error'
            );

            return;

        }


        account.status =
            'Active';


        /*
         * Do NOT automatically assign a permanent
         * application role.
         *
         * "Pending" is a UI approval state only.
         *
         * syncStaffProfileToSupabase() converts
         * Pending to the valid database role:
         *
         * non_class_teacher
         */


        account.role =
            'Pending';


        account.accountType =
            'Staff';


        account.type =
            'Staff';


        account.approvedAt =
            new Date()
                .toISOString();


        saveAccounts(
            accounts
        );


        await syncStaffProfileToSupabase(
            account
        );


        showMessage(
            'Staff account approved. Please assign the staff role.'
        );


        updateSummary();

        renderStaff();

    }



    // =================================================
    // REJECT STAFF
    // =================================================

    async function rejectStaff(
        employeeId
    ) {

        const account =
            findStaffByEmployeeId(
                employeeId
            );


        if (!account) {

            showMessage(
                'Staff account could not be found.',
                'error'
            );

            return;

        }


        const confirmed =
            window.confirm(
                'Are you sure you want to reject this Staff account?'
            );


        if (!confirmed) {
            return;
        }


        const accounts =
            getAccounts();


        const index =
            accounts.findIndex(
                function (item) {

                    return (
                        String(
                            item.employeeId ||
                            item.employee_code ||
                            ''
                        ).trim()
                        ===
                        String(
                            employeeId
                        ).trim()
                    );

                }
            );


        if (
            index ===
            -1
        ) {

            showMessage(
                'Staff account could not be found.',
                'error'
            );

            return;

        }


        accounts.splice(
            index,
            1
        );


        saveAccounts(
            accounts
        );


        showMessage(
            'Staff account rejected.'
        );


        updateSummary();

        renderStaff();

    }



    // =================================================
    // ASSIGN ROLE
    // =================================================

    async function assignRole(
        employeeId,
        select
    ) {

        if (!select) {

            showMessage(
                'Role selection could not be found.',
                'error'
            );

            return;

        }


        const selectedRole =
            select.value;


        if (
            selectedRole ===
            'Pending'
        ) {

            showMessage(
                'Please select a Staff role.',
                'error'
            );

            return;

        }


        const accounts =
            getAccounts();


        const account =
            findStaffByEmployeeId(
                employeeId
            );


        if (!account) {

            showMessage(
                'Staff account could not be found.',
                'error'
            );

            return;

        }


        account.role =
            selectedRole;


        account.accountType =
            'Staff';


        account.type =
            'Staff';


        account.roleAssignedAt =
            new Date()
                .toISOString();


        saveAccounts(
            accounts
        );


        const synced =
            await syncStaffProfileToSupabase(
                account
            );


        if (!synced) {

            showMessage(
                'Role was saved locally, but the SAMS profile could not be synchronized.',
                'error'
            );

            renderStaff();

            return;

        }


        showMessage(
            'Role assigned successfully.'
        );


        renderStaff();

    }



    // =================================================
    // TABLE BUTTON ACTIONS
    // =================================================

    const tableBody =
        document.getElementById(
            'staffTableBody'
        );


    if (tableBody) {

        tableBody.addEventListener(
            'click',
            function (event) {

                const button =
                    event.target.closest(
                        'button[data-action]'
                    );


                if (!button) {
                    return;
                }


                const action =
                    button.dataset.action;


                const employeeId =
                    button.dataset.employeeId;


                if (!employeeId) {

                    showMessage(
                        'Employee ID could not be identified.',
                        'error'
                    );

                    return;

                }


                if (
                    action ===
                    'approve'
                ) {

                    approveStaff(
                        employeeId
                    );

                }


                else if (
                    action ===
                    'reject'
                ) {

                    rejectStaff(
                        employeeId
                    );

                }


                else if (
                    action ===
                    'role'
                ) {

                    const select =
                        tableBody.querySelector(
                            `select.role-select[data-employee-id="${CSS.escape(
                                employeeId
                            )}"]`
                        );


                    assignRole(
                        employeeId,
                        select
                    );

                }

            }
        );

    }



    // =================================================
    // INITIAL RENDER
    // =================================================

    renderStaff();

    updateSummary();


})();
