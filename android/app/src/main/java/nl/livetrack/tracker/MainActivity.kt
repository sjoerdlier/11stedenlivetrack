package nl.livetrack.tracker

import android.Manifest
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.view.animation.LinearInterpolator
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import nl.livetrack.tracker.databinding.ActivityMainBinding

private enum class Panel { EMPTY, PRIMER, HERO }

/**
 * The calm status screen: which of the three panels (empty / permission
 * primer / hero) is showing is driven by prefs.hasRequiredFields() and
 * prefs.primerShown, not by activity state — so returning from
 * SettingsActivity, a permission dialog, or a process restart always lands
 * on the right panel without extra bookkeeping.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: TrackerPrefs
    private var currentPanel: Panel = Panel.EMPTY
    private var pulseAnimator: AnimatorSet? = null

    // Fires whenever LocationTrackingService writes a new status field (or
    // flips isTracking) — keeps the hero panel live while this screen is in
    // the foreground, without any custom Binder/broadcast plumbing.
    private val prefsListener =
        SharedPreferences.OnSharedPreferenceChangeListener { _, _ -> runOnUiThread { renderPanel() } }

    private val elapsedHandler = Handler(Looper.getMainLooper())
    private val elapsedTicker = object : Runnable {
        override fun run() {
            updateHeroTexts()
            elapsedHandler.postDelayed(this, 1_000L)
        }
    }

    private val locationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
            val locationGranted =
                results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                    results[Manifest.permission.ACCESS_COARSE_LOCATION] == true
            if (locationGranted) {
                requestBackgroundLocationIfNeeded()
            } else {
                Toast.makeText(this, R.string.status_permission_denied, Toast.LENGTH_LONG).show()
            }
        }

    private val backgroundLocationLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            // Granted or not, continue: a denial here just means updates may
            // pause once the screen locks on some Android versions —
            // foreground tracking (app open) still works either way, and
            // forcing the flow to a halt over it would be worse than that.
            requestBatteryExemptionIfNeeded()
        }

    private val batteryExemptionLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            startTrackingService()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        prefs = TrackerPrefs(this)

        binding.buttonSettings.setOnClickListener { openSettings() }
        binding.buttonAction.setOnClickListener { onActionClick() }
        binding.textViewOnMap.setOnClickListener { openMap() }
    }

    override fun onResume() {
        super.onResume()
        sharedPrefs().registerOnSharedPreferenceChangeListener(prefsListener)
        currentPanel = computePanel()
        renderPanel()
    }

    override fun onPause() {
        super.onPause()
        sharedPrefs().unregisterOnSharedPreferenceChangeListener(prefsListener)
        stopElapsedTicker()
        stopPulseAnimation()
    }

    private fun sharedPrefs(): SharedPreferences = getSharedPreferences("tracker_prefs", MODE_PRIVATE)

    private fun computePanel(): Panel = if (!prefs.hasRequiredFields()) Panel.EMPTY else Panel.HERO

    private fun openSettings() {
        startActivity(Intent(this, SettingsActivity::class.java))
    }

    private fun openMap() {
        val url = prefs.baseUrl.trim()
        if (url.isNotBlank()) {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }
    }

    private fun onActionClick() {
        when (currentPanel) {
            Panel.EMPTY -> openSettings()
            Panel.PRIMER -> {
                prefs.primerShown = true
                currentPanel = Panel.HERO
                renderPanel()
                requestLocationPermissions()
            }
            Panel.HERO -> {
                if (prefs.isTracking) {
                    stopTracking()
                } else if (!prefs.primerShown) {
                    currentPanel = Panel.PRIMER
                    renderPanel()
                } else {
                    requestLocationPermissions()
                }
            }
        }
    }

    private fun requestLocationPermissions() {
        val fineGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED

        if (fineGranted) {
            requestBackgroundLocationIfNeeded()
            return
        }

        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        locationPermissionLauncher.launch(permissions.toTypedArray())
    }

    private fun requestBackgroundLocationIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val granted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                return
            }
        }
        requestBatteryExemptionIfNeeded()
    }

    private fun requestBatteryExemptionIfNeeded() {
        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
            Toast.makeText(this, R.string.battery_optimization_prompt, Toast.LENGTH_LONG).show()
            val intent = Intent(
                Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:$packageName"),
            )
            batteryExemptionLauncher.launch(intent)
        } else {
            startTrackingService()
        }
    }

    private fun startTrackingService() {
        prefs.trackingStartedAtMs = System.currentTimeMillis()
        ContextCompat.startForegroundService(this, Intent(this, LocationTrackingService::class.java))
        renderPanel()
    }

    private fun stopTracking() {
        stopService(Intent(this, LocationTrackingService::class.java))
        prefs.isTracking = false
        renderPanel()
    }

    private fun renderPanel() {
        binding.panelEmpty.visibility = if (currentPanel == Panel.EMPTY) View.VISIBLE else View.GONE
        binding.panelPrimer.visibility = if (currentPanel == Panel.PRIMER) View.VISIBLE else View.GONE
        binding.panelHero.visibility = if (currentPanel == Panel.HERO) View.VISIBLE else View.GONE

        when (currentPanel) {
            Panel.EMPTY -> {
                binding.buttonAction.setText(R.string.empty_state_button)
                binding.buttonAction.setIconResource(R.drawable.ic_gear)
                binding.textHint.visibility = View.GONE
                stopElapsedTicker()
                stopPulseAnimation()
            }
            Panel.PRIMER -> {
                binding.buttonAction.setText(R.string.primer_button)
                binding.buttonAction.setIconResource(R.drawable.ic_play)
                binding.textHint.visibility = View.GONE
                stopElapsedTicker()
                stopPulseAnimation()
            }
            Panel.HERO -> {
                val tracking = prefs.isTracking
                binding.buttonAction.setText(if (tracking) R.string.button_stop else R.string.button_start)
                binding.buttonAction.setIconResource(if (tracking) R.drawable.ic_stop else R.drawable.ic_play)
                binding.textHint.visibility = View.VISIBLE
                binding.textHint.setText(if (tracking) R.string.hint_line_active else R.string.hint_line_idle)
                updateHeroTexts()
                if (tracking) startElapsedTicker() else stopElapsedTicker()
                if (tracking) startPulseAnimation() else stopPulseAnimation()
            }
        }
    }

    private fun updateHeroTexts() {
        val tracking = prefs.isTracking
        binding.textContextChip.text = getString(R.string.context_chip_format, prefs.route, prefs.party)

        // Two distinct failure modes get folded into one visible "error"
        // state: the service is alive and actively failing to reach the
        // server (lastUpdateSuccess == false), or the service has gone
        // silent altogether — no update since well past the send interval,
        // which is what a process kill that bypassed START_STICKY (a
        // force-stop, an aggressive OEM battery manager) looks like from
        // here. Without the second check, isTracking would stay stuck at
        // "true" from before the kill and the hero would keep reading
        // "Actief" with a climbing timer while nothing is actually being
        // sent — exactly the false confidence this app exists to prevent.
        val stale = isUpdateStale()
        val hasError = tracking && (!prefs.lastUpdateSuccess || stale)
        when {
            !tracking -> {
                binding.textHeroState.setText(R.string.hero_idle_state)
                binding.textHeroSub.setText(R.string.hero_idle_sub)
            }
            hasError -> {
                binding.textHeroState.setText(R.string.hero_error_state)
                binding.textHeroSub.text = if (stale) getString(R.string.hero_error_stale) else prefs.lastUpdateText
            }
            else -> {
                binding.textHeroState.setText(R.string.hero_active_state)
                val elapsedMs = if (prefs.trackingStartedAtMs > 0) {
                    System.currentTimeMillis() - prefs.trackingStartedAtMs
                } else {
                    0L
                }
                binding.textHeroSub.text = getString(R.string.elapsed_label, formatElapsed(elapsedMs))
            }
        }

        binding.textLastUpdate.text = if (prefs.lastUpdateAtMs > 0) {
            getString(R.string.last_update_label, formatAgo(System.currentTimeMillis() - prefs.lastUpdateAtMs))
        } else {
            getString(R.string.last_update_never)
        }

        val tintRes = if (hasError) R.color.danger else R.color.brand
        val tint = ContextCompat.getColorStateList(this, tintRes)
        binding.pulseCore.backgroundTintList = tint
        binding.pulseRingOuter.backgroundTintList = tint
        binding.pulseRingMid.backgroundTintList = tint
    }

    private fun isUpdateStale(): Boolean {
        val reference = if (prefs.lastUpdateAtMs > 0) prefs.lastUpdateAtMs else prefs.trackingStartedAtMs
        if (reference <= 0) return false
        return System.currentTimeMillis() - reference > STALE_UPDATE_MS
    }

    private fun formatElapsed(ms: Long): String {
        val totalMinutes = ms / 60_000
        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60
        return if (hours > 0) "${hours}u ${minutes}m" else "${minutes}m"
    }

    private fun formatAgo(ms: Long): String {
        val totalSeconds = ms / 1_000
        return when {
            totalSeconds < 60 -> "${totalSeconds}s"
            totalSeconds < 3_600 -> "${totalSeconds / 60}m"
            else -> "${totalSeconds / 3_600}u"
        }
    }

    private fun startElapsedTicker() {
        elapsedHandler.removeCallbacks(elapsedTicker)
        elapsedHandler.post(elapsedTicker)
    }

    private fun stopElapsedTicker() {
        elapsedHandler.removeCallbacks(elapsedTicker)
    }

    private fun startPulseAnimation() {
        if (pulseAnimator?.isRunning == true) return

        // Android's nearest equivalent of prefers-reduced-motion: a user who
        // set "remove animations" system-wide has this at 0.
        val durationScale = Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)
        if (durationScale == 0f) return

        val rings = listOf(binding.pulseRingOuter, binding.pulseRingMid)
        val ringAnimators = rings.mapIndexed { index, ring ->
            AnimatorSet().apply {
                playTogether(
                    ObjectAnimator.ofFloat(ring, View.SCALE_X, 1f, 1.6f),
                    ObjectAnimator.ofFloat(ring, View.SCALE_Y, 1f, 1.6f),
                    ObjectAnimator.ofFloat(ring, View.ALPHA, 0.35f, 0f),
                )
                duration = 1_800L
                startDelay = index * 500L
            }
        }
        pulseAnimator = AnimatorSet().apply {
            playTogether(ringAnimators)
            interpolator = LinearInterpolator()
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    if (prefs.isTracking) {
                        rings.forEach { it.scaleX = 1f; it.scaleY = 1f; it.alpha = 0.35f }
                        startPulseAnimation()
                    }
                }
            })
            start()
        }
    }

    private fun stopPulseAnimation() {
        pulseAnimator?.cancel()
        pulseAnimator = null
        binding.pulseRingOuter.apply { scaleX = 1f; scaleY = 1f; alpha = 0.35f }
        binding.pulseRingMid.apply { scaleX = 1f; scaleY = 1f; alpha = 0.35f }
    }

    private companion object {
        // A bit over 2x the service's ~30s send interval — long enough that
        // one slow network round trip doesn't flip this on by itself, short
        // enough to catch a dead service well before someone would notice
        // on their own.
        const val STALE_UPDATE_MS = 90_000L
    }
}
