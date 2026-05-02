package com.claudeos

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.core.app.ActivityCompat
import com.claudeos.ui.ApiKeyGate
import com.claudeos.ui.ClaudeOsTheme
import com.claudeos.ui.Shell

class MainActivity : ComponentActivity() {
    private val viewModel: ShellViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA, Manifest.permission.POST_NOTIFICATIONS),
            42,
        )

        setContent {
            ClaudeOsTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFF0B0D12)) {
                    val key = remembered(this)
                    if (key == null) {
                        ApiKeyGate(onSaved = { /* state will tick via flow */ })
                    } else {
                        LaunchedEffect(Unit) { viewModel.bootstrap() }
                        Shell(viewModel)
                    }
                }
            }
        }
    }

    override fun onBackPressed() {
        // Launchers swallow back at the home screen — this is intentional.
        // (Don't call super: we don't want to leave the launcher.)
    }
}

@Composable
private fun remembered(activity: ComponentActivity): String? {
    val flow = remember { Settings.apiKeyFlow(activity) }
    val state = flow.collectAsState(initial = null)
    return state.value
}
