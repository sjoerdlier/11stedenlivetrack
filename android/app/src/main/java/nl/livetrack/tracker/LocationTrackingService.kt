package nl.livetrack.tracker

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.text.SimpleDateFormat
import java.time.Instant
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Foreground service: while running, requests a location update roughly
 * every LOCATION_INTERVAL_MS and POSTs it to /api/live. Runs as a foreground
 * service (persistent notification, required by Android since it's the only
 * way background location updates keep arriving reliably) rather than a
 * plain background service, which Android would throttle or kill outright
 * within minutes on most manufacturers' battery management.
 */
class LocationTrackingService : Service() {

    private lateinit var prefs: TrackerPrefs
    private lateinit var fusedLocationClient: com.google.android.gms.location.FusedLocationProviderClient
    private val networkExecutor = Executors.newSingleThreadExecutor()
    private val notificationManager by lazy { getSystemService(NotificationManager::class.java) }
    private val timeFormatter = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location = result.lastLocation ?: return
            sendLocation(location.latitude, location.longitude)
        }
    }

    override fun onCreate() {
        super.onCreate()
        prefs = TrackerPrefs(this)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification(getString(R.string.notification_text)))
        prefs.isTracking = true
        startLocationUpdates()
        // START_STICKY: if Android kills this process under memory pressure,
        // it restarts the service (with a null intent) rather than leaving
        // tracking silently stopped for the rest of the event.
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        prefs.isTracking = false
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    @SuppressLint("MissingPermission") // Caller (MainActivity) verifies the permission before starting this service.
    private fun startLocationUpdates() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, LOCATION_INTERVAL_MS)
            .setMinUpdateIntervalMillis(LOCATION_INTERVAL_MS / 2)
            .build()
        fusedLocationClient.requestLocationUpdates(request, locationCallback, mainLooper)
    }

    private fun sendLocation(lat: Double, lon: Double) {
        val baseUrl = prefs.baseUrl
        val route = prefs.route
        val party = prefs.party
        val token = prefs.token
        if (baseUrl.isBlank() || route.isBlank() || party.isBlank() || token.isBlank()) return

        val recordedAtIso = Instant.now().toString()
        networkExecutor.execute {
            val now = System.currentTimeMillis()
            val time = timeFormatter.format(java.util.Date(now))
            prefs.lastUpdateAtMs = now
            try {
                ApiClient.postLocation(baseUrl, route, party, token, lat, lon, recordedAtIso)
                prefs.lastUpdateSuccess = true
                prefs.lastUpdateText = time
                notificationManager.notify(NOTIFICATION_ID, buildNotification(getString(R.string.notification_text)))
            } catch (e: Exception) {
                Log.e(TAG, "Kon locatie niet versturen", e)
                prefs.lastUpdateSuccess = false
                prefs.lastUpdateText = e.message ?: time
                notificationManager.notify(
                    NOTIFICATION_ID,
                    buildNotification(getString(R.string.notification_text_failed, time)),
                )
            }
        }
    }

    private fun buildNotification(text: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW, // low: updates the persistent notification without a sound/heads-up popup every 30s
        )
        notificationManager.createNotificationChannel(channel)
    }

    companion object {
        private const val TAG = "LocationTrackingService"
        private const val CHANNEL_ID = "livetrack_channel"
        private const val NOTIFICATION_ID = 1
        private const val LOCATION_INTERVAL_MS = 30_000L
    }
}
