package nl.livetrack.tracker

import android.content.Context

/**
 * Everything the tracker needs to know is entered once in the app itself
 * (server URL, route, party, token) and persisted here — nothing is
 * hardcoded at build time, so the same APK works for anyone the organizer
 * hands a token to, and a rotated token in /beheer just means re-typing one
 * field here, not a new build.
 */
class TrackerPrefs(context: Context) {
    private val prefs = context.getSharedPreferences("tracker_prefs", Context.MODE_PRIVATE)

    var baseUrl: String
        get() = prefs.getString(KEY_BASE_URL, "") ?: ""
        set(value) = prefs.edit().putString(KEY_BASE_URL, value).apply()

    var route: String
        get() = prefs.getString(KEY_ROUTE, "") ?: ""
        set(value) = prefs.edit().putString(KEY_ROUTE, value).apply()

    var party: String
        get() = prefs.getString(KEY_PARTY, "") ?: ""
        set(value) = prefs.edit().putString(KEY_PARTY, value).apply()

    var token: String
        get() = prefs.getString(KEY_TOKEN, "") ?: ""
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    var isTracking: Boolean
        get() = prefs.getBoolean(KEY_TRACKING, false)
        set(value) = prefs.edit().putBoolean(KEY_TRACKING, value).apply()

    // Raw fragment only (e.g. a timestamp, or "12:34:56 – timeout") — the
    // "OK"/"mislukt" framing is MainActivity's job (via lastUpdateSuccess),
    // so it's applied exactly once instead of both here and at display time.
    var lastUpdateText: String
        get() = prefs.getString(KEY_LAST_UPDATE, "") ?: ""
        set(value) = prefs.edit().putString(KEY_LAST_UPDATE, value).apply()

    var lastUpdateSuccess: Boolean
        get() = prefs.getBoolean(KEY_LAST_UPDATE_SUCCESS, true)
        set(value) = prefs.edit().putBoolean(KEY_LAST_UPDATE_SUCCESS, value).apply()

    // Epoch millis of the last send attempt (success or failure) — separate
    // from lastUpdateText so the UI can compute a live "X geleden" instead of
    // freezing on the clock time the update happened to land at.
    var lastUpdateAtMs: Long
        get() = prefs.getLong(KEY_LAST_UPDATE_AT, 0L)
        set(value) = prefs.edit().putLong(KEY_LAST_UPDATE_AT, value).apply()

    // Set by MainActivity the moment a fresh "Start livetracking" tap
    // actually starts the service — drives the "1u 23m onderweg" elapsed
    // readout. Deliberately not touched by the service itself, so a
    // START_STICKY restart (or a BootReceiver resume) doesn't reset the
    // clock back to zero.
    var trackingStartedAtMs: Long
        get() = prefs.getLong(KEY_TRACKING_STARTED_AT, 0L)
        set(value) = prefs.edit().putLong(KEY_TRACKING_STARTED_AT, value).apply()

    // The permission primer only needs to be seen once per install, not
    // every time tracking is (re)started.
    var primerShown: Boolean
        get() = prefs.getBoolean(KEY_PRIMER_SHOWN, false)
        set(value) = prefs.edit().putBoolean(KEY_PRIMER_SHOWN, value).apply()

    fun hasRequiredFields(): Boolean =
        baseUrl.isNotBlank() && route.isNotBlank() && party.isNotBlank() && token.isNotBlank()

    companion object {
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_ROUTE = "route"
        private const val KEY_PARTY = "party"
        private const val KEY_TOKEN = "token"
        private const val KEY_TRACKING = "is_tracking"
        private const val KEY_LAST_UPDATE = "last_update_text"
        private const val KEY_LAST_UPDATE_SUCCESS = "last_update_success"
        private const val KEY_LAST_UPDATE_AT = "last_update_at_ms"
        private const val KEY_TRACKING_STARTED_AT = "tracking_started_at_ms"
        private const val KEY_PRIMER_SHOWN = "primer_shown"
    }
}
