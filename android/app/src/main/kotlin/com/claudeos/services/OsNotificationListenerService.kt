package com.claudeos.services

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Receives every notification from every app once enabled in Settings →
 * Notifications → Device & app notifications. The Shell collects from
 * [events] and feeds them to Claude as `[event]` messages so the assistant
 * can decide whether to interrupt the user.
 */
class OsNotificationListenerService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        // Skip our own notifications to avoid feedback loops.
        if (sbn.packageName == packageName) return
        val n = sbn.notification ?: return
        val extras = n.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
        val pkg = sbn.packageName
        val event = NotificationEvent(
            packageName = pkg,
            title = title,
            text = if (bigText.isNotEmpty()) bigText else text,
            postTime = sbn.postTime,
            isOngoing = sbn.isOngoing,
        )
        _events.tryEmit(event)
        synchronized(buffer) {
            buffer.add(event)
            while (buffer.size > BUFFER_LIMIT) buffer.removeAt(0)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {}

    companion object {
        private const val BUFFER_LIMIT = 100
        private val buffer = mutableListOf<NotificationEvent>()
        private val _events = MutableSharedFlow<NotificationEvent>(
            replay = 0, extraBufferCapacity = 32,
        )
        val events = _events.asSharedFlow()

        /** Snapshot of recent captured notifications, newest last. */
        fun recent(limit: Int = 20, packageFilter: String? = null): List<NotificationEvent> {
            val snap = synchronized(buffer) { buffer.toList() }
            val filtered = if (packageFilter == null) snap
            else snap.filter { it.packageName.contains(packageFilter, ignoreCase = true) }
            return filtered.takeLast(limit)
        }
    }
}

data class NotificationEvent(
    val packageName: String,
    val title: String,
    val text: String,
    val postTime: Long,
    val isOngoing: Boolean,
)
