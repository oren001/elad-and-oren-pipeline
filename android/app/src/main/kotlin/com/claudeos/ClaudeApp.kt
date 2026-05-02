package com.claudeos

import android.app.Application
import com.claudeos.api.ClaudeClient
import com.claudeos.memory.MemoryStore
import com.claudeos.tools.ToolRunner
import com.claudeos.voice.VoiceOut
import kotlinx.coroutines.runBlocking

class ClaudeApp : Application() {
    lateinit var memory: MemoryStore
        private set
    lateinit var claude: ClaudeClient
        private set
    lateinit var toolRunner: ToolRunner
        private set
    lateinit var voiceOut: VoiceOut
        private set

    override fun onCreate() {
        super.onCreate()
        memory = MemoryStore(this)
        claude = ClaudeClient { runBlocking { Settings.getApiKey(this@ClaudeApp) } }
        toolRunner = ToolRunner(this)
        voiceOut = VoiceOut(this)
    }
}
