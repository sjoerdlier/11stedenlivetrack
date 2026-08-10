package nl.livetrack.tracker

import android.Manifest
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import nl.livetrack.tracker.databinding.ActivityMainBinding

/**
 * The whole app is this one screen: enter server URL / route / party /
 * token, tap start, and — after the permission + battery-exemption dance
 * below — a foreground service (LocationTrackingService) takes over and
 * keeps posting locations until stopped. There's deliberately no separate
 * "settings" screen; these four fields *are* the configuration.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: TrackerPrefs

    // Fires whenever LocationTrackingService writes a new lastUpdateText (or
    // flips isTracking) — keeps the status line live while this screen is in
    // the foreground, without any custom Binder/broadcast plumbing.
    private val prefsListener =
        SharedPreferences.OnSharedPreferenceChangeListener { _, _ -> runOnUiThread { refreshStatus() } }

    private val locationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
            val locationGranted =
                results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                    results[Manifest.permission.ACCESS_COARSE_LOCATION] == true
            if (locationGranted) {
                requestBackgroundLocationIfNeeded()
            } else {
                binding.textStatus.setText(R.string.status_permission_denied)
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
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        prefs = TrackerPrefs(this)

        binding.inputBaseUrl.setText(prefs.baseUrl.ifBlank { getString(R.string.hint_base_url) })
        binding.inputRoute.setText(prefs.route.ifBlank { getString(R.string.hint_route) })
        binding.inputParty.setText(prefs.party.ifBlank { getString(R.string.hint_party) })
        binding.inputToken.setText(prefs.token)

        binding.buttonToggle.setOnClickListener {
            if (prefs.isTracking) stopTracking() else startTrackingFlow()
        }
    }

    override fun onResume() {
        super.onResume()
        sharedPrefs().registerOnSharedPreferenceChangeListener(prefsListener)
        refreshStatus()
    }

    override fun onPause() {
        super.onPause()
        sharedPrefs().unregisterOnSharedPreferenceChangeListener(prefsListener)
    }

    private fun sharedPrefs(): SharedPreferences = getSharedPreferences("tracker_prefs", MODE_PRIVATE)

    private fun startTrackingFlow() {
        val baseUrl = binding.inputBaseUrl.text?.toString()?.trim().orEmpty()
        val route = binding.inputRoute.text?.toString()?.trim().orEmpty()
        val party = binding.inputParty.text?.toString()?.trim().orEmpty()
        val token = binding.inputToken.text?.toString()?.trim().orEmpty()

        prefs.baseUrl = baseUrl
        prefs.route = route
        prefs.party = party
        prefs.token = token

        if (!prefs.hasRequiredFields()) {
            binding.textStatus.setText(R.string.status_missing_fields)
            return
        }

        requestLocationPermissions()
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
        ContextCompat.startForegroundService(this, Intent(this, LocationTrackingService::class.java))
        refreshStatus()
    }

    private fun stopTracking() {
        stopService(Intent(this, LocationTrackingService::class.java))
        prefs.isTracking = false
        refreshStatus()
    }

    private fun refreshStatus() {
        val tracking = prefs.isTracking
        binding.buttonToggle.setText(if (tracking) R.string.button_stop else R.string.button_start)
        binding.textStatus.text = when {
            !tracking -> getString(R.string.status_idle)
            prefs.lastUpdateText.isBlank() -> getString(R.string.status_running, "…")
            !prefs.lastUpdateSuccess -> getString(R.string.status_error, prefs.lastUpdateText)
            else -> getString(R.string.status_running, prefs.lastUpdateText)
        }
    }
}
