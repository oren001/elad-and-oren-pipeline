package com.claudeos.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.claudeos.api.Action
import com.claudeos.api.Node
import com.claudeos.api.UISpec
import kotlinx.serialization.json.JsonObject

@Composable
fun Renderer(
    spec: UISpec,
    onAction: (Action) -> Unit,
    onPhoto: (String) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
            .padding(bottom = 96.dp),
    ) {
        spec.title?.let {
            Text(it, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(12.dp))
        }
        RenderNode(spec.root, onAction, onPhoto)
        if (spec.suggestions.isNotEmpty()) {
            Spacer(Modifier.height(16.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                spec.suggestions.forEach { s ->
                    Surface(
                        shape = CircleShape,
                        color = Color.White.copy(alpha = 0.10f),
                        modifier = Modifier.clickable { onAction(Action.Send(s)) },
                    ) {
                        Text(
                            s,
                            color = Color.White.copy(alpha = 0.9f),
                            fontSize = 14.sp,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RenderNode(node: Node, onAction: (Action) -> Unit, onPhoto: (String) -> Unit) {
    when (node) {
        is Node.Text -> {
            val style = when (node.tone) {
                "headline" -> TextStyle(color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.SemiBold)
                "title" -> TextStyle(color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                "muted" -> TextStyle(color = Color.White.copy(alpha = 0.6f), fontSize = 14.sp)
                "caption" -> TextStyle(color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp)
                else -> TextStyle(color = Color.White.copy(alpha = 0.9f), fontSize = 16.sp)
            }
            Text(node.value, style = style)
        }
        is Node.Stack -> Column(verticalArrangement = Arrangement.spacedBy((node.gap ?: 12).dp)) {
            node.children.forEach { RenderNode(it, onAction, onPhoto) }
        }
        is Node.Row -> Row(
            horizontalArrangement = Arrangement.spacedBy((node.gap ?: 8).dp, when (node.align) {
                "center" -> Alignment.CenterHorizontally
                "end" -> Alignment.End
                "between" -> Alignment.SpaceBetween
                else -> Alignment.Start
            }),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            node.children.forEach { RenderNode(it, onAction, onPhoto) }
        }
        is Node.Card -> Surface(
            shape = RoundedCornerShape(20.dp),
            color = Color.White.copy(alpha = 0.05f),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(20.dp)),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                node.title?.let { Text(it, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp) }
                node.subtitle?.let { Text(it, color = Color.White.copy(alpha = 0.6f), fontSize = 14.sp) }
                node.children.forEach { RenderNode(it, onAction, onPhoto) }
            }
        }
        is Node.Button -> {
            val (bg, fg) = when (node.variant) {
                "danger" -> Color(0xFFEF4444) to Color.White
                "soft" -> Color.White.copy(alpha = 0.1f) to Color.White
                "ghost" -> Color.Transparent to Color.White
                else -> Color.White to Color.Black
            }
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = bg,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onAction(node.action) }
                    .let { if (node.variant == "ghost") it.border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(14.dp)) else it },
            ) {
                Text(
                    node.label,
                    color = fg,
                    modifier = Modifier.padding(vertical = 14.dp),
                    style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Medium),
                )
            }
        }
        is Node.SlideToConfirm -> SlideToConfirm(
            label = node.label,
            confirmedLabel = node.confirmedLabel,
            tone = node.tone,
            onConfirm = { onAction(node.action) },
        )
        is Node.ListView -> Surface(
            shape = RoundedCornerShape(20.dp),
            color = Color.White.copy(alpha = 0.05f),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(20.dp)),
        ) {
            Column {
                node.items.forEachIndexed { i, item ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .let { if (item.action != null) it.clickable { onAction(item.action) } else it }
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(item.title, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            item.subtitle?.let {
                                Text(it, color = Color.White.copy(alpha = 0.6f), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                        item.trailing?.let {
                            Text(it, color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp)
                        }
                    }
                    if (i < node.items.size - 1) {
                        HorizontalDivider(color = Color.White.copy(alpha = 0.05f))
                    }
                }
            }
        }
        is Node.Image -> AsyncImage(
            model = node.src, contentDescription = node.alt,
            modifier = Modifier.fillMaxWidth().let {
                if (node.rounded) it.clip(RoundedCornerShape(20.dp)) else it
            },
        )
        is Node.PhotoGrid -> LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.heightIn(max = 480.dp),
        ) {
            items(node.photos) { p ->
                AsyncImage(
                    model = p.src,
                    contentDescription = p.alt,
                    modifier = Modifier
                        .aspectRatio(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.White.copy(alpha = 0.05f))
                        .let { if (p.action != null) it.clickable { onAction(p.action) } else it },
                )
            }
        }
        is Node.Field -> FieldNode(node)
        is Node.Form -> FormNode(node, onAction)
        is Node.Toggle -> ToggleNode(node, onAction)
        is Node.Slider -> SliderNode(node, onAction)
        is Node.Map -> {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = Color.White.copy(alpha = 0.05f),
                modifier = Modifier.fillMaxWidth().aspectRatio(4f / 3f),
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(12.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(node.label ?: "Map", color = Color.White)
                    Text("${node.lat}, ${node.lng}", color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
                }
            }
        }
        is Node.Metric -> Surface(
            shape = RoundedCornerShape(20.dp),
            color = Color.White.copy(alpha = 0.05f),
            modifier = Modifier.fillMaxWidth().border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(20.dp)),
        ) {
            Column(Modifier.padding(16.dp)) {
                Text(node.label, color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp)
                Text(node.value, color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.SemiBold)
                node.delta?.let {
                    val c = when (node.tone) {
                        "good" -> Color(0xFF34D399)
                        "bad" -> Color(0xFFF87171)
                        else -> Color.White.copy(alpha = 0.6f)
                    }
                    Text(it, color = c, fontSize = 13.sp)
                }
            }
        }
        is Node.Chips -> Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            node.chips.forEach { c ->
                Surface(
                    shape = CircleShape,
                    color = if (c.selected) Color.White else Color.White.copy(alpha = 0.10f),
                    modifier = Modifier.let {
                        if (c.action != null) it.clickable { onAction(c.action) } else it
                    },
                ) {
                    Text(
                        c.label,
                        color = if (c.selected) Color.Black else Color.White,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    )
                }
            }
        }
        is Node.Divider -> HorizontalDivider(color = Color.White.copy(alpha = 0.1f))
        is Node.Spacer -> Spacer(Modifier.height((node.size ?: 12).dp))
        is Node.MediaPlayer -> Surface(
            shape = RoundedCornerShape(20.dp),
            color = Color.White.copy(alpha = 0.05f),
            modifier = Modifier.fillMaxWidth().border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(20.dp)),
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                node.artwork?.let {
                    AsyncImage(
                        model = it, contentDescription = null,
                        modifier = Modifier.size(56.dp).clip(RoundedCornerShape(8.dp)),
                    )
                }
                Column(Modifier.weight(1f)) {
                    Text(node.title, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    node.subtitle?.let { Text(it, color = Color.White.copy(alpha = 0.6f), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                }
                node.action?.let { a ->
                    IconButton(onClick = { onAction(a) }) {
                        Icon(Icons.Filled.PlayArrow, contentDescription = "play", tint = Color.White)
                    }
                }
            }
        }
        is Node.CameraViewfinder -> CameraScreen(prompt = node.capturePrompt, onCapture = onPhoto)
        is Node.Loading -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
            node.label?.let { Text(it, color = Color.White.copy(alpha = 0.7f)) }
        }
        is Node.ErrorNode -> Surface(
            shape = RoundedCornerShape(16.dp),
            color = Color(0xFFEF4444).copy(alpha = 0.1f),
            modifier = Modifier.fillMaxWidth().border(1.dp, Color(0xFFEF4444).copy(alpha = 0.3f), RoundedCornerShape(16.dp)),
        ) {
            Text(node.message, color = Color(0xFFFFB4B4), modifier = Modifier.padding(12.dp))
        }
    }
}

@Composable
private fun FieldNode(node: Node.Field) {
    var v by rememberSaveable(node.name) { mutableStateOf(node.value ?: "") }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(node.label, color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
        Surface(
            shape = RoundedCornerShape(14.dp),
            color = Color.White.copy(alpha = 0.10f),
            modifier = Modifier.fillMaxWidth().border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(14.dp)),
        ) {
            BasicTextField(
                value = v,
                onValueChange = { v = it },
                textStyle = TextStyle(color = Color.White, fontSize = 16.sp),
                cursorBrush = androidx.compose.ui.graphics.SolidColor(Color.White),
                singleLine = node.kind != "multiline",
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            )
        }
    }
}

@Composable
private fun FormNode(node: Node.Form, onAction: (Action) -> Unit) {
    val values = remember { mutableStateMapOf<String, String>() }
    LaunchedEffect(node) {
        node.fields.forEach { f -> values[f.name] = f.value ?: "" }
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        node.fields.forEach { f ->
            FieldNode(f)
        }
        Surface(
            shape = RoundedCornerShape(14.dp),
            color = Color.White,
            modifier = Modifier.fillMaxWidth().clickable {
                // Submit: snapshot values into the action input.
                val a = node.submit
                if (a is Action.Tool) {
                    val merged = JsonObject(a.input + values.mapValues { kotlinx.serialization.json.JsonPrimitive(it.value) })
                    onAction(Action.Tool(a.tool, merged, a.risk, a.label))
                } else {
                    onAction(a)
                }
            },
        ) {
            Text(node.submitLabel, color = Color.Black, modifier = Modifier.padding(vertical = 14.dp), style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Medium))
        }
    }
}

@Composable
private fun ToggleNode(node: Node.Toggle, onAction: (Action) -> Unit) {
    var v by rememberSaveable(node.name) { mutableStateOf(node.value) }
    Row(
        modifier = Modifier.fillMaxWidth().clickable {
            v = !v
            node.onChange?.let { onAction(it) }
        },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(node.label, color = Color.White)
        Switch(checked = v, onCheckedChange = {
            v = it
            node.onChange?.let { a -> onAction(a) }
        })
    }
}

@Composable
private fun SliderNode(node: Node.Slider, onAction: (Action) -> Unit) {
    var v by rememberSaveable(node.name) { mutableFloatStateOf(node.value.toFloat()) }
    Column {
        if (node.label != null) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(node.label, color = Color.White.copy(alpha = 0.8f), fontSize = 14.sp)
                Text("${v.toInt()}${node.unit ?: ""}", color = Color.White.copy(alpha = 0.8f), fontSize = 14.sp)
            }
        }
        Slider(
            value = v,
            onValueChange = { v = it },
            onValueChangeFinished = { node.onChange?.let { onAction(it) } },
            valueRange = node.min.toFloat()..node.max.toFloat(),
        )
    }
}
