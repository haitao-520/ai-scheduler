# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[User Instruction Summary]
- Date: 2026-09-11
- Context: Mentioned after a series of UI tweaks for the ai-scheduler app
- Instructions:
  - By default, only edit code when asked; do NOT run any build (typecheck/build/cap sync/gradlew/APK packaging) automatically.
  - Run the build only when the user explicitly asks to build.

[User Instruction Summary]
- Date: 2026-09-12
- Context: Mentioned while iterating on the Android widget
- Instructions:
  - Every time an APK is built, bump the app version number by 0.01 (e.g. 1.0 -> 1.01 -> 1.02), and increment `versionCode` in `android/app/build.gradle` accordingly.

[Project Knowledge Summary]
- Date: 2026-09-11
- Context: Discovered by Agent while deploying the Android build environment for the ai-scheduler project
- Category: Environment Configuration
- Instructions:
  - JDK: OpenJDK 17 at `/usr/lib/jvm/java-17-openjdk-amd64` (installed via apt)
  - Android SDK: `/opt/android-sdk` (cmdline-tools/latest, platform-tools, platforms;android-34, build-tools;34.0.0)
  - Environment variables are persisted in `/etc/profile.d/android-sdk.sh` (JAVA_HOME, ANDROID_HOME, ANDROID_SDK_ROOT, PATH). New shells must `source /etc/profile.d/android-sdk.sh` or set them explicitly.
  - This is a headless Linux (Debian 12) container. No Android emulator/AVD is available, so APK build works but on-device UI testing must be done on a real device/emulator outside this environment.

[Project Knowledge Summary]
- Date: 2026-09-11
- Context: Discovered by Agent while building the ai-scheduler Android app
- Category: Build Methods
- Instructions:
  - Web/TypeScript typecheck: `npm run typecheck`; production web build: `npm run build` (outputs `dist/`)
  - After changing web code, sync assets into the Android project with `npx cap sync android`
  - Build debug APK: `cd /workspace/android && ./gradlew assembleDebug`
  - APK output: `/workspace/android/app/build/outputs/apk/debug/app-debug.apk`
  - Gradle/Java commands must run through the managed background terminal (see background-terminal-resource-limits rule), not the normal bash tool.
  - DeepSeek API is called directly from the client. Web dev uses the Vite proxy `/deepseek-proxy` -> `https://api.deepseek.com`; Android uses `CapacitorHttp` to avoid CORS. The API Key is user-supplied at runtime and stored only in localStorage.
  - AI thinking mode: when `Settings.thinking` is true, the request body adds `thinking: { type: 'enabled' }`, `reasoning_effort` (low/medium/high) and `max_tokens: 8192`; the model's chain-of-thought is read from `message.reasoning_content` and shown in a collapsible "已深度思考" block. Reasoning content must NOT be sent back in multi-turn history (only `role` + `content` are sent). When thinking is off, send `temperature: 0.2` instead (reasoning models reject temperature).
  - APK download page is served from `public/download.html`, with the APK copied to `public/app-debug.apk`. `vite.config.ts` sets `build.copyPublicDir: false` so these download assets are served in dev preview but excluded from the production build / Capacitor sync.
  - After rebuilding the APK, re-copy it with `cp /workspace/android/app/build/outputs/apk/debug/app-debug.apk /workspace/public/app-debug.apk` to refresh the download page.

[Project Knowledge Summary]
- Date: 2026-09-12
- Context: Discovered by Agent while building the Android home-screen widgets
- Category: Troubleshooting & Debugging
- Instructions:
  - RemoteViews rejects reflection-based actions such as `views.setInt(id, "setBackgroundColor", ...)`: the whole RemoteViews becomes invalid and the launcher silently falls back to the previous/minimal layout. Use only supported direct methods (`setTextViewText`, `setTextColor`, `setImageViewResource`, `setViewVisibility`, `setOnClickPendingIntent`).
  - Custom `@drawable` backgrounds and bundled `@font` resources DO work in this widget; `layout_weight` and `setViewVisibility(GONE)` on weighted rows also work.
  - Widget cell count is derived from `minWidth`/`minHeight` via `cells = (dp + 30) / 70`; use 110dp for 2 columns/rows, 40dp for 1 row.

[Project Knowledge Summary]
- Date: 2026-09-12
- Context: Discovered by Agent while generating cute widget backgrounds
- Category: Build Methods
- Instructions:
  - Pillow was installed for image generation with `pip install --break-system-packages pillow`.
  - Cute Chinese font bundled at `android/app/src/main/res/font/zcool_kuaile.ttf` (ZCOOL KuaiLe / 站酷快乐体, OFL), referenced as `@font/zcool_kuaile` in widget layouts.
  - Widget background PNGs (`widget_fur1.png` square, `widget_fur2.png` wide) are white→brown vertical gradient rounded rects with a fur edge, generated by a Pillow script.
