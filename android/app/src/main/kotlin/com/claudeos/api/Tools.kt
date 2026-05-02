package com.claudeos.api

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject

enum class RiskTier { LOW, CONFIRM, SLIDE_TO_CONFIRM }

data class OsTool(
    val name: String,
    val description: String,
    val risk: RiskTier,
    val inputSchema: JsonObject,
)

object Tools {
    val all: List<OsTool> = listOf(
        tool(
            "render_ui",
            "Render a screen for the user. Call this at the end of every turn unless your reply is purely a brief spoken response. Replaces the current screen.",
            RiskTier.LOW,
            required = listOf("spec"),
        ) {
            putJsonObject("spec") {
                put("type", "object")
                put("description", "A UISpec: { speak?, title?, root, suggestions? }. Node types: text, stack, row, card, button, slide_to_confirm, list, image, photo_grid, field, form, toggle, slider, map, metric, chips, divider, spacer, media_player, camera_viewfinder, loading, error. Actions on buttons/slide_to_confirm: { kind: 'send', prompt } | { kind: 'tool', tool, input, risk } | { kind: 'open_url', url } | { kind: 'dismiss' }.")
            }
        },
        tool("remember", "Save a durable fact about the user (relationships, preferences, routines). Don't store secrets.",
            RiskTier.LOW, required = listOf("key", "value")) {
            putJsonObject("key") { put("type", "string"); put("description", "Stable short key like 'mom.phone' or 'coffee.order'") }
            putJsonObject("value") { put("type", "string") }
            putJsonObject("category") { put("type", "string"); put("description", "person | preference | routine | place | credential_ref | other") }
        },
        tool("recall", "Look up remembered facts by key prefix or category.", RiskTier.LOW) {
            putJsonObject("key_prefix") { put("type", "string") }
            putJsonObject("category") { put("type", "string") }
        },
        tool("add_lesson", "Save a short behavioral lesson for next time (e.g. 'when X, do Y'). Use after meaningful interactions.",
            RiskTier.LOW, required = listOf("lesson")) {
            putJsonObject("lesson") { put("type", "string") }
        },
        tool("send_message", "Send an SMS or chat message. Risky — invoke via slide_to_confirm.",
            RiskTier.SLIDE_TO_CONFIRM, required = listOf("recipient", "body")) {
            putJsonObject("recipient") { put("type", "string") }
            putJsonObject("body") { put("type", "string") }
            putJsonObject("channel") { put("type", "string"); put("description", "sms | whatsapp | imessage | telegram") }
        },
        tool("place_call", "Place a phone call. Risky — invoke via slide_to_confirm.",
            RiskTier.SLIDE_TO_CONFIRM, required = listOf("recipient")) {
            putJsonObject("recipient") { put("type", "string") }
        },
        tool("take_photo", "Open the camera viewfinder so the user can capture a photo.", RiskTier.LOW) {
            putJsonObject("reason") { put("type", "string"); put("description", "Why you need the photo") }
        },
        tool("search_photos", "Search the user's photo library by date, place or contents.",
            RiskTier.LOW, required = listOf("query")) {
            putJsonObject("query") { put("type", "string") }
        },
        tool("control_smart_home", "Control a smart home device. Reversible: confirm. Irreversible: slide_to_confirm.",
            RiskTier.CONFIRM, required = listOf("device", "command")) {
            putJsonObject("device") { put("type", "string") }
            putJsonObject("command") { put("type", "string"); put("description", "e.g. 'on' | 'off' | 'set:50%' | 'play:jazz'") }
        },
        tool("navigate", "Open turn-by-turn navigation.",
            RiskTier.LOW, required = listOf("destination")) {
            putJsonObject("destination") { put("type", "string") }
            putJsonObject("mode") { put("type", "string"); put("description", "driving | walking | transit | cycling") }
        },
        tool("pay", "Make a payment. Always slide_to_confirm.",
            RiskTier.SLIDE_TO_CONFIRM, required = listOf("recipient", "amount", "currency")) {
            putJsonObject("recipient") { put("type", "string") }
            putJsonObject("amount") { put("type", "number") }
            putJsonObject("currency") { put("type", "string") }
            putJsonObject("memo") { put("type", "string") }
        },
        tool("open_app", "Open an installed app by name.",
            RiskTier.LOW, required = listOf("app")) {
            putJsonObject("app") { put("type", "string") }
        },
        tool("calendar_read", "Read upcoming calendar events.", RiskTier.LOW) {
            putJsonObject("start") { put("type", "string") }
            putJsonObject("end") { put("type", "string") }
        },
        tool("calendar_write", "Create or modify a calendar event.",
            RiskTier.CONFIRM, required = listOf("title", "start")) {
            putJsonObject("title") { put("type", "string") }
            putJsonObject("start") { put("type", "string") }
            putJsonObject("end") { put("type", "string") }
            putJsonObject("location") { put("type", "string") }
            putJsonObject("notes") { put("type", "string") }
        },
        tool("web_browse", "Fetch a page or run a web search.",
            RiskTier.LOW, required = listOf("query_or_url")) {
            putJsonObject("query_or_url") { put("type", "string") }
        },
        tool("read_screen", "Read the current foreground app's on-screen content (text + clickable elements). Requires the user to have enabled the Claude OS accessibility service. Useful for inspecting WhatsApp, Maps, banking, or any other app the user is currently viewing.",
            RiskTier.LOW) {
        },
        tool("read_recent_notifications", "Return recent notifications captured by the launcher's notification listener (texts, WhatsApp/Slack/etc messages, calendar reminders). Requires the user to have enabled notification access for Claude OS.",
            RiskTier.LOW) {
            putJsonObject("limit") { put("type", "integer"); put("description", "Max notifications to return (default 20)") }
            putJsonObject("from_app") { put("type", "string"); put("description", "Optional package-name substring filter, e.g. 'whatsapp', 'gmail', 'messaging'") }
        },
        tool("wait_ms", "Pause for a given number of milliseconds. Useful between open_app and read_screen so the launched app has time to render.",
            RiskTier.LOW, required = listOf("ms")) {
            putJsonObject("ms") { put("type", "integer"); put("description", "Milliseconds to wait, capped at 5000.") }
        },
        tool("interrupt_user", "Show a prominent in-launcher notification interrupting the user with an important message (incoming text from a key person, calendar reminder, etc).",
            RiskTier.LOW, required = listOf("headline")) {
            putJsonObject("headline") { put("type", "string") }
            putJsonObject("body") { put("type", "string") }
            putJsonObject("from") { put("type", "string") }
            putJsonObject("urgency") { put("type", "string"); put("description", "low | normal | high") }
        },
    )

    val byName: Map<String, OsTool> = all.associateBy { it.name }
    val serverHandled: Set<String> = setOf("render_ui", "remember", "recall", "add_lesson")

    fun anthropicSchema(): JsonArray = buildJsonArray {
        all.forEach { t ->
            add(buildJsonObject {
                put("name", t.name)
                put("description", t.description)
                put("input_schema", t.inputSchema)
            })
        }
    }
}

private fun tool(
    name: String,
    description: String,
    risk: RiskTier,
    required: List<String> = emptyList(),
    properties: kotlinx.serialization.json.JsonObjectBuilder.() -> Unit,
): OsTool {
    val schema = buildJsonObject {
        put("type", "object")
        putJsonObject("properties") { properties() }
        if (required.isNotEmpty()) {
            putJsonArray("required") { required.forEach { add(JsonPrimitive(it)) } }
        }
    }
    return OsTool(name, description, risk, schema)
}
