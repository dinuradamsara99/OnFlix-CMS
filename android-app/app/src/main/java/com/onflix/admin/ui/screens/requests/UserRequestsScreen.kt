package com.onflix.admin.ui.screens.requests

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onflix.admin.data.api.OnFlixApiService
import com.onflix.admin.data.model.UserRequest
import com.onflix.admin.theme.*
import kotlinx.coroutines.launch

@Composable
fun UserRequestsScreen(apiService: OnFlixApiService) {
    val coroutineScope = rememberCoroutineScope()
    var searchQuery by remember { mutableStateOf("") }
    var isBatchProcessing by remember { mutableStateOf(false) }

    // Mock initial list of requests (in live app loads from Supabase / API)
    var requests by remember {
        mutableStateOf(
            listOf(
                UserRequest(id = 1, tmdb_id = 1321179, media_type = "movie", title = "King's Warden", year = "2026", status = "pending"),
                UserRequest(id = 2, tmdb_id = 939243, media_type = "movie", title = "Sonic the Hedgehog 3", year = "2024", status = "pending")
            )
        )
    }

    val filtered = requests.filter { it.title.contains(searchQuery, ignoreCase = true) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp)
    ) {
        // Header with Batch Fulfill
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "User Title Requests",
                    color = DarkTextPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${filtered.size} pending reviews from OnFlix users",
                    color = DarkTextSecondary,
                    fontSize = 12.sp
                )
            }
            Button(
                onClick = {
                    coroutineScope.launch {
                        isBatchProcessing = true
                        apiService.queueManual(0, "all") // Triggers auto_fulfill
                        isBatchProcessing = false
                        requests = emptyList()
                    }
                },
                enabled = requests.isNotEmpty() && !isBatchProcessing,
                colors = ButtonDefaults.buttonColors(containerColor = OnFlixPrimary, contentColor = OnFlixPrimaryForeground),
                shape = RoundedCornerShape(10.dp)
            ) {
                if (isBatchProcessing) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), color = OnFlixPrimaryForeground, strokeWidth = 2.dp)
                } else {
                    Text("Fulfill All", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(Modifier.height(14.dp))

        // Search Bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search requested titles…", color = DarkTextMuted, fontSize = 13.sp) },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, tint = DarkTextMuted) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = OnFlixPrimary,
                unfocusedBorderColor = DarkBorder,
                focusedContainerColor = DarkSurface,
                unfocusedContainerColor = DarkSurface,
                focusedTextColor = DarkTextPrimary,
                unfocusedTextColor = DarkTextPrimary
            )
        )

        Spacer(Modifier.height(14.dp))

        // Request Items List
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(filtered, key = { it.id }) { req ->
                Surface(
                    color = DarkSurface,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, DarkBorder, RoundedCornerShape(14.dp))
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = req.title,
                                color = DarkTextPrimary,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 15.sp
                            )
                            Text(
                                text = "TMDB ID: ${req.tmdb_id} • ${req.media_type.uppercase()} • ${req.year ?: "N/A"}",
                                color = DarkTextSecondary,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(top = 2.dp)
                            )
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            IconButton(
                                onClick = {
                                    coroutineScope.launch {
                                        apiService.queueManual(req.tmdb_id, req.media_type)
                                        requests = requests.filter { it.id != req.id }
                                    }
                                },
                                colors = IconButtonDefaults.iconButtonColors(containerColor = DarkSurfaceVariant)
                            ) {
                                Icon(Icons.Filled.Check, contentDescription = "Queue & Approve", tint = ColorSuccess, modifier = Modifier.size(18.dp))
                            }
                            IconButton(
                                onClick = {
                                    requests = requests.filter { it.id != req.id }
                                },
                                colors = IconButtonDefaults.iconButtonColors(containerColor = DarkSurfaceVariant)
                            ) {
                                Icon(Icons.Filled.Close, contentDescription = "Reject", tint = ColorError, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }

            if (filtered.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(top = 40.dp), contentAlignment = Alignment.Center) {
                        Text("No pending requests found.", color = DarkTextMuted, fontSize = 14.sp)
                    }
                }
            }
        }
    }
}
