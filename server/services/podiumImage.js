import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatePath = path.resolve(__dirname, '../public/assets/commit-podium.jpeg');

const PYTHON_SCRIPT = String.raw`
import io
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

def normalize(value):
    return ' '.join(str(value or '').split()).strip()

def choose_font_path():
    candidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
    ]
    for item in candidates:
        if os.path.exists(item):
            return item
    return None

FONT_PATH = choose_font_path()
if not FONT_PATH:
    raise RuntimeError('No se ha encontrado una fuente compatible para generar el podio.')

def load_font(size):
    return ImageFont.truetype(FONT_PATH, size=size)

def text_size(draw, text, font, stroke_width=0):
    bbox = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
    return bbox[2] - bbox[0], bbox[3] - bbox[1], bbox

def fit_single_line(draw, text, max_width, start_size, min_size, stroke_width):
    size = start_size
    while size >= min_size:
        font = load_font(size)
        width, _, _ = text_size(draw, text, font, stroke_width)
        if width <= max_width:
            return font
        size -= 2
    return load_font(min_size)

def wrap_text(draw, text, max_width, start_size, min_size, stroke_width, max_lines=2):
    words = normalize(text).split()
    if not words:
        words = ['Track semanal']

    size = start_size
    while size >= min_size:
        font = load_font(size)
        lines = []
        current = ''
        for word in words:
            candidate = word if not current else current + ' ' + word
            width, _, _ = text_size(draw, candidate, font, stroke_width)
            if width <= max_width or not current:
                current = candidate
            else:
                lines.append(current)
                current = word
        if current:
            lines.append(current)

        if len(lines) <= max_lines:
            return font, lines
        size -= 2

    # fallback duro: recortar a una o dos líneas
    font = load_font(min_size)
    lines = []
    current = ''
    for word in words:
        candidate = word if not current else current + ' ' + word
        width, _, _ = text_size(draw, candidate, font, stroke_width)
        if width <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
            if len(lines) == max_lines - 1:
                break
    if current:
        lines.append(current)
    lines = lines[:max_lines]
    if lines:
        last = lines[-1]
        while True:
            width, _, _ = text_size(draw, last + '…', font, stroke_width)
            if width <= max_width or len(last) <= 1:
                lines[-1] = last + ('…' if not last.endswith('…') else '')
                break
            last = last[:-1]
    return font, lines

def draw_centered_line(draw, text, center_x, center_y, font, fill, stroke_fill, stroke_width):
    width, height, bbox = text_size(draw, text, font, stroke_width)
    x = center_x - width / 2
    y = center_y - height / 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=fill, stroke_width=stroke_width, stroke_fill=stroke_fill)


def draw_title(draw, width, track_name):
    x, y, w, h = 44, 34, width - 88, 138
    draw.rounded_rectangle((x, y, x + w, y + h), radius=24, fill=(13, 31, 46, 220), outline=(255, 230, 150, 245), width=6)
    font, lines = wrap_text(draw, track_name, max_width=w - 70, start_size=46, min_size=24, stroke_width=4, max_lines=2)
    line_height = font.size + 8
    block_height = line_height * len(lines)
    start_y = y + h / 2 - block_height / 2 + line_height / 2 - 4
    for idx, line in enumerate(lines):
        draw_centered_line(draw, line, x + w / 2, start_y + idx * line_height, font, (255, 232, 154, 255), (8, 12, 18, 240), 4)


def draw_name_pill(draw, text, center_x, center_y, max_width, max_font, min_font, fill_text):
    text = normalize(text) or '—'
    font = fit_single_line(draw, text, max_width=max_width, start_size=max_font, min_size=min_font, stroke_width=3)
    tw, th, bbox = text_size(draw, text, font, 3)
    pad_x = 22
    pad_y = 12
    pill_w = tw + pad_x * 2
    pill_h = th + pad_y * 2
    x1 = center_x - pill_w / 2
    y1 = center_y - pill_h / 2
    x2 = center_x + pill_w / 2
    y2 = center_y + pill_h / 2
    draw.rounded_rectangle((x1, y1, x2, y2), radius=20, fill=(13, 31, 46, 190), outline=(255, 255, 255, 242), width=4)
    draw_centered_line(draw, text, center_x, center_y, font, fill_text, (7, 12, 18, 235), 3)


def main():
    template_path = sys.argv[1]
    payload = json.loads(sys.argv[2])
    track_name = normalize(payload.get('trackName') or 'Track semanal')
    first = payload.get('firstPilot') or '—'
    second = payload.get('secondPilot') or '—'
    third = payload.get('thirdPilot') or '—'

    image = Image.open(template_path).convert('RGBA')
    draw = ImageDraw.Draw(image)
    width, height = image.size

    draw_title(draw, width, track_name)

    # posiciones afinadas para que el texto quede justo encima de los drones
    draw_name_pill(draw, first, center_x=int(width * 0.50), center_y=470, max_width=320, max_font=34, min_font=18, fill_text=(255, 242, 184, 255))
    draw_name_pill(draw, second, center_x=int(width * 0.17), center_y=700, max_width=230, max_font=30, min_font=16, fill_text=(255, 255, 255, 255))
    draw_name_pill(draw, third, center_x=int(width * 0.83), center_y=700, max_width=230, max_font=30, min_font=16, fill_text=(255, 255, 255, 255))

    out = io.BytesIO()
    image.convert('RGB').save(out, format='JPEG', quality=95)
    sys.stdout.buffer.write(out.getvalue())

main()
`;

export async function buildTrackPodiumImage({ trackName, firstPilot, secondPilot, thirdPilot }) {
  const payload = JSON.stringify({ trackName, firstPilot, secondPilot, thirdPilot });
  const result = spawnSync('python3', ['-c', PYTHON_SCRIPT, templatePath, payload], {
    encoding: null,
    maxBuffer: 20 * 1024 * 1024
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString('utf8') : 'Error desconocido al generar el podio.';
    throw new Error(stderr.trim() || 'Error desconocido al generar el podio.');
  }

  return Buffer.from(result.stdout);
}
