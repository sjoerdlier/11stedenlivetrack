package nl.livetrack.tracker

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import nl.livetrack.tracker.databinding.ActivitySettingsBinding

/**
 * Server URL / route / party / token — the four fields that fully configure
 * the tracker, moved off the main screen so that one reads as a calm status
 * view instead of a form. Reachable via the gear icon on MainActivity.
 */
class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var prefs: TrackerPrefs

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        prefs = TrackerPrefs(this)

        binding.inputBaseUrl.setText(prefs.baseUrl.ifBlank { getString(R.string.hint_base_url) })
        binding.inputRoute.setText(prefs.route.ifBlank { getString(R.string.hint_route) })
        binding.inputParty.setText(prefs.party.ifBlank { getString(R.string.hint_party) })
        binding.inputToken.setText(prefs.token)

        binding.buttonBack.setOnClickListener { onBackPressedDispatcher.onBackPressed() }
        binding.buttonSave.setOnClickListener { save() }
    }

    private fun save() {
        val baseUrl = binding.inputBaseUrl.text?.toString()?.trim().orEmpty()
        val route = binding.inputRoute.text?.toString()?.trim().orEmpty()
        val party = binding.inputParty.text?.toString()?.trim().orEmpty()
        val token = binding.inputToken.text?.toString()?.trim().orEmpty()

        if (baseUrl.isBlank() || route.isBlank() || party.isBlank() || token.isBlank()) {
            Toast.makeText(this, R.string.settings_missing_fields, Toast.LENGTH_SHORT).show()
            return
        }

        prefs.baseUrl = baseUrl
        prefs.route = route
        prefs.party = party
        prefs.token = token

        Toast.makeText(this, R.string.settings_saved, Toast.LENGTH_SHORT).show()
        finish()
    }
}
