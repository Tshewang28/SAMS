// SAMS cloud state bridge
(function () {
    "use strict";

    const KEYS = [
        "sams_accounts",
        "sams_students",
        "sams_classes",
        "sams_assessment_criteria",
        "sams_assessment_records",
        "sams_games_sports_records",
        "sams_volunteer_programs",
        "sams_volunteer_records",
        "sams_recent_activities",
        "sams_school_settings",
        "sams_system_settings"
    ];

    let pulling = false;
    let readyResolve;

    const ready = new Promise(function (resolve) {
        readyResolve = resolve;
    });

    window.samsCloud = {
        ready: ready,
        pullAll: pullAll,
        syncKey: syncKey,
        syncAll: syncAll
    };

    async function currentUserId() {
        const result = await window.samsSupabase.auth.getUser();
        return result.data?.user?.id || null;
    }

    function parse(value) {
        try {
            return JSON.parse(value);
        } catch (e) {
            return value;
        }
    }

    async function pullAll() {
        if (!window.samsSupabase) {
            readyResolve(false);
            return false;
        }

        try {
            const sessionResult =
                await window.samsSupabase.auth.getSession();

            if (!sessionResult.data?.session) {
                readyResolve(false);
                return false;
            }

            const result = await window.samsSupabase
                .from("sams_store")
                .select("key,value,updated_at");

            if (result.error) {
                throw result.error;
            }

            pulling = true;

            (result.data || []).forEach(function (row) {
                if (KEYS.includes(row.key)) {
                    localStorage.setItem(
                        row.key,
                        JSON.stringify(row.value)
                    );
                }
            });

            pulling = false;

            readyResolve(true);

            window.dispatchEvent(
                new CustomEvent("sams-cloud-ready")
            );

            return true;

        } catch (error) {

            pulling = false;

            console.error(
                "SAMS cloud pull failed",
                error
            );

            readyResolve(false);

            return false;
        }
    }

    async function syncKey(key) {

        if (
            pulling ||
            !KEYS.includes(key) ||
            !window.samsSupabase
        ) {
            return;
        }

        try {

            const uid = await currentUserId();

            if (!uid) {
                return;
            }

            const raw = localStorage.getItem(key);

            const value =
                raw === null
                    ? null
                    : parse(raw);

            await window.samsSupabase
                .from("sams_store")
                .upsert(
                    {
                        key: key,
                        value: value,
                        updated_by: uid,
                        updated_at:
                            new Date().toISOString()
                    },
                    {
                        onConflict: "key"
                    }
                );

        } catch (error) {

            console.error(
                "SAMS cloud save failed",
                key,
                error
            );
        }
    }

    async function syncAll() {

        for (const key of KEYS) {
            await syncKey(key);
        }
    }

    const originalSetItem =
        Storage.prototype.setItem;

    Storage.prototype.setItem =
        function (key, value) {

            originalSetItem.call(
                this,
                key,
                value
            );

            if (
                this === localStorage &&
                KEYS.includes(key) &&
                !pulling
            ) {
                queueMicrotask(
                    function () {
                        syncKey(key);
                    }
                );
            }
        };

    const originalRemoveItem =
        Storage.prototype.removeItem;

    Storage.prototype.removeItem =
        function (key) {

            originalRemoveItem.call(
                this,
                key
            );

            if (
                this === localStorage &&
                KEYS.includes(key) &&
                !pulling
            ) {
                queueMicrotask(
                    function () {
                        syncKey(key);
                    }
                );
            }
        };

    window.addEventListener(
        "sams-cloud-pull",
        pullAll
    );

    window.addEventListener(
        "online",
        function () {
            pullAll();
        }
    );
})();
