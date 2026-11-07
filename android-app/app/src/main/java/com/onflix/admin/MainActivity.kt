package com.onflix.admin

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.onflix.admin.data.api.OnFlixApiService
import com.onflix.admin.theme.DarkBackground
import com.onflix.admin.theme.OnFlixAdminTheme
import com.onflix.admin.ui.components.BottomNav
import com.onflix.admin.ui.components.NavigationTab
import com.onflix.admin.ui.components.TopBar
import com.onflix.admin.ui.screens.content.ContentScreen
import com.onflix.admin.ui.screens.copilot.CopilotScreen
import com.onflix.admin.ui.screens.overview.OverviewScreen
import com.onflix.admin.ui.screens.requests.UserRequestsScreen
import com.onflix.admin.ui.screens.settings.SettingsScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val prefs = getSharedPreferences("onflix_admin_prefs", Context.MODE_PRIVATE)
        val baseUrl = prefs.getString("base_url", "https://onflixlk.vercel.app") ?: "https://onflixlk.vercel.app"
        val secretKey = prefs.getString("secret_key", "") ?: ""

        val apiService = OnFlixApiService(baseUrl, secretKey)

        setContent {
            OnFlixAdminTheme {
                var currentTab by remember { mutableStateOf(NavigationTab.OVERVIEW) }
                val pendingRequestsCount by remember { mutableIntStateOf(2) }

                Scaffold(
                    containerColor = DarkBackground,
                    topBar = {
                        TopBar(
                            title = "ONFLIX",
                            subtitle = when (currentTab) {
                                NavigationTab.OVERVIEW -> "Subtitle Automation & Streaming Admin"
                                NavigationTab.REQUESTS -> "Pending User Title Requests"
                                NavigationTab.CONTENT -> "Content Library Management"
                                NavigationTab.COPILOT -> "OnFlix AI Co-Pilot Assistant"
                                NavigationTab.SETTINGS -> "Admin Configuration & Keys"
                            }
                        )
                    },
                    bottomBar = {
                        BottomNav(
                            currentTab = currentTab,
                            onTabSelected = { currentTab = it },
                            pendingRequestsCount = pendingRequestsCount
                        )
                    }
                ) { innerPadding ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    ) {
                        when (currentTab) {
                            NavigationTab.OVERVIEW -> OverviewScreen(
                                apiService = apiService,
                                onNavigateToRequests = { currentTab = NavigationTab.REQUESTS },
                                pendingRequestsCount = pendingRequestsCount
                            )
                            NavigationTab.REQUESTS -> UserRequestsScreen(apiService = apiService)
                            NavigationTab.CONTENT -> ContentScreen()
                            NavigationTab.COPILOT -> CopilotScreen(apiService = apiService)
                            NavigationTab.SETTINGS -> SettingsScreen(apiService = apiService)
                        }
                    }
                }
            }
        }
    }
}
