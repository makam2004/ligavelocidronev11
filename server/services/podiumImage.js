import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatePath = path.resolve(__dirname, '../public/assets/commit-podium.jpeg');

function findFontPath() {
  const candidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf'
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

const EMBED_FONT_PATH = findFontPath();
const EMBED_FONT_BASE64 = EMBED_FONT_PATH ? fs.readFileSync(EMBED_FONT_PATH).toString('base64') : null;
const FONT_FAMILY = 'LigaPodiumBold';

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

function truncateToFit(text, maxChars) {
  const normalized = normalizeText(text) || '—';
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(1, maxChars - 1)).trim()}…`;
}

function wrapLines(text, maxCharsPerLine = 18, maxLines = 2) {
  const normalized = normalizeText(text) || '—';
  const words = normalized.split(' ');
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
  const consumed = lines.join(' ');
  if (normalized.length > consumed.length && lines.length) {
    lines[lines.length - 1] = truncateToFit(lines[lines.length - 1], maxCharsPerLine);
  }

  return lines.slice(0, maxLines);
}

function buildTextLines({ lines, centerX, startY, lineHeight, fontSize, fill, stroke, strokeWidth }) {
  return lines.map((line, index) => `
    <text x="${centerX}" y="${startY + index * lineHeight}" text-anchor="middle"
      font-family="${FONT_FAMILY}" font-size="${fontSize}" font-weight="700"
      fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" paint-order="stroke fill"
      dominant-baseline="middle">${escapeXml(line)}</text>`).join('');
}

function buildFontFaceCss() {
  if (!EMBED_FONT_BASE64) return '';
  return `
    @font-face {
      font-family: '${FONT_FAMILY}';
      src: url(data:font/ttf;base64,${EMBED_FONT_BASE64}) format('truetype');
      font-weight: 700;
      font-style: normal;
    }
  `;
}

function buildTrackTitle({ width, text }) {
  const normalized = normalizeText(text) || 'Track semanal';
  const lines = wrapLines(normalized, 28, 2);
  const fontSize = clamp(58 - Math.max(0, normalized.length - 20), 30, 58);
  const lineHeight = Math.round(fontSize * 1.08);
  const boxWidth = width - 90;
  const boxX = 45;
  const boxHeight = 150;
  const boxY = 30;
  const startY = boxY + (boxHeight / 2) - ((lines.length - 1) * lineHeight) / 2;

  return `
    <g>
      <rect x="${boxX}" y="${boxY}" rx="26" ry="26" width="${boxWidth}" height="${boxHeight}" fill="rgba(13,31,46,0.80)" stroke="rgba(255,230,150,0.95)" stroke-width="6" />
      ${buildTextLines({
        lines,
        centerX: width / 2,
        startY,
        lineHeight,
        fontSize,
        fill: '#ffe89a',
        stroke: 'rgba(6,12,18,0.96)',
        strokeWidth: 8
      })}
    </g>`;
}

function buildNamePill({ centerX, centerY, width, text, fill = '#ffffff' }) {
  const normalized = truncateToFit(text, 20);
  const fontSize = clamp(34 - Math.max(0, normalized.length - 10), 18, 34);
  const height = 86;
  const x = Math.round(centerX - width / 2);
  const y = Math.round(centerY - height / 2);

  return `
    <g>
      <rect x="${x}" y="${y}" rx="18" ry="18" width="${width}" height="${height}" fill="rgba(13,31,46,0.82)" stroke="rgba(255,255,255,0.95)" stroke-width="4" />
      ${buildTextLines({
        lines: [normalized || '—'],
        centerX,
        startY: centerY,
        lineHeight: fontSize,
        fontSize,
        fill,
        stroke: 'rgba(8,12,18,0.96)',
        strokeWidth: 6
      })}
    </g>`;
}

function buildOverlay({ width, height, trackName, firstPilot, secondPilot, thirdPilot }) {
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        ${buildFontFaceCss()}
        text { font-family: '${FONT_FAMILY}', sans-serif; }
      </style>
      ${buildTrackTitle({ width, text: trackName })}
      ${buildNamePill({ centerX: 512, centerY: 565, width: 305, text: firstPilot, fill: '#fff2b8' })}
      ${buildNamePill({ centerX: 175, centerY: 770, width: 260, text: secondPilot, fill: '#ffffff' })}
      ${buildNamePill({ centerX: 848, centerY: 770, width: 260, text: thirdPilot, fill: '#ffffff' })}
    </svg>`;
}

export async function buildTrackPodiumImage({ trackName, firstPilot, secondPilot, thirdPilot }) {
  const template = sharp(templatePath);
  const metadata = await template.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1536;

  const overlaySvg = buildOverlay({
    width,
    height,
    trackName: trackName || 'Track semanal',
    firstPilot: firstPilot || '—',
    secondPilot: secondPilot || '—',
    thirdPilot: thirdPilot || '—'
  });

  return template
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .jpeg({ quality: 94 })
    .toBuffer();
}
