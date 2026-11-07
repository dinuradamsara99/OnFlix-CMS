# OnFlix Admin — Native Android Mobile App (Kotlin & Jetpack Compose)

A clean, modern, responsive native Android Admin application for the **OnFlix** streaming and subtitle automation platform.

Built with **Kotlin 2.0+**, **Jetpack Compose (Material 3)**, **Coroutines**, and **Ktor Client**.

---

## 📱 Features Included

1. **Dashboard & Metrics (Overview):**
   - Real-time job counters (`Total`, `Completed`, `Awaiting Embed`, `Awaiting Subtitle`, `Failed`).
   - Pending User Requests alert banner with 1-click navigation.
   - Stage 1: **Scan Trending Now** (trigger TMDB scanner).
   - Stage 2: **Process Batch Now** (trigger embed verification, English SRT fetch, Gemini translation & publish).
   - Live action logs display.
   - **Manual Title Dispatch**: Process or queue any title by TMDB ID, media type (Movie / TV Show), Season & Episode.

2. **OnFlix AI Co-Pilot (Mobile Assistant):**
   - Native chat interface matching ChatGPT/Claude UX.
   - Full bilingual support: Natural spoken Sinhala and English.
   - Quick action chips: *Subtitles නැති films මොනවද?*, *Health report*, *Top 10 auto-curate*, *Fulfill requests*.
   - Auto-failover backend connection (Groq -> GitHub Models -> OpenRouter).

3. **User Title Requests:**
   - Review pending movie/show requests submitted by OnFlix users.
   - Search requested titles.
   - 1-click **"Approve & Queue"** into subtitle automation.
   - Reject unwanted requests.
   - **"Fulfill All"** batch queueing.

4. **Content Library Management:**
   - Filter by All, Movies, TV Shows.
   - Search by title or OnFlix ID.
   - Toggle publication status: **Publish / Unpublish (Draft)**.
   - Hero Slider status indicator.
   - Delete titles with live confirmation.

5. **On-Device Subtitle Translation Engine (`NativeSubtitleEngine.kt`):**
   - Direct SRT parser and cue segmenter.
   - Direct connection to Gemini REST API (`gemini-2.0-flash` multi-key pool).
   - Parallel batch translation of dialogue into natural spoken Sinhala without altering timestamps.
   - Reassembles clean `.srt` files right on the device.

6. **Settings & Configurations:**
   - Server Base URL & Admin Secret (`CRON_SECRET`).
   - Direct Gemini API keys multi-pool.
   - SubDL API key.
   - Instant "Test Connection" button.

---

## 🎨 Design System
- **Background**: `#0B0E11`
- **Surface / Card**: `#13161A`
- **Surface Variant**: `#1A1E24`
- **Border**: `#22262E`
- **Primary / Accent**: `#4CDCDD` (OnFlix Cyan)
- **Typography**: Clean, responsive layout with native Sinhala Unicode font rendering.
- **Strict Clean Design**: No glows, no heavy shadows, no decorative borders.

---

## ☁️ How to Build the APK in the Cloud (Free via GitHub Actions)

Since you don't have Android Studio / Kotlin installed on your local PC right now, you can build the APK directly in the cloud:

1. **Push this repository to GitHub:**
   ```bash
   git add .
   git commit -m "Add OnFlix Native Kotlin Android App"
   git push origin main
   ```
2. **Go to your GitHub Repository:**
   - Click on the **"Actions"** tab.
   - You will see the workflow named **"Build OnFlix Android Admin APK"**.
   - It will automatically run on push, or you can click **"Run workflow"**.
3. **Download your APK:**
   - When the build finishes (takes ~2 minutes), scroll down to the **"Artifacts"** section.
   - Click on **`onflix-admin-debug-apk`** to download the ready-to-install `.apk` file directly to your phone!

---

## 💻 Local Build (If using Android Studio later)

1. Open Android Studio -> **Open Project** -> Select the `android-app` folder.
2. Allow Gradle to sync dependencies.
3. Click **Run 'app'** or **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**.
