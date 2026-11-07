package com.onflix.admin.ui.screens.overview

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onflix.admin.data.api.OnFlixApiService
import com.onflix.admin.theme.*
import kotlinx.coroutines.launch

@Composable
fun OverviewScreen(
    apiService: OnFlixApiService,
    onNavigateToRequests: () -> Unit,
    pendingRequestsCount: Int = 2
) {
    val coroutineScope = rememberCoroutineScope()
    var isScanning by remember { mutableStateOf(false) }
    var isProcessing by remember { mutableStateOf(false) }
    var actionLogs by remember { mutableStateOf<List<String>>(emptyList()) }
    var logTitle by remember { mutableStateOf("") }

    // Manual Job State
    var manualTmdbId by remember { mutableStateOf("") }
    var manualType by remember { mutableStateOf("movie") }
    var manualSeason by remember { mutableStateOf("1") }
    var manualEpisode by remember { mutableStateOf("1") }
    var manualMessage by remember { mutableStateOf("") }
    var manualLoading by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(vertical = 16.dp)
    ) {
        // 1. Pending Requests Alert Banner
        if (pendingRequestsCount > 0) {
            item {
                Surface(
                    color = DarkSurface,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, DarkBorder, RoundedCornerShape(16.dp))
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "$pendingRequestsCount User Title Requests Pending",
                                color = DarkTextPrimary,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 15.sp
                            )
                            Text(
                                text = "Users requested titles on OnFlix. Fulfill them with 1-click.",
                                color = DarkTextSecondary,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(top = 2.dp)
                            )
                        }
                        Button(
                            onClick = onNavigateToRequests,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = OnFlixPrimary,
                                contentColor = OnFlixPrimaryForeground
                            ),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text("View", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        // 2. Metrics Grid
        item {
            Text(
                text = "SYSTEM OVERVIEW",
                color = DarkTextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MetricCard(title = "Total Jobs", value = "25", color = DarkTextPrimary, modifier = Modifier.weight(1f))
                    MetricCard(title = "Completed", value = "20", color = ColorSuccess, modifier = Modifier.weight(1f))
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MetricCard(title = "Waiting Embed", value = "3", color = Color(0xFF818CF8), modifier = Modifier.weight(1f))
                    MetricCard(title = "Waiting Sub", value = "1", color = ColorWarning, modifier = Modifier.weight(1f))
                    MetricCard(title = "Failed", value = "1", color = ColorError, modifier = Modifier.weight(1f))
                }
            }
        }

        // 3. Automation Actions
        item {
            Text(
                text = "AUTOMATION ACTIONS",
                color = DarkTextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        item {
            Surface(
                color = DarkSurface,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, DarkBorder, RoundedCornerShape(16.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Stage 1 — Scan Trending Now",
                        color = DarkTextPrimary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp
                    )
                    Text(
                        text = "Discover trending & upcoming releases from TMDB and queue new jobs.",
                        color = DarkTextSecondary,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp, bottom = 12.dp)
                    )
                    Button(
                        onClick = {
                            coroutineScope.launch {
                                isScanning = true
                                logTitle = "Stage 1 Scanner"
                                val res = apiService.runScan()
                                isScanning = false
                                actionLogs = res.getOrNull()?.logs ?: listOf(res.exceptionOrNull()?.message ?: "Error")
                            }
                        },
                        enabled = !isScanning && !isProcessing,
                        colors = ButtonDefaults.buttonColors(containerColor = DarkSurfaceVariant, contentColor = DarkTextPrimary),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (isScanning) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = OnFlixPrimary, strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                            Text("Scanning TMDB…", fontSize = 13.sp)
                        } else {
                            Icon(Icons.Filled.PlayArrow, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Run Scanner", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }

        item {
            Surface(
                color = DarkSurface,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, DarkBorder, RoundedCornerShape(16.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Stage 2 — Process Batch Now",
                        color = DarkTextPrimary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp
                    )
                    Text(
                        text = "Check playable embed video, fetch English SRT, translate to Sinhala and publish.",
                        color = DarkTextSecondary,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp, bottom = 12.dp)
                    )
                    Button(
                        onClick = {
                            coroutineScope.launch {
                                isProcessing = true
                                logTitle = "Stage 2 Batch Processor"
                                val res = apiService.runProcess()
                                isProcessing = false
                                actionLogs = res.getOrNull()?.logs ?: listOf(res.exceptionOrNull()?.message ?: "Error")
                            }
                        },
                        enabled = !isScanning && !isProcessing,
                        colors = ButtonDefaults.buttonColors(containerColor = DarkSurfaceVariant, contentColor = DarkTextPrimary),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (isProcessing) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = OnFlixPrimary, strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                            Text("Processing Cues…", fontSize = 13.sp)
                        } else {
                            Icon(Icons.Filled.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Run Processor", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }

        // 4. Action Logs Display
        if (actionLogs.isNotEmpty()) {
            item {
                Surface(
                    color = Color.Black,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(
                            text = logTitle,
                            color = OnFlixPrimary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(6.dp))
                        actionLogs.forEach { log ->
                            Text(text = log, color = DarkTextSecondary, fontSize = 11.sp, lineHeight = 16.sp)
                        }
                    }
                }
            }
        }

        // 5. Manual Process / Queue Card
        item {
            Text(
                text = "MANUAL DISPATCH",
                color = DarkTextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        item {
            Surface(
                color = DarkSurface,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, DarkBorder, RoundedCornerShape(16.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Process or Queue by TMDB ID",
                        color = DarkTextPrimary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp
                    )
                    Text(
                        text = "Add any movie or series directly to automation queue.",
                        color = DarkTextSecondary,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp, bottom = 12.dp)
                    )

                    OutlinedTextField(
                        value = manualTmdbId,
                        onValueChange = { manualTmdbId = it },
                        placeholder = { Text("TMDB ID (e.g. 293610)", color = DarkTextMuted, fontSize = 13.sp) },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = OnFlixPrimary,
                            unfocusedBorderColor = DarkBorder,
                            focusedContainerColor = DarkSurfaceVariant,
                            unfocusedContainerColor = DarkSurfaceVariant,
                            focusedTextColor = DarkTextPrimary,
                            unfocusedTextColor = DarkTextPrimary
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(Modifier.height(10.dp))

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = manualType == "movie",
                            onClick = { manualType = "movie" },
                            label = { Text("Movie") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = OnFlixPrimary,
                                selectedLabelColor = OnFlixPrimaryForeground,
                                containerColor = DarkSurfaceVariant,
                                labelColor = DarkTextSecondary
                            )
                        )
                        FilterChip(
                            selected = manualType == "tv",
                            onClick = { manualType = "tv" },
                            label = { Text("TV Show") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = OnFlixPrimary,
                                selectedLabelColor = OnFlixPrimaryForeground,
                                containerColor = DarkSurfaceVariant,
                                labelColor = DarkTextSecondary
                            )
                        )
                    }

                    if (manualType == "tv") {
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedTextField(
                                value = manualSeason,
                                onValueChange = { manualSeason = it },
                                label = { Text("Season") },
                                singleLine = true,
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(10.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = OnFlixPrimary,
                                    unfocusedBorderColor = DarkBorder
                                )
                            )
                            OutlinedTextField(
                                value = manualEpisode,
                                onValueChange = { manualEpisode = it },
                                label = { Text("Episode") },
                                singleLine = true,
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(10.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = OnFlixPrimary,
                                    unfocusedBorderColor = DarkBorder
                                )
                            )
                        }
                    }

                    Spacer(Modifier.height(14.dp))

                    Button(
                        onClick = {
                            val id = manualTmdbId.toLongOrNull() ?: return@Button
                            coroutineScope.launch {
                                manualLoading = true
                                val s = manualSeason.toIntOrNull() ?: 1
                                val e = manualEpisode.toIntOrNull() ?: 1
                                val res = apiService.queueManual(id, manualType, s, e)
                                manualLoading = false
                                manualMessage = res.getOrNull() ?: (res.exceptionOrNull()?.message ?: "Error")
                            }
                        },
                        enabled = manualTmdbId.isNotBlank() && !manualLoading,
                        colors = ButtonDefaults.buttonColors(containerColor = OnFlixPrimary, contentColor = OnFlixPrimaryForeground),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (manualLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = OnFlixPrimaryForeground, strokeWidth = 2.dp)
                        } else {
                            Text("Queue Title Now", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }

                    if (manualMessage.isNotBlank()) {
                        Spacer(Modifier.height(10.dp))
                        Text(text = manualMessage, color = OnFlixPrimary, fontSize = 12.sp, lineHeight = 16.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun MetricCard(
    title: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = DarkSurface,
        shape = RoundedCornerShape(14.dp),
        modifier = modifier.border(1.dp, DarkBorder, RoundedCornerShape(14.dp))
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(text = title, color = DarkTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
            Text(text = value, color = color, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
        }
    }
}
