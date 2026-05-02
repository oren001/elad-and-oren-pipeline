package com.claudeos

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "settings")

object Settings {
    private val KEY_API = stringPreferencesKey("anthropic_api_key")
    private val KEY_HISTORY = stringPreferencesKey("history_json")

    fun apiKeyFlow(ctx: Context): Flow<String?> = ctx.dataStore.data.map { it[KEY_API] }

    suspend fun getApiKey(ctx: Context): String? = ctx.dataStore.data.first()[KEY_API]

    suspend fun setApiKey(ctx: Context, k: String) {
        ctx.dataStore.edit { it[KEY_API] = k }
    }

    suspend fun getHistory(ctx: Context): String? = ctx.dataStore.data.first()[KEY_HISTORY]

    suspend fun setHistory(ctx: Context, json: String) {
        ctx.dataStore.edit { it[KEY_HISTORY] = json }
    }

    suspend fun clearHistory(ctx: Context) {
        ctx.dataStore.edit { it.remove(KEY_HISTORY) }
    }
}
