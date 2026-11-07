package com.onflix.admin.ui.screens.copilot

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onflix.admin.data.api.OnFlixApiService
import com.onflix.admin.data.model.CopilotMessage
import com.onflix.admin.data.model.CopilotMessagePayload
import com.onflix.admin.theme.*
import kotlinx.coroutines.launch
import java.util.UUID

@Composable
fun CopilotScreen(apiService: OnFlixApiService) {
    val coroutineScope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    var messages by remember {
        mutableStateOf(
            listOf(
                CopilotMessage(
                    id = UUID.randomUUID().toString(),
                    role = "assistant",
                    content = "ආයුබෝවන්! මම OnFlix Co-Pilot AI සහායකයා. OnFlix හි Content, Subtitles, Top 10 සහ Automation පිළිබඳව ඕනෑම දෙයක් සිංහලෙන් හෝ English වලින් විමසන්න."
                )
            )
        )
    }
    var inputText by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val quickActions = listOf(
        "Subtitles නැති films මොනවද?" to "Subtitles නැති films මොනවද?",
        "Health report එකක් දෙන්න" to "get_health_report",
        "Top 10 curate කරන්න" to "auto_curate_top_ten highest rating",
        "Hero Slider update කරන්න" to "auto_curate_hero_slider",
        "Pending requests fulfill කරන්න" to "auto_fulfill_requests"
    )

    fun send(prompt: String) {
        if (prompt.isBlank() || isLoading) return
        val userMsg = CopilotMessage(id = UUID.randomUUID().toString(), role = "user", content = prompt.trim())
        messages = messages + userMsg
        inputText = ""
        isLoading = true
        errorMessage = null

        coroutineScope.launch {
            listState.animateScrollToItem(messages.size)
            val historyPayload = messages.takeLast(8).map {
                CopilotMessagePayload(role = it.role, content = it.content)
            }
            val res = apiService.sendCopilotMessage(historyPayload)
            isLoading = false
            res.onSuccess { response ->
                messages = messages + CopilotMessage(
                    id = UUID.randomUUID().toString(),
                    role = "assistant",
                    content = response.content
                )
            }.onFailure { err ->
                errorMessage = err.message ?: "Failed to connect to AI Co-Pilot"
            }
            listState.animateScrollToItem(messages.size)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
    ) {
        // Chat Messages
        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            items(messages, key = { it.id }) { msg ->
                val isUser = msg.role == "user"
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = if (isUser) Alignment.End else Alignment.Start
                ) {
                    if (!isUser) {
                        Text(
                            text = "ONFLIX ASSISTANT",
                            color = DarkTextMuted,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            modifier = Modifier.padding(bottom = 4.dp, start = 4.dp)
                        )
                    }
                    Surface(
                        color = if (isUser) DarkSurfaceVariant else DarkSurface,
                        shape = RoundedCornerShape(
                            topStart = 16.dp,
                            topEnd = 16.dp,
                            bottomStart = if (isUser) 16.dp else 4.dp,
                            bottomEnd = if (isUser) 4.dp else 16.dp
                        ),
                        modifier = Modifier
                            .fillMaxWidth(if (isUser) 0.85f else 0.95f)
                            .border(1.dp, DarkBorder, RoundedCornerShape(16.dp))
                    ) {
                        Text(
                            text = msg.content,
                            color = DarkTextPrimary,
                            fontSize = 15.sp,
                            lineHeight = 23.sp,
                            modifier = Modifier.padding(14.dp)
                        )
                    }
                }
            }

            if (isLoading) {
                item {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = OnFlixPrimary, strokeWidth = 2.dp)
                        Text(text = "Co-Pilot සිතමින් පවතී…", color = DarkTextSecondary, fontSize = 13.sp)
                    }
                }
            }

            if (errorMessage != null) {
                item {
                    Surface(
                        color = Color(0xFF450A0A),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = errorMessage ?: "",
                            color = Color(0xFFFCA5A5),
                            fontSize = 12.sp,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }
        }

        // Quick Actions Scroll Row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            quickActions.forEach { (label, prompt) ->
                SuggestionChip(
                    onClick = { send(prompt) },
                    label = { Text(label, fontSize = 12.sp, color = DarkTextPrimary) },
                    colors = SuggestionChipDefaults.suggestionChipColors(containerColor = DarkSurface),
                    border = SuggestionChipDefaults.suggestionChipBorder(borderColor = DarkBorder, enabled = true),
                    shape = RoundedCornerShape(20.dp)
                )
            }
        }

        // Bottom Input Area
        Surface(
            color = DarkSurface,
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    placeholder = {
                        Text(
                            "සිංහලෙන් හෝ English වලින් විමසන්න…",
                            color = DarkTextMuted,
                            fontSize = 14.sp
                        )
                    },
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent,
                        focusedTextColor = DarkTextPrimary,
                        unfocusedTextColor = DarkTextPrimary
                    ),
                    modifier = Modifier.weight(1f),
                    maxLines = 4
                )

                IconButton(
                    onClick = { send(inputText) },
                    enabled = inputText.isNotBlank() && !isLoading,
                    colors = IconButtonDefaults.iconButtonColors(
                        containerColor = OnFlixPrimary,
                        contentColor = OnFlixPrimaryForeground,
                        disabledContainerColor = DarkSurfaceVariant,
                        disabledContentColor = DarkTextMuted
                    )
                ) {
                    Icon(
                        imageVector = Icons.Filled.ArrowUpward,
                        contentDescription = "Send",
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}
