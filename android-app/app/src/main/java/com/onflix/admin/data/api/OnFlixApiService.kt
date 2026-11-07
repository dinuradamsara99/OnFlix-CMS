package com.onflix.admin.data.api

import com.onflix.admin.data.model.*
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.okhttp.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.Json

class OnFlixApiService(
    private var baseUrl: String = "https://onflixlk.vercel.app",
    private var adminSecret: String = ""
) {
    private val client = HttpClient(OkHttp) {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
                encodeDefaults = true
            })
        }
    }

    fun updateConfig(url: String, secret: String) {
        baseUrl = url.trimEnd('/')
        adminSecret = secret.trim()
    }

    suspend fun sendCopilotMessage(
        messages: List<CopilotMessagePayload>
    ): Result<CopilotChatResponse> = runCatching {
        val response = client.post("$baseUrl/api/public/copilot/chat") {
            contentType(ContentType.Application.Json)
            setBody(CopilotChatRequest(key = adminSecret, messages = messages))
        }
        if (!response.status.isSuccess()) {
            val errBody = response.body<String>()
            throw Exception("HTTP ${response.status.value}: $errBody")
        }
        response.body<CopilotChatResponse>()
    }

    suspend fun runScan(): Result<RunActionResponse> = runCatching {
        val response = client.post("$baseUrl/api/public/cron/scan") {
            header("Authorization", "Bearer $adminSecret")
        }
        response.body<RunActionResponse>()
    }

    suspend fun runProcess(): Result<RunActionResponse> = runCatching {
        val response = client.post("$baseUrl/api/public/cron/process") {
            header("Authorization", "Bearer $adminSecret")
        }
        response.body<RunActionResponse>()
    }

    suspend fun queueManual(
        tmdbId: Long,
        mediaType: String,
        season: Int = 0,
        episode: Int = 0
    ): Result<String> = runCatching {
        val prompt = if (mediaType == "tv") {
            "queue_title tmdb_id: $tmdbId, media_type: tv, season: $season, episode: $episode"
        } else {
            "queue_title tmdb_id: $tmdbId, media_type: movie"
        }
        val res = sendCopilotMessage(listOf(CopilotMessagePayload(role = "user", content = prompt))).getOrThrow()
        res.content
    }
}
