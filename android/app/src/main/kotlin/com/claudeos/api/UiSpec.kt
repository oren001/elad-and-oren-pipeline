package com.claudeos.api

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonElement

@Serializable
data class UISpec(
    val speak: String? = null,
    val title: String? = null,
    val root: Node,
    val suggestions: List<String> = emptyList(),
)

@OptIn(ExperimentalSerializationApi::class)
@Serializable
@JsonClassDiscriminator("kind")
sealed class Action {
    @Serializable @SerialName("send")
    data class Send(val prompt: String) : Action()

    @Serializable @SerialName("tool")
    data class Tool(
        val tool: String,
        val input: JsonObject = JsonObject(emptyMap()),
        val risk: String? = null,
        val label: String? = null,
    ) : Action()

    @Serializable @SerialName("open_url")
    data class OpenUrl(val url: String) : Action()

    @Serializable @SerialName("dismiss")
    data object Dismiss : Action()
}

@OptIn(ExperimentalSerializationApi::class)
@Serializable
@JsonClassDiscriminator("type")
sealed class Node {
    @Serializable @SerialName("text")
    data class Text(val value: String, val tone: String? = null) : Node()

    @Serializable @SerialName("stack")
    data class Stack(val gap: Int? = null, val children: List<Node>) : Node()

    @Serializable @SerialName("row")
    data class Row(val gap: Int? = null, val align: String? = null, val children: List<Node>) : Node()

    @Serializable @SerialName("card")
    data class Card(
        val title: String? = null,
        val subtitle: String? = null,
        val accent: String? = null,
        val children: List<Node>,
    ) : Node()

    @Serializable @SerialName("button")
    data class Button(
        val label: String,
        val variant: String? = null,
        val icon: String? = null,
        val action: Action,
    ) : Node()

    @Serializable @SerialName("slide_to_confirm")
    data class SlideToConfirm(
        val label: String,
        val confirmedLabel: String? = null,
        val tone: String? = null,
        val action: Action,
    ) : Node()

    @Serializable @SerialName("list")
    data class ListView(val items: List<ListItem>) : Node()

    @Serializable
    data class ListItem(
        val title: String,
        val subtitle: String? = null,
        val trailing: String? = null,
        val icon: String? = null,
        val action: Action? = null,
    )

    @Serializable @SerialName("image")
    data class Image(val src: String, val alt: String? = null, val rounded: Boolean = false) : Node()

    @Serializable @SerialName("photo_grid")
    data class PhotoGrid(val photos: List<Photo>) : Node()

    @Serializable
    data class Photo(val src: String, val alt: String? = null, val action: Action? = null)

    @Serializable @SerialName("field")
    data class Field(
        val name: String,
        val label: String,
        val placeholder: String? = null,
        val kind: String? = null,
        val value: String? = null,
    ) : Node()

    @Serializable @SerialName("form")
    data class Form(
        val submitLabel: String,
        val fields: List<Field>,
        val submit: Action,
    ) : Node()

    @Serializable @SerialName("toggle")
    data class Toggle(
        val name: String,
        val label: String,
        val value: Boolean,
        val onChange: Action? = null,
    ) : Node()

    @Serializable @SerialName("slider")
    data class Slider(
        val name: String,
        val label: String? = null,
        val min: Double,
        val max: Double,
        val step: Double? = null,
        val value: Double,
        val unit: String? = null,
        val onChange: Action? = null,
    ) : Node()

    @Serializable @SerialName("map")
    data class Map(val lat: Double, val lng: Double, val zoom: Int? = null, val label: String? = null) : Node()

    @Serializable @SerialName("metric")
    data class Metric(
        val label: String,
        val value: String,
        val delta: String? = null,
        val tone: String? = null,
    ) : Node()

    @Serializable @SerialName("chips")
    data class Chips(val chips: List<Chip>) : Node()

    @Serializable
    data class Chip(val label: String, val action: Action? = null, val selected: Boolean = false)

    @Serializable @SerialName("divider")
    data object Divider : Node()

    @Serializable @SerialName("spacer")
    data class Spacer(val size: Int? = null) : Node()

    @Serializable @SerialName("media_player")
    data class MediaPlayer(
        val title: String,
        val subtitle: String? = null,
        val artwork: String? = null,
        val playing: Boolean = false,
        val action: Action? = null,
    ) : Node()

    @Serializable @SerialName("camera_viewfinder")
    data class CameraViewfinder(val capturePrompt: String? = null) : Node()

    @Serializable @SerialName("loading")
    data class Loading(val label: String? = null) : Node()

    @Serializable @SerialName("error")
    data class ErrorNode(val message: String) : Node()
}

@Serializable
data class MemoryFact(
    val key: String,
    val value: String,
    val category: String? = null,
)

@Serializable
data class PendingClientTool(
    val id: String,
    val name: String,
    val input: JsonObject,
)
