package com.claudeos.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

private const val MODEL = "claude-opus-4-7"
private const val MAX_TOKENS = 4096
private const val ENDPOINT = "https://api.anthropic.com/v1/messages"
private const val ANTHROPIC_VERSION = "2023-06-01"

/**
 * Result of one full turn of the agent loop. Either we have a UI to render and
 * we're done waiting on the user, or there are pendingClientTools that the
 * device must execute and feed back as tool_results.
 */
data class TurnResult(
    val history: JsonArray,
    val ui: UISpec? = null,
    val speak: String? = null,
    val pendingClientTools: List<PendingClientTool> = emptyList(),
    val newMemory: List<MemoryFact> = emptyList(),
)

class ClaudeClient(
    private val getApiKey: () -> String?,
    private val json: kotlinx.serialization.json.Json = kotlinx.serialization.json.Json {
        ignoreUnknownKeys = true
        prettyPrint = false
        classDiscriminator = "kind"
    },
) {
    private val http = OkHttpClient.Builder()
        .callTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private val mediaJson = "application/json; charset=utf-8".toMediaType()

    /** Run one turn of the agent loop. */
    suspend fun runTurn(
        history: JsonArray,
        userText: String? = null,
        userImageJpegB64: String? = null,
        toolResults: List<ToolResult> = emptyList(),
        memory: List<MemoryFact>,
    ): TurnResult = withContext(Dispatchers.IO) {
        val key = getApiKey() ?: error("No API key set")
        var workingHistory = history.toMutableList()

        if (userText != null || userImageJpegB64 != null) {
            workingHistory.add(buildJsonObject {
                put("role", "user")
                putJsonArray("content") {
                    if (userImageJpegB64 != null) add(buildJsonObject {
                        put("type", "image")
                        putJsonObject("source") {
                            put("type", "base64")
                            put("media_type", "image/jpeg")
                            put("data", userImageJpegB64)
                        }
                    })
                    if (userText != null) add(buildJsonObject {
                        put("type", "text")
                        put("text", userText)
                    })
                }
            })
        }

        if (toolResults.isNotEmpty()) {
            workingHistory.add(buildJsonObject {
                put("role", "user")
                putJsonArray("content") {
                    toolResults.forEach { tr ->
                        add(buildJsonObject {
                            put("type", "tool_result")
                            put("tool_use_id", tr.toolUseId)
                            put("content", tr.content)
                            if (tr.isError) put("is_error", true)
                        })
                    }
                }
            })
        }

        val system = SystemPrompt.build(memory)
        var ui: UISpec? = null
        var speak: String? = null
        val newMemory = mutableListOf<MemoryFact>()
        var pending: List<PendingClientTool> = emptyList()

        for (step in 0 until 6) {
            val resp = postMessages(key, system, JsonArray(workingHistory))
            val assistantContent = resp["content"]!!.jsonArray
            workingHistory.add(buildJsonObject {
                put("role", "assistant")
                put("content", assistantContent)
            })
            val stop = resp["stop_reason"]?.jsonPrimitive?.content

            if (stop != "tool_use") {
                val text = assistantContent.mapNotNull { block ->
                    val obj = block.jsonObject
                    if (obj["type"]?.jsonPrimitive?.content == "text") obj["text"]?.jsonPrimitive?.content else null
                }.joinToString("\n").trim()
                if (text.isNotEmpty() && speak == null) speak = text
                break
            }

            val toolUses = assistantContent.mapNotNull { it.jsonObject.takeIf { o -> o["type"]?.jsonPrimitive?.content == "tool_use" } }
            val serverResults = mutableListOf<ToolResult>()
            val clientPending = mutableListOf<PendingClientTool>()

            for (tu in toolUses) {
                val tuId = tu["id"]!!.jsonPrimitive.content
                val tuName = tu["name"]!!.jsonPrimitive.content
                val input = tu["input"]?.jsonObject ?: JsonObject(emptyMap())

                when (tuName) {
                    "render_ui" -> {
                        val specEl = input["spec"]
                        if (specEl is JsonObject) {
                            try {
                                ui = json.decodeFromJsonElement(UISpec.serializer(), specEl)
                                if (speak == null) speak = ui?.speak
                            } catch (e: Exception) {
                                serverResults += ToolResult(tuId, "render_ui parse error: ${e.message}", isError = true)
                                continue
                            }
                        }
                        serverResults += ToolResult(tuId, """{"ok":true}""")
                    }
                    "remember" -> {
                        val k = input["key"]?.jsonPrimitive?.content
                        val v = input["value"]?.jsonPrimitive?.content
                        val cat = input["category"]?.jsonPrimitive?.content
                        if (k != null && v != null) newMemory += MemoryFact(k, v, cat)
                        serverResults += ToolResult(tuId, """{"ok":true}""")
                    }
                    "recall" -> {
                        val keyPrefix = input["key_prefix"]?.jsonPrimitive?.content
                        val cat = input["category"]?.jsonPrimitive?.content
                        val matched = memory.filter {
                            (keyPrefix == null || it.key.startsWith(keyPrefix)) &&
                                    (cat == null || it.category == cat)
                        }
                        val payload = buildJsonObject {
                            putJsonArray("facts") {
                                matched.forEach { f ->
                                    add(buildJsonObject {
                                        put("key", f.key)
                                        put("value", f.value)
                                        if (f.category != null) put("category", f.category)
                                    })
                                }
                            }
                        }
                        serverResults += ToolResult(tuId, payload.toString())
                    }
                    "add_lesson" -> {
                        val l = input["lesson"]?.jsonPrimitive?.content
                        if (l != null) newMemory += MemoryFact(
                            "lesson.${java.lang.Long.toString(System.currentTimeMillis(), 36)}",
                            l, "lesson",
                        )
                        serverResults += ToolResult(tuId, """{"ok":true}""")
                    }
                    else -> clientPending += PendingClientTool(tuId, tuName, input)
                }
            }

            if (clientPending.isNotEmpty()) {
                pending = clientPending
                break
            }

            // Feed server results back into history and loop.
            workingHistory.add(buildJsonObject {
                put("role", "user")
                putJsonArray("content") {
                    serverResults.forEach { tr ->
                        add(buildJsonObject {
                            put("type", "tool_result")
                            put("tool_use_id", tr.toolUseId)
                            put("content", tr.content)
                            if (tr.isError) put("is_error", true)
                        })
                    }
                }
            })

            if (ui != null) break
        }

        TurnResult(
            history = JsonArray(workingHistory),
            ui = ui,
            speak = speak,
            pendingClientTools = pending,
            newMemory = newMemory,
        )
    }

    private fun postMessages(apiKey: String, system: String, messages: JsonArray): JsonObject {
        val body = buildJsonObject {
            put("model", MODEL)
            put("max_tokens", MAX_TOKENS)
            put("system", system)
            put("tools", Tools.anthropicSchema())
            put("messages", messages)
        }
        val req = Request.Builder()
            .url(ENDPOINT)
            .header("x-api-key", apiKey)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .header("content-type", "application/json")
            .post(body.toString().toRequestBody(mediaJson))
            .build()
        http.newCall(req).execute().use { resp ->
            val text = resp.body?.string() ?: ""
            if (!resp.isSuccessful) error("Claude API ${resp.code}: $text")
            return json.parseToJsonElement(text).jsonObject
        }
    }
}

data class ToolResult(
    val toolUseId: String,
    val content: String, // JSON string or plain text
    val isError: Boolean = false,
)
