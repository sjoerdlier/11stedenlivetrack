package nl.livetrack.tracker

import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Talks to POST /api/live — see src/app/api/live/route.ts in the main repo.
 * Deliberately plain HttpURLConnection rather than a networking library: one
 * blocking call, called from a background thread already, so there's
 * nothing a Retrofit/OkHttp dependency would meaningfully simplify here,
 * and fewer dependencies means fewer things that can fail to resolve on a
 * first Gradle sync.
 */
object ApiClient {

    class ApiException(message: String) : Exception(message)

    fun postLocation(
        baseUrl: String,
        route: String,
        party: String,
        token: String,
        lat: Double,
        lon: Double,
        recordedAtIso: String,
    ) {
        val url = URL(baseUrl.trimEnd('/') + "/api/live")
        val connection = url.openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.doOutput = true
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $token")

            val body = JSONObject().apply {
                put("route", route)
                put("party", party)
                put("lat", lat)
                put("lon", lon)
                put("recordedAt", recordedAtIso)
            }

            OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { it.write(body.toString()) }

            val status = connection.responseCode
            if (status !in 200..299) {
                val errorBody = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                throw ApiException("HTTP $status: $errorBody")
            }
        } finally {
            connection.disconnect()
        }
    }
}
