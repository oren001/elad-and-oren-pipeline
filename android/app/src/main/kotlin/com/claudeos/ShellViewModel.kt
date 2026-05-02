package com.claudeos

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.claudeos.api.MemoryFact
import com.claudeos.api.PendingClientTool
import com.claudeos.api.ToolResult
import com.claudeos.api.UISpec
import com.claudeos.services.OsNotificationListenerService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject

class ShellViewModel(app: Application) : AndroidViewModel(app) {
    private val claudeApp = app as ClaudeApp
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private val _ui = MutableStateFlow<UISpec?>(null)
    val ui: StateFlow<UISpec?> = _ui.asStateFlow()

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    private val _voiceOn = MutableStateFlow(true)
    val voiceOn: StateFlow<Boolean> = _voiceOn.asStateFlow()

    private val _pendingPhotoToolId = MutableStateFlow<String?>(null)
    val pendingPhotoToolId: StateFlow<String?> = _pendingPhotoToolId.asStateFlow()

    private var history: JsonArray = JsonArray(emptyList())

    init {
        viewModelScope.launch {
            val saved = Settings.getHistory(getApplication())
            if (saved != null) {
                runCatching { history = json.parseToJsonElement(saved) as JsonArray }
            }
            // Subscribe to OS notification events and push them to Claude as
            // [event] messages. Claude decides whether to interrupt the user.
            OsNotificationListenerService.events.collect { ev ->
                if (ev.text.isBlank() && ev.title.isBlank()) return@collect
                send(text = "[event] notification from ${ev.packageName}: ${ev.title} — ${ev.text}")
            }
        }
    }

    fun toggleVoice() { _voiceOn.value = !_voiceOn.value }

    fun reset() {
        viewModelScope.launch {
            history = JsonArray(emptyList())
            _ui.value = null
            Settings.clearHistory(getApplication())
            send(text = "(reset — render a fresh home)")
        }
    }

    fun bootstrap() {
        if (history.isEmpty()) send(text = "(idle bootstrap — render an adaptive home dashboard for right now)")
    }

    /** Send a user turn or tool results to Claude and process the response. */
    fun send(
        text: String? = null,
        imageJpegB64: String? = null,
        toolResults: List<ToolResult> = emptyList(),
    ) {
        viewModelScope.launch {
            _busy.value = true
            try {
                var workingText: String? = text
                var workingImage: String? = imageJpegB64
                var workingResults: List<ToolResult> = toolResults
                while (true) {
                    val mem = claudeApp.memory.all()
                    val r = claudeApp.claude.runTurn(
                        history = history,
                        userText = workingText,
                        userImageJpegB64 = workingImage,
                        toolResults = workingResults,
                        memory = mem,
                    )
                    history = r.history
                    Settings.setHistory(getApplication(), history.toString())

                    if (r.newMemory.isNotEmpty()) claudeApp.memory.put(r.newMemory)
                    if (r.ui != null) _ui.value = r.ui
                    if (r.speak != null && _voiceOn.value) claudeApp.voiceOut.say(r.speak)

                    if (r.pendingClientTools.isEmpty()) break

                    // Interactive tools (camera) need the user — render the
                    // viewfinder and stash the tool id; the photo result is
                    // sent when the user captures.
                    val photoCall = r.pendingClientTools.firstOrNull { it.name == "take_photo" }
                    if (photoCall != null) {
                        _pendingPhotoToolId.value = photoCall.id
                        _ui.value = UISpec(
                            root = com.claudeos.api.Node.CameraViewfinder(
                                capturePrompt = (photoCall.input["reason"] as? JsonPrimitive)?.content
                                    ?: "Tap to capture"
                            )
                        )
                        break
                    }

                    // Risky client tools — if Claude bypassed the slide_to_confirm
                    // UI, render our own confirmation gate and tell Claude we
                    // showed one.
                    val risky = r.pendingClientTools.firstOrNull { call ->
                        val def = com.claudeos.api.Tools.byName[call.name]
                        def?.risk == com.claudeos.api.RiskTier.SLIDE_TO_CONFIRM ||
                            def?.risk == com.claudeos.api.RiskTier.CONFIRM
                    }
                    if (risky != null) {
                        _ui.value = buildConfirmGate(risky)
                        workingResults = r.pendingClientTools.map {
                            ToolResult(it.id, """{"awaiting_user_confirmation":true}""")
                        }
                        workingText = null
                        workingImage = null
                        break
                    }

                    // Auto-execute low-risk tools and feed back.
                    val results = r.pendingClientTools.map { claudeApp.toolRunner.run(it) }
                    workingResults = results
                    workingText = null
                    workingImage = null
                    // continue loop
                }
            } catch (e: Exception) {
                _ui.value = UISpec(root = com.claudeos.api.Node.ErrorNode(e.message ?: "error"))
            } finally {
                _busy.value = false
            }
        }
    }

    /** User-confirmed tool call (from a slide_to_confirm action). Run it and
     *  inform Claude with the result. */
    fun runConfirmedTool(name: String, input: JsonObject) {
        viewModelScope.launch {
            val fakeId = "act_${System.currentTimeMillis()}"
            val result = claudeApp.toolRunner.run(
                com.claudeos.api.PendingClientTool(fakeId, name, input)
            )
            send(text = "[user-confirmed action] tool=$name input=${input} result=${result.content}")
        }
    }

    fun openCamera() {
        _ui.value = UISpec(root = com.claudeos.api.Node.CameraViewfinder(capturePrompt = "Tap to capture"))
    }

    fun onPhotoCaptured(b64: String) {
        val pendingId = _pendingPhotoToolId.value
        if (pendingId != null) {
            _pendingPhotoToolId.value = null
            send(
                imageJpegB64 = b64,
                toolResults = listOf(ToolResult(pendingId, """{"captured":true,"note":"image attached"}""")),
            )
        } else {
            send(text = "(captured photo)", imageJpegB64 = b64)
        }
    }

    private fun buildConfirmGate(risky: PendingClientTool): UISpec {
        val rationale = (risky.input["rationale"] as? JsonPrimitive)?.content
        return UISpec(
            title = "Confirm",
            root = com.claudeos.api.Node.Card(
                title = "Run ${risky.name}?",
                subtitle = rationale,
                children = listOf(
                    com.claudeos.api.Node.Text(
                        value = risky.input.toString().take(800),
                        tone = "muted",
                    ),
                    com.claudeos.api.Node.SlideToConfirm(
                        label = "Slide to confirm",
                        tone = if (risky.name == "pay") "danger" else "primary",
                        action = com.claudeos.api.Action.Tool(
                            tool = risky.name,
                            input = risky.input,
                        ),
                    ),
                ),
            ),
        )
    }
}
