package com.onflix.admin.data.util

data class ParsedEnv(
    val cronSecret: String = "",
    val baseUrl: String = "",
    val geminiKeys: List<String> = emptyList(),
    val subdlKeys: List<String> = emptyList(),
    val tmdbApiKey: String = "",
    val supabaseUrl: String = "",
    val supabaseServiceKey: String = "",
    val groqApiKey: String = "",
    val githubToken: String = "",
    val openRouterApiKey: String = "",
    val rawKeyMap: Map<String, String> = emptyMap()
)

object EnvParser {
    fun parse(rawText: String): ParsedEnv {
        val map = mutableMapOf<String, String>()
        val geminiList = mutableListOf<String>()
        val subdlList = mutableListOf<String>()

        rawText.lines().forEach { rawLine ->
            val line = rawLine.trim()
            if (line.isNotEmpty() && !line.startsWith("#")) {
                val eqIdx = line.indexOf('=')
                if (eqIdx > 0) {
                    val key = line.substring(0, eqIdx).trim()
                    var value = line.substring(eqIdx + 1).trim()
                    // Strip enclosing quotes if present
                    if ((value.startsWith("\"") && value.endsWith("\"")) ||
                        (value.startsWith("'") && value.endsWith("'"))
                    ) {
                        value = value.substring(1, value.length - 1)
                    }
                    if (value.isNotEmpty()) {
                        map[key] = value
                    }
                }
            }
        }

        // Aggregate all GEMINI_API_KEY_* variants
        map.filter { it.key.startsWith("GEMINI_API_KEY") }.forEach {
            if (!geminiList.contains(it.value)) {
                geminiList.add(it.value)
            }
        }

        // Aggregate all SUBDL_API_KEY_* variants
        map.filter { it.key.startsWith("SUBDL_API_KEY") }.forEach {
            if (!subdlList.contains(it.value)) {
                subdlList.add(it.value)
            }
        }

        val baseUrl = map["NEXT_PUBLIC_SITE_URL"] 
            ?: map["SITE_URL"] 
            ?: map["BASE_URL"] 
            ?: "https://onflixlk.vercel.app"

        return ParsedEnv(
            cronSecret = map["CRON_SECRET"] ?: "",
            baseUrl = baseUrl,
            geminiKeys = geminiList,
            subdlKeys = subdlList,
            tmdbApiKey = map["TMDB_API_KEY"] ?: "",
            supabaseUrl = map["ONFLIX_SUPABASE_URL"] ?: map["SUPABASE_URL"] ?: "",
            supabaseServiceKey = map["ONFLIX_SUPABASE_SERVICE_KEY"] ?: map["SUPABASE_SERVICE_ROLE_KEY"] ?: "",
            groqApiKey = map["GROQ_API_KEY"] ?: "",
            githubToken = map["GITHUB_TOKEN"] ?: "",
            openRouterApiKey = map["OPENROUTER_API_KEY"] ?: "",
            rawKeyMap = map
        )
    }
}
