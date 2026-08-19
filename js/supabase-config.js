// SAMS - Supabase connection
const SAMS_SUPABASE_URL = "https://jlqhijydwfiaabphelvt.supabase.co";
const SAMS_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7xVYg08F7pwMK0_epB9eBQ_bmM4jLdF";

if (!window.supabase) {
    console.error("Supabase CDN did not load.");
} else {
    const samsSupabase = window.supabase.createClient(
        SAMS_SUPABASE_URL,
        SAMS_SUPABASE_PUBLISHABLE_KEY
    );

    window.samsSupabase = samsSupabase;
}
