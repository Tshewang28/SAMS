// SAMS - Central Supabase Cloud Storage Bridge
// One shared data store for phone, laptop and other devices.
(function () {
    "use strict";

    // These are application DATA keys only. Login/session keys remain
    // device/session-specific and are intentionally not synchronized.
    const KEYS = [
        "sams_accounts",
        "sams_students",
        "sams_classes",
        "sams_assessment_criteria",
        "sams_assessment_records",
        "sams_assessment_cache",
        "sams_games_sports_records",
        "sams_discipline_records",
        "sams_volunteer_programs",
        "sams_volunteer_records",
        "sams_reports",
        "sams_hall_of_fame",
        "sams_hall_of_fame_records",
        "sams_class_ranking",
        "sams_ranking",
        "sams_recent_activities",
        "sams_school_settings",
        "sams_system_settings"
    ];

    const KEY_SET = new Set(KEYS);
    let pulling = false;
    let initialised = false;
    let channel = null;
    let writeQueue = Promise.resolve();
    const pendingWrites = new Map();
    let readyResolve;

    const ready = new Promise(resolve => {
        readyResolve = resolve;
    });

    window.samsCloud = {
        ready,
        keys: KEYS.slice(),
        pullAll,
        syncKey,
        syncAll,
        isReady: () => initialised
    };

    function parse(value) {
        try {
            return JSON.parse(value);
        } catch (_) {
            return value;
        }
    }

    async function getSession() {
        if (!window.samsSupabase) return null;
        try {
            const result = await window.samsSupabase.auth.getSession();
            return result.data?.session || null;
        } catch (error) {
            console.warn("SAMS: unable to read Supabase session.", error);
            return null;
        }
    }

    async function currentUserId() {
        const session = await getSession();
        return session?.user?.id || null;
    }

    function localValue(key) {
        const raw = localStorage.getItem(key);
        return raw === null ? null : parse(raw);
    }

    function setLocalFromCloud(key, value) {
        if (!KEY_SET.has(key)) return;
        pulling = true;
        try {
            if (value === null || typeof value === "undefined") {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(value));
            }
        } finally {
            pulling = false;
        }
    }

    async function fetchRows() {
        const result = await window.samsSupabase
            .from("sams_store")
            .select("key,value,updated_at,updated_by");

        if (result.error) throw result.error;
        return Array.isArray(result.data) ? result.data : [];
    }

    function stableId(item) {
        if (!item || typeof item !== "object") return "";
        return String(
            item.id ||
            item.userId ||
            item.user_id ||
            item.studentId ||
            item.studentCode ||
            item.employeeCode ||
            item.employee_code ||
            item.email ||
            item.code ||
            ""
        ).trim().toLowerCase();
    }

    function fingerprint(item) {
        if (item && typeof item === "object") {
            const id = stableId(item);
            if (id) return "id:" + id;

            // Classes without IDs can safely be identified by grade +
            // section/stream because that is how SAMS treats a class.
            if (item.grade || item.class || item.className) {
                const grade = String(item.grade || item.class || item.className || "").trim().toLowerCase();
                const section = String(item.section || item.stream || item["Section/Stream"] || "").trim().toLowerCase();
                if (grade || section) return "class:" + grade + "|" + section;
            }

            // Last-resort deterministic fingerprint for small records.
            try {
                return "json:" + JSON.stringify(item, Object.keys(item).sort());
            } catch (_) {}
        }
        return "value:" + String(item);
    }

    function mergeData(key, local, cloud) {
        if (!Array.isArray(local) || !Array.isArray(cloud)) {
            return cloud;
        }

        const merged = [];
        const seen = new Set();

        // Cloud records first so the central version wins when the same
        // record exists on both devices.
        [...cloud, ...local].forEach(item => {
            const fp = fingerprint(item);
            if (seen.has(fp)) return;
            seen.add(fp);
            merged.push(item);
        });

        return merged;
    }

    function sameJson(a, b) {
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch (_) {
            return false;
        }
    }

    async function pullAll() {
        if (!window.samsSupabase) {
            readyResolve(false);
            return false;
        }

        const session = await getSession();
        if (!session) {
            readyResolve(false);
            return false;
        }

        try {
            const rows = await fetchRows();
            const byKey = new Map(rows.map(row => [row.key, row]));

            // Supabase is the central store. If both this device and the
            // cloud already have array data, merge records rather than
            // silently deleting records that exist only on this device.
            // Scalar settings remain cloud-authoritative.
            for (const key of KEYS) {
                const local = localValue(key);
                const cloudRow = byKey.get(key);

                if (cloudRow) {
                    const merged = mergeData(key, local, cloudRow.value);
                    setLocalFromCloud(key, merged);

                    // If the merge added local-only records, write the merged
                    // result back so every device receives the same dataset.
                    if (Array.isArray(merged) && !sameJson(merged, cloudRow.value)) {
                        await syncKey(key, merged);
                    }
                } else if (local !== null) {
                    await syncKey(key, local);
                }
            }

            initialised = true;
            readyResolve(true);
            window.dispatchEvent(new CustomEvent("sams-cloud-ready"));

            subscribeRealtime();
            return true;
        } catch (error) {
            console.error("SAMS cloud pull failed:", error);
            readyResolve(false);
            window.dispatchEvent(new CustomEvent("sams-cloud-error", {
                detail: error
            }));
            return false;
        }
    }

    function queueSync(key, value) {
        pendingWrites.set(key, value);
        writeQueue = writeQueue
            .then(async () => {
                if (!pendingWrites.has(key)) return;
                const nextValue = pendingWrites.get(key);
                pendingWrites.delete(key);
                await syncKey(key, nextValue);
            })
            .catch(error => {
                console.error("SAMS cloud write queue failed:", error);
            });
    }

    async function syncKey(key, explicitValue) {
        if (pulling || !KEY_SET.has(key) || !window.samsSupabase) return false;

        const uid = await currentUserId();
        if (!uid) return false;

        const value = arguments.length >= 2
            ? explicitValue
            : localValue(key);

        try {
            const result = await window.samsSupabase
                .from("sams_store")
                .upsert({
                    key,
                    value,
                    updated_by: uid,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: "key"
                });

            if (result.error) throw result.error;
            return true;
        } catch (error) {
            console.error("SAMS cloud save failed:", key, error);
            return false;
        }
    }

    async function syncAll() {
        for (const key of KEYS) {
            await syncKey(key);
        }
    }

    function subscribeRealtime() {
        if (channel || !window.samsSupabase) return;

        channel = window.samsSupabase
            .channel("sams-central-store")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "sams_store"
                },
                payload => {
                    const row = payload.new || payload.old;
                    const key = row?.key;
                    if (!KEY_SET.has(key)) return;

                    // Do not echo our own local write back over a newer local
                    // change that is still being saved.
                    if (payload.eventType === "DELETE") {
                        setLocalFromCloud(key, null);
                    } else {
                        setLocalFromCloud(key, row.value);
                    }

                    window.dispatchEvent(new CustomEvent("sams-cloud-updated", {
                        detail: {
                            key,
                            event: payload.eventType,
                            value: payload.eventType === "DELETE" ? null : row.value
                        }
                    }));
                }
            )
            .subscribe(status => {
                if (status === "CHANNEL_ERROR") {
                    console.warn("SAMS cloud realtime channel error.");
                }
            });
    }

    // Any application write to a shared localStorage key is mirrored to
    // Supabase. Existing SAMS pages can therefore continue using their
    // current localStorage APIs without maintaining a second database.
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
        originalSetItem.call(this, key, value);

        if (this === localStorage && KEY_SET.has(key) && !pulling) {
            queueMicrotask(() => queueSync(key, parse(value)));
        }
    };

    const originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
        originalRemoveItem.call(this, key);

        if (this === localStorage && KEY_SET.has(key) && !pulling) {
            queueMicrotask(() => queueSync(key, null));
        }
    };

    window.addEventListener("sams-cloud-pull", pullAll);

    window.addEventListener("online", () => {
        pullAll();
    });

    // Start automatically on every SAMS page. Login/session data is already
    // established on normal navigation, so every page gets the same cloud
    // dataset instead of relying on a device-specific localStorage copy.
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            pullAll();
        }, { once: true });
    } else {
        pullAll();
    }
})();
