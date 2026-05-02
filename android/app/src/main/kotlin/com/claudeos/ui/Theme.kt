package com.claudeos.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkScheme = darkColorScheme(
    primary = Color.White,
    onPrimary = Color.Black,
    secondary = Color(0xFFA0A4AB),
    background = Color(0xFF0B0D12),
    onBackground = Color.White,
    surface = Color(0xFF13161D),
    onSurface = Color.White,
)

@Composable
fun ClaudeOsTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkScheme, content = content)
}
