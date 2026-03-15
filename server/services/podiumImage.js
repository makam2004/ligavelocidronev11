import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatePath = path.resolve(__dirname, '../public/assets/commit-podium.jpeg');
const FONT_FAMILY = 'LigaPodium';
let cachedFontDataUri = null;

function resolveFontDataUri() {
  if (cachedFontDataUri) return cachedFontDataUri;

  const fontCandidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf',
    '/usr/share/fonts/truetype/lato/Lato-Black.ttf',
    '/usr/share/fonts/truetype/lato/Lato-Bold.ttf'
  ];

  for (const fontPath of fontCandidates) {
    if (fs.existsSync(fontPath)) {
      const ext = path.extname(fontPath).toLowerCase();
      const mime = ext === '.otf' ? 'font/otf' : 'font/ttf';
      const encoded = fs.readFileSync(fontPath).toString('base64');
      cachedFontDataUri = `data:${mime};base64,${encoded}`;
      return cachedFontDataUri;
    }
  }

  cachedFontDataUri = '';
  return cachedFontDataUri;
}

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
  let remaining = word;
  while (remaining.length > maxChars) {
    parts.push(`${remaining.slice(0, Math.max(1, maxChars - 1))}…`);
    remaining = remaining.slice(Math.max(1, maxChars - 1));
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function wrapLines(text, maxCharsPerLine = 12, maxLines = 2) {
  const normalized = normalizeText(text);
  if (!normalized) return ['—'];

  const sourceWords = normalized.split(' ').flatMap((word) => splitLongWord(word, maxCharsPerLine + 4));
  const lines = [];
  let current = '';

  for (const word of sourceWords) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) {
      break;
    }
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  const consumed = lines.join(' ').trim();
  if (normalized.length > consumed.length && lines.length) {
    const lastIndex = lines.length - 1;
    const lastLine = lines[lastIndex];
    lines[lastIndex] = lastLine.length > maxCharsPerLine - 1
      ? `${lastLine.slice(0, Math.max(1, maxCharsPerLine - 1)).trim()}…`
      : `${lastLine}…`;
  }

  return lines.slice(0, maxLines);
}

function computeFontSize(text, maxCharsPerLine, baseSize, minSize, maxLines = 2) {
  const wrapped = wrapLines(text, maxCharsPerLine, maxLines);
  const maxLength = wrapped.reduce((acc, line) => Math.max(acc, line.length), 0);
  if (maxLength <= maxCharsPerLine) return baseSize;
  const penalty = (maxLength - maxCharsPerLine) * 2;
  return clamp(baseSize - penalty, minSize, baseSize);
}

function buildTextLines({ lines, centerX, startY, lineHeight, fontSize, fill, stroke, strokeWidth }) {
  return lines.map((line, index) => `
    <text x="${centerX}" y="${startY + index * lineHeight}" text-anchor="middle"
      font-family="${FONT_FAMILY}" font-size="${fontSize}" font-weight="900"
      fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" paint-order="stroke fill"
      dominant-baseline="middle">${escapeXml(line)}</text>`).join('');
}

function buildNameBlock({ x, y, width, height, text, fill = '#ffffff' }) {
  const normalized = normalizeText(text) || '—';
  const maxCharsPerLine = normalized.length > 16 ? 11 : 13;
  const lines = wrapLines(normalized, maxCharsPerLine, 2);
  const fontSize = computeFontSize(normalized, maxCharsPerLine, 52, 28, 2);
  const lineHeight = Math.round(fontSize * 1.02);
  const startY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;

  return `
    <g>
      <rect x="${x}" y="${y}" rx="22" ry="22" width="${width}" height="${height}" fill="rgba(20,30,40,0.78)" stroke="rgba(255,255,255,0.95)" stroke-width="4" />
      ${buildTextLines({
        lines,
        centerX: x + width / 2,
        startY,
        lineHeight,
        fontSize,
        fill,
        stroke: 'rgba(8,12,18,0.92)',
        strokeWidth: 8
      })}
    </g>`;
}

function buildTrackTitle({ width, text }) {
  const normalized = normalizeText(text) || 'Track semanal';
  const lines = wrapLines(normalized, 24, 2);
  const fontSize = computeFontSize(normalized, 24, 58, 28, 2);
  const lineHeight = Math.round(fontSize * 1.02);
  const boxWidth = width - 96;
  const boxX = 48;
  const boxHeight = 150;
  const boxY = 38;
  const startY = boxY + boxHeight / 2 - ((lines.length - 1) * lineHeight) / 2;

  return `
    <g>
      <rect x="${boxX}" y="${boxY}" rx="26" ry="26" width="${boxWidth}" height="${boxHeight}" fill="rgba(13,31,46,0.82)" stroke="rgba(255,230,150,0.95)" stroke-width="6" />
      ${buildTextLines({
        lines,
        centerX: width / 2,
        startY,
        lineHeight,
        fontSize,
        fill: '#ffe89a',
        stroke: 'rgba(6,12,18,0.92)',
        strokeWidth: 10
      })}
    </g>`;
}

function buildPodiumOverlay({ width, height, trackName, winners }) {
  const [first, second, third] = winners;
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        @font-face {
          font-family: '${FONT_FAMILY}';
          src: url('${resolveFontDataUri()}') format('truetype');
          font-weight: 400 900;
          font-style: normal;
        }
        text { font-family: '${FONT_FAMILY}', Arial, Helvetica, sans-serif; }
      </style>
      ${buildTrackTitle({ width, text: trackName })}
      ${buildNameBlock({ x: 74, y: 640, width: 270, height: 124, text: second || '—' })}
      ${buildNameBlock({ x: 352, y: 470, width: 320, height: 132, text: first || '—', fill: '#fff2b8' })}
      ${buildNameBlock({ x: 690, y: 640, width: 270, height: 124, text: third || '—' })}
    </svg>`;
}

export async function buildTrackPodiumImage({ trackName, firstPilot, secondPilot, thirdPilot }) {
  const template = sharp(templatePath);
  const metadata = await template.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1536;

  const overlaySvg = buildPodiumOverlay({
    width,
    height,
    trackName: trackName || 'Track semanal',
    winners: [firstPilot, secondPilot, thirdPilot]
  });

  return template
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .jpeg({ quality: 94 })
    .toBuffer();
}
