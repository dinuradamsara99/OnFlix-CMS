package com.onflix.admin.data.model

import kotlinx.serialization.Serializable

@Serializable
data class Job(
    val id: Long,
    val tmdb_id: Long,
    val media_type: String,
    val title: String,
    val season_number: Int = 0,
    val episode_number: Int = 0,
    val status: String,
    val release_date: String? = null,
    val popularity: Double? = null,
    val runtime: Int? = null,
    val poster_path: String? = null,
    val next_retry_at: String? = null,
    val retry_count: Int? = 0,
    val error_log: String? = null,
    val updated_at: String? = null
)

@Serializable
data class ContentItem(
    val id: Long,
    val title: String,
    val type: String,
    val tmdb_id: Long,
    val release_year: Int? = null,
    val rating: Double? = null,
    val featured: Boolean = false,
    val status: String = "published",
    val sinhala_subtitle_url: String? = null,
    val embed_link: String? = null,
    val poster_url: String? = null
)

@Serializable
data class UserRequest(
    val id: Long,
    val tmdb_id: Long,
    val media_type: String,
    val title: String,
    val year: String? = null,
    val status: String = "pending",
    val email: String? = null,
    val created_at: String? = null
)

@Serializable
data class CopilotMessage(
    val id: String,
    val role: String, // "user", "assistant"
    val content: String,
    val timestamp: Long = System.currentTimeMillis()
)

@Serializable
data class CopilotChatRequest(
    val key: String,
    val messages: List<CopilotMessagePayload>
)

@Serializable
data class CopilotMessagePayload(
    val role: String,
    val content: String
)

@Serializable
data class CopilotChatResponse(
    val role: String? = null,
    val content: String = "",
    val error: String? = null
)

@Serializable
data class RunActionResponse(
    val ok: Boolean = true,
    val logs: List<String> = emptyList(),
    val error: String? = null
)
