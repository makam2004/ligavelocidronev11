import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatePath = path.resolve(__dirname, '../public/assets/commit-podium.jpeg');

const FONT = 'DejaVu Sans Bold';
const FALLBACK_TRACK = 'Track semanal';

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeText(value, fallback = '—') {
  const normalized = normalizeText(value);
  return normalized || fallback;
}

function truncate(value, maxChars) {
  const normalized = safeText(value);
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(1, maxChars - 1)).trim()}…`;
}

function wrapTrackTitle(value, maxCharsPerLine = 34, maxLines = 2) {
  const text = safeText(value, FALLBACK_TRACK);
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }

  if (lines.length < maxLines && current) lines.push(current);
  const remaining = words.join(' ').slice(lines.join(' ').length).trim();
  if (remaining && lines.length) {
    lines[lines.length - 1] = truncate(`${lines[lines.length - 1]} ${remaining}`, maxCharsPerLine);
  }

  return lines.slice(0, maxLines);
}

function roundedRectSvg(width, height, radius, fill, stroke, strokeWidth, fillOpacity = 1) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect
        x="${strokeWidth / 2}"
        y="${strokeWidth / 2}"
        width="${width - strokeWidth}"
        height="${height - strokeWidth}"
        rx="${radius}"
        ry="${radius}"
        fill="${fill}"
        fill-opacity="${fillOpacity}"
        stroke="${stroke}"
        stroke-width="${strokeWidth}"
      />
    </svg>
  `);
}

async function makeTextBuffer(text, { width, dpi = 144, align = 'center', rgba = true } = {}) {
  const buffer = await sharp({
    text: {
      text,
      font: FONT,
      width,
      align,
      rgba,
      dpi
    }
  })
    .png()
    .toBuffer();

  const meta = await sharp(buffer).metadata();
  return { buffer, width: meta.width || 0, height: meta.height || 0 };
}

function centeredLeft(totalWidth, itemWidth) {
  return Math.round((totalWidth - itemWidth) / 2);
}

async function addTrackTitle(composites, canvasWidth, trackName) {
  const box = { left: 45, top: 28, width: canvasWidth - 90, height: 140 };
  composites.push({
    input: roundedRectSvg(box.width, box.height, 26, '#0d1f2e', '#ffe89a', 6, 0.84),
    left: box.left,
    top: box.top
  });

  const lines = wrapTrackTitle(trackName);
  const titleText = await makeTextBuffer(lines.join('\n'), {
    width: box.width - 80,
    dpi: 170
  });

  composites.push({
    input: titleText.buffer,
    left: box.left + centeredLeft(box.width, titleText.width),
    top: box.top + centeredLeft(box.height, titleText.height)
  });
}

async function addPilotPill(composites, { left, top, width, height, text }) {
  composites.push({
    input: roundedRectSvg(width, height, 18, '#0d1f2e', '#ffffff', 4, 0.82),
    left,
    top
  });

  const label = await makeTextBuffer(truncate(text, 18), {
    width: width - 26,
    dpi: 150
  });

  composites.push({
    input: label.buffer,
    left: left + centeredLeft(width, label.width),
    top: top + centeredLeft(height, label.height)
  });
}

export async function buildTrackPodiumImage({ trackName, firstPilot, secondPilot, thirdPilot }) {
  const template = sharp(templatePath);
  const metadata = await template.metadata();
  const width = metadata.width || 1024;

  const composites = [];

  await addTrackTitle(composites, width, safeText(trackName, FALLBACK_TRACK));

  await addPilotPill(composites, {
    left: 345,
    top: 530,
    width: 310,
    height: 80,
    text: safeText(firstPilot)
  });

  await addPilotPill(composites, {
    left: 42,
    top: 735,
    width: 260,
    height: 76,
    text: safeText(secondPilot)
  });

  await addPilotPill(composites, {
    left: 722,
    top: 735,
    width: 260,
    height: 76,
    text: safeText(thirdPilot)
  });

  return template
    .composite(composites)
    .jpeg({ quality: 94 })
    .toBuffer();
}
