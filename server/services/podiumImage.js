import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.resolve(__dirname, '../public/assets');
const templatePath = path.join(assetsDir, 'commit-podium.jpeg');
const fontPath = path.join(assetsDir, 'NotoSans-Regular.ttf');

const FALLBACK_TRACK = 'Track semanal';
const FONT_DATA = fs.readFileSync(fontPath).toString('base64');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function safeText(value, fallback = '—') {
  const text = normalizeText(value);
  return text || fallback;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(value, maxChars) {
  const text = safeText(value);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1)).trim()}…`;
}

function wrapWords(value, maxCharsPerLine, maxLines = 2) {
  const words = safeText(value).split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (!current || next.length <= maxCharsPerLine) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }

  if (lines.length < maxLines && current) lines.push(current);
  if (!lines.length) lines.push(FALLBACK_TRACK);

  const flattened = words.join(' ');
  const consumed = lines.join(' ').length;
  const remaining = flattened.slice(consumed).trim();
  if (remaining && lines.length) {
    lines[lines.length - 1] = truncate(`${lines[lines.length - 1]} ${remaining}`, maxCharsPerLine);
  }

  return lines.slice(0, maxLines);
}

function multilineText({ x, y, lines, fontSize, lineHeight, fill, stroke = '#000000', strokeWidth = 1.4, anchor = 'middle' }) {
  const safeLines = lines.map((line) => escapeXml(line));
  const startY = y - ((safeLines.length - 1) * lineHeight) / 2;
  return `
    <text x="${x}" y="${startY}" text-anchor="${anchor}" font-family="PodiumFont, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" paint-order="stroke fill" dominant-baseline="middle">
      ${safeLines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${line}</tspan>`).join('')}
    </text>
  `;
}

function singleLineText({ x, y, text, fontSize, fill, stroke = '#000000', strokeWidth = 1.3, anchor = 'middle' }) {
  return `
    <text x="${x}" y="${y}" text-anchor="${anchor}" font-family="PodiumFont, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" paint-order="stroke fill" dominant-baseline="middle">${escapeXml(text)}</text>
  `;
}

function pill({ x, y, w, h, radius = 20, fill = '#10273a', fillOpacity = 0.84, stroke = '#ffffff', strokeWidth = 4 }) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function titleBox(width) {
  return `<rect x="44" y="28" width="${width - 88}" height="138" rx="26" ry="26" fill="#10273a" fill-opacity="0.84" stroke="#ffe89a" stroke-width="6"/>`;
}

export async function buildTrackPodiumImage({ trackName, firstPilot, secondPilot, thirdPilot }) {
  const template = sharp(templatePath);
  const meta = await template.metadata();
  const width = meta.width || 1024;
  const height = meta.height || 1536;

  const titleLines = wrapWords(safeText(trackName, FALLBACK_TRACK), 26, 2);
  const first = truncate(firstPilot || '—', 16);
  const second = truncate(secondPilot || '—', 16);
  const third = truncate(thirdPilot || '—', 16);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <style>
        @font-face {
          font-family: 'PodiumFont';
          src: url('data:font/ttf;base64,${FONT_DATA}') format('truetype');
          font-weight: 700;
          font-style: normal;
        }
      </style>
    </defs>

    ${titleBox(width)}
    ${multilineText({ x: width / 2, y: 97, lines: titleLines, fontSize: 42, lineHeight: 46, fill: '#ffffff', stroke: '#000000', strokeWidth: 2.2 })}

    ${pill({ x: 335, y: 505, w: 320, h: 78 })}
    ${singleLineText({ x: 495, y: 544, text: first, fontSize: 30, fill: '#ffffff', stroke: '#000000', strokeWidth: 1.8 })}

    ${pill({ x: 46, y: 704, w: 270, h: 74 })}
    ${singleLineText({ x: 181, y: 741, text: second, fontSize: 28, fill: '#ffffff', stroke: '#000000', strokeWidth: 1.8 })}

    ${pill({ x: 708, y: 704, w: 270, h: 74 })}
    ${singleLineText({ x: 843, y: 741, text: third, fontSize: 28, fill: '#ffffff', stroke: '#000000', strokeWidth: 1.8 })}
  </svg>`;

  return template
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 94 })
    .toBuffer();
}
