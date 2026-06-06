import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { loadSettings, saveSettings } from "./settings.mjs";

const TEMPLATE_FILENAME = "template.json";

function validateTemplate(data, filePath) {
  const errors = [];
  if (!data.id || typeof data.id !== "string") errors.push("缺少或无效的 id");
  if (!data.name || typeof data.name !== "string") errors.push("缺少或无效的 name");
  if (!data.type || !["domestic", "international"].includes(data.type)) errors.push("type 必须为 domestic 或 international");
  if (!data.articleGroups || !Array.isArray(data.articleGroups) || data.articleGroups.length === 0) {
    errors.push("articleGroups 必须为非空数组");
  } else {
    data.articleGroups.forEach((g, i) => {
      if (!g.bodyKey) errors.push(`articleGroups[${i}] 缺少 bodyKey`);
    });
  }
  return errors;
}

export function scanTemplates(modDir) {
  if (!modDir || !existsSync(modDir)) return [];

  const templates = [];

  try {
    const entries = readdirSync(modDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const templatePath = join(modDir, entry.name, TEMPLATE_FILENAME);
      if (!existsSync(templatePath)) continue;

      try {
        const raw = readFileSync(templatePath, "utf-8");
        const data = JSON.parse(raw);
        const errors = validateTemplate(data, templatePath);

        if (errors.length > 0) {
          console.warn(`⚠️ 模板 ${templatePath} 验证失败: ${errors.join(", ")}`);
          continue;
        }

        templates.push({
          ...data,
          _source: templatePath,
          _modDir: join(modDir, entry.name),
        });
      } catch (e) {
        console.warn(`⚠️ 读取模板 ${templatePath} 失败: ${e.message}`);
      }
    }
  } catch (e) {
    console.warn(`⚠️ 扫描目录 ${modDir} 失败: ${e.message}`);
  }

  return templates;
}

export function importTemplate(template, settings) {
  if (!template || !template.id) return null;

  const styleKey = `tpl_${template.id}`;
  const styleData = {
    name: template.name,
    tone: template.tone || "",
    type: template.type,
    promptTemplate: template.promptTemplate || null,
    articleGroups: template.articleGroups,
  };

  if (template.guiFile) styleData.guiFile = template.guiFile;
  if (template.ymlFile) styleData.ymlFile = template.ymlFile;
  if (template._modDir) styleData.modBaseDir = template._modDir;

  const targetStyles = template.type === "international"
    ? "internationalStyles"
    : "styles";

  if (!settings.newspaper[targetStyles]) settings.newspaper[targetStyles] = {};
  settings.newspaper[targetStyles][styleKey] = styleData;

  return { styleKey, targetStyles, styleData };
}

export function getImportedTemplateKeys(settings) {
  const domesticKeys = Object.keys(settings.newspaper?.styles || {}).filter(k => k.startsWith("tpl_"));
  const intlKeys = Object.keys(settings.newspaper?.internationalStyles || {}).filter(k => k.startsWith("tpl_"));
  return { domestic: domesticKeys, international: intlKeys };
}

export function removeTemplate(styleKey, settings) {
  if (!styleKey.startsWith("tpl_")) return false;

  let removed = false;
  if (settings.newspaper?.styles?.[styleKey]) {
    delete settings.newspaper.styles[styleKey];
    removed = true;
  }
  if (settings.newspaper?.internationalStyles?.[styleKey]) {
    delete settings.newspaper.internationalStyles[styleKey];
    removed = true;
  }

  return removed;
}
