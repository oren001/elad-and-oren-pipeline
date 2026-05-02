package com.claudeos.memory

import android.content.Context
import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import com.claudeos.api.MemoryFact
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Entity(tableName = "memory")
data class MemoryEntity(
    @PrimaryKey val key: String,
    val value: String,
    val category: String?,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
)

@Dao
interface MemoryDao {
    @Query("SELECT * FROM memory ORDER BY updated_at DESC")
    suspend fun all(): List<MemoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(fact: MemoryEntity)

    @Query("DELETE FROM memory")
    suspend fun clear()
}

@Database(entities = [MemoryEntity::class], version = 1, exportSchema = false)
abstract class MemoryDatabase : RoomDatabase() {
    abstract fun dao(): MemoryDao

    companion object {
        @Volatile private var instance: MemoryDatabase? = null
        fun get(ctx: Context): MemoryDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(ctx.applicationContext, MemoryDatabase::class.java, "memory.db")
                .build().also { instance = it }
        }
    }
}

class MemoryStore(private val ctx: Context) {
    private val dao get() = MemoryDatabase.get(ctx).dao()

    suspend fun all(): List<MemoryFact> = withContext(Dispatchers.IO) {
        dao.all().map { MemoryFact(it.key, it.value, it.category) }
    }

    suspend fun put(facts: List<MemoryFact>) = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        facts.forEach { dao.upsert(MemoryEntity(it.key, it.value, it.category, now)) }
    }

    suspend fun clear() = withContext(Dispatchers.IO) { dao.clear() }
}
