import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatePath = path.resolve(__dirname, '../public/assets/commit-podium.jpeg');

function findFirstExisting(candidates) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const boldFontPath = findFirstExisting([
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
  '/usr/share/fonts/truetype/lato/Lato-Bold.ttf'
]);

const regularFontPath = findFirstExisting([
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
  '/usr/share/fonts/truetype/lato/Lato-Regular.ttf'
]);

const boldFontBase64 = boldFontPath ? fs.readFileSync(boldFontPath).toString('base64') : null;
const regularFontBase64 = regularFontPath ? fs.readFileSync(regularFontPath).toString('base64') : null;

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function splitLongWord(word, maxChars) {
  if (word.length <= maxChars) return [word];
  const parts = [];
  let current = word;
  while (current.length > maxChars) {
    parts.push(`${current.slice(0, Math.max(1, maxChars - 1))}…`);
    current = current.slice(Math.max(1, maxChars - 1));
  }
  if (current) parts.push(current);
  return parts;
}

function wrapLines(text, maxCharsPerLine = 18, maxLines = 2) {
  const normalized = normalizeText(text);
  if (!normalized) return ['—'];

  const words = normalized
    .split(' ')
    .flatMap((word) => splitLongWord(word, maxCharsPerLine + 4));

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

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  const consumedLength = lines.join(' ').length;
  if (normalized.length > consumedLength && lines.length) {
    const lastIndex = lines.length - 1;
    const last = lines[lastIndex].replace(/…$/, '');
    lines[lastIndex] = `${last.slice(0, Math.max(1, maxCharsPerLine - 1)).trim()}…`;
  }

  return lines.slice(0, maxLines);
}

function getFontCss() {
  const css = [];

  if (regularFontBase64) {
    css.push(`@font-face {
      font-family: 'PodiumSans';
      src: url(data:font/ttf;base64,${regularFontBase64}) format('truetype');
      font-weight: 400;
      font-style: normal;
    }`);
  }

  if (boldFontBase64) {
    css.push(`@font-face {
      font-family: 'PodiumSans';
      src: url(data:font/ttf;base64,${boldFontBase64}) format('truetype');
      font-weight: 700;
      font-style: normal;
    }`);
  }

  css.push(`
    .podium-text {
      font-family: 'PodiumSans', 'DejaVu Sans', sans-serif;
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: antialiased;
    }
  `);

  return css.join('\n');
}

function drawTextLines({ lines, centerX, centerY, fontSize, lineHeight, fill, stroke, strokeWidth, fontWeight = 700 }) {
  const totalHeight = (lines.length - 1) * lineHeight;
  const firstY = centerY - totalHeight / 2;

  return lines.map((line, index) => `
    <text
      class="podium-text"
      x="${centerX}"
      y="${firstY + index * lineHeight}"
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="${fontSize}"
      font-weight="${fontWeight}"
      fill="${fill}"
      stroke="${stroke}"
      stroke-width="${strokeWidth}"
      paint-order="stroke fill"
      lengthAdjust="spacingAndGlyphs"
    >${escapeXml(line)}</text>
  `).join('');
}

function fitFontSize(lines, boxWidth, preferredSize, minSize) {
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0) || 1;
  const estimated = Math.floor((boxWidth * 1.72) / longest);
  return clamp(Math.min(preferredSize, estimated), minSize, preferredSize);
}

function nameBlock({ x, y, width, height, text, highlight = false }) {
  const normalized = normalizeText(text) || '—';
  const lines = wrapLines(normalized, normalized.length > 14 ? 11 : 13, 2);
  const fontSize = fitFontSize(lines, width - 24, 44, 24);
  const lineHeight = Math.round(fontSize * 1.05);

  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="18" ry="18"
        fill="rgba(14,30,46,0.82)" stroke="rgba(255,255,255,0.96)" stroke-width="4"/>
      ${drawTextLines({
        lines,
        centerX: x + width / 2,
        centerY: y + height / 2,
        fontSize,
        lineHeight,
        fill: highlight ? '#ffe9a3' : '#ffffff',
        stroke: 'rgba(8,12,18,0.96)',
        strokeWidth: 7,
        fontWeight: 700
      })}
    </g>
  `;
}

function titleBlock({ width, text }) {
  const normalized = normalizeText(text) || 'Track semanal';
  const lines = wrapLines(normalized, 22, 2);
  const boxX = 44;
  const boxY = 34;
  const boxWidth = width - 88;
  const boxHeight = 136;
  const fontSize = fitFontSize(lines, boxWidth - 48, 62, 32);
  const lineHeight = Math.round(fontSize * 1.08);

  return `
    <g>
      <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="24" ry="24"
        fill="rgba(13,31,46,0.88)" stroke="rgba(255,230,150,0.95)" stroke-width="6"/>
      ${drawTextLines({
        lines,
        centerX: width / 2,
        centerY: boxY + boxHeight / 2,
        fontSize,
        lineHeight,
        fill: '#ffe89a',
        stroke: 'rgba(6,12,18,0.98)',
        strokeWidth: 9,
        fontWeight: 700
      })}
    </g>
  `;
}

function buildOverlay({ width, height, trackName, winners }) {
  const [first, second, third] = winners;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <style><![CDATA[
          ${getFontCss()}
        ]]></style>
      </defs>
      ${titleBlock({ width, text: trackName })}
      ${nameBlock({ x: 56, y: 700, width: 270, height: 104, text: second, highlight: false })}
      ${nameBlock({ x: 356, y: 530, width: 312, height: 108, text: first, highlight: true })}
      ${nameBlock({ x: 698, y: 700, width: 270, height: 104, text: third, highlight: false })}
    </svg>
  `;
}

export async function buildTrackPodiumImage({ trackName, firstPilot, secondPilot, thirdPilot }) {
  const template = sharp(templatePath);
  const metadata = await template.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1536;

  const overlay = buildOverlay({
    width,
    height,
    trackName: trackName || 'Track semanal',
    winners: [firstPilot || '—', secondPilot || '—', thirdPilot || '—']
  });

  return template
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .jpeg({ quality: 94 })
    .toBuffer();
}
