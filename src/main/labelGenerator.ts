import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export interface LabelSettings {
  label_width_mm:  number;
  label_height_mm: number;
  logo_path?:      string;
  logo_position:   'top-left' | 'top-center' | 'top-right';
  sold_color:      string;
  giveaway_color:  string;
  font_scale:      'small' | 'medium' | 'large';
  printer_name?:   string;
}

export interface LabelData {
  username:         string;
  item_description: string;
  price:            number;
  sale_type:        'SOLD' | 'GIVEAWAY';
  is_reprint?:      boolean;
  settings:         LabelSettings;
}

const MM_TO_PT = 2.8346;

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function wrapText(text: string, maxChars: number): [string, string] {
  if (text.length <= maxChars) return [text, ''];
  const cut = text.lastIndexOf(' ', maxChars);
  const breakAt = cut > maxChars * 0.5 ? cut : maxChars;
  return [text.slice(0, breakAt).trim(), text.slice(breakAt).trim().slice(0, maxChars)];
}

export class LabelGenerator {
  async generate(data: LabelData): Promise<Buffer> {
    const { settings } = data;
    const W = settings.label_width_mm  * MM_TO_PT;
    const H = settings.label_height_mm * MM_TO_PT;

    const doc  = await PDFDocument.create();
    const page = doc.addPage([W, H]);

    const boldFont  = await doc.embedFont(StandardFonts.HelveticaBold);
    const plainFont = await doc.embedFont(StandardFonts.Helvetica);

    const fScale = settings.font_scale === 'small' ? 0.82
                 : settings.font_scale === 'large'  ? 1.18
                 : 1.0;

    // ── Background ──────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });

    // Top accent stripe
    page.drawRectangle({ x: 0, y: H - 5, width: W, height: 5, color: rgb(0.04, 0.39, 0.87) });
    // Bottom accent stripe
    page.drawRectangle({ x: 0, y: 0, width: W, height: 4, color: rgb(0.04, 0.39, 0.87) });

    // ── Badge (SOLD / GIVEAWAY) ──────────────────────────────────────────────
    const badgeColor = data.sale_type === 'SOLD'
      ? hexToRgb(settings.sold_color     || '#22c55e')
      : hexToRgb(settings.giveaway_color || '#f59e0b');
    const badgeText  = data.sale_type;
    const badgeW     = data.sale_type === 'GIVEAWAY' ? 88 : 62;
    const badgeH     = 22;
    const badgeX     = W - badgeW - 10;
    const badgeY     = H - 36;

    page.drawRectangle({ x: badgeX, y: badgeY, width: badgeW, height: badgeH, color: badgeColor });
    page.drawText(badgeText, {
      x: badgeX + (badgeW / 2) - (badgeText.length * 3.8 * fScale),
      y: badgeY + 5,
      size: 11 * fScale, font: boldFont, color: rgb(1, 1, 1),
    });

    // ── Logo ─────────────────────────────────────────────────────────────────
    // FIX 5: graceful fallback when logo missing/invalid
    let logoBottomY = H - 8;
    let logoLoaded  = false;

    if (settings.logo_path && fs.existsSync(settings.logo_path)) {
      try {
        const logoBytes = fs.readFileSync(settings.logo_path);
        const ext       = path.extname(settings.logo_path).toLowerCase();
        const logoImg   = (ext === '.png')
          ? await doc.embedPng(logoBytes)
          : await doc.embedJpg(logoBytes);

        const maxW = Math.min(W * 0.45, 130);
        const maxH = 38;
        const dims = logoImg.scaleToFit(maxW, maxH);

        const logoX = settings.logo_position === 'top-center'
          ? (W / 2) - (dims.width / 2)
          : settings.logo_position === 'top-right'
            ? W - dims.width - 10
            : 10;
        const logoY = H - dims.height - 8;

        page.drawImage(logoImg, { x: logoX, y: logoY, width: dims.width, height: dims.height });
        logoBottomY = logoY;
        logoLoaded  = true;
      } catch (e) {
        console.warn('[LabelGen] Logo load failed, using text fallback:', e);
      }
    }

    // FIX 5: text fallback if no logo or logo failed
    if (!logoLoaded) {
      page.drawText('SELLERS EDGE', {
        x: 10, y: H - 22,
        size: 13 * fScale, font: boldFont,
        color: rgb(0.04, 0.39, 0.87),
      });
      logoBottomY = H - 24;
    }

    // ── Divider ───────────────────────────────────────────────────────────────
    const dividerY = logoBottomY - 6;
    page.drawLine({
      start: { x: 10, y: dividerY }, end: { x: W - 10, y: dividerY },
      thickness: 0.75, color: rgb(0.88, 0.88, 0.88),
    });

    // ── Username ──────────────────────────────────────────────────────────────
    const usernameY = dividerY - 20;
    page.drawText('@' + data.username, {
      x: 12, y: usernameY,
      size: 15 * fScale, font: boldFont,
      color: rgb(0.04, 0.39, 0.87),
    });

    // ── Item Description (wraps to 2 lines) ───────────────────────────────────
    const maxChars = Math.floor((W - 24) / (7.2 * fScale));
    const [line1, line2] = wrapText(data.item_description, maxChars);

    page.drawText(line1, {
      x: 12, y: usernameY - 22,
      size: 12 * fScale, font: boldFont, color: rgb(0.1, 0.1, 0.1),
    });
    if (line2) {
      page.drawText(line2, {
        x: 12, y: usernameY - 38,
        size: 12 * fScale, font: boldFont, color: rgb(0.1, 0.1, 0.1),
      });
    }

    // ── Price ─────────────────────────────────────────────────────────────────
    const priceText = data.sale_type === 'GIVEAWAY'
      ? 'FREE GIVEAWAY'
      : `$${data.price.toFixed(2)}`;

    page.drawText(priceText, {
      x: 12, y: 18,
      size: (data.sale_type === 'GIVEAWAY' ? 14 : 20) * fScale,
      font: boldFont, color: rgb(0.05, 0.05, 0.05),
    });

    // ── Reprint watermark ─────────────────────────────────────────────────────
    if (data.is_reprint) {
      page.drawText('REPRINT', {
        x: W - 58, y: 18,
        size: 9, font: boldFont,
        color: rgb(0.72, 0.72, 0.72),
      });
    }

    // ── Timestamp (small, bottom right) ──────────────────────────────────────
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    page.drawText(ts, {
      x: W - 30, y: 6,
      size: 6.5, font: plainFont,
      color: rgb(0.75, 0.75, 0.75),
    });

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }
}
