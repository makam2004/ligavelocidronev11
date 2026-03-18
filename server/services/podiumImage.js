import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.resolve(__dirname, '../public/assets');
const templatePath = path.join(assetsDir, 'commit-podium.jpeg');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function safeText(value, fallback = '—') {
  const text = normalizeText(value);
  return text || fallback;
}

function truncate(value, maxChars) {
  const text = safeText(value);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1)).trim()}…`;
}

function wrapText(text, maxLineLength = 18, maxLines = 2) {
  const words = safeText(text).split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (!lines.length) return ['—'];

  const allText = words.join(' ');
  const used = lines.join(' ').length;
  const remainder = allText.slice(used).trim();
  if (remainder) {
    lines[lines.length - 1] = truncate(`${lines[lines.length - 1]} ${remainder}`, maxLineLength);
  }

  return lines.slice(0, maxLines);
}

function escapeMarkup(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function renderTextBlock({
  text,
  width,
  fontSize,
  color = '#FFFFFF',
  align = 'center',
  lineSpacing = 1,
  rgba = true,
}) {
  const lines = Array.isArray(text) ? text : [text];
  const markup = lines
    .map((line) => {
      const escaped = escapeMarkup(line);
      return `<span foreground="${color}" font_family="DejaVu Sans" font_weight="bold" size="${fontSize * 1024}">${escaped}</span>`;
    })
    .join(`<span size="${Math.round(fontSize * lineSpacing * 1024)}">\n</span>`);

  return sharp({
    text: {
      text: markup,
      rgba,
      width,
      align,
      dpi: 144,
    },
  })
    .png()
    .toBuffer();
}

function makeSvgOverlay(width, height) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect x="44" y="28" width="${width - 88}" height="138" rx="26" ry="26" fill="#10273a" fill-opacity="0.84" stroke="#ffe89a" stroke-width="6"/>
      <rect x="335" y="505" width="320" height="78" rx="20" ry="20" fill="#10273a" fill-opacity="0.84" stroke="#ffffff" stroke-width="4"/>
      <rect x="46" y="704" width="270" height="74" rx="20" ry="20" fill="#10273a" fill-opacity="0.84" stroke="#ffffff" stroke-width="4"/>
      <rect x="708" y="704" width="270" height="74" rx="20" ry="20" fill="#10273a" fill-opacity="0.84" stroke="#ffffff" stroke-width="4"/>
    </svg>
  `);
}

async function centeredComposite(buffer, x, y, targetWidth) {
  const meta = await sharp(buffer).metadata();
  const left = Math.round(x + (targetWidth - (meta.width || targetWidth)) / 2);
  const top = Math.round(y + ((meta.height || 0) > 0 ? 0 : 0));
  return { input: buffer, left, top };
}

export async function buildTrackPodiumImage({ trackName, firstPilot, secondPilot, thirdPilot }) {
  const template = sharp(templatePath);
  const meta = await template.metadata();
  const width = meta.width || 1024;
  const height = meta.height || 1536;

  const titleLines = wrapText(safeText(trackName, 'Track semanal'), 18, 2);
  const first = truncate(firstPilot || '—', 16);
  const second = truncate(secondPilot || '—', 14);
  const third = truncate(thirdPilot || '—', 14);

  const titleBuffer = await renderTextBlock({
    text: titleLines,
    width: width - 120,
    fontSize: titleLines.length > 1 ? 32 : 38,
    lineSpacing: 1.05,
  });

  const firstBuffer = await renderTextBlock({
    text: first,
    width: 280,
    fontSize: 28,
  });

  const secondBuffer = await renderTextBlock({
    text: second,
    width: 230,
    fontSize: 24,
  });

  const thirdBuffer = await renderTextBlock({
    text: third,
    width: 230,
    fontSize: 24,
  });

  const titleMeta = await sharp(titleBuffer).metadata();
  const firstMeta = await sharp(firstBuffer).metadata();
  const secondMeta = await sharp(secondBuffer).metadata();
  const thirdMeta = await sharp(thirdBuffer).metadata();

  const composites = [
    { input: makeSvgOverlay(width, height), top: 0, left: 0 },
    {
      input: titleBuffer,
      left: Math.round((width - (titleMeta.width || width - 120)) / 2),
      top: 52,
    },
    {
      input: firstBuffer,
      left: Math.round(335 + (320 - (firstMeta.width || 280)) / 2),
      top: Math.round(505 + (78 - (firstMeta.height || 32)) / 2 - 2),
    },
    {
      input: secondBuffer,
      left: Math.round(46 + (270 - (secondMeta.width || 230)) / 2),
      top: Math.round(704 + (74 - (secondMeta.height || 28)) / 2 - 2),
    },
    {
      input: thirdBuffer,
      left: Math.round(708 + (270 - (thirdMeta.width || 230)) / 2),
      top: Math.round(704 + (74 - (thirdMeta.height || 28)) / 2 - 2),
    },
  ];

  return template.composite(composites).jpeg({ quality: 94 }).toBuffer();
}
