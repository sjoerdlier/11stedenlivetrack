package nl.livetrack.tracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/**
 * Resumes tracking after a reboot mid-tocht, so a phone that restarts (low
 * battery, a stuck app, someone bumping the power button) doesn't leave
 * sharing silently off until someone happens to check. isTracking survives
 * the reboot as-is: the service's process just dies without onDestroy ever
 * running, so the flag still reads true from before the restart.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return

        val prefs = TrackerPrefs(context)
        if (prefs.isTracking && prefs.hasRequiredFields()) {
            ContextCompat.startForegroundService(context, Intent(context, LocationTrackingService::class.java))
        }
    }
}
