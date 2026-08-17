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

            const profileData = {
                full_name:
                    account.name ||
                    account.full_name ||
                    '',
                email: email || null,
                employee_code:
                    account.employeeId ||
                    account.employeeCode ||
                    '',
                role: role || 'Pending',
                active:
                    String(account.status || '').toLowerCase() === 'active',
                is_assessor:
                    account.isAssessor === true ||
                    account.is_assessor === true ||
                    account.appointedAssessor === true ||
                    account.appointed_assessor === true
            };

            // Prefer the Auth UUID when the local account contains it.
            if (
                authId &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authId)
            ) {
                profileData.id = authId;

                const result =
                    await window.samsSupabase
                        .from('profiles')
                        .upsert(
                            profileData,
                            { onConflict: 'id' }
                        );

                if (result.error) {
                    throw result.error;
                }

                return true;
            }

            // If there is no Auth UUID, update an existing profile
            // by email. We deliberately do NOT invent a UUID.
            if (email) {

                const found =
                    await window.samsSupabase
                        .from('profiles')
                        .select('id')
                        .eq('email', email)
                        .maybeSingle();

                if (found.error) {
                    throw found.error;
                }

                if (found.data?.id) {

                    const result =
                        await window.samsSupabase
                            .from('profiles')
                            .update(profileData)
                            .eq('id', found.data.id);

                    if (result.error) {
                        throw result.error;
                    }

                    return true;
                }
            }

            console.warn(
                'SAMS: no existing Supabase Auth/profile ID found for staff account:',
                email || authId
            );

            return false;

        } catch (error) {

            console.error(
                'SAMS staff profile synchronization failed:',
                error
            );

            return false;
        }
    }


    async function syncAllStaffProfilesToSupabase() {

        const staff = getStaffAccounts();

        for (const account of staff) {
            await syncStaffProfileToSupabase(account);
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
    // CURRENT USER
    // =================================================

    function getCurrentUser() {

        const savedUser =
            sessionStorage.getItem(
                'sams_current_user'
            );


        if (savedUser) {

            try {

                return JSON.parse(
                    savedUser
                );

            } catch (error) {

                console.error(
                    'Invalid current user session.',
                    error
                );

            }

        }


        const email =
            sessionStorage.getItem(
                'sams_email'
            );


        if (!email) {
            return null;
        }


        const accounts =
            getAccounts();


        return accounts.find(
            function (account) {

                return (
                    account.email &&
                    account.email.toLowerCase() ===
                    email.toLowerCase()
                );

            }
        ) || null;

    }


    // =================================================
    // CHECK ADMINISTRATOR ACCESS
    // =================================================

    const currentUser =
        getCurrentUser();


    if (!currentUser) {

        window.location.href =
            'index.html';

        return;

    }


    const currentRole =
        String(
            currentUser.role ||
            currentUser.accountType ||
            currentUser.type ||
            ''
        )
        .trim()
        .toLowerCase();


    if (
        currentRole !==
        'administrator'
    ) {

        alert(
            'Access denied. Only the Administrator can access Staff Management.'
        );

        window.location.href =
            'dashboard.html';

        return;

    }


    // =================================================
    // ELEMENTS
    // =================================================

    const tableBody =
        document.getElementById(
            'staffTableBody'
        );


    const emptyState =
        document.getElementById(
            'emptyState'
        );


    const pendingCount =
        document.getElementById(
            'pendingCount'
        );


    const approvedCount =
        document.getElementById(
            'approvedCount'
        );


    const rejectedCount =
        document.getElementById(
            'rejectedCount'
        );


    const filterStatus =
        document.getElementById(
            'filterStatus'
        );


    const message =
        document.getElementById(
            'approvalMessage'
        );


    const adminUserName =
        document.getElementById(
            'adminUserName'
        );


    // =================================================
    // DISPLAY ADMIN NAME
    // =================================================

    if (
        adminUserName &&
        currentUser.name
    ) {

        adminUserName.textContent =
            currentUser.name;

    }


    // =================================================
    // SHOW MESSAGE
    // =================================================

    function showMessage(
        text,
        type = 'success'
    ) {

        if (!message) {
            return;
        }


        message.textContent =
            text;


        message.className =
            'approval-message ' +
            type;


        setTimeout(
            function () {

                message.textContent =
                    '';

                message.className =
                    'approval-message';

            },
            3000
        );

    }


    // =================================================
    // GET STAFF ACCOUNTS
    // =================================================

    function getStaffAccounts() {

        return getAccounts().filter(
            function (account) {

                const type =
                    String(
                        account.accountType ||
                        account.type ||
                        ''
                    )
                    .trim()
                    .toLowerCase();


                return type === 'staff';

            }
        );

    }


    // =================================================
    // FIND STAFF BY EMPLOYEE ID
    // =================================================

    function findStaffByEmployeeId(
        employeeId
    ) {

        const accounts =
            getAccounts();


        return accounts.find(
            function (account) {

                return (
                    account.employeeId &&
                    String(
                        account.employeeId
                    ).trim() ===
                    String(
                        employeeId
                    ).trim()
                );

            }
        );

    }


    // =================================================
    // UPDATE SUMMARY
    // =================================================

    function updateSummary() {

        const staff =
            getStaffAccounts();


        const pending =
            staff.filter(
                function (account) {

                    return (
                        String(
                            account.status ||
                            ''
                        )
                        .toLowerCase() ===
                        'pending'
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
                        )
                        .toLowerCase() ===
                        'active'
                    );

                }
            ).length;


        const rejected =
            staff.filter(
                function (account) {

                    return (
                        String(
                            account.status ||
                            ''
                        )
                        .toLowerCase() ===
                        'rejected'
                    );

                }
            ).length;


        if (pendingCount) {

            pendingCount.textContent =
                pending;

        }


        if (approvedCount) {

            approvedCount.textContent =
                active;

        }


        if (rejectedCount) {

            rejectedCount.textContent =
                rejected;

        }

    }


    // =================================================
    // STATUS CLASS
    // =================================================

    function getStatusClass(
        status
    ) {

        const cleanStatus =
            String(
                status || ''
            )
            .toLowerCase();


        if (
            cleanStatus ===
            'pending'
        ) {

            return 'status-pending';

        }


        if (
            cleanStatus ===
            'active'
        ) {

            return 'status-active';

        }


        if (
            cleanStatus ===
            'rejected'
        ) {

            return 'status-rejected';

        }


        if (
            cleanStatus ===
            'inactive'
        ) {

            return 'status-inactive';

        }


        return 'status-inactive';

    }


    // =================================================
    // ESCAPE HTML
    // =================================================

    function escapeHTML(
        value
    ) {

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
                    value="Teacher"
                    ${selectedRole === 'Teacher'
                        ? 'selected'
                        : ''}
                >
                    Teacher
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


                <button
                    type="button"
                    class="approval-btn deactivate"
                    data-action="deactivate"
                    data-employee-id="${escapeHTML(
                        employeeId
                    )}"
                >
                    Deactivate
                </button>

            `;

        }


        // ---------------------------------------------
        // REJECTED
        // ---------------------------------------------

        else if (
            status ===
            'rejected'
        ) {

            html += `

                <button
                    type="button"
                    class="approval-btn activate"
                    data-action="activate"
                    data-employee-id="${escapeHTML(
                        employeeId
                    )}"
                >
                    Re-activate
                </button>

            `;

        }


        // ---------------------------------------------
        // INACTIVE
        // ---------------------------------------------

        else if (
            status ===
            'inactive'
        ) {

            html += `

                <button
                    type="button"
                    class="approval-btn activate"
                    data-action="activate"
                    data-employee-id="${escapeHTML(
                        employeeId
                    )}"
                >
                    Activate
                </button>

            `;

        }


        return html;

    }


    // =================================================
    // RENDER STAFF TABLE
    // =================================================

    function renderStaff() {

        if (!tableBody) {
            return;
        }


        const staff =
            getStaffAccounts();


        const selectedStatus =
            filterStatus
                ? filterStatus.value
                : 'all';


        let filteredStaff =
            staff;


        if (
            selectedStatus !==
            'all'
        ) {

            filteredStaff =
                staff.filter(
                    function (account) {

                        return (
                            String(
                                account.status ||
                                ''
                            )
                            .toLowerCase() ===
                            selectedStatus
                        );

                    }
                );

        }


        tableBody.innerHTML =
            '';


        if (
            filteredStaff.length ===
            0
        ) {

            if (emptyState) {

                emptyState.style.display =
                    'block';

            }


            return;

        }


        if (emptyState) {

            emptyState.style.display =
                'none';

        }


        filteredStaff.forEach(
            function (account) {

                const row =
                    document.createElement(
                        'tr'
                    );


                const employeeId =
                    account.employeeId ||
                    'Not available';


                const status =
                    account.status ||
                    'Pending';


                const role =
                    account.role ||
                    'Pending';


                row.innerHTML = `

                    <!-- EMPLOYEE ID -->

                    <td>

                        <strong>
                            ${escapeHTML(
                                employeeId
                            )}
                        </strong>

                    </td>


                    <!-- STAFF NAME -->

                    <td>

                        <div class="staff-name">
                            ${escapeHTML(
                                account.name ||
                                'Unnamed Staff'
                            )}
                        </div>

                    </td>


                    <!-- EMAIL -->

                    <td>

                        <div class="staff-email">
                            ${escapeHTML(
                                account.email ||
                                ''
                            )}
                        </div>

                    </td>


                    <!-- STATUS -->

                    <td>

                        <span
                            class="status-badge
                            ${getStatusClass(
                                status
                            )}"
                        >
                            ${escapeHTML(
                                status
                            )}
                        </span>

                    </td>


                    <!-- ROLE -->

                    <td>

                        ${createRoleSelect(
                            employeeId,
                            role
                        )}

                    </td>


                    <!-- ACTION -->

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


        // Do NOT automatically assign
        // a permanent role.
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

        await syncStaffProfileToSupabase(account);

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


        const target =
            findStaffByEmployeeId(
                employeeId
            );


        target.status =
            'Rejected';


        target.rejectedAt =
            new Date()
                .toISOString();


        saveAccounts(
            accounts
        );

        await syncStaffProfileToSupabase(target);

        showMessage(
            'Staff account rejected.'
        );


        updateSummary();

        renderStaff();

    }


    // =================================================
    // DEACTIVATE STAFF
    // =================================================

    async function deactivateStaff(
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
                'Are you sure you want to deactivate this Staff account?'
            );


        if (!confirmed) {
            return;
        }


        const accounts =
            getAccounts();


        const target =
            findStaffByEmployeeId(
                employeeId
            );


        target.status =
            'Inactive';


        target.deactivatedAt =
            new Date()
                .toISOString();


        saveAccounts(
            accounts
        );

        await syncStaffProfileToSupabase(target);

        showMessage(
            'Staff account deactivated.'
        );


        updateSummary();

        renderStaff();

    }


    // =================================================
    // ACTIVATE STAFF
    // =================================================

    async function activateStaff(
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
                'Staff account could not be found.',
                'error'
            );

            return;

        }


        account.status =
            'Active';


        account.activatedAt =
            new Date()
                .toISOString();


        saveAccounts(
            accounts
        );

        await syncStaffProfileToSupabase(account);

        showMessage(
            'Staff account activated.'
        );


        updateSummary();

        renderStaff();

    }


    // =================================================
    // ASSIGN ROLE
    // =================================================

    async function assignRole(
        employeeId
    ) {

        const select =
            document.querySelector(
                `.role-select[data-employee-id="${CSS.escape(
                    String(employeeId)
                )}"]`
            );


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

        await syncStaffProfileToSupabase(account);

        showMessage(
            'Role assigned successfully.'
        );


        renderStaff();

    }


    // =================================================
    // TABLE BUTTON ACTIONS
    // =================================================

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
                        'Employee ID is missing.',
                        'error'
                    );

                    return;

                }


                switch (action) {

                    case 'approve':

                        approveStaff(
                            employeeId
                        );

                        break;


                    case 'reject':

                        rejectStaff(
                            employeeId
                        );

                        break;


                    case 'role':

                        assignRole(
                            employeeId
                        );

                        break;


                    case 'deactivate':

                        deactivateStaff(
                            employeeId
                        );

                        break;


                    case 'activate':

                        activateStaff(
                            employeeId
                        );

                        break;

                }

            }
        );

    }


    // =================================================
    // ROLE DROPDOWN CHANGE
    // =================================================

    if (tableBody) {

        tableBody.addEventListener(
            'change',
            function (event) {

                if (
                    !event.target.classList.contains(
                        'role-select'
                    )
                ) {
                    return;
                }


                const employeeId =
                    event.target.dataset.employeeId;


                if (!employeeId) {
                    return;
                }


                // Only save when a real role
                // is selected.

                if (
                    event.target.value !==
                    'Pending'
                ) {

                    assignRole(
                        employeeId
                    );

                }

            }
        );

    }


    // =================================================
    // FILTER
    // =================================================

    if (filterStatus) {

        filterStatus.addEventListener(
            'change',
            function () {

                renderStaff();

            }
        );

    }


    // =================================================
    // BACK TO DASHBOARD
    // =================================================

    const backDashboardBtn =
        document.getElementById(
            'backDashboardBtn'
        );


    if (backDashboardBtn) {

        backDashboardBtn.addEventListener(
            'click',
            function () {

                window.location.href =
                    'dashboard.html';

            }
        );

    }


    // =================================================
    // INITIAL LOAD
    // =================================================

    updateSummary();

    renderStaff();

    // Synchronize existing local staff profiles to Supabase once.
    // This allows the same activated/assigned account to be recognized
    // from another device when the corresponding Auth/profile ID exists.
    syncAllStaffProfilesToSupabase();

})();