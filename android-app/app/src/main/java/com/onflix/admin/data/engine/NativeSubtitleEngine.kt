package com.onflix.admin.data.engine

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.okhttp.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

data class SubtitleCue(
    val index: Int,
    val timeRange: String,
    val text: String
)

class NativeSubtitleEngine(
    private val geminiKeys: List<String> = emptyList()
) {
    private val client = HttpClient(OkHttp)
    private val json = Json { ignoreUnknownKeys = true }

    fun parseSrt(rawSrt: String): List<SubtitleCue> {
        val normalized = rawSrt.replace("\r\n", "\n").replace("\r", "\n")
        val blocks = normalized.trim().split(Regex("\n\n+"))
        val cues = mutableListOf<SubtitleCue>()

        for (block in blocks) {
            val lines = block.lines().filter { it.isNotBlank() }
            if (lines.size >= 2) {
                val timeIdx = if (lines[0].contains("-->")) 0 else 1
                if (timeIdx < lines.size && lines[timeIdx].contains("-->")) {
                    val idx = if (timeIdx == 1) lines[0].toIntOrNull() ?: cues.size + 1 else cues.size + 1
                    val timeRange = lines[timeIdx].trim()
                    val text = lines.drop(timeIdx + 1).joinToString("\n").trim()
                    cues.add(SubtitleCue(index = idx, timeRange = timeRange, text = text))
                }
            }
        }
        return cues
    }

    suspend fun translateCueBatch(
        cues: List<SubtitleCue>,
        keyIndex: Int = 0
    ): Result<List<SubtitleCue>> = withContext(Dispatchers.IO) {
        runCatching {
            if (geminiKeys.isEmpty()) {
                throw Exception("No Gemini API keys provided for translation.")
            }
            val key = geminiKeys[keyIndex % geminiKeys.size]
            val prompt = buildString {
                appendLine("You are a professional Sinhala film subtitle translator.")
                appendLine("Translate the dialogue into natural, fluent, high-quality spoken Sinhala.")
                appendLine("CRITICAL RULES:")
                appendLine("1. Keep the exact ID tags like [ID: 1] unchanged so they can be reassembled.")
                appendLine("2. Never remove cues or alter numbers.")
                appendLine("3. Output ONLY the translated blocks.")
                appendLine()
                for (cue in cues) {
                    appendLine("[ID: ${cue.index}]")
                    appendLine(cue.text)
                    appendLine()
                }
            }

            val payload = buildJsonObject {
                putJsonArray("contents") {
                    addJsonObject {
                        putJsonArray("parts") {
                            addJsonObject {
                                put("text", prompt)
                            }
                        }
                    }
                }
                putJsonObject("generationConfig") {
                    put("temperature", 0.3)
                    put("maxOutputTokens", 4096)
                }
            }

            val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$key"
            val response: HttpResponse = client.post(url) {
                contentType(ContentType.Application.Json)
                setBody(payload.toString())
            }

            if (!response.status.isSuccess()) {
                throw Exception("Gemini API Error: ${response.status.value} - ${response.bodyAsText()}")
            }

            val resJson = json.parseToJsonElement(response.bodyAsText()).jsonObject
            val candidateText = resJson["candidates"]?.jsonArray?.firstOrNull()?.jsonObject
                ?.get("content")?.jsonObject
                ?.get("parts")?.jsonArray?.firstOrNull()?.jsonObject
                ?.get("text")?.jsonPrimitive?.content ?: throw Exception("Empty Gemini response")

            // Parse ID-mapped blocks back to cues
            val translatedCues = mutableListOf<SubtitleCue>()
            val pattern = Regex("\\[ID:\\s*(\\d+)\\]\\s*\\n([\\s\\S]*?)(?=(?:\\[ID:\\s*\\d+\\]|$))")
            val matches = pattern.findAll(candidateText).toList()

            for (cue in cues) {
                val match = matches.find { it.groupValues[1].toIntOrNull() == cue.index }
                val translatedText = match?.groupValues?.get(2)?.trim() ?: cue.text
                translatedCues.add(cue.copy(text = translatedText))
            }
            translatedCues
        }
    }

    fun buildSrt(cues: List<SubtitleCue>): String {
        return buildString {
            for ((i, cue) in cues.withIndex()) {
                appendLine(cue.index)
                appendLine(cue.timeRange)
                appendLine(cue.text)
                if (i < cues.size - 1) appendLine()
            }
        }
    }
}
