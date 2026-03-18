import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatePath = path.resolve(__dirname, '../public/assets/commit-podium.jpeg');

const FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
];

function loadEmbeddedFontBase64() {
  for (const candidate of FONT_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate).toString('base64');
      }
    } catch {
      // ignore and try next
    }
  }
  return null;
}

const EMBEDDED_FONT_BASE64 = loadEmbeddedFontBase64();

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

function truncateText(text, maxChars) {
  const normalized = normalizeText(text);
  if (normalized.length <= maxChars) return normalized || '—';
  return `${normalized.slice(0, Math.max(1, maxChars - 1)).trim()}…`;
}

function fitFontSize(text, maxChars, base, min) {
  const length = truncateText(text, maxChars).length;
  if (length <= maxChars * 0.6) return base;
  const ratio = (length - maxChars * 0.6) / (maxChars * 0.4);
  return clamp(Math.round(base - ratio * (base - min)), min, base);
}

function styleBlock() {
  if (EMBEDDED_FONT_BASE64) {
    return `<style><![CDATA[
      @font-face {
        font-family: 'PodiumEmbedded';
        src: url("data:font/truetype;charset=utf-8;base64,${EMBEDDED_FONT_BASE64}") format('truetype');
        font-weight: 700;
        font-style: normal;
      }
      .podium-text { font-family: 'PodiumEmbedded', sans-serif; }
    ]]></style>`;
  }

  return `<style><![CDATA[
    .podium-text { font-family: 'DejaVu Sans', Arial, sans-serif; }
  ]]></style>`;
}

function drawCenteredText({ text, x, y, fontSize, fill = '#ffffff', stroke = 'rgba(9,14,22,0.94)', strokeWidth = 8 }) {
  return `<text class="podium-text" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle"
    font-size="${fontSize}" font-weight="700" fill="${fill}" stroke="${stroke}"
    stroke-width="${strokeWidth}" paint-order="stroke fill">${escapeXml(text)}</text>`;
}

function drawPillLabel({ x, y, width, height, text, fontSize, fill = '#ffffff' }) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="22" ry="22"
        fill="rgba(13,31,46,0.76)" stroke="rgba(255,255,255,0.94)" stroke-width="4" />
      ${drawCenteredText({ text, x: x + width / 2, y: y + height / 2 + 1, fontSize, fill, strokeWidth: 7 })}
    </g>`;
}

function buildTrackTitle(width, trackName) {
  const title = truncateText(trackName || 'Track semanal', 28);
  const fontSize = fitFontSize(title, 28, 52, 34);
  return `
    <g>
      <rect x="44" y="34" width="936" height="138" rx="24" ry="24"
        fill="rgba(13,31,46,0.84)" stroke="rgba(255,230,150,0.96)" stroke-width="6" />
      ${drawCenteredText({ text: title, x: width / 2, y: 103, fontSize, fill: '#fff3b7', strokeWidth: 9 })}
    </g>`;
}

function buildPodiumNames(firstPilot, secondPilot, thirdPilot) {
  const first = truncateText(firstPilot, 12);
  const second = truncateText(secondPilot, 12);
  const third = truncateText(thirdPilot, 12);

  return `
    ${drawPillLabel({ x: 40, y: 710, width: 266, height: 72, text: second, fontSize: fitFontSize(second, 12, 34, 22) })}
    ${drawPillLabel({ x: 356, y: 520, width: 312, height: 76, text: first, fontSize: fitFontSize(first, 12, 36, 24), fill: '#fff3b7' })}
    ${drawPillLabel({ x: 718, y: 710, width: 266, height: 72, text: third, fontSize: fitFontSize(third, 12, 34, 22) })}
  `;
}

function buildPodiumOverlay({ width, height, trackName, firstPilot, secondPilot, thirdPilot }) {
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${styleBlock()}
      ${buildTrackTitle(width, trackName)}
      ${buildPodiumNames(firstPilot, secondPilot, thirdPilot)}
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
    trackName,
    firstPilot,
    secondPilot,
    thirdPilot
  });

  return template
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .jpeg({ quality: 95 })
    .toBuffer();
}
