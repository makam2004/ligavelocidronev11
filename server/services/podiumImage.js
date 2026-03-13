import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatePath = path.resolve(__dirname, '../public/assets/commit-podium.jpeg');

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

function wrapLines(text, maxCharsPerLine = 12, maxLines = 2) {
  const normalized = String(text || '').trim();
  if (!normalized) return ['—'];

  const words = normalized.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  let index = 0;

  while (index < words.length && lines.length < maxLines) {
    const word = words[index];
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxCharsPerLine || !current) {
      current = candidate;
      index += 1;
      continue;
    }

    lines.push(current);
    current = '';
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  if (index < words.length && lines.length) {
    const rest = words.slice(index).join(' ');
    const lastIndex = lines.length - 1;
    const combined = `${lines[lastIndex]} ${rest}`.trim();
    lines[lastIndex] = combined.length > maxCharsPerLine + 8
      ? `${combined.slice(0, maxCharsPerLine + 5).trim()}…`
      : combined;
  }

  return lines.slice(0, maxLines);
}

function computeFontSize(text, maxCharsPerLine, baseSize, minSize) {
  const maxLength = wrapLines(text, maxCharsPerLine, 2).reduce((acc, line) => Math.max(acc, line.length), 0);
  if (maxLength <= maxCharsPerLine) return baseSize;
  const penalty = (maxLength - maxCharsPerLine) * 2;
  return clamp(baseSize - penalty, minSize, baseSize);
}

function buildNameBlock({ x, y, width, height, text, fill = '#ffffff' }) {
  const maxCharsPerLine = text.length > 14 ? 11 : 13;
  const lines = wrapLines(text, maxCharsPerLine, 2);
  const fontSize = computeFontSize(text, maxCharsPerLine, 52, 30);
  const lineHeight = Math.round(fontSize * 1.1);
  const startY = y + (height - (lines.length - 1) * lineHeight) / 2 + fontSize * 0.35;

  return `
    <g>
      <rect x="${x}" y="${y}" rx="22" ry="22" width="${width}" height="${height}" fill="rgba(20,30,40,0.78)" stroke="rgba(255,255,255,0.95)" stroke-width="4" />
      ${lines.map((line, index) => `
        <text x="${x + width / 2}" y="${startY + index * lineHeight}" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900"
          fill="${fill}" stroke="rgba(8,12,18,0.85)" stroke-width="8" paint-order="stroke fill">
          ${escapeXml(line)}
        </text>
      `).join('')}
    </g>`;
}

function buildTrackTitle({ width, text }) {
  const lines = wrapLines(text, 26, 2);
  const fontSize = computeFontSize(text, 26, 62, 34);
  const lineHeight = Math.round(fontSize * 1.08);
  const boxWidth = width - 96;
  const boxX = 48;
  const boxHeight = 150;
  const boxY = 38;
  const startY = boxY + (boxHeight - (lines.length - 1) * lineHeight) / 2 + fontSize * 0.35;

  return `
    <g>
      <rect x="${boxX}" y="${boxY}" rx="26" ry="26" width="${boxWidth}" height="${boxHeight}" fill="rgba(13,31,46,0.82)" stroke="rgba(255,230,150,0.95)" stroke-width="6" />
      ${lines.map((line, index) => `
        <text x="${width / 2}" y="${startY + index * lineHeight}" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900"
          fill="#ffe89a" stroke="rgba(6,12,18,0.88)" stroke-width="10" paint-order="stroke fill">
          ${escapeXml(line)}
        </text>
      `).join('')}
    </g>`;
}

function buildPodiumOverlay({ width, height, trackName, winners }) {
  const [first, second, third] = winners;
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
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
