import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const OFFICIAL_CHARACTER_SHEET_TEMPLATE_URL = "/forms/5E_CharacterSheet_Fillable.pdf";

const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

function safeText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim();
}

function formatModifier(value) {
  const n = Number(value) || 0;
  return n >= 0 ? `+${n}` : String(n);
}

function sanitizePdfText(value) {
  return safeText(value)
    .replace(/[–—]/g, "-")
    .replace(/[’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function drawTextTop(page, text, x, top, {
  font,
  size = 9,
  color = BLACK,
  width = null,
  align = "left",
  minSize = 5.5,
} = {}) {
  let value = sanitizePdfText(text);
  if (!value) return;

  let actualSize = size;
  if (width != null) {
    while (actualSize > minSize && font.widthOfTextAtSize(value, actualSize) > width) actualSize -= 0.25;
    if (font.widthOfTextAtSize(value, actualSize) > width) {
      const ellipsis = "...";
      while (value.length > 1 && font.widthOfTextAtSize(value + ellipsis, actualSize) > width) value = value.slice(0, -1);
      value += ellipsis;
    }
  }

  let drawX = x;
  if (width != null) {
    const textWidth = font.widthOfTextAtSize(value, actualSize);
    if (align === "center") drawX = x + Math.max(0, (width - textWidth) / 2);
    if (align === "right") drawX = x + Math.max(0, width - textWidth);
  }

  page.drawText(value, {
    x: drawX,
    y: page.getHeight() - top - actualSize,
    size: actualSize,
    font,
    color,
  });
}

function wrapParagraph(font, paragraph, size, width) {
  const words = sanitizePdfText(paragraph).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

function wrapText(font, text, size, width) {
  const paragraphs = sanitizePdfText(text).split(/\n+/);
  const lines = [];
  paragraphs.forEach((paragraph, index) => {
    if (!paragraph.trim()) {
      lines.push("");
    } else {
      lines.push(...wrapParagraph(font, paragraph, size, width));
    }
    if (index < paragraphs.length - 1) lines.push("");
  });
  return lines;
}

function drawWrappedTop(page, text, x, top, width, height, {
  font,
  size = 7,
  lineHeight = size * 1.18,
  color = BLACK,
  ellipsis = true,
} = {}) {
  const lines = wrapText(font, text, size, width);
  const maxLines = Math.max(1, Math.floor(height / lineHeight));
  const visible = lines.slice(0, maxLines);
  if (ellipsis && lines.length > maxLines && visible.length) {
    let last = visible[visible.length - 1] || "";
    while (last.length > 1 && font.widthOfTextAtSize(last + "...", size) > width) last = last.slice(0, -1);
    visible[visible.length - 1] = `${last}...`;
  }

  visible.forEach((line, index) => {
    if (!line) return;
    page.drawText(line, {
      x,
      y: page.getHeight() - top - size - index * lineHeight,
      size,
      font,
      color,
    });
  });
  return {
    lines,
    usedLines: visible.length,
    overflow: Math.max(0, lines.length - maxLines),
  };
}

function drawDotTop(page, x, top, {
  radius = 2.35,
  filled = true,
} = {}) {
  page.drawCircle({
    x,
    y: page.getHeight() - top,
    size: radius,
    color: filled ? BLACK : WHITE,
    borderColor: BLACK,
    borderWidth: 0.65,
  });
}

function captureFieldGeometry(form) {
  const fields = new Map();
  for (const field of form.getFields()) {
    const widgets = field?.acroField?.getWidgets?.() || [];
    const rect = widgets[0]?.getRectangle?.();
    if (!rect) continue;
    fields.set(field.getName(), { ...rect });
  }
  return fields;
}

function fieldRect(fields, name) {
  return fields?.get?.(name) || null;
}

function drawTextInRect(page, text, rect, {
  font,
  size = 9,
  color = BLACK,
  align = "center",
  minSize = 5.5,
  paddingX = 1.5,
  verticalAdjust = 0,
} = {}) {
  let value = sanitizePdfText(text);
  if (!value || !rect) return false;

  const usableWidth = Math.max(1, rect.width - paddingX * 2);
  let actualSize = size;
  while (actualSize > minSize && font.widthOfTextAtSize(value, actualSize) > usableWidth) actualSize -= 0.25;
  if (font.widthOfTextAtSize(value, actualSize) > usableWidth) {
    const ellipsis = "...";
    while (value.length > 1 && font.widthOfTextAtSize(value + ellipsis, actualSize) > usableWidth) value = value.slice(0, -1);
    value += ellipsis;
  }

  const textWidth = font.widthOfTextAtSize(value, actualSize);
  let x = rect.x + paddingX;
  if (align === "center") x = rect.x + Math.max(0, (rect.width - textWidth) / 2);
  if (align === "right") x = rect.x + rect.width - paddingX - textWidth;

  // Helvetica's visual center sits about .255em above its baseline. Centering
  // against the AcroForm widget rectangle eliminates the hand-tuned vertical drift
  // that showed up in browser/PDF print previews.
  const y = rect.y + rect.height / 2 - actualSize * 0.255 + verticalAdjust;
  page.drawText(value, { x, y, size: actualSize, font, color });
  return true;
}

function drawFieldText(page, fields, name, text, options = {}) {
  return drawTextInRect(page, text, fieldRect(fields, name), options);
}

function fieldContentBox(page, fields, name, paddingX = 5, paddingY = 5) {
  const rect = fieldRect(fields, name);
  if (!rect) return null;
  return {
    x: rect.x + paddingX,
    top: page.getHeight() - rect.y - rect.height + paddingY,
    width: Math.max(1, rect.width - paddingX * 2),
    height: Math.max(1, rect.height - paddingY * 2),
  };
}

function drawFieldWrapped(page, fields, name, text, {
  paddingX = 5,
  paddingY = 5,
  ...options
} = {}) {
  const box = fieldContentBox(page, fields, name, paddingX, paddingY);
  if (!box) return { lines: [], usedLines: 0, overflow: 0 };
  return drawWrappedTop(page, text, box.x, box.top, box.width, box.height, options);
}

function drawDotInRect(page, rect, {
  radius = 2.35,
  filled = true,
} = {}) {
  if (!rect) return false;
  page.drawCircle({
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
    size: radius,
    color: filled ? BLACK : WHITE,
    borderColor: BLACK,
    borderWidth: 0.65,
  });
  return true;
}

function buildFeatureText(feature) {
  const name = safeText(feature?.name);
  const description = safeText(feature?.description);
  const meta = [feature?.category, feature?.level != null ? `Level ${feature.level}` : "", feature?.source]
    .map(safeText)
    .filter(Boolean)
    .join(" - ");
  const heading = [name, meta ? `(${meta})` : ""].filter(Boolean).join(" ");
  return [heading ? `${heading}.` : "", description].filter(Boolean).join(" ");
}

function drawFeatureBlocks(page, features, box, {
  font,
  boldFont,
  size = 6.4,
  lineHeight = 7.25,
} = {}) {
  let top = box.top;
  const remaining = [];

  for (let index = 0; index < features.length; index += 1) {
    const feature = features[index];
    const text = buildFeatureText(feature);
    if (!text) continue;
    const lines = wrapText(font, text, size, box.width);
    const required = Math.max(lineHeight, lines.length * lineHeight + 3);
    if (top + required > box.top + box.height) {
      remaining.push(...features.slice(index));
      break;
    }

    const heading = safeText(feature?.name);
    if (heading) {
      drawTextTop(page, heading, box.x, top, {
        font: boldFont,
        size: Math.min(size + 0.15, 7),
        width: box.width,
      });
      top += lineHeight;
    }

    const description = safeText(feature?.description);
    if (description) {
      const descLines = wrapText(font, description, size, box.width);
      for (const line of descLines) {
        if (top + lineHeight > box.top + box.height) break;
        drawTextTop(page, line, box.x, top, { font, size, width: box.width });
        top += lineHeight;
      }
    } else if (!heading) {
      for (const line of lines) {
        drawTextTop(page, line, box.x, top, { font, size, width: box.width });
        top += lineHeight;
      }
    }
    top += 3;
  }

  return remaining;
}

function itemLine(item) {
  const qty = Number(item?.quantity || 1);
  const equipped = item?.equipped ? " [equipped]" : "";
  const slot = item?.equipped && item?.equipSlot ? ` (${item.equipSlot})` : "";
  return `${qty > 1 ? `${qty}x ` : ""}${safeText(item?.name)}${equipped}${slot}`;
}

function actionLine(action) {
  const parts = [
    safeText(action?.statusLabel),
    action?.attackBonus != null ? `attack ${formatModifier(action.attackBonus)}` : "",
    action?.saveDc != null ? `DC ${action.saveDc}${action?.saveAbilities?.length ? ` ${action.saveAbilities.join("/")}` : ""}` : "",
    safeText(action?.damage) ? `${safeText(action.damage)}${safeText(action?.damageType) ? ` ${safeText(action.damageType)}` : ""}` : "",
    safeText(action?.healing) ? `${safeText(action.healing)} healing` : "",
    safeText(action?.summary),
    safeText(action?.detail),
  ].filter(Boolean);
  return [safeText(action?.label), parts.join(" - ")].filter(Boolean).join(": ");
}

// Coordinates below are calibrated against the 612 × 792 official template.
 // Keep core numeric fields centered and favor readable text; long narrative/features
 // should overflow to the official continuation areas rather than shrinking below print-safe sizes.
function pageOne(page, model, fonts) {
  const { regular, bold } = fonts;
  const profile = model.profile || {};

  drawTextTop(page, profile.name, 70, 65, { font: regular, size: 17.5, width: 180, minSize: 11 });
  const classLevel = [profile.className, profile.subclass, profile.level ? `Lvl ${profile.level}` : ""].filter(Boolean).join(" ");
  drawTextTop(page, classLevel, 270, 75, { font: regular, size: 10, width: 105, minSize: 7 });
  drawTextTop(page, profile.background, 383, 75, { font: regular, size: 10, width: 90, minSize: 7 });
  drawTextTop(page, profile.playerName || "NPC", 480, 75, { font: regular, size: 10, width: 80, minSize: 7 });
  drawTextTop(page, [profile.species, profile.lineage].filter(Boolean).join(" - "), 270, 97, { font: regular, size: 9.3, width: 105, minSize: 6.5 });
  drawTextTop(page, profile.alignment, 383, 97, { font: regular, size: 9.3, width: 90, minSize: 6.5 });
  drawTextTop(page, model.xp == null ? "" : String(model.xp), 480, 97, { font: regular, size: 9.3, width: 80, minSize: 6.5 });

  const abilityScoreTop = [160, 232, 303, 375, 447, 518];
  model.abilities.forEach((ability, index) => {
    drawTextTop(page, ability.score, 45, abilityScoreTop[index], { font: regular, size: 17, width: 25, align: "center" });
    drawTextTop(page, formatModifier(ability.modifier), 45, abilityScoreTop[index] + 27, { font: regular, size: 10, width: 25, align: "center" });
  });

  if (model.inspiration) drawTextTop(page, "X", 106, 139, { font: bold, size: 11, width: 24, align: "center" });
  drawTextTop(page, formatModifier(model.proficiencyBonus), 99, 174, { font: regular, size: 10, width: 26, align: "center" });

  const saveTops = [207.3, 220.8, 234.3, 247.8, 261.3, 274.8];
  model.abilities.forEach((ability, index) => {
    drawTextTop(page, formatModifier(ability.saveModifier), 114, saveTops[index] + 0.4, { font: bold, size: 8.3, width: 16.5, align: "right", minSize: 7.2 });
    if (ability.saveProficient) drawDotTop(page, 104.5, saveTops[index] + 4.2, { radius: 2.45 });
  });

  const skillTops = [322.6, 336.1, 349.6, 363.1, 376.6, 390.1, 403.6, 417.1, 430.6, 444.1, 457.6, 471.1, 484.6, 498.1, 511.6, 525.1, 538.6, 552.1];
  model.skills.forEach((skill, index) => {
    drawTextTop(page, formatModifier(skill.modifier), 114, skillTops[index] + 0.3, { font: bold, size: 8.2, width: 16.5, align: "right", minSize: 7.1 });
    if (skill.proficient) drawDotTop(page, 104.5, skillTops[index] + 4.2, { radius: 2.45 });
    if (skill.expertise) drawTextTop(page, "x2", 95.5, skillTops[index] + 0.3, { font: bold, size: 5.1, width: 8, align: "right", minSize: 4.7 });
  });

  drawTextTop(page, model.armorClass, 225, 150, { font: bold, size: 15, width: 44, align: "center" });
  drawTextTop(page, formatModifier(model.initiative), 280, 150, { font: bold, size: 14, width: 47, align: "center" });
  drawTextTop(page, model.speed, 338, 150, { font: bold, size: 13.5, width: 45, align: "center", minSize: 9 });

  drawTextTop(page, model.hp.max || "", 320, 198.5, { font: bold, size: 9.8, width: 55, align: "right" });
  drawTextTop(page, model.hp.current || "", 250, 219, { font: regular, size: 17, width: 110, align: "center" });
  drawTextTop(page, model.hp.temp || "", 250, 271, { font: regular, size: 17, width: 110, align: "center" });
  drawTextTop(page, model.hp.hitDice, 235, 333.5, { font: regular, size: 11, width: 60, align: "center" });

  drawWrappedTop(page, profile.traits, 426, 151, 141, 38, { font: regular, size: 7.8, lineHeight: 8.65 });
  drawWrappedTop(page, profile.ideals, 426, 214, 141, 31, { font: regular, size: 7.8, lineHeight: 8.65 });
  drawWrappedTop(page, profile.bonds, 426, 270, 141, 31, { font: regular, size: 7.8, lineHeight: 8.65 });
  drawWrappedTop(page, profile.flaws, 426, 326, 141, 31, { font: regular, size: 7.8, lineHeight: 8.65 });

  drawTextTop(page, model.passivePerception, 34, 582, { font: bold, size: 11.5, width: 30, align: "center" });

  const trainingLines = [
    model.languages.length ? `Languages: ${model.languages.join(", ")}` : "",
    model.tools.length ? `Tools: ${model.tools.join(", ")}` : "",
    model.weapons.length ? `Weapons: ${model.weapons.join(", ")}` : "",
    model.armorProficiencies.length ? `Armor: ${model.armorProficiencies.join(", ")}` : "",
    model.professions.length ? `Professions: ${model.professions.map((entry) => `${entry.name} rank ${entry.rank}`).join(", ")}` : "",
  ].filter(Boolean).join("\n");
  drawWrappedTop(page, trainingLines, 44, 622, 145, 122, { font: regular, size: 7.4, lineHeight: 8.45 });

  const currency = model.currency || {};
  const coinRows = [
    ["cp", 611],
    ["sp", 636],
    ["ep", 663],
    ["gp", 690],
    ["pp", 716],
  ];
  coinRows.forEach(([key, top]) => {
    if (Number(currency[key] || 0) > 0) drawTextTop(page, currency[key], 226, top + 0.5, { font: bold, size: 8.2, width: 34, align: "center" });
  });

  const equipmentLines = model.inventory.map(itemLine);
  if (model.legacy?.equipment) equipmentLines.push(model.legacy.equipment);
  drawWrappedTop(page, equipmentLines.join("\n"), 270, 612, 116, 132, { font: regular, size: 7.3, lineHeight: 8.3 });

  const attacks = model.actions.filter((action) => action.attackBonus != null || safeText(action.damage)).slice(0, 3);
  const attackTops = [398, 418, 438];
  attacks.forEach((action, index) => {
    drawTextTop(page, action.label, 223, attackTops[index] + 0.5, { font: bold, size: 7.9, width: 72, minSize: 6 });
    drawTextTop(page, action.attackBonus == null ? "" : formatModifier(action.attackBonus), 297, attackTops[index] + 0.5, { font: bold, size: 7.9, width: 30, align: "center" });
    const damage = [action.damage, action.damageType].filter(Boolean).join(" ");
    drawTextTop(page, damage, 331, attackTops[index] + 0.5, { font: regular, size: 7.4, width: 58, minSize: 5.8 });
  });

  const usedIds = new Set(attacks.map((action) => action.id));
  const actionDetail = model.actions
    .filter((action) => !usedIds.has(action.id))
    .map(actionLine);
  if (model.legacy?.attacks) actionDetail.push(model.legacy.attacks);
  drawWrappedTop(page, actionDetail.join("\n\n"), 223, 457, 164, 101, { font: regular, size: 6.9, lineHeight: 7.8 });

  return drawFeatureBlocks(page, model.features || [], {
    x: 423,
    top: 393,
    width: 147,
    height: 350,
  }, { font: regular, boldFont: bold, size: 7.1, lineHeight: 8.1 });
}

async function embedPortrait(pdfDoc, page, url, fetchImpl) {
  if (!url || typeof fetchImpl !== "function") return false;
  try {
    const response = await fetchImpl(url, { mode: "cors" });
    if (!response.ok) return false;
    const blob = await response.blob();
    let bytes;
    let kind = String(blob.type || response.headers?.get?.("content-type") || "").toLowerCase();
    if (kind.includes("png") || kind.includes("jpeg") || kind.includes("jpg")) {
      bytes = new Uint8Array(await blob.arrayBuffer());
    } else if (typeof document !== "undefined") {
      const bitmap = typeof createImageBitmap === "function" ? await createImageBitmap(blob) : null;
      if (!bitmap) return false;
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      bitmap.close?.();
      if (!pngBlob) return false;
      bytes = new Uint8Array(await pngBlob.arrayBuffer());
      kind = "image/png";
    } else {
      return false;
    }

    const image = kind.includes("png") ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    const fitted = image.scaleToFit(151, 188);
    const x = 42 + (151 - fitted.width) / 2;
    const top = 132 + (188 - fitted.height) / 2;
    page.drawImage(image, {
      x,
      y: page.getHeight() - top - fitted.height,
      width: fitted.width,
      height: fitted.height,
    });
    return true;
  } catch {
    return false;
  }
}

async function pageTwo(pdfDoc, page, model, fonts, overflowFeatures, fetchImpl) {
  const { regular, bold } = fonts;
  const profile = model.profile || {};

  drawTextTop(page, profile.name, 70, 68, { font: regular, size: 16.5, width: 180, minSize: 10 });
  drawTextTop(page, profile.age, 266, 76, { font: regular, size: 9.5, width: 90, minSize: 7 });
  drawTextTop(page, profile.height, 379, 76, { font: regular, size: 9.5, width: 80, minSize: 7 });
  drawTextTop(page, profile.weight, 475, 76, { font: regular, size: 9.5, width: 85, minSize: 7 });
  drawTextTop(page, profile.eyes, 266, 102, { font: regular, size: 9.5, width: 90, minSize: 7 });
  drawTextTop(page, profile.skin, 379, 102, { font: regular, size: 9.5, width: 80, minSize: 7 });
  drawTextTop(page, profile.hair, 475, 102, { font: regular, size: 9.5, width: 85, minSize: 7 });

  const portraitPlaced = await embedPortrait(pdfDoc, page, profile.portraitUrl, fetchImpl);
  if (profile.appearance) {
    drawWrappedTop(page, profile.appearance, 42, portraitPlaced ? 322 : 134, 151, portraitPlaced ? 23 : 200, {
      font: regular,
      size: portraitPlaced ? 6.4 : 7.8,
      lineHeight: portraitPlaced ? 7.1 : 8.8,
    });
  }

  const alliesText = [
    profile.affiliation ? `Affiliation: ${profile.affiliation}` : "",
    profile.role ? `Role: ${profile.role}` : "",
    profile.location ? `Location: ${profile.location}` : "",
    profile.tags?.length ? `Tags: ${profile.tags.join(", ")}` : "",
    model.notes?.length ? `Notes:\n${model.notes.map((note) => `- ${note.body}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  drawWrappedTop(page, alliesText, 233, 137, 334, 199, { font: regular, size: 7.4, lineHeight: 8.45 });

  drawFeatureBlocks(page, overflowFeatures || [], {
    x: 233,
    top: 393,
    width: 334,
    height: 180,
  }, { font: regular, boldFont: bold, size: 7.15, lineHeight: 8.1 });

  const backstory = [
    profile.description ? `Description: ${profile.description}` : "",
    profile.backgroundNarrative && profile.backgroundNarrative !== profile.background ? `Backstory: ${profile.backgroundNarrative}` : "",
    profile.motivation ? `Motivation: ${profile.motivation}` : "",
    profile.quirk ? `Quirk: ${profile.quirk}` : "",
    profile.mannerism ? `Mannerism: ${profile.mannerism}` : "",
    profile.voice ? `Voice: ${profile.voice}` : "",
    profile.secret ? `Secret: ${profile.secret}` : "",
  ].filter(Boolean).join("\n\n");
  drawWrappedTop(page, backstory, 45, 393, 146, 345, { font: regular, size: 7.2, lineHeight: 8.2 });

  const treasure = [
    model.legacy?.treasure ? model.legacy.treasure : "",
    Object.values(model.currency || {}).some((value) => Number(value || 0) > 0)
      ? `Coin: ${["cp", "sp", "ep", "gp", "pp"].map((key) => Number(model.currency?.[key] || 0) ? `${model.currency[key]} ${key.toUpperCase()}` : "").filter(Boolean).join(", ")}`
      : "",
    model.inventory.length ? `Inventory:\n${model.inventory.map(itemLine).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  drawWrappedTop(page, treasure, 233, 618, 334, 120, { font: regular, size: 7.2, lineHeight: 8.15 });
}

function spellLayout(level) {
  const layouts = {
    0: { x: 55, top: 184, width: 135, pitch: 18.0, max: 6, dotX: null },
    1: { x: 55, top: 360, width: 135, pitch: 14.4, max: 11, dotX: 36 },
    2: { x: 55, top: 580, width: 135, pitch: 14.4, max: 12, dotX: 36 },
    3: { x: 242, top: 184, width: 138, pitch: 14.4, max: 11, dotX: 224 },
    4: { x: 242, top: 416, width: 138, pitch: 14.4, max: 11, dotX: 224 },
    5: { x: 242, top: 650, width: 138, pitch: 14.4, max: 7, dotX: 224 },
    6: { x: 430, top: 184, width: 138, pitch: 14.4, max: 8, dotX: 412 },
    7: { x: 430, top: 357, width: 138, pitch: 14.4, max: 7, dotX: 412 },
    8: { x: 430, top: 535, width: 138, pitch: 14.4, max: 6, dotX: 412 },
    9: { x: 430, top: 671, width: 138, pitch: 14.4, max: 6, dotX: 412 },
  };
  return layouts[level] || null;
}

function pageThree(page, model, fonts) {
  const { regular, bold } = fonts;
  const casting = model.spellcasting || {};
  const profile = model.profile || {};
  drawTextTop(page, casting.className || profile.className, 72, 69, { font: regular, size: 13, width: 170, minSize: 8.5 });
  drawTextTop(page, casting.ability, 284, 67, { font: bold, size: 13, width: 60, align: "center" });
  drawTextTop(page, casting.saveDc == null ? "" : casting.saveDc, 394, 67, { font: bold, size: 13, width: 60, align: "center" });
  drawTextTop(page, casting.attackBonus == null ? "" : formatModifier(casting.attackBonus), 499, 67, { font: bold, size: 13, width: 60, align: "center" });

  const slotPositions = {
    1: [80, 310],
    2: [80, 541],
    3: [268, 149],
    4: [268, 381],
    5: [268, 614],
    6: [456, 149],
    7: [456, 323],
    8: [456, 500],
    9: [456, 640],
  };
  for (let level = 1; level <= 9; level += 1) {
    const total = Number(casting.slots?.[level - 1] || 0);
    if (!total) continue;
    const [x, top] = slotPositions[level];
    drawTextTop(page, total, x, top + 0.5, { font: bold, size: 9.3, width: 28, align: "center" });
  }

  const byLevel = new Map();
  for (const spell of model.spells || []) {
    const level = Math.max(0, Math.min(9, Number(spell.level || 0)));
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level).push(spell);
  }

  for (let level = 0; level <= 9; level += 1) {
    const layout = spellLayout(level);
    if (!layout) continue;
    const spells = byLevel.get(level) || [];
    const visible = spells.slice(0, layout.max);
    visible.forEach((spell, index) => {
      const top = layout.top + index * layout.pitch;
      drawTextTop(page, spell.name, layout.x, top, {
        font: regular,
        size: 8.2,
        width: layout.width,
        minSize: 6.1,
      });
      if (layout.dotX != null && spell.prepared) drawDotTop(page, layout.dotX, top + 4.1, { radius: 2.15 });
      if (layout.dotX != null && spell.alwaysAvailable && !spell.prepared) {
        page.drawCircle({
          x: layout.dotX,
          y: page.getHeight() - (top + 4.1),
          size: 2.15,
          borderColor: BLACK,
          borderWidth: 1,
        });
      }
    });
    if (spells.length > layout.max) {
      const top = layout.top + (layout.max - 1) * layout.pitch;
      drawTextTop(page, `+${spells.length - layout.max} more`, layout.x + 82, top, {
        font: bold,
        size: 6.3,
        width: layout.width - 82,
        align: "right",
      });
    }
  }
}

export async function buildOfficialCharacterSheetPdf({
  model,
  templateUrl = OFFICIAL_CHARACTER_SHEET_TEMPLATE_URL,
  fetchImpl = typeof fetch === "function" ? fetch.bind(globalThis) : null,
} = {}) {
  if (!model || typeof model !== "object") throw new Error("A printable character-sheet model is required.");
  if (typeof fetchImpl !== "function") throw new Error("PDF generation requires browser fetch support.");

  const templateResponse = await fetchImpl(templateUrl);
  if (!templateResponse.ok) throw new Error(`Could not load the official character-sheet template (${templateResponse.status}).`);
  const templateBytes = new Uint8Array(await templateResponse.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });

  if (pdfDoc.getPageCount() < 3) throw new Error("The official character-sheet template must contain all three pages.");

  try {
    const form = pdfDoc.getForm();
    form.flatten();
  } catch {
    // The user-provided/browser-printed edition may already be flattened.
  }

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };

  const pages = pdfDoc.getPages();
  const overflowFeatures = pageOne(pages[0], model, fonts);
  await pageTwo(pdfDoc, pages[1], model, fonts, overflowFeatures, fetchImpl);
  pageThree(pages[2], model, fonts);

  pdfDoc.setTitle(`${safeText(model.profile?.name) || "Character"} - DNDNext Character Sheet`);
  pdfDoc.setSubject("DNDNext printable character sheet");
  pdfDoc.setCreator("DNDNext");
  pdfDoc.setProducer("DNDNext / pdf-lib");

  return pdfDoc.save({ useObjectStreams: false });
}

export function safeOfficialSheetFilename(name) {
  const base = safeText(name || "character")
    .replace(/[^a-zA-Z0-9 _.-]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ /g, "_");
  return `${base || "character"}_Character_Sheet.pdf`;
}
