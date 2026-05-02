package com.claudeos.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.claudeos.Settings
import kotlinx.coroutines.launch

@Composable
fun ApiKeyGate(onSaved: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var k by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().background(Color.Black).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Column(modifier = Modifier.widthIn(max = 360.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Claude OS", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.SemiBold)
            Text("Paste your Anthropic API key to begin.", color = Color.White.copy(alpha = 0.6f))
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = Color.White.copy(alpha = 0.10f),
                modifier = Modifier.fillMaxWidth(),
            ) {
                BasicTextField(
                    value = k,
                    onValueChange = { k = it },
                    visualTransformation = PasswordVisualTransformation(),
                    textStyle = TextStyle(color = Color.White, fontSize = 16.sp),
                    cursorBrush = SolidColor(Color.White),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp),
                )
            }
            androidx.compose.material3.Button(
                onClick = {
                    if (k.isNotBlank()) scope.launch {
                        Settings.setApiKey(ctx, k.trim())
                        onSaved()
                    }
                },
                enabled = k.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Continue") }
            Text(
                "Stored locally on this device. Memory and history live in your phone. Nothing is sent to any server other than Anthropic.",
                color = Color.White.copy(alpha = 0.4f),
                fontSize = 12.sp,
            )
        }
    }
}
