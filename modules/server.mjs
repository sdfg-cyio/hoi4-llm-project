import express from "express";
import fetch from "node-fetch";
import { dirname } from "path";
import { loadSettings, saveSettings, getDefaults, getProviderPresets } from "./settings.mjs";
import { loadSession, startNewSession } from "./session.mjs";
import { loadHistory, clearHistory } from "./history.mjs";
import { scanTemplates, importTemplate, removeTemplate, getImportedTemplateKeys } from "./templates.mjs";
import { MAJOR_TAGS } from "../config.mjs";

const app = express();
app.use(express.json());

let watcherState = {
  isWatching: false,
  currentSession: null,
  logs: [],
  reloadCommands: null,
};

export function setWatcherState(state) {
  watcherState = { ...watcherState, ...state };
}

export function addLog(message) {
  watcherState.logs.push({
    time: new Date().toLocaleTimeString("zh-CN"),
    message,
  });
  if (watcherState.logs.length > 200) {
    watcherState.logs = watcherState.logs.slice(-200);
  }
}

app.get("/api/settings", (req, res) => {
  const settings = loadSettings();
  const safe = JSON.parse(JSON.stringify(settings));
  if (safe.llm?.apiKey) {
    safe.llm.apiKey = safe.llm.apiKey.replace(/(.{4}).*(.{4})/, "$1****$2");
  }
  res.json(safe);
});

app.put("/api/settings/llm", (req, res) => {
  const settings = loadSettings();
  const { provider, apiUrl, apiKey, model, temperature, maxTokens, contextLength, historyCount } = req.body;

  if (provider !== undefined) settings.llm.provider = provider;
  if (apiUrl !== undefined) settings.llm.apiUrl = apiUrl;
  if (apiKey !== undefined && !apiKey.includes("****")) {
    settings.llm.apiKey = apiKey;
  }
  if (model !== undefined) settings.llm.model = model;
  if (temperature !== undefined) settings.llm.temperature = Number(temperature);
  if (maxTokens !== undefined) settings.llm.maxTokens = Number(maxTokens);
  if (contextLength !== undefined) settings.llm.contextLength = Number(contextLength);
  if (historyCount !== undefined) settings.llm.historyCount = Number(historyCount);

  saveSettings(settings);
  res.json({ ok: true });
});

app.put("/api/settings/newspaper", (req, res) => {
  const settings = loadSettings();
  const { styles, selectedStyle, internationalStyles, selectedInternationalStyle } = req.body;

  if (styles) settings.newspaper.styles = styles;
  if (selectedStyle !== undefined) settings.newspaper.selectedStyle = selectedStyle;
  if (internationalStyles) settings.newspaper.internationalStyles = internationalStyles;
  if (selectedInternationalStyle !== undefined) settings.newspaper.selectedInternationalStyle = selectedInternationalStyle;

  saveSettings(settings);
  res.json({ ok: true });
});

app.put("/api/settings/console", (req, res) => {
  const settings = loadSettings();
  const { newsTags, minDaysBetweenNews, newsType, customTags, outputLang } = req.body;

  if (newsTags !== undefined) settings.console.newsTags = newsTags;
  if (minDaysBetweenNews !== undefined) {
    settings.console.minDaysBetweenNews = Number(minDaysBetweenNews);
  }
  if (newsType !== undefined) settings.console.newsType = newsType;
  if (customTags !== undefined) settings.console.customTags = customTags;
  if (outputLang !== undefined) settings.console.outputLang = outputLang;

  saveSettings(settings);

  if (watcherState.onRestart) {
    watcherState.onRestart();
  }

  res.json({ ok: true });
});

app.put("/api/settings/paths", (req, res) => {
  const settings = loadSettings();
  const { hoi4Dir, saveDir, modDir, templateDirs } = req.body;

  if (hoi4Dir !== undefined) settings.paths.hoi4Dir = hoi4Dir;
  if (saveDir !== undefined) settings.paths.saveDir = saveDir;
  if (modDir !== undefined) settings.paths.modDir = modDir;
  if (templateDirs !== undefined) settings.paths.templateDirs = templateDirs;

  saveSettings(settings);

  if (watcherState.onRestart) {
    watcherState.onRestart();
  }

  res.json({ ok: true });
});

app.get("/api/providers", (req, res) => {
  res.json(getProviderPresets());
});

app.post("/api/models", async (req, res) => {
  const settings = loadSettings();
  const apiKey = req.body.apiKey || settings.llm.apiKey;
  const modelsUrl = req.body.modelsUrl;
  const provider = req.body.provider || settings.llm.provider;

  if (!modelsUrl && provider !== "custom") {
    const presets = getProviderPresets();
    const preset = presets[provider];
    if (!preset?.modelsUrl) {
      return res.json({ ok: false, error: "该供应商不支持获取模型列表" });
    }
  }

  const url = modelsUrl || getProviderPresets()[provider]?.modelsUrl;
  if (!url) {
    return res.json({ ok: false, error: "请提供模型列表 URL" });
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();

    if (data.data && Array.isArray(data.data)) {
      const models = data.data
        .map(m => ({
          id: m.id,
          owned_by: m.owned_by || "",
          context_length: m.context_length || m.max_context_length || null,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
      res.json({ ok: true, models });
    } else if (data.error) {
      res.json({ ok: false, error: data.error.message || JSON.stringify(data.error) });
    } else {
      res.json({ ok: false, error: "响应格式不支持" });
    }
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post("/api/test-connection", async (req, res) => {
  const settings = loadSettings();
  const apiKey = req.body.apiKey || settings.llm.apiKey;
  const apiUrl = req.body.apiUrl || settings.llm.apiUrl;
  const model = req.body.model || settings.llm.model;

  if (!apiUrl || !apiKey || !model) {
    return res.json({ ok: false, error: "请先填写 API 地址、Key 和模型" });
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "你好，请回复'连接成功'" }],
        max_tokens: 20,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();

    if (data.choices?.[0]?.message?.content) {
      res.json({ ok: true, reply: data.choices[0].message.content.trim() });
    } else if (data.error) {
      res.json({ ok: false, error: data.error.message || JSON.stringify(data.error) });
    } else {
      res.json({ ok: false, error: "未知响应格式" });
    }
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get("/api/status", (req, res) => {
  const session = loadSession();
  res.json({
    isWatching: watcherState.isWatching,
    session,
    majorTags: MAJOR_TAGS,
    logs: watcherState.logs.slice(-80),
    reloadCommands: watcherState.reloadCommands,
  });
});

app.get("/api/logs", (req, res) => {
  const count = Number(req.query.count) || 50;
  res.json(watcherState.logs.slice(-count));
});

app.get("/api/history", (req, res) => {
  const history = loadHistory();
  res.json(history);
});

app.delete("/api/history", (req, res) => {
  clearHistory();
  res.json({ ok: true });
});

app.post("/api/watcher/start", (req, res) => {
  if (watcherState.isWatching) {
    return res.json({ ok: false, error: "已在监听中" });
  }
  if (watcherState.onStart) {
    watcherState.onStart();
  }
  res.json({ ok: true });
});

app.post("/api/watcher/stop", (req, res) => {
  if (!watcherState.isWatching) {
    return res.json({ ok: false, error: "未在监听" });
  }
  if (watcherState.onStop) {
    watcherState.onStop();
  }
  res.json({ ok: true });
});

app.post("/api/session/reset", (req, res) => {
  startNewSession("", "");
  res.json({ ok: true });
});

app.get("/api/defaults", (req, res) => {
  res.json(getDefaults());
});

app.get("/api/templates", (req, res) => {
  const settings = loadSettings();
  const modDir = settings.paths?.modDir;
  const templateDirs = settings.paths?.templateDirs || [];

  const allDirs = [...templateDirs];
  if (modDir) allDirs.push(dirname(modDir));

  const seen = new Set();
  const templates = [];
  for (const dir of allDirs) {
    const found = scanTemplates(dir);
    for (const t of found) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        templates.push(t);
      }
    }
  }

  const imported = getImportedTemplateKeys(settings);
  res.json({ templates, imported });
});

app.post("/api/templates/import", (req, res) => {
  const { template } = req.body;
  if (!template || !template.id) {
    return res.json({ ok: false, error: "无效的模板数据" });
  }

  const settings = loadSettings();
  const result = importTemplate(template, settings);

  if (!result) {
    return res.json({ ok: false, error: "导入失败" });
  }

  saveSettings(settings);
  res.json({ ok: true, styleKey: result.styleKey, targetStyles: result.targetStyles });
});

app.delete("/api/templates/:styleKey", (req, res) => {
  const { styleKey } = req.params;
  const settings = loadSettings();

  if (!removeTemplate(styleKey, settings)) {
    return res.json({ ok: false, error: "未找到该模板或无法删除" });
  }

  saveSettings(settings);
  res.json({ ok: true });
});

app.use(express.static("web", { etag: false, maxAge: 0 }));
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  next();
});

export function startServer(port = 3000) {
  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`\n🌐 Web控制台: http://localhost:${port}`);
      resolve();
    });
  });
}
