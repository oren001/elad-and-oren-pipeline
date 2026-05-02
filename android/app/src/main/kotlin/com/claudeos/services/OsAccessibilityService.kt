package com.claudeos.services

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * The OS-level eyes and hands. Once the user enables this service in
 * Settings → Accessibility, Claude can:
 *  - read the current foreground app's view hierarchy (to "see" the screen)
 *  - perform global actions (back, home, recents, notifications shade)
 *  - tap, swipe, type into other apps
 *
 * For now this service exposes a thin command surface via static refs that
 * the in-app tool runner can invoke. Each capability is wrapped behind a
 * simple sealed result so the agent can be told what happened.
 */
class OsAccessibilityService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We don't need every event for v1; the agent reads the screen on
        // demand via dumpScreen(). But we keep the door open here.
    }

    override fun onInterrupt() {}

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance === this) instance = null
    }

    /** Return a flat textual representation of the current screen's UI. */
    fun dumpScreen(): String {
        val root = rootInActiveWindow ?: return "(no active window)"
        val sb = StringBuilder()
        walk(root, sb, 0)
        return sb.toString()
    }

    private fun walk(node: AccessibilityNodeInfo?, sb: StringBuilder, depth: Int) {
        if (node == null) return
        val text = node.text?.toString()
        val desc = node.contentDescription?.toString()
        val cls = node.className?.toString()?.substringAfterLast('.')
        if (!text.isNullOrBlank() || !desc.isNullOrBlank()) {
            sb.append("  ".repeat(depth))
            sb.append("[$cls] ")
            if (!text.isNullOrBlank()) sb.append(text)
            if (!desc.isNullOrBlank()) sb.append(" (").append(desc).append(")")
            if (node.isClickable) sb.append(" *clickable")
            sb.append('\n')
        }
        for (i in 0 until node.childCount) walk(node.getChild(i), sb, depth + 1)
    }

    /** Tap an absolute screen coordinate using a synthetic gesture. */
    fun tap(x: Float, y: Float) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
        val path = Path().apply { moveTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 50))
            .build()
        dispatchGesture(gesture, null, null)
    }

    /** Swipe between two coordinates. */
    fun swipe(x1: Float, y1: Float, x2: Float, y2: Float, durationMs: Long = 300) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
        val path = Path().apply { moveTo(x1, y1); lineTo(x2, y2) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, durationMs))
            .build()
        dispatchGesture(gesture, null, null)
    }

    fun pressBack() = performGlobalAction(GLOBAL_ACTION_BACK)
    fun pressHome() = performGlobalAction(GLOBAL_ACTION_HOME)
    fun openNotifications() = performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
    fun openRecents() = performGlobalAction(GLOBAL_ACTION_RECENTS)

    companion object {
        @Volatile var instance: OsAccessibilityService? = null
            private set
    }
}
