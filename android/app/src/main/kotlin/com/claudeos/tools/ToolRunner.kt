package com.claudeos.tools

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.claudeos.MainActivity
import com.claudeos.R
import com.claudeos.api.PendingClientTool
import com.claudeos.api.ToolResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Executes client-side tool calls by dispatching the right Android intent or
 * service action. Returns a ToolResult to be fed back to Claude.
 */
class ToolRunner(private val ctx: Context) {

    suspend fun run(call: PendingClientTool): ToolResult = withContext(Dispatchers.IO) {
        try {
            when (call.name) {
                "navigate" -> navigate(call)
                "open_app" -> openApp(call)
                "place_call" -> placeCall(call)
                "send_message" -> sendMessage(call)
                "control_smart_home" -> stub(call, "smart-home bridge not yet connected")
                "search_photos" -> stub(call, "photo search not yet connected")
                "calendar_read" -> stub(call, "calendar bridge not yet connected")
                "calendar_write" -> stub(call, "calendar bridge not yet connected")
                "pay" -> stub(call, "payment bridge not yet connected")
                "web_browse" -> webBrowse(call)
                "interrupt_user" -> interruptUser(call)
                else -> error(call, "unknown tool: ${call.name}")
            }
        } catch (e: Exception) {
            error(call, e.message ?: "tool failed")
        }
    }

    private fun navigate(call: PendingClientTool): ToolResult {
        val dest = call.input.s("destination") ?: return error(call, "missing destination")
        val mode = call.input.s("mode") ?: "driving"
        val uri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=${Uri.encode(dest)}&travelmode=$mode")
        val i = Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(i)
        return ok(call, """{"opened":true,"destination":"$dest"}""")
    }

    private fun openApp(call: PendingClientTool): ToolResult {
        val app = call.input.s("app")?.lowercase() ?: return error(call, "missing app")
        val pm = ctx.packageManager
        val candidates = pm.getInstalledApplications(0).filter {
            (pm.getApplicationLabel(it).toString().lowercase().contains(app))
        }
        val target = candidates.firstOrNull() ?: return error(call, "app not installed: $app")
        val intent = pm.getLaunchIntentForPackage(target.packageName)
            ?: return error(call, "no launch intent for ${target.packageName}")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
        return ok(call, """{"opened":true,"app":"$app","package":"${target.packageName}"}""")
    }

    private fun placeCall(call: PendingClientTool): ToolResult {
        val recipient = call.input.s("recipient") ?: return error(call, "missing recipient")
        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$recipient"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
        return ok(call, """{"dialing":"$recipient"}""")
    }

    private fun sendMessage(call: PendingClientTool): ToolResult {
        val recipient = call.input.s("recipient") ?: return error(call, "missing recipient")
        val body = call.input.s("body") ?: ""
        val channel = call.input.s("channel") ?: "sms"
        val intent = when (channel) {
            "whatsapp" -> Intent(Intent.ACTION_VIEW, Uri.parse(
                "https://wa.me/${recipient.filter { it.isDigit() }}?text=${Uri.encode(body)}"
            ))
            else -> Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$recipient")).apply {
                putExtra("sms_body", body)
            }
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
        return ok(call, """{"sent":true,"channel":"$channel","recipient":"$recipient"}""")
    }

    private fun webBrowse(call: PendingClientTool): ToolResult {
        val q = call.input.s("query_or_url") ?: return error(call, "missing query")
        val url = if (q.startsWith("http")) q else "https://www.google.com/search?q=${Uri.encode(q)}"
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
        return ok(call, """{"opened":"$url"}""")
    }

    private fun interruptUser(call: PendingClientTool): ToolResult {
        val headline = call.input.s("headline") ?: return error(call, "missing headline")
        val body = call.input.s("body")
        val from = call.input.s("from")
        val urgency = call.input.s("urgency") ?: "normal"
        ensureChannel()

        val tap = PendingIntent.getActivity(
            ctx, 0,
            Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("event", "user_tapped_interrupt")
                .putExtra("headline", headline),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val priority = when (urgency) {
            "high" -> NotificationCompat.PRIORITY_HIGH
            "low" -> NotificationCompat.PRIORITY_LOW
            else -> NotificationCompat.PRIORITY_DEFAULT
        }

        val notif = NotificationCompat.Builder(ctx, NOTIF_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(if (from != null) "$headline · $from" else headline)
            .setContentText(body ?: "")
            .setStyle(NotificationCompat.BigTextStyle().bigText(body ?: ""))
            .setPriority(priority)
            .setAutoCancel(true)
            .setContentIntent(tap)
            .build()

        val mgr = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        mgr.notify(headline.hashCode(), notif)
        return ok(call, """{"shown":true}""")
    }

    private fun stub(call: PendingClientTool, note: String): ToolResult {
        val payload = buildJsonObject {
            put("ok", true)
            put("note", note)
            call.input.entries.forEach { (k, v) -> if (v is JsonPrimitive) put(k, v.content) }
        }
        return ok(call, payload.toString())
    }

    private fun ok(call: PendingClientTool, content: String) =
        ToolResult(call.id, content, isError = false)

    private fun error(call: PendingClientTool, msg: String) =
        ToolResult(call.id, msg, isError = true)

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (mgr.getNotificationChannel(NOTIF_CHANNEL_ID) == null) {
                mgr.createNotificationChannel(
                    NotificationChannel(NOTIF_CHANNEL_ID, "Claude OS", NotificationManager.IMPORTANCE_HIGH).apply {
                        description = "Interrupts and assistant nudges"
                    }
                )
            }
        }
    }

    companion object {
        const val NOTIF_CHANNEL_ID = "claude_os_main"
    }
}

private fun JsonObject.s(k: String): String? =
    (this[k] as? JsonPrimitive)?.contentOrNullSafe()

private fun JsonPrimitive.contentOrNullSafe(): String? =
    if (this.isString) this.content else this.content.takeIf { it != "null" }
