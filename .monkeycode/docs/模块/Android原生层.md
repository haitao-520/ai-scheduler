# Android 原生层

原生层是 Capacitor 生成的安卓工程，承担 WebView 容器、返回键处理、以及两个桌面小部件的渲染。它不参与排班业务计算，只做数据落盘与小部件展示。

## 结构

```
android/
├── variables.gradle                       # SDK 与依赖版本
├── settings.gradle                        # 模块与 Capacitor 设置
└── app/
    ├── build.gradle                       # 应用 id、versionCode/versionName
    └── src/main/
        ├── AndroidManifest.xml            # Activity、Provider、插件权限
        ├── java/com/pbrili/
        │   ├── MainActivity.java          # 容器、状态栏、返回键
        │   ├── CalendarWidgetPlugin.java  # JS 到原生的数据桥
        │   ├── CalendarWidgetProvider.java# 2×2 日历小部件
        │   └── ShiftWidgetProvider.java   # 2×1 今明班次小部件
        └── res/
            ├── layout/                    # 小部件布局
            ├── drawable/                  # 小部件背景（圆角 + 描边）
            ├── font/huangyou.ttf          # 站酷庆科黄油体
            └── xml/                       # appwidget-provider 定义
```

## 关键文件

| 文件 | 目的 |
|------|------|
| `MainActivity.java` | 注册 `CalendarWidgetPlugin`；透明状态栏；覆写 `onBackPressed` 让返回键优先回退 WebView 历史 |
| `CalendarWidgetPlugin.java` | `save` 写入 `SharedPreferences` 并触发两个 Provider 刷新；`getStatus` 读取诊断日志 |
| `CalendarWidgetProvider.java` | 静态 6×7 网格日历小部件，含时段配色与班/休角标 |
| `ShiftWidgetProvider.java` | 今明两天的班次文本条，按开始时间分色 |
| `widget_calendar.xml` | 日历小部件布局，固定 id `w_cell_N` / `w_badge_N` / `w_row_N` |
| `widget_shifts.xml` | 今明班次布局，两个 `TextView` 各占一半高度 |

## 依赖

**本模块依赖**

- Capacitor Android（`com.getcapacitor.*`）
- Android AppWidget / `RemoteViews` / `SharedPreferences`
- `org.json` 解析 Web 层传入的 JSON
- `variables.gradle` 中的 SDK 版本与 AndroidX 依赖

**依赖本模块的**

- Web 层经 `src/lib/widget.ts` 调用 `CalendarWidget` 插件
- 系统 Launcher 托管并渲染两个 AppWidget

## 规范

### 文件命名

- Provider 以 `WidgetProvider` 结尾，插件以 `Plugin` 结尾
- 布局文件使用小写下划线，如 `widget_calendar.xml`

### 代码模式

小部件布局采用**静态固定 id 网格**，渲染时按索引填值，避免运行时增删视图：

```java
for (int index = 0; index < CELL_IDS.length; index++) {
    views.setTextViewText(CELL_IDS[index], String.valueOf(day));
    views.setTextColor(CELL_IDS[index], color);
}
```

整行可见性用 `setViewVisibility` 切换，不用反射方法。

### 错误处理

- `CalendarWidgetProvider.updateWidget` 用 `try/catch(Throwable)` 包裹渲染，失败时回退到 `widget_min` 最小布局并写入诊断日志
- `ShiftWidgetProvider.updateWidget` 渲染失败时静默处理，避免拖垮桌面
- 日期/时间解析失败返回安全默认值

### 测试

项目未配置 Android 单元/仪器测试。

## 重要约束

### RemoteViews 只调用受支持的方法

反射式调用（如 `views.setInt(id, "setBackgroundColor", color)`）会导致整个 `RemoteViews` 失效，小部件静默回退。可用的方法包括 `setTextViewText`、`setTextColor`、`setViewVisibility`、`setOnClickPendingIntent`。

### 尺寸换算

appwidget 的 `minWidth` / `minHeight` 与桌面格数换算约为 `cells = (dp + 30) / 70`。2 列/行用 110dp，1 行用 40dp；`targetCellWidth` / `targetCellHeight` 为 Android 12+ 的显式格数声明。

### 版本号

每次发布 APK 递增 `android/app/build.gradle` 的 `versionCode`（+1）与 `versionName`（+0.01）。

## 添加新 Provider

1. 按 `widget_shifts` 的最小实现创建布局、`widget_xxx_info.xml` 与 `XxxWidgetProvider.java`
2. 在 `AndroidManifest.xml` 注册 `receiver` 并声明 `appwidget-provider` 元数据
3. 如需 JS 触发刷新，在 `CalendarWidgetPlugin.save` 中调用其 `updateAll(context)`
4. 构建安装后删除旧小部件再重新添加

**检查清单**

- [ ] 布局只使用固定 id，渲染只用受支持方法
- [ ] `appwidget-provider` 尺寸与目标格数匹配
- [ ] `./gradlew :app:compileDebugJavaWithJavac` 通过
- [ ] 真机删除旧小部件后重新添加验证渲染
