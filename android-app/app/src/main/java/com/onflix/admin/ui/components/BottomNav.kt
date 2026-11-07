package com.onflix.admin.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.onflix.admin.theme.*

enum class NavigationTab(
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    OVERVIEW("Overview", Icons.Filled.Dashboard, Icons.Outlined.Dashboard),
    REQUESTS("Requests", Icons.Filled.Notifications, Icons.Outlined.Notifications),
    CONTENT("Content", Icons.Filled.Movie, Icons.Outlined.Movie),
    COPILOT("Co-Pilot", Icons.Filled.SmartToy, Icons.Outlined.SmartToy),
    SETTINGS("Settings", Icons.Filled.Settings, Icons.Outlined.Settings)
}

@Composable
fun BottomNav(
    currentTab: NavigationTab,
    onTabSelected: (NavigationTab) -> Unit,
    pendingRequestsCount: Int = 0
) {
    NavigationBar(
        containerColor = DarkSurface,
        tonalElevation = 0.dp,
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
    ) {
        NavigationTab.entries.forEach { tab ->
            val isSelected = currentTab == tab
            NavigationBarItem(
                selected = isSelected,
                onClick = { onTabSelected(tab) },
                icon = {
                    BadgedBox(
                        badge = {
                            if (tab == NavigationTab.REQUESTS && pendingRequestsCount > 0) {
                                Badge(
                                    containerColor = OnFlixPrimary,
                                    contentColor = OnFlixPrimaryForeground
                                ) {
                                    Text(pendingRequestsCount.toString())
                                }
                            }
                        }
                    ) {
                        Icon(
                            imageVector = if (isSelected) tab.selectedIcon else tab.unselectedIcon,
                            contentDescription = tab.label
                        )
                    }
                },
                label = { Text(tab.label) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = OnFlixPrimaryForeground,
                    selectedTextColor = OnFlixPrimary,
                    indicatorColor = OnFlixPrimary,
                    unselectedIconColor = DarkTextSecondary,
                    unselectedTextColor = DarkTextSecondary
                )
            )
        }
    }
}
