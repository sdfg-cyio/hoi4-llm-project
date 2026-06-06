import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { getLocDir, getLocDirEn } from "../config.mjs";
import { loadSettings } from "./settings.mjs";

function getLocDirRus(settings) {
  const hoi4Dir = settings?.paths?.hoi4Dir || "";
  return hoi4Dir ? join(hoi4Dir, "localisation", "russian") : "";
}

function loadLocalisationFromDir(dir) {
  const dict = {};
  let files;
  try {
    files = readdirSync(dir).filter(f => f.endsWith(".yml"));
  } catch (e) {
    return dict;
  }

  for (const file of files) {
    const fullPath = join(dir, file);
    let content;
    try { content = readFileSync(fullPath, "utf-8"); }
    catch (e) {
      try { content = readFileSync(fullPath, "utf-16le"); }
      catch (e2) { continue; }
    }

    for (const line of content.split("\n")) {
      const match = line.match(/^\s+([\w.]+):\d*\s+"(.+)"/);
      if (match) {
        const key = match[1];
        let value = match[2];
        value = value.replace(/\[[\w|.]+\]/g, "");
        value = value.replace(/§[A-Z!]/g, "");
        value = value.replace(/\$[\w|.]+\$/g, "");
        value = value.trim();
        if (value) dict[key] = value;
      }
    }
  }
  return dict;
}

export function loadLocalisation() {
  const settings = loadSettings();
  const dir = getLocDir(settings);
  if (!dir) {
    console.log("[警告] HOI4目录未配置，跳过中文翻译加载");
    return {};
  }
  const dict = loadLocalisationFromDir(dir);
  console.log(`[OK] 加载翻译 ${Object.keys(dict).length} 条`);
  return dict;
}

export function loadLocalisationEn() {
  const settings = loadSettings();
  const dir = getLocDirEn(settings);
  if (!dir) {
    console.log("[警告] HOI4目录未配置，跳过英文翻译加载");
    return {};
  }
  const dict = loadLocalisationFromDir(dir);
  console.log(`[OK] 加载英文翻译 ${Object.keys(dict).length} 条`);
  return dict;
}

export function loadLocalisationRus() {
  const settings = loadSettings();
  const dir = getLocDirRus(settings);
  if (!dir) {
    console.log("[警告] HOI4目录未配置，跳过俄语翻译加载");
    return {};
  }
  const dict = loadLocalisationFromDir(dir);
  console.log(`[OK] 加载俄语翻译 ${Object.keys(dict).length} 条`);
  return dict;
}
