package com.claudeos.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.claudeos.ShellViewModel
import com.claudeos.api.Action
import com.claudeos.voice.VoiceIn
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun Shell(viewModel: ShellViewModel) {
    val ctx = LocalContext.current
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    val voiceOn by viewModel.voiceOn.collectAsStateWithLifecycle()

    var typed by remember { mutableStateOf("") }
    var listening by remember { mutableStateOf(false) }
    var partial by remember { mutableStateOf("") }

    val voiceIn = remember { VoiceIn(ctx) }
    DisposableEffect(Unit) { onDispose { voiceIn.stop() } }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0B0D12))
            .windowInsetsPadding(WindowInsets.statusBars),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Top bar
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date()),
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 12.sp,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconButton(onClick = { viewModel.toggleVoice() }) {
                        Icon(
                            if (voiceOn) Icons.Filled.VolumeUp else Icons.Filled.VolumeOff,
                            contentDescription = "voice toggle",
                            tint = Color.White,
                        )
                    }
                    Surface(
                        shape = CircleShape, color = Color.White.copy(alpha = 0.10f),
                    ) {
                        Text(
                            "new",
                            color = Color.White,
                            modifier = Modifier
                                .clip(CircleShape)
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                            fontSize = 12.sp,
                        )
                    }
                }
            }

            Box(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                ui?.let { spec ->
                    Renderer(
                        spec = spec,
                        onAction = { a -> handleAction(a, viewModel) },
                        onPhoto = { b64 -> viewModel.onPhotoCaptured(b64) },
                    )
                } ?: Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    if (busy) CircularProgressIndicator(color = Color.White)
                    else Text("say something", color = Color.White.copy(alpha = 0.6f))
                }
            }
        }

        // Bottom dock
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.navigationBars)
                .imePadding()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            // Mic button — push-to-talk
            Surface(
                shape = CircleShape,
                color = if (listening) Color(0xFFEF4444) else Color.White.copy(alpha = 0.15f),
                modifier = Modifier.size(48.dp),
            ) {
                IconButton(
                    onClick = {
                        if (listening) {
                            voiceIn.stop()
                            listening = false
                        } else {
                            partial = ""
                            listening = true
                            voiceIn.start(object : VoiceIn.Listener {
                                override fun onPartial(text: String) { partial = text }
                                override fun onFinal(text: String) {
                                    listening = false
                                    partial = ""
                                    if (text.isNotBlank()) viewModel.send(text = text)
                                }
                                override fun onError(error: String) { listening = false }
                            })
                        }
                    },
                ) { Icon(Icons.Filled.Mic, contentDescription = "voice", tint = Color.White) }
            }
            // Camera button
            Surface(
                shape = CircleShape,
                color = Color.White.copy(alpha = 0.15f),
                modifier = Modifier.size(48.dp),
            ) {
                IconButton(onClick = { viewModel.openCamera() }) {
                    Icon(Icons.Filled.CameraAlt, contentDescription = "camera", tint = Color.White)
                }
            }
            // Text field
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = Color.White.copy(alpha = 0.10f),
                modifier = Modifier.weight(1f).height(48.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.weight(1f).padding(horizontal = 12.dp)) {
                        if ((listening && partial.isEmpty()) && typed.isEmpty()) {
                            Text("listening…", color = Color.White.copy(alpha = 0.4f))
                        } else if (!listening && typed.isEmpty()) {
                            Text(if (busy) "…" else "ask anything", color = Color.White.copy(alpha = 0.4f))
                        }
                        BasicTextField(
                            value = if (listening) partial else typed,
                            onValueChange = { if (!listening) typed = it },
                            textStyle = TextStyle(color = Color.White, fontSize = 16.sp),
                            cursorBrush = SolidColor(Color.White),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    if (typed.isNotBlank()) {
                        IconButton(
                            onClick = {
                                viewModel.send(text = typed.trim())
                                typed = ""
                            },
                            modifier = Modifier.size(36.dp),
                        ) { Icon(Icons.Filled.Send, contentDescription = "send", tint = Color.White) }
                        Spacer(Modifier.width(4.dp))
                    }
                }
            }
        }
    }
}

private fun handleAction(action: Action, viewModel: ShellViewModel) {
    when (action) {
        is Action.Send -> viewModel.send(text = action.prompt)
        is Action.Tool -> viewModel.runConfirmedTool(action.tool, action.input)
        is Action.OpenUrl -> {
            viewModel.runConfirmedTool(
                "web_browse",
                buildJsonObject { put("query_or_url", action.url) },
            )
        }
        is Action.Dismiss -> Unit
    }
}
