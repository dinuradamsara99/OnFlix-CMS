package com.onflix.admin.ui.components

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onflix.admin.theme.*

@Composable
fun StatusBadge(status: String) {
    val (bgColor, textColor, label) = when (status.lowercase()) {
        "completed", "published" -> Triple(Color(0xFF064E3B), Color(0xFF34D399), "Completed")
        "waiting_embed" -> Triple(Color(0xFF312E81), Color(0xFF818CF8), "Awaiting Embed")
        "waiting_subtitle" -> Triple(Color(0xFF451A03), Color(0xFFFBBF24), "Awaiting Subtitle")
        "processing" -> Triple(Color(0xFF1E3A8A), Color(0xFF60A5FA), "Processing")
        "failed" -> Triple(Color(0xFF450A0A), Color(0xFFF87171), "Failed")
        "draft" -> Triple(Color(0xFF27272A), Color(0xFFA1A1AA), "Draft")
        "archived" -> Triple(Color(0xFF18181B), Color(0xFF71717A), "Archived")
        else -> Triple(DarkSurfaceVariant, DarkTextSecondary, status)
    }

    Surface(
        color = bgColor,
        shape = RoundedCornerShape(6.dp)
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}
