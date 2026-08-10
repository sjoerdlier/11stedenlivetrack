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
    }
}
