package com.claudeos.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun SlideToConfirm(
    label: String,
    confirmedLabel: String? = null,
    tone: String? = null,
    onConfirm: () -> Unit,
) {
    val density = LocalDensity.current
    val thumbSizeDp = 56.dp
    val thumbSizePx = with(density) { thumbSizeDp.toPx() }

    var trackWidthPx by remember { mutableFloatStateOf(0f) }
    var x by remember { mutableFloatStateOf(0f) }
    var confirmed by remember { mutableStateOf(false) }

    val bg = if (tone == "danger") Color(0xFFEF4444).copy(alpha = 0.2f) else Color.White.copy(alpha = 0.1f)
    val thumbColor = if (tone == "danger") Color(0xFFEF4444) else Color.White
    val arrowColor = if (tone == "danger") Color.White else Color.Black

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(thumbSizeDp)
            .clip(CircleShape)
            .background(bg)
            .onSizeChanged { trackWidthPx = it.width.toFloat() },
    ) {
        Text(
            text = if (confirmed) (confirmedLabel ?: "Done") else label,
            color = Color.White,
            style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Medium),
            modifier = Modifier.align(Alignment.Center),
        )

        Box(
            modifier = Modifier
                .offset { IntOffset(x.toInt(), 0) }
                .size(thumbSizeDp)
                .clip(CircleShape)
                .background(thumbColor)
                .pointerInput(confirmed, trackWidthPx) {
                    if (confirmed) return@pointerInput
                    detectDragGestures(
                        onDragEnd = {
                            val max = (trackWidthPx - thumbSizePx).coerceAtLeast(0f)
                            if (x >= max - with(density) { 4.dp.toPx() }) {
                                x = max
                                confirmed = true
                                onConfirm()
                            } else {
                                x = 0f
                            }
                        },
                        onDrag = { _, drag ->
                            val max = (trackWidthPx - thumbSizePx).coerceAtLeast(0f)
                            x = (x + drag.x).coerceIn(0f, max)
                        },
                    )
                },
        ) {
            Text(
                text = "→",
                color = arrowColor,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.align(Alignment.Center),
            )
        }
    }
}
