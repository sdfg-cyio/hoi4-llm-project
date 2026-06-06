# HOI4 LLM Newspaper — 钢铁雄心4 AI 新闻生成器

基于大语言模型的 HOI4 动态新闻系统。监听存档变化，自动检测游戏事件，以多种报纸风格生成新闻报道，写入 Mod 本地化文件，在游戏内以 GUI 报纸界面呈现。

## 目录

- [功能概览](#功能概览)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [架构与数据流](#架构与数据流)
- [模块接口文档](#模块接口文档)
- [API 接口](#api-接口)
- [配置说明](#配置说明)
- [报纸风格体系](#报纸风格体系)
- [制作扩展风格](#制作扩展风格)
- [HOI4 Mod 结构](#hoi4-mod-结构)
- [常见问题](#常见问题)

---

## 功能概览

- **存档监听**：自动检测 HOI4 存档变化，解析领土变更、战斗、外交、科技等事件
- **差异对比**：对比新旧存档，提取国策完成、领土易手、战役胜负、战争目标、条约签署等
- **LLM 生成新闻**：调用大语言模型，以不同报纸风格生成新闻报道（支持 DeepSeek / OpenAI / SiliconFlow / OpenRouter / 自定义 API）
- **多风格报纸**：7 种内置风格（4 种国内报纸 + 3 种国际通讯社），每种有独立 Prompt 模板
- **双语输出**：支持中文 / 英文输出，自动选择对应 Prompt、yml 路径和日期格式
- **游戏内展示**：新闻写入 Mod yml 文件，通过 GUI 界面在游戏内以报纸形式展示
- **Web 控制台**：浏览器配置 LLM 参数、报纸风格、路径、监听国家，实时查看日志和新闻历史
- **模板系统**：支持 Submod 模板导入，可扩展新报纸风格
- **写入提醒**：新闻写入后 Web 控制台发出提示音，显示需要执行的 reload 指令
- **即插即用**：内置 node.exe，双击 `start.bat` 即可运行，无需安装 Node.js

---

## 快速开始

### 方式一：即插即用（推荐）

1. 下载发行包并解压
2. 双击 `start.bat`
3. 浏览器打开 `http://localhost:3000`
4. 在 Web 控制台中配置 API Key 和路径
5. 点击「启动监听」，开始玩 HOI4

### 方式二：从源码运行

#### 环境要求

- [Node.js](https://nodejs.org) 18+（或使用项目内置的 `node.exe`）
- HOI4 钢铁雄心4（任何支持 Mod 的版本）
- 大语言模型 API Key（DeepSeek / OpenAI / 兼容接口）

#### 安装

```bash
git clone https://github.com/sdfg-cyio/hoi4-llm-project.git
cd hoi4-llm-project
npm install
```

#### 配置

1. 启动程序：
   ```bash
   start.bat
   ```
   或手动运行：
   ```bash
   node watcher.mjs
   ```

2. 打开浏览器访问 `http://localhost:3000`

4. 在 Web 控制台中配置：
   - **LLM 设置**：选择供应商、填入 API Key、选择模型
   - **路径设置**：
     - HOI4 安装目录（如 `C:\Program Files\Steam\steamapps\common\Hearts of Iron IV`）
     - 存档目录（如 `C:\Users\...\Documents\Paradox Interactive\Hearts of Iron IV\save games`）
     - Mod 目录（指向 `hoi4_newspaper` 模组根目录，如 `C:\Users\...\Documents\Paradox Interactive\Hearts of Iron IV\mod\hoi4_newspaper` 或 Steam Workshop 路径 `D:\SteamLibrary\steamapps\workshop\content\1158310\XXXXXX`）
   - **控制台设置**：选择监听国家、输出语言、新闻类型等

5. 点击「启动监听」，然后开始玩 HOI4

### 游戏内使用

当新闻生成后，在游戏内：
1. 打开控制台（`~` 键）
2. 输入 `reload loc` 回车
3. 输入 `reload gui` 回车
4. 点击对应报纸的决议按钮即可阅读

---

## 项目结构

```
hoi4-llm-project/
├── config.mjs              # 核心配置（路径函数、常量）
├── watcher.mjs             # 主入口：存档监听、事件调度
├── start.bat               # Windows 启动脚本（自动检测 node.exe）
├── node.exe                # 内置 Node.js（可选，免安装运行）
├── package.json            # Node.js 依赖
│
├── modules/                # 后端模块
│   ├── server.mjs          # Express Web 服务器 + API
│   ├── settings.mjs        # 设置管理 + Prompt 模板
│   ├── parser.mjs          # Jomini 存档解析器
│   ├── differ.mjs          # 存档差异对比
│   ├── translator.mjs      # 事件翻译（游戏代码→人类可读）
│   ├── llm.mjs             # LLM 调用 + Prompt 构建
│   ├── newswriter.mjs      # 新闻写入 yml 文件
│   ├── session.mjs         # 会话管理（连续性检查）
│   ├── history.mjs         # 新闻历史记录
│   ├── localisation.mjs    # 游戏本地化字典加载
│   ├── states.mjs          # 州名/胜利点字典
│   └── templates.mjs       # Submod 模板系统
│
├── data/                   # 数据工具
│   └── generate_dicts.mjs  # 从游戏文件生成州名字典
│
├── runtime/                # 运行时数据（.gitignore）
│   ├── settings.json       # 用户设置（敏感，不上传）
│   ├── settings.example.json # 设置模板
│   ├── last_snapshot.json  # 上次存档快照
│   ├── session.json        # 当前会话
│   └── news_history.json   # 新闻历史
│
├── web/
│   └── index.html          # 前端单页应用（含 i18n）
│
└── hoi4_newspaper/         # HOI4 Mod 文件
    ├── descriptor.mod
    ├── common/decisions/   # 决议定义
    ├── common/scripted_guis/ # GUI 脚本
    ├── gfx/interface/      # 报纸背景图
    ├── interface/          # GUI 布局文件
    └── localisation/       # yml 翻译文件
        ├── simp_chinese/   # 中文（7个）
        └── english/        # 英文（7个）
```

---

## 架构与数据流

```
┌─────────────┐     fs.watch      ┌──────────────┐
│  HOI4 存档   │ ───────────────→ │  watcher.mjs │
│  (.hoi4)     │                  │  (主调度器)    │
└─────────────┘                  └──────┬───────┘
                                        │
                          ┌─────────────┼─────────────┐
                          ▼             ▼             ▼
                   ┌──────────┐  ┌──────────┐  ┌──────────┐
                   │ parser   │  │ session  │  │ settings │
                   │ 存档解析  │  │ 会话检查  │  │ 读取配置  │
                   └────┬─────┘  └────┬─────┘  └──────────┘
                        │             │
                        ▼             │
                   ┌──────────┐       │
                   │ differ   │       │
                   │ 差异对比  │◄──────┘ (status=continue)
                   └────┬─────┘
                        │
                        ▼
                   ┌──────────┐
                   │translator│
                   │ 事件翻译  │ ← localisation.mjs (字典)
                   └────┬─────┘ ← states.mjs (州名)
                        │
                        ▼
                   ┌──────────┐
                   │   llm    │
                   │ Prompt构建│ ← settings.mjs (模板)
                   │ LLM调用  │ → 外部 API
                   └────┬─────┘
                        │
                        ▼
                   ┌──────────┐
                   │newswriter│
                   │ 写入yml  │ → hoi4_newspaper/localisation/
                   └────┬─────┘
                        │
                        ▼
                   ┌──────────┐
                   │ history  │
                   │ 记录历史  │ → runtime/news_history.json
                   └──────────┘

┌─────────────┐   HTTP API    ┌──────────────┐
│  浏览器前端   │ ←──────────→ │  server.mjs  │
│  index.html │              │  Express 服务  │
└─────────────┘              └──────┬───────┘
                                    │
                          ┌─────────┼─────────┐
                          ▼         ▼         ▼
                     settings   watcher   history
                     读写配置    控制监听   查看历史
```

### 核心处理流程

1. **存档变化** → `fs.watch` 检测到 `.hoi4` 文件
2. **解析存档** → `parser.parseSave()` 使用 Jomini 提取结构化数据
3. **会话检查** → `session.checkContinuity()` 判断是否需要生成新闻
4. **差异对比** → `differ.diffSaves()` 对比新旧存档，提取事件列表
5. **事件翻译** → `translator.translateEvents()` 将游戏代码翻译为人类可读文本
6. **Prompt 构建** → `llm.buildPrompt()` / `buildInternationalPrompt()` 填充模板
7. **LLM 调用** → `llm.callLLM()` 调用外部 API（最多 2 次重试）
8. **结果解析** → `llm.parseArticlesOutput()` 解析 JSON 输出
9. **写入 yml** → `newswriter.writeNewsToMod()` 写入 Mod 本地化文件
10. **记录历史** → `history.addNewsToHistory()` 保存到历史文件

---

## 模块接口文档

### config.mjs — 核心配置

| 导出 | 类型 | 说明 |
|------|------|------|
| `PROJECT_DIR` | `string` | 项目根目录（`import.meta.url` 自动检测） |
| `MOD_DIR` | `string` | 同 PROJECT_DIR |
| `SNAPSHOT_PATH` | `string` | 快照文件路径 |
| `SESSION_PATH` | `string` | 会话文件路径 |
| `STATES_DICT` | `string` | 州名字典路径 |
| `VP_DICT` | `string` | 胜利点字典路径 |
| `MAJOR_TAGS` | `string[]` | 主要国家 TAG 列表 |
| `SAVE_WRITE_DELAY` | `number` | 存档写入延迟（3000ms） |
| `WEB_PORT` | `number` | Web 端口（3000） |
| `getHoi4Dir(settings)` | `function` | 获取 HOI4 安装目录 |
| `getLocDir(settings)` | `function` | 获取简中本地化目录 |
| `getLocDirEn(settings)` | `function` | 获取英文本地化目录 |
| `getStatesDir(settings)` | `function` | 获取州历史目录 |
| `getSaveDir(settings)` | `function` | 获取存档目录 |

### settings.mjs — 设置管理

| 导出 | 签名 | 说明 |
|------|------|------|
| `loadSettings()` | `→ object` | 加载设置（与默认值深度合并） |
| `saveSettings(settings)` | `→ void` | 保存设置到 `runtime/settings.json` |
| `getDefaults()` | `→ object` | 获取默认设置深拷贝 |
| `getProviderPresets()` | `→ object` | 获取 LLM 供应商预设 |

**设置结构**（`runtime/settings.json`）：

```jsonc
{
  "llm": {
    "provider": "deepseek",       // deepseek | openai | siliconflow | openrouter | custom
    "apiUrl": "",                 // API 端点
    "apiKey": "",                 // API 密钥
    "model": "",                  // 模型名称
    "temperature": 0.8,
    "maxTokens": 800,
    "contextLength": 64000,
    "historyCount": 3             // Prompt 中包含的历史新闻期数
  },
  "newspaper": {
    "styles": { ... },            // 国内报纸风格（key→StyleDef）
    "selectedStyle": "GER",       // 当前选中的国内风格
    "internationalStyles": { ... }, // 国际通讯社风格
    "selectedInternationalStyle": "intl_ap"
  },
  "console": {
    "newsTags": [],               // 额外监听的国家 TAG
    "minDaysBetweenNews": 25,     // 最小新闻间隔天数
    "newsType": "both",           // domestic | international | both
    "customTags": [],
    "outputLang": "zh"            // zh | en
  },
  "paths": {
    "hoi4Dir": "",                // HOI4 安装目录
    "saveDir": "",                // 存档目录
    "modDir": "",                 // hoi4_newspaper 模组根目录
    "templateDirs": []            // 模板扫描目录
  }
}
```

**风格定义**（StyleDef）：

```jsonc
{
  "name": "《人民观察家报》",       // 中文名
  "nameEn": "Völkischer Beobachter", // 英文名
  "tone": "...",                   // 中文风格描述
  "toneEn": "...",                 // 英文风格描述
  "type": "domestic",              // domestic | international
  "promptTemplate": "...",         // 中文 Prompt 模板
  "promptTemplateEn": "...",       // 英文 Prompt 模板
  "articleGroups": [               // 新闻槽位
    { "titleKey": "ger_1_title", "bodyKey": "ger_1_body" },
    { "titleKey": "ger_2_title", "bodyKey": "ger_2_body" }
  ],
  "dateKey": "ger_date",           // 日期 yml key
  "guiFile": "interface/ai_newspaper_ger.gui",
  "ymlFile": "localisation/simp_chinese/ger_newspaper_l_simp_chinese.yml",
  "ymlFileEn": "localisation/english/ger_newspaper_l_english.yml"
}
```

### parser.mjs — 存档解析

| 导出 | 签名 | 说明 |
|------|------|------|
| `initParser()` | `async → Jomini` | 初始化解析器（仅需一次） |
| `parseSave(filePath, extraTags)` | `async → SaveData` | 解析存档文件 |

**SaveData 结构**：

```jsonc
{
  "date": "1936.3.15",
  "player": "GER",
  "countries": {
    "GER": {
      "stability": 0.65,
      "warSupport": 0.40,
      "fuel": 1000,
      "maxFuel": 50000,
      "ideas": ["ger_fascism_focus"],
      "faction": "Axis",
      "atWar": false,
      "controlledStates": [1, 2, 3, ...],
      "nationalFocus": "ger_rhineland",
      "research": ["infantry_weapons", ...]
    }
  },
  "wars": [...],
  "battles": [...],
  "states": { "1": { owner: "GER", ... } }
}
```

### differ.mjs — 差异对比

| 导出 | 签名 | 说明 |
|------|------|------|
| `diffSaves(snapshot, current, viewTag, vpDict)` | `→ Event[]` | 对比两个存档，从指定国家视角输出事件 |

**Event 类型**：

```jsonc
{ "type": "focus_completed", "tag": "GER", "name": "莱茵兰" }
{ "type": "state_controlled", "tag": "GER", "stateId": 105, "from": "FRA" }
{ "type": "battle_won", "tag": "GER", "province": "巴黎", "attacker": "GER" }
{ "type": "battle_lost", "tag": "GER", "province": "华沙", "defender": "POL" }
{ "type": "war_started", "tag": "GER", "against": "POL" }
{ "type": "treaty", "tag": "GER", "treaty": "德国吞并了奥地利" }
{ "type": "idea_gained", "tag": "GER", "idea": "政治顾问" }
{ "type": "idea_lost", "tag": "GER", "idea": "经济法案" }
{ "type": "faction_joined", "tag": "GER", "faction": "Axis" }
{ "type": "wargoal", "tag": "GER", "target": "POL", "type": "take_state" }
{ "type": "research_completed", "tag": "GER", "name": "步兵武器" }
```

### translator.mjs — 事件翻译

| 导出 | 签名 | 说明 |
|------|------|------|
| `translate(code, dict)` | `→ string` | 翻译游戏代码 |
| `getEnCountryName(tag)` | `→ string` | 获取国家英文名 |
| `translateEvents(events, dict, vpDict, lang, dictEn)` | `→ string[]` | 批量翻译事件 |

### llm.mjs — LLM 调用

| 导出 | 签名 | 说明 |
|------|------|------|
| `formatDate(d, lang)` | `→ string` | 格式化日期（中/英） |
| `getNewspaperStyle()` | `→ StyleDef` | 获取当前国内风格 |
| `getInternationalStyle()` | `→ StyleDef` | 获取当前国际风格 |
| `parseArticlesOutput(raw)` | `→ Article[]\|null` | 解析 LLM JSON 输出 |
| `generateNews({ events, playerName, playerTag, stability, warSupport, fuelStatus, dateFrom, dateTo, lang })` | `async → { articles, style }\|null` | 生成国内新闻 |
| `generateInternationalNews({ countryEvents, dateFrom, dateTo, lang })` | `async → { articles, style }\|null` | 生成国际新闻 |

**Prompt 模板占位符**：

| 占位符 | 中文模板 | 英文模板 | 说明 |
|--------|---------|---------|------|
| 报纸名 / newspaperName | `{报纸名}` | `{newspaperName}` | 风格的 name / nameEn |
| 国家名 / countryName | `{国家名}` | `{countryName}` | 玩家国家翻译名 |
| 风格描述 / styleDesc | `{风格描述}` | `{styleDesc}` | 风格的 tone / toneEn |
| 起始日期 / dateFrom | `{起始日期}` | `{dateFrom}` | 上一期日期 |
| 结束日期 / dateTo | `{结束日期}` | `{dateTo}` | 当前日期 |
| 稳定度 / stability | `{稳定度}` | `{stability}` | 国家稳定度 |
| 战争支持度 / warSupport | `{战争支持度}` | `{warSupport}` | 战争支持度 |
| 燃油信息 / fuelInfo | `{燃油信息}` | `{fuelInfo}` | 燃油状态描述 |
| 事件列表 / eventList | `{事件列表}` | `{eventList}` | 翻译后的事件文本 |
| 各国事件 / countryEvents | `{各国事件}` | `{countryEvents}` | 各国事件汇总 |
| 历史新闻 / historyNews | `{历史新闻}` | `{historyNews}` | 近期新闻摘要 |
| 文章数 / articleCount | `{articleCount}` | `{articleCount}` | articleGroups 数量 |

### newswriter.mjs — 新闻写入

| 导出 | 签名 | 说明 |
|------|------|------|
| `resetNewspaperYml(styles, modBaseDir)` | `→ void` | 重置 yml（清空新闻，保留 UI key） |
| `writeNewsToMod(newsSlots, _, date)` | `→ void` | 将新闻写入对应 yml 文件 |

**yml 写入逻辑**：
- 读取现有 yml → 解析 key-value → 只更新新闻 key 和日期 key → 保留 UI key（`newspaper_dismiss`、`newspaper_next`、`read_*_desc`）
- UTF-8 BOM 编码
- `outputLang` 决定写入中文 yml（`l_simp_chinese`）还是英文 yml（`l_english`）

### session.mjs — 会话管理

| 导出 | 签名 | 说明 |
|------|------|------|
| `dateToDays(dateInput)` | `→ number` | 游戏日期转天数 |
| `formatDateShort(dateInput)` | `→ string` | 日期格式化 |
| `loadSession()` | `→ object\|null` | 加载会话 |
| `checkContinuity(playerTag, date, minDays)` | `→ { status, reason?, daysDiff? }` | 检查连续性 |
| `startNewSession(playerTag, date)` | `→ object` | 新建会话 |
| `updateSession(date)` | `→ object` | 更新会话 |

**status 返回值**：
- `first` — 首次运行，建立基准
- `new_game` — 玩家/日期大幅变化，新游戏
- `too_soon` — 间隔天数不足
- `continue` — 正常继续，生成新闻

### history.mjs — 新闻历史

| 导出 | 签名 | 说明 |
|------|------|------|
| `loadHistory()` | `→ Array` | 加载历史 |
| `saveHistory(history)` | `→ void` | 保存历史 |
| `addNewsToHistory({ issue, dateFrom, dateTo, playerTag, articles })` | `→ Array` | 添加一期 |
| `getRecentNews(count)` | `→ Array` | 获取最近 N 期 |
| `clearHistory()` | `→ void` | 清空历史 |

### localisation.mjs — 本地化字典

| 导出 | 签名 | 说明 |
|------|------|------|
| `loadLocalisation()` | `→ object` | 加载简中翻译字典（从 HOI4 安装目录） |
| `loadLocalisationEn()` | `→ object` | 加载英文翻译字典 |

### states.mjs — 州名/胜利点

| 导出 | 签名 | 说明 |
|------|------|------|
| `loadStates()` | `→ { statesDict, vpDict }` | 加载字典 |
| `describeState(id)` | `→ string` | 州 ID 转描述 |

### templates.mjs — 模板系统

| 导出 | 签名 | 说明 |
|------|------|------|
| `scanTemplates(modDir)` | `→ Array` | 扫描目录下的 `template.json` |
| `importTemplate(template, settings)` | `→ { styleKey, targetStyles, styleData }\|null` | 导入模板 |
| `getImportedTemplateKeys(settings)` | `→ { domestic, international }` | 获取已导入 key |
| `removeTemplate(styleKey, settings)` | `→ boolean` | 移除模板 |

---

## API 接口

Web 控制台通过 REST API 与后端交互，所有端点前缀 `/api`。

### 设置管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/settings` | 获取设置（API Key 脱敏） |
| `GET` | `/api/defaults` | 获取默认设置 |
| `GET` | `/api/providers` | 获取 LLM 供应商预设 |
| `PUT` | `/api/settings/llm` | 更新 LLM 设置 |
| `PUT` | `/api/settings/newspaper` | 更新报纸风格设置 |
| `PUT` | `/api/settings/console` | 更新控制台设置（触发监听器重启） |
| `PUT` | `/api/settings/paths` | 更新路径设置（触发监听器重启） |

### LLM 操作

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/models` | 获取远程模型列表 |
| `POST` | `/api/test-connection` | 测试 LLM 连接 |

### 监听控制

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/status` | 获取监听状态、会话信息、日志 |
| `POST` | `/api/watcher/start` | 启动存档监听 |
| `POST` | `/api/watcher/stop` | 停止存档监听 |
| `POST` | `/api/session/reset` | 重置会话 |

### 历史与模板

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/history` | 获取新闻历史 |
| `DELETE` | `/api/history` | 清空新闻历史 |
| `GET` | `/api/templates` | 扫描并获取模板列表 |
| `POST` | `/api/templates/import` | 导入模板 |
| `DELETE` | `/api/templates/:styleKey` | 删除模板 |

---

## 配置说明

### 路径配置

| 字段 | 说明 | 示例 |
|------|------|------|
| `hoi4Dir` | HOI4 安装目录 | `C:\Program Files\Steam\steamapps\common\Hearts of Iron IV` |
| `saveDir` | 存档目录 | `C:\Users\用户\Documents\Paradox Interactive\Hearts of Iron IV\save games` |
| `modDir` | hoi4_newspaper 模组根目录 | `C:\Users\用户\Documents\Paradox Interactive\Hearts of Iron IV\mod\hoi4_newspaper` 或 `D:\SteamLibrary\steamapps\workshop\content\1158310\XXXXXX` |

- `hoi4Dir` 用于加载游戏本地化字典（翻译事件文本），留空则跳过翻译
- `modDir` 决定新闻 yml 的写入位置，必须指向 `hoi4_newspaper` 模组根目录
- Steam Workshop 安装的 Mod 路径格式为 `steamapps\workshop\content\1158310\{mod_id}`

### 输出语言

`outputLang` 控制整条写入链路：

| 设置值 | yml 路径 | yml 头 | Prompt | 日期格式 | 事件翻译 |
|--------|---------|--------|--------|---------|---------|
| `zh` | `localisation/simp_chinese/` | `l_simp_chinese:` | 中文模板 | 1936年3月15日 | 中文字典 |
| `en` | `localisation/english/` | `l_english:` | 英文模板 | March 15, 1936 | 英文字典 |

### 前端 i18n

前端 UI 语言与输出语言独立。左上角 `[A/文]` 下拉栏切换 UI 语言（中文/英文），`outputLang` 下拉框控制新闻输出语言。

---

## 报纸风格体系

### 国内报纸（type: domestic）

从玩家 TAG 视角报道本国事件。

| Key | 名称 | 文章数 | 特色 |
|-----|------|--------|------|
| `GER` | 《人民观察家报》 / Völkischer Beobachter | 2 | 德国官方风格，庄重严肃 |
| `ENG` | 《卫报》 / The Guardian | 2 | 英国左翼，关注社会公正 |
| `SOV` | 《真理报》 / Pravda | 2 | 苏联官方，特殊版面布局（title1=标语，body1=自带小标题） |
| `CHI` | 《大公报》 / Ta Kung Pao | 3 | 中国民间，忧愤坚定 |

### 国际通讯社（type: international）

从全球视角报道各国事件。

| Key | 名称 | 文章数 | 特色 |
|-----|------|--------|------|
| `intl_ap` | 美联社全球电讯 / AP World Wire | 6 | 平衡报道，多方信源 |
| `intl_maid` | 女仆简报 / Maid Briefing | 5 | 二次元女仆对话风格，title=对主人说的话 |
| `intl_gaijin` | 盖金社 / Gaijin Entertainment | 3 | RT 风格，安东三人组每期必死 |

### Prompt 模板变量

每个风格拥有独立的 `promptTemplate`（中文）和 `promptTemplateEn`（英文），不再共享默认模板。模板中可使用上述占位符。

---

## 制作扩展风格

### 方法一：Web 控制台修改

在 Web 控制台的「报纸设置」面板中直接修改 Name / Tone / Prompt Template 等字段，保存即可。

### 方法二：Submod 模板

创建一个 Submod 目录，在其中放置 `template.json` 文件，通过 Web 控制台的「模板」功能导入。

**template.json 格式**：

```json
{
  "styleKey": "intl_reuters",
  "targetStyles": "international",
  "styleData": {
    "name": "路透社电讯",
    "nameEn": "Reuters Wire",
    "tone": "路透社风格，简洁客观，注重事实",
    "toneEn": "Reuters style, concise and objective, fact-focused",
    "type": "international",
    "promptTemplate": "你是国际通讯社{报纸名}的编辑...（完整 Prompt）",
    "promptTemplateEn": "You are the editor of {newspaperName}...（full prompt）",
    "articleGroups": [
      { "titleKey": "reuters_1_title", "bodyKey": "reuters_1_body" },
      { "titleKey": "reuters_2_title", "bodyKey": "reuters_2_body" },
      { "titleKey": "reuters_3_title", "bodyKey": "reuters_3_body" }
    ],
    "dateKey": "reuters_date"
  }
}
```

### 方法三：代码添加（内置风格）

在 `modules/settings.mjs` 中：

1. 创建独立的 Prompt 模板常量（如 `REUTERS_PROMPT_TEMPLATE` / `REUTERS_PROMPT_TEMPLATE_EN`）
2. 在 `DEFAULT_INTERNATIONAL_STYLES`（或 `DEFAULT_STYLES`）中添加风格定义
3. 删除 `runtime/settings.json` 重新生成（否则旧设置会覆盖新默认值）

### 添加新风格需要的 HOI4 Mod 文件

每个风格需要以下 Mod 文件：

| 文件 | 位置 | 说明 |
|------|------|------|
| 决议文件 | `common/decisions/{key}_decisions.txt` | 点击打开报纸的决议按钮 |
| GUI 脚本 | `common/scripted_guis/{key}_gui.txt` | GUI 交互逻辑 |
| GUI 布局 | `interface/{key}.gui` | 报纸界面布局 |
| 背景图 | `gfx/interface/newspaper/{key}_bg.png` | 报纸背景 |
| 中文 yml | `localisation/simp_chinese/{key}_l_simp_chinese.yml` | 中文翻译 |
| 英文 yml | `localisation/english/{key}_l_english.yml` | 英文翻译 |
| Sprite | `interface/newspaper_sprites.gfx` | 添加背景图 spriteType |

**yml 文件必须 UTF-8 BOM 编码**，格式：

```yml
﻿l_simp_chinese:
 read_{key}:0 "阅读{报纸名}"
 read_{key}_desc:0 "查看{报纸名}的最新报道。"
 newspaper_dismiss:0 "关闭报纸"
 newspaper_next:0 "下一页"
 {dateKey}:0 ""
 {titleKey}_1:0 "等待新闻..."
 {bodyKey}_1:0 "{报纸名}等待最新消息。"
```

---

## HOI4 Mod 结构

`hoi4_newspaper/` 是一个标准的 HOI4 Mod，通过 `descriptor.mod` 注册。

### 工作原理

1. **决议触发**：玩家在游戏内点击决议 → 打开 Scripted GUI
2. **GUI 展示**：Scripted GUI 读取 yml 中的本地化文本 → 在报纸背景图上渲染
3. **新闻更新**：本工具监听存档变化 → LLM 生成新闻 → 写入 yml → 玩家 `reload loc` + `reload gui` → 看到新报纸

### 内置风格对应的 Mod 文件

| 风格 | 决议 | GUI 脚本 | GUI 布局 | 背景图 |
|------|------|---------|---------|--------|
| GER | `ger_newspaper_decisions.txt` | `ger_newspaper_gui.txt` | `ai_newspaper_ger.gui` | `ger_bg.png` |
| ENG | `eng_newspaper_decisions.txt` | `eng_newspaper_gui.txt` | `ai_newspaper_eng.gui` | `eng_bg.png` |
| SOV | `sov_newspaper_decisions.txt` | `sov_newspaper_gui.txt` | `ai_newspaper_sov.gui` | `sov_bg.png` |
| CHI | `chi_newspaper_decisions.txt` | `chi_newspaper_gui.txt` | `ai_newspaper_chi.gui` | `chi_bg.png` |
| AP | `intl_ap_newspaper_decisions.txt` | `intl_ap_newspaper_gui.txt` | `ai_newspaper_intl_ap.gui` | `intl_ap_bg.png` |
| MAID | `maid_brief_decisions.txt` | `maid_brief_gui.txt` | `ai_newspaper_intl_maid_.gui` | `maid_brief_bg.png` + `maid_portrait.png` |
| GAIJIN | `gaijin_newspaper_decisions.txt` | `gaijin_newspaper_gui.txt` | `gaijin_newspaper.gui` | `intl_gaijin_bg.png` |

---

## 常见问题

### 新闻生成后游戏内看不到？

需要手动刷新本地化和 GUI：
1. 按 `~` 打开控制台
2. 输入 `reload loc` 回车
3. 输入 `reload gui` 回车
4. 点击报纸决议按钮

### 修改了 Prompt 但前端没变化？

`deepMerge(DEFAULTS, saved)` 中 saved 覆盖 DEFAULTS，已有 `settings.json` 不会被代码中的新默认值更新。解决方法：删除 `runtime/settings.json` 重新生成。

### yml 文件 HOI4 无法加载？

yml 文件必须是 **UTF-8 BOM** 编码。如果出现三重 BOM（`\ufeff\ufeff\ufeff`），HOI4 无法解析。工具内置了 BOM 清理逻辑（`parseExistingYml` 中 `replace(/^\ufeff+/, "")`），写入时只添加单个 BOM。

### HOI4 目录未配置会怎样？

- 本地化字典加载跳过，事件翻译使用 TAG 原始代码
- 州名字典无法生成（需要运行 `data/generate_dicts.mjs`）
- 新闻仍可正常生成和写入，但文本可读性降低

### 如何更换 LLM 供应商？

在 Web 控制台「LLM 设置」中选择供应商，填入 API Key 和模型名。支持自定义 API 地址（选择「自定义」供应商），兼容任何 OpenAI 格式的 API。

### 如何生成州名字典？

```bash
# 需先在 settings.json 中配置 hoi4Dir
node data/generate_dicts.mjs
```

这会从 HOI4 游戏文件中读取州定义和本地化，生成 `data/states_dict.json` 和 `data/vp_dict.json`。

---

## 依赖

| 包 | 版本 | 用途 |
|----|------|------|
| `express` | ^5.2.1 | Web 服务器 |
| `jomini` | ^0.10.0 | HOI4 存档解析 |
| `node-fetch` | ^3.3.2 | HTTP 请求（LLM API 调用） |
| `dotenv` | ^17.3.1 | 环境变量 |

## 许可

ISC
