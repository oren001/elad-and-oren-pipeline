package com.claudeos.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * Push-to-talk speech recognition. Holds a single recognizer; start() begins
 * listening, stop() ends it. Reports partial + final results to the caller.
 */
class VoiceIn(private val ctx: Context) {
    private var recognizer: SpeechRecognizer? = null

    interface Listener {
        fun onPartial(text: String) {}
        fun onFinal(text: String)
        fun onError(error: String) {}
        fun onReady() {}
    }

    fun start(listener: Listener) {
        if (recognizer != null) return
        if (!SpeechRecognizer.isRecognitionAvailable(ctx)) {
            listener.onError("speech recognition unavailable")
            return
        }
        val r = SpeechRecognizer.createSpeechRecognizer(ctx)
        recognizer = r
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) { listener.onReady() }
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onError(error: Int) {
                listener.onError("err=$error")
                cleanup()
            }
            override fun onResults(results: Bundle?) {
                val text = results
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull().orEmpty()
                listener.onFinal(text)
                cleanup()
            }
            override fun onPartialResults(partialResults: Bundle?) {
                val text = partialResults
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull().orEmpty()
                if (text.isNotEmpty()) listener.onPartial(text)
            }
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, false)
        }
        r.startListening(intent)
    }

    fun stop() { recognizer?.stopListening() }

    private fun cleanup() {
        recognizer?.destroy()
        recognizer = null
    }
}

/** Wraps Android TTS. Call [say] to speak; [shutdown] when done. */
class VoiceOut(ctx: Context) {
    private var tts: TextToSpeech? = null
    private var ready = false
    private val pending = mutableListOf<String>()

    init {
        tts = TextToSpeech(ctx) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.getDefault()
                ready = true
                synchronized(pending) {
                    pending.forEach { tts?.speak(it, TextToSpeech.QUEUE_ADD, null, null) }
                    pending.clear()
                }
            }
        }
    }

    fun say(text: String) {
        if (text.isBlank()) return
        if (ready) tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
        else synchronized(pending) { pending.add(text) }
    }

    fun stop() { tts?.stop() }

    fun shutdown() { tts?.stop(); tts?.shutdown() }
}
