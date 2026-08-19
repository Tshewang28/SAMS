// SAMS CENTRAL CLOUD STORAGE BRIDGE
// All shared SAMS application data is stored in Supabase.
// localStorage is only a device cache; sessionStorage remains device/session only.
(function () {
    "use strict";

    const DATA_KEYS = [
        "sams_students",
        "sams_classes",
        "sams_assessment_criteria",
        "sams_assessment_records",
        "sams_games_sports_records",
        "sams_discipline_records",
        "sams_volunteer_programs",
        "sams_volunteer_records",
        "sams_reports",
        "sams_hall_of_fame_records",
        "sams_hall_of_fame",
        "sams_class_ranking",
        "sams_ranking",
        "sams_recent_activities",
        "sams_assessment_cache",
        "sams_school_settings",
        "sams_system_settings"
    ];

    // sams_accounts is deliberately NOT a cloud-store key. Registered
    // accounts come from Supabase Auth + public.profiles, which is the
    // authoritative cross-device user directory.
    const ALL_KEYS = [...DATA_KEYS];

    let pulling = false;
    let resetting = false;
    let suppressSync = false;
    let realtimeStarted = false;
    let readyResolve;

    const ready = new Promise(resolve => { readyResolve = resolve; });

    window.samsCloud = {
        ready,
        pullAll,
        syncKey,
        syncAll,
        deleteKey,
        resetAssessmentData,
        refreshAccountsFromProfiles,
        DATA_KEYS: [...DATA_KEYS]
    };

    function parse(value) {
        try { return JSON.parse(value); } catch (e) { return value; }
    }

    async function currentUserId() {
        if (!window.samsSupabase) return null;
        const result = await window.samsSupabase.auth.getUser();
        return result.data?.user?.id || null;
    }

    function emailOf(a) {
        return String(
            a?.email || a?.educationalEmail || a?.educational_email || ""
        ).trim().toLowerCase();
    }

    function profileToAccount(p) {
        if (!p) return null;
        const roleMap = {
            admin: "Administrator",
            administrator: "Administrator",
            principal: "Principal",
            vice_principal: "Vice Principal",
            class_teacher: "Class Teacher",
            non_class_teacher: "Non-Class Teacher",
            assessor: "Assessor",
            student: "Student"
        };
        const rawRole = String(p.role || "").trim().toLowerCase();
        return {
            id: p.id,
            name: p.full_name || "",
            full_name: p.full_name || "",
            email: p.email || "",
            username: p.email || "",
            employeeId: p.employee_code || "",
            employeeCode: p.employee_code || "",
            role: roleMap[rawRole] || p.role || "",
            accountType: roleMap[rawRole] || p.role || "",
            isAssessor: p.is_assessor === true,
            assignedClass: p.assigned_class || "",
            assignedSection: p.assigned_section || "",
            assignedStream: p.assigned_stream || "",
            active: p.active === true,
            status: p.active === true ? "Active" : "Inactive"
        };
    }

    async function refreshAccountsFromProfiles() {
        if (!window.samsSupabase) return [];
        try {
            const result = await window.samsSupabase
                .from("profiles")
                .select("id,full_name,email,employee_code,role,active,is_assessor,assigned_class,assigned_section,assigned_stream")
                .order("full_name", { ascending: true });

            if (result.error) throw result.error;

            const accounts = (result.data || [])
                .map(profileToAccount)
                .filter(Boolean);

            localStorage.setItem("sams_accounts", JSON.stringify(accounts));
            return accounts;
        } catch (error) {
            console.warn("SAMS profiles could not be refreshed:", error);
            return [];
        }
    }

    function mergeArrays(cloudValue, localValue) {
        if (!Array.isArray(cloudValue) || !Array.isArray(localValue)) return cloudValue;
        const result = [...cloudValue];
        const ids = new Set(result.map(x => String(x?.id ?? x?.studentCode ?? "")));
        for (const item of localValue) {
            const id = String(item?.id ?? item?.studentCode ?? "");
            if (id && !ids.has(id)) {
                result.push(item);
                ids.add(id);
            }
        }
        return result;
    }

    function localValue(key) {
        const raw = localStorage.getItem(key);
        return raw === null ? null : parse(raw);
    }

    async function pullAll() {
        if (resetting || !window.samsSupabase) {
            readyResolve(false);
            return false;
        }

        try {
            const sessionResult = await window.samsSupabase.auth.getSession();
            if (!sessionResult.data?.session) {
                readyResolve(false);
                return false;
            }

            const result = await window.samsSupabase
                .from("sams_store")
                .select("key,value,updated_at")
                .in("key", ALL_KEYS);

            if (result.error) throw result.error;

            pulling = true;

            const rows = result.data || [];
            const byKey = new Map(rows.map(row => [row.key, row]));
            const migrationDone = localStorage.getItem("sams_cloud_central_migration_v3") === "1";
            const migrationUploads = [];

            for (const key of DATA_KEYS) {
                const row = byKey.get(key);
                const local = localValue(key);

                // First connection on a device: if cloud has no row, preserve
                // useful local data by uploading it. If both exist, merge
                // array records by ID rather than silently destroying data.
                if (!migrationDone && local !== null) {
                    if (!row) {
                        migrationUploads.push({ key, value: local });
                        localStorage.setItem(key, JSON.stringify(local));
                        continue;
                    }

                    if (Array.isArray(row.value) && Array.isArray(local) && local.length) {
                        const merged = mergeArrays(row.value, local);
                        localStorage.setItem(key, JSON.stringify(merged));
                        if (JSON.stringify(merged) !== JSON.stringify(row.value)) {
                            migrationUploads.push({ key, value: merged });
                        }
                        continue;
                    }
                }

                if (row) {
                    localStorage.setItem(key, JSON.stringify(row.value));
                }
            }

            pulling = false;

            // Complete the one-time device migration after the cloud snapshot
            // has been reconciled, then make Supabase authoritative thereafter.
            for (const item of migrationUploads) {
                await upsertValue(item.key, item.value);
            }
            localStorage.setItem("sams_cloud_central_migration_v3", "1");

            await refreshAccountsFromProfiles();
            startRealtime();

            readyResolve(true);
            window.dispatchEvent(new CustomEvent("sams-cloud-ready"));
            return true;
        } catch (error) {
            pulling = false;
            console.error("SAMS cloud pull failed", error);
            readyResolve(false);
            return false;
        }
    }

    async function upsertValue(key, value) {
        const uid = await currentUserId();
        if (!uid) throw new Error("No authenticated SAMS user is available.");

        const result = await window.samsSupabase
            .from("sams_store")
            .upsert({
                key,
                value,
                updated_by: uid,
                updated_at: new Date().toISOString()
            }, { onConflict: "key" });

        if (result.error) throw result.error;
    }

    async function syncKey(key) {
        if (
            pulling || resetting || suppressSync ||
            !ALL_KEYS.includes(key) || !window.samsSupabase
        ) return;

        try {
            const value = localValue(key);
            if (value === null) {
                await deleteKey(key);
            } else {
                await upsertValue(key, value);
            }
        } catch (error) {
            console.error("SAMS cloud save failed", key, error);
        }
    }

    async function syncAll() {
        for (const key of DATA_KEYS) await syncKey(key);
        await refreshAccountsFromProfiles();
    }

    async function deleteKey(key) {
        if (!ALL_KEYS.includes(key) || !window.samsSupabase) return true;
        const uid = await currentUserId();
        if (!uid) throw new Error("No authenticated SAMS user is available for cloud deletion.");

        const result = await window.samsSupabase
            .from("sams_store")
            .delete()
            .eq("key", key);
        if (result.error) throw result.error;

        const verify = await window.samsSupabase
            .from("sams_store")
            .select("key")
            .eq("key", key)
            .maybeSingle();
        if (verify.error) throw verify.error;
        if (verify.data) throw new Error(`Cloud deletion failed for ${key}. Check sams_store RLS.`);
        return true;
    }

    async function resetAssessmentData(keys) {
        const resetKeys = Array.isArray(keys)
            ? keys.filter(key => ALL_KEYS.includes(key))
            : [];
        if (!resetKeys.length) return true;
        if (!window.samsSupabase) throw new Error("Supabase is not available.");

        resetting = true;
        suppressSync = true;
        try {
            for (const key of resetKeys) await deleteKey(key);
            resetKeys.forEach(key => localStorage.removeItem(key));
            return true;
        } finally {
            suppressSync = false;
            resetting = false;
        }
    }

    function startRealtime() {
        if (realtimeStarted || !window.samsSupabase) return;
        realtimeStarted = true;

        try {
            window.samsSupabase
                .channel("sams-central-store")
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "sams_store" },
                    payload => {
                        const key = payload.new?.key || payload.old?.key;
                        if (!ALL_KEYS.includes(key) || pulling || resetting) return;

                        if (payload.eventType === "DELETE") {
                            suppressSync = true;
                            localStorage.removeItem(key);
                            suppressSync = false;
                        } else {
                            suppressSync = true;
                            localStorage.setItem(key, JSON.stringify(payload.new.value));
                            suppressSync = false;
                        }

                        window.dispatchEvent(new CustomEvent("sams-cloud-data-changed", {
                            detail: { key, eventType: payload.eventType }
                        }));
                    }
                )
                .subscribe();
        } catch (error) {
            console.warn("SAMS realtime synchronization could not start:", error);
        }
    }

    // Intercept local cache writes and mirror them to Supabase. Application
    // pages can keep using their existing localStorage-based UI code.
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
        originalSetItem.call(this, key, value);
        if (this === localStorage && ALL_KEYS.includes(key) && !pulling && !resetting && !suppressSync) {
            queueMicrotask(() => syncKey(key));
        }
    };

    const originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
        originalRemoveItem.call(this, key);
        if (this === localStorage && ALL_KEYS.includes(key) && !pulling && !resetting && !suppressSync) {
            queueMicrotask(() => syncKey(key));
        }
    };

    window.addEventListener("sams-cloud-pull", pullAll);
    window.addEventListener("online", pullAll);

    // Supabase restores the session asynchronously. Pull as soon as a session
    // becomes available, and again after sign-in so every device gets the same
    // central snapshot.
    if (window.samsSupabase) {
        window.samsSupabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                setTimeout(() => pullAll(), event === "INITIAL_SESSION" ? 0 : 50);
            }
        });
    }
})();
