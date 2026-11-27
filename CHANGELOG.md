# 更新日志

## v1.63（versionCode 64）

发布日期：2026-11-28
构建产物：[`public/releases/paiban-rili-v1.63.apk`](./public/releases/paiban-rili-v1.63.apk)（8.7 MB，debug 签名）

### 新增：备忘录

- **左下角「备忘」按钮**：与右下角「AI 排班」对称，同款渐变配色与浮动动画。
- **备忘录面板**：支持添加、勾选完成、就地编辑（点击文字）、删除；数据保存在 `localStorage`（键 `scheduler.memos.v1`），重启不丢。
- **每条独立的小部件开关**：备忘条目右下角新增「小部件」开关，打开才同步到桌面小部件（新增条目默认打开）。

### 新增：备忘录桌面小部件（2×2）

- 与「排班日历」小部件同尺寸、同风格，最多显示 5 条。
- 状态标识：已完成 **🟢 + 灰字**，未完成 **🔴 + 黑字**。
- 标题 17sp、正文 16sp，全部加粗；行间距 4dp。
- 应用内增删改备忘后小部件立即刷新。

### 新增：点击小部件直达备忘录

- 点击备忘录小部件直接打开应用的备忘录面板，不再只是启动应用。
- 冷启动读持久化目标，热启动走 `onNewIntent` 实时派发，两条路径都覆盖。

### 修复与调整

- 移除尝试用组合长划线（U+0336）模拟删除线的实现：华文幼圆字体缺该字形，渲染成方块乱码。
- 备忘文字恢复使用幼圆字体，与标题、角标风格统一。

### 涉及文件

**新增**

| 文件 | 说明 |
|------|------|
| `src/components/MemoPanel.tsx` | 备忘录面板组件 |
| `android/app/src/main/java/com/pbrili/MemoWidgetProvider.java` | 备忘录小部件渲染 |
| `android/app/src/main/res/layout/widget_memo.xml` | 小部件布局（5 行） |
| `android/app/src/main/res/xml/widget_memo_info.xml` | 小部件 2×2 尺寸配置 |
| `public/releases/paiban-rili-v1.63.apk` | 本版构建产物 |

**修改**

| 文件 | 变更 |
|------|------|
| `src/App.tsx` | 备忘录状态提升为全局、同步小部件、小部件点击跳转、浮层防重复 |
| `src/types.ts` | 新增 `Memo` 类型 |
| `src/lib/storage.ts` | 新增 `loadMemos` / `saveMemos` |
| `src/lib/widget.ts` | 新增 `saveMemos` 桥接、`consumeOpenTarget` 读取跳转目标 |
| `src/styles.css` | 左下角按钮、备忘录面板、开关样式 |
| `android/app/src/main/java/com/pbrili/CalendarWidgetPlugin.java` | 新增 `saveMemos`、`consumeOpenTarget` 方法 |
| `android/app/src/main/java/com/pbrili/MainActivity.java` | 处理小部件跳转 intent（冷/热启动） |
| `android/app/src/main/AndroidManifest.xml` | 注册 `MemoWidgetProvider` |
| `android/app/src/main/res/values/strings.xml` | 新增小部件描述文案 |
| `android/app/build.gradle` | versionCode 53 → 64，versionName 1.52 → 1.63 |
| `README.md` | 版本说明同步 |
| `public/download.html` | 下载版本指向新构建 |

### 从 v1.52 升级

覆盖安装即可，排班、设置、对话历史等本地数据保留。备忘录为新增功能，首次使用为空列表。

---

## v1.52（versionCode 53）

上一版基线：日历排班、AI 对话排班、深度思考、两个桌面小部件（排班日历 2×2、今明班次 2×1）、班次提醒。
