package com.onflix.admin.ui.screens.content

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onflix.admin.data.model.ContentItem
import com.onflix.admin.theme.*
import com.onflix.admin.ui.components.StatusBadge

@Composable
fun ContentScreen() {
    var searchQuery by remember { mutableStateOf("") }
    var selectedFilter by remember { mutableStateOf("all") }

    var contentList by remember {
        mutableStateOf(
            listOf(
                ContentItem(id = 50, title = "Hope", type = "movie", tmdb_id = 2234932, release_year = 2026, rating = 8.4, featured = true, status = "published", sinhala_subtitle_url = "https://supabase..."),
                ContentItem(id = 48, title = "The Remarried Empress", type = "tv_show", tmdb_id = 279246, release_year = 2026, rating = 8.19, featured = true, status = "published"),
                ContentItem(id = 47, title = "Doctor X: Mafia in White", type = "tv_show", tmdb_id = 293610, release_year = 2026, rating = 9.0, featured = false, status = "published"),
                ContentItem(id = 46, title = "Final Table", type = "tv_show", tmdb_id = 316702, release_year = 2026, rating = 8.5, featured = false, status = "published")
            )
        )
    }

    val filtered = contentList.filter {
        val matchesType = when (selectedFilter) {
            "movie" -> it.type == "movie"
            "tv_show" -> it.type == "tv_show"
            else -> true
        }
        val matchesQuery = it.title.contains(searchQuery, ignoreCase = true) || it.id.toString() == searchQuery
        matchesType && matchesQuery
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp)
    ) {
        Text(
            text = "Content Library",
            color = DarkTextPrimary,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Manage movies, TV shows, publication status and hero slider.",
            color = DarkTextSecondary,
            fontSize = 12.sp,
            modifier = Modifier.padding(bottom = 12.dp)
        )

        // Search Bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search by title or OnFlix ID…", color = DarkTextMuted, fontSize = 13.sp) },
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

        Spacer(Modifier.height(10.dp))

        // Filter Chips
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("all" to "All", "movie" to "Movies", "tv_show" to "TV Shows").forEach { (type, label) ->
                FilterChip(
                    selected = selectedFilter == type,
                    onClick = { selectedFilter = type },
                    label = { Text(label, fontSize = 12.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = OnFlixPrimary,
                        selectedLabelColor = OnFlixPrimaryForeground,
                        containerColor = DarkSurface,
                        labelColor = DarkTextSecondary
                    ),
                    shape = RoundedCornerShape(20.dp)
                )
            }
        }

        Spacer(Modifier.height(14.dp))

        // Items List
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(filtered, key = { it.id }) { item ->
                Surface(
                    color = DarkSurface,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, DarkBorder, RoundedCornerShape(14.dp))
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(
                                    text = item.title,
                                    color = DarkTextPrimary,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 15.sp
                                )
                                if (item.featured) {
                                    Surface(color = Color(0xFF451A03), shape = RoundedCornerShape(4.dp)) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                        ) {
                                            Icon(Icons.Filled.Star, contentDescription = null, tint = ColorWarning, modifier = Modifier.size(10.dp))
                                            Text("Slider", color = ColorWarning, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                            StatusBadge(item.status)
                        }

                        Spacer(Modifier.height(4.dp))

                        Text(
                            text = "ID: ${item.id} • TMDB: ${item.tmdb_id} • ${if (item.type == "movie") "Movie" else "TV Show"} • ${item.release_year ?: "N/A"} • Rating: ★ ${item.rating ?: 0.0}",
                            color = DarkTextSecondary,
                            fontSize = 12.sp
                        )

                        Spacer(Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextButton(
                                onClick = {
                                    val newStatus = if (item.status == "published") "draft" else "published"
                                    contentList = contentList.map { if (it.id == item.id) it.copy(status = newStatus) else it }
                                },
                                contentPadding = PaddingValues(0.dp)
                            ) {
                                Text(
                                    text = if (item.status == "published") "Unpublish (Draft)" else "Publish",
                                    color = OnFlixPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }

                            IconButton(
                                onClick = {
                                    contentList = contentList.filter { it.id != item.id }
                                }
                            ) {
                                Icon(Icons.Filled.Delete, contentDescription = "Delete", tint = ColorError, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}
