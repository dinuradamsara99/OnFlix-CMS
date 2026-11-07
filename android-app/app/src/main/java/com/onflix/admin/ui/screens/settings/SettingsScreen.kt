package com.onflix.admin.ui.screens.settings

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentPaste
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onflix.admin.data.api.OnFlixApiService
import com.onflix.admin.data.util.EnvParser
import com.onflix.admin.data.util.ParsedEnv
import com.onflix.admin.theme.*
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(apiService: OnFlixApiService) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("onflix_admin_prefs", Context.MODE_PRIVATE) }
    val coroutineScope = rememberCoroutineScope()

    var baseUrl by remember { mutableStateOf(prefs.getString("base_url", "https://onflixlk.vercel.app") ?: "") }
    var secretKey by remember { mutableStateOf(prefs.getString("secret_key", "") ?: "") }
    var geminiKeys by remember { mutableStateOf(prefs.getString("gemini_keys", "") ?: "") }
    var subdlKey by remember { mutableStateOf(prefs.getString("subdl_key", "") ?: "") }
    var supabaseUrl by remember { mutableStateOf(prefs.getString("supabase_url", "") ?: "") }
    var tmdbKey by remember { mutableStateOf(prefs.getString("tmdb_key", "") ?: "") }

    var saveStatus by remember { mutableStateOf("") }
    var isTesting by remember { mutableStateOf(false) }
    var showPasteDialog by remember { mutableStateOf(false) }
    var pastedEnvContent by remember { mutableStateOf("") }
    var importedSummary by remember { mutableStateOf<String?>(null) }

    fun applyParsedEnv(parsed: ParsedEnv) {
        if (parsed.cronSecret.isNotEmpty()) secretKey = parsed.cronSecret
        if (parsed.baseUrl.isNotEmpty()) baseUrl = parsed.baseUrl
        if (parsed.geminiKeys.isNotEmpty()) geminiKeys = parsed.geminiKeys.joinToString(", ")
        if (parsed.subdlKeys.isNotEmpty()) subdlKey = parsed.subdlKeys.joinToString(", ")
        if (parsed.supabaseUrl.isNotEmpty()) supabaseUrl = parsed.supabaseUrl
        if (parsed.tmdbApiKey.isNotEmpty()) tmdbKey = parsed.tmdbApiKey

        // Persist immediately to SharedPreferences
        prefs.edit().apply {
            putString("base_url", baseUrl.trim())
            putString("secret_key", secretKey.trim())
            putString("gemini_keys", geminiKeys.trim())
            putString("subdl_key", subdlKey.trim())
            putString("supabase_url", supabaseUrl.trim())
            putString("tmdb_key", tmdbKey.trim())
            if (parsed.groqApiKey.isNotEmpty()) putString("groq_key", parsed.groqApiKey)
            if (parsed.githubToken.isNotEmpty()) putString("github_token", parsed.githubToken)
            if (parsed.openRouterApiKey.isNotEmpty()) putString("openrouter_key", parsed.openRouterApiKey)
            apply()
        }

        apiService.updateConfig(baseUrl, secretKey)

        importedSummary = "Imported successfully! Found ${parsed.geminiKeys.size} Gemini Keys, ${parsed.subdlKeys.size} SubDL Keys, CRON_SECRET, TMDB Key, Supabase URL."
        saveStatus = "All keys configured and saved automatically!"
    }

    // Android System File Picker for .env file
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        if (uri != null) {
            try {
                context.contentResolver.openInputStream(uri)?.use { stream ->
                    val raw = stream.bufferedReader().readText()
                    val parsed = EnvParser.parse(raw)
                    applyParsedEnv(parsed)
                }
            } catch (e: Exception) {
                saveStatus = "Error reading file: ${e.message}"
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Column {
            Text(
                text = "Settings & API Keys",
                color = DarkTextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Upload your web .env file to configure all keys in 1-click.",
                color = DarkTextSecondary,
                fontSize = 12.sp
            )
        }

        // ─── 1. Instant 1-Click .env Upload Card ─────────────────────────────
        Surface(
            color = DarkSurface,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, OnFlixPrimary.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Filled.UploadFile,
                        contentDescription = null,
                        tint = OnFlixPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                    Text(
                        text = "Auto-Configure via .env File",
                        color = OnFlixPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Text(
                    text = "Upload or paste your web .env file. The app will automatically extract and configure all Gemini multi-keys, SubDL keys, Cron Secret, Supabase credentials and TMDB keys.",
                    color = DarkTextSecondary,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    modifier = Modifier.padding(vertical = 10.dp)
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            filePickerLauncher.launch(arrayOf("*/*", "text/plain"))
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = OnFlixPrimary,
                            contentColor = OnFlixPrimaryForeground
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Filled.UploadFile, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Upload .env", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }

                    OutlinedButton(
                        onClick = { showPasteDialog = true },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = DarkTextPrimary),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Filled.ContentPaste, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Paste .env", fontSize = 13.sp)
                    }
                }

                if (importedSummary != null) {
                    Spacer(Modifier.height(12.dp))
                    Surface(
                        color = Color(0xFF064E3B),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = ColorSuccess, modifier = Modifier.size(18.dp))
                            Text(
                                text = importedSummary ?: "",
                                color = Color(0xFF6EE7B7),
                                fontSize = 12.sp,
                                lineHeight = 16.sp
                            )
                        }
                    }
                }
            }
        }

        // ─── 2. Server Connection Card ───────────────────────────────────────
        Surface(
            color = DarkSurface,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, DarkBorder, RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(text = "ONFLIX SERVER CONNECTION", color = OnFlixPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)

                OutlinedTextField(
                    value = baseUrl,
                    onValueChange = { baseUrl = it },
                    label = { Text("Server Base URL") },
                    placeholder = { Text("https://onflixlk.vercel.app") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = OnFlixPrimary,
                        unfocusedBorderColor = DarkBorder,
                        focusedTextColor = DarkTextPrimary,
                        unfocusedTextColor = DarkTextPrimary
                    )
                )

                OutlinedTextField(
                    value = secretKey,
                    onValueChange = { secretKey = it },
                    label = { Text("Admin Secret (CRON_SECRET)") },
                    placeholder = { Text("Enter secret key…") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = OnFlixPrimary,
                        unfocusedBorderColor = DarkBorder,
                        focusedTextColor = DarkTextPrimary,
                        unfocusedTextColor = DarkTextPrimary
                    )
                )
            }
        }

        // ─── 3. Extracted Translation Pools ──────────────────────────────────
        Surface(
            color = DarkSurface,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, DarkBorder, RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(text = "TRANSLATION & API KEY POOLS", color = OnFlixPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)

                OutlinedTextField(
                    value = geminiKeys,
                    onValueChange = { geminiKeys = it },
                    label = { Text("Gemini Multi-Keys Pool") },
                    placeholder = { Text("AQ.Ab8RN6..., AIzaSy...") },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 3,
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = OnFlixPrimary,
                        unfocusedBorderColor = DarkBorder,
                        focusedTextColor = DarkTextPrimary,
                        unfocusedTextColor = DarkTextPrimary
                    )
                )

                OutlinedTextField(
                    value = subdlKey,
                    onValueChange = { subdlKey = it },
                    label = { Text("SubDL API Key Pool") },
                    placeholder = { Text("subdl keys…") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = OnFlixPrimary,
                        unfocusedBorderColor = DarkBorder,
                        focusedTextColor = DarkTextPrimary,
                        unfocusedTextColor = DarkTextPrimary
                    )
                )

                if (supabaseUrl.isNotEmpty()) {
                    OutlinedTextField(
                        value = supabaseUrl,
                        onValueChange = { supabaseUrl = it },
                        label = { Text("Supabase URL") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = OnFlixPrimary,
                            unfocusedBorderColor = DarkBorder,
                            focusedTextColor = DarkTextPrimary,
                            unfocusedTextColor = DarkTextPrimary
                        )
                    )
                }
            }
        }

        // ─── 4. Save & Test Buttons ──────────────────────────────────────────
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            Button(
                onClick = {
                    prefs.edit().apply {
                        putString("base_url", baseUrl.trim())
                        putString("secret_key", secretKey.trim())
                        putString("gemini_keys", geminiKeys.trim())
                        putString("subdl_key", subdlKey.trim())
                        putString("supabase_url", supabaseUrl.trim())
                        putString("tmdb_key", tmdbKey.trim())
                        apply()
                    }
                    apiService.updateConfig(baseUrl, secretKey)
                    saveStatus = "Settings saved successfully!"
                },
                colors = ButtonDefaults.buttonColors(containerColor = OnFlixPrimary, contentColor = OnFlixPrimaryForeground),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                Text("Save Settings", fontWeight = FontWeight.Bold)
            }

            OutlinedButton(
                onClick = {
                    coroutineScope.launch {
                        isTesting = true
                        val res = apiService.queueManual(0, "test")
                        isTesting = false
                        saveStatus = if (res.isSuccess) "Connected to OnFlix API!" else "Failed: ${res.exceptionOrNull()?.message}"
                    }
                },
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = DarkTextPrimary)
            ) {
                if (isTesting) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), color = OnFlixPrimary, strokeWidth = 2.dp)
                } else {
                    Text("Test Connection")
                }
            }
        }

        if (saveStatus.isNotBlank()) {
            Text(text = saveStatus, color = OnFlixPrimary, fontSize = 13.sp)
        }
    }

    // ─── Paste .env Text Dialog ──────────────────────────────────────────────
    if (showPasteDialog) {
        AlertDialog(
            onDismissRequest = { showPasteDialog = false },
            containerColor = DarkSurface,
            title = {
                Text(
                    text = "Paste .env Content",
                    color = DarkTextPrimary,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column {
                    Text(
                        text = "Paste the raw text of your .env file here:",
                        color = DarkTextSecondary,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                    OutlinedTextField(
                        value = pastedEnvContent,
                        onValueChange = { pastedEnvContent = it },
                        placeholder = { Text("GEMINI_API_KEY_1=...\nCRON_SECRET=...", color = DarkTextMuted, fontSize = 11.sp) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = OnFlixPrimary,
                            unfocusedBorderColor = DarkBorder,
                            focusedContainerColor = DarkSurfaceVariant,
                            unfocusedContainerColor = DarkSurfaceVariant,
                            focusedTextColor = DarkTextPrimary,
                            unfocusedTextColor = DarkTextPrimary
                        ),
                        shape = RoundedCornerShape(10.dp)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val parsed = EnvParser.parse(pastedEnvContent)
                        applyParsedEnv(parsed)
                        showPasteDialog = false
                        pastedEnvContent = ""
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = OnFlixPrimary,
                        contentColor = OnFlixPrimaryForeground
                    )
                ) {
                    Text("Parse & Apply", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showPasteDialog = false }) {
                    Text("Cancel", color = DarkTextSecondary)
                }
            }
        )
    }
}
