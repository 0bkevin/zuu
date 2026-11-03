import {
  ogTextGraphemes,
  plainSocialCardSummaryText as plainText,
} from "$lib/social-card-text";
import {
  escapeOgXml,
  ogFontFamily,
  renderOgTextBlock,
  wrapOgText,
} from "$lib/server/og-text";
import type { ImageDimensions } from "$lib/server/og-image";

/**
 * The zPage social card, arranged from the cover's real aspect ratio.
 *
 * The cover is shown the way `FeaturedImageFrame` shows it on the site: a
 * full-bleed panel holding the whole image (never cropped) over a blurred,
 * darkened enlargement of the same bytes. The panel's shape follows the
 * cover, and the type column takes whatever is left:
 *
 *   landscape  ratio >= 1.25   type left, wide panel right
 *   square     0.85 .. 1.25    type left, square panel right
 *   portrait   ratio <  0.85   tall panel left, wide type column right
 *   text       no cover        a typographic poster on the dark surface
 *
 * Type is Inter Display / Inter (font-inter in build/free2z/web.Dockerfile)
 * with the Noto script fallbacks behind it, on the dark tokens from
 * src/styles/globals.css. The category chip mirrors the mono uppercase chip
 * on `ZpageCard`.
 */

export const OG_CARD_WIDTH = 1200;
export const OG_CARD_HEIGHT = 630;

export type CardLayout = "landscape" | "square" | "portrait" | "text";

export type CardCover = {
  href: string;
  dimensions?: ImageDimensions | null;
};

export type CardArticle = {
  title?: string;
  actual_language?: string;
  description?: string;
  content?: string;
  category?: string;
  creator?: { username?: string };
};

const C = {
  bg: "#0a0a0c",
  surface: "#141417",
  raised: "#1c1c20",
  text: "#f4f4f5",
  textSecondary: "#d4d4d8",
  textMuted: "#a1a1aa",
  accent: "#a3e635",
} as const;

const W = OG_CARD_WIDTH;
const H = OG_CARD_HEIGHT;
const DISPLAY = "Inter Display";
const TEXT = "Inter";
const MONO = "DejaVu Sans Mono";
const BRAND_FONT = `${DISPLAY},${TEXT},DejaVu Sans,sans-serif`;
const MARGIN = 64;

const LANDSCAPE_MIN_RATIO = 1.25;
const PORTRAIT_MAX_RATIO = 0.85;

type Box = { x: number; y: number; width: number; height: number };

function validRatio(dimensions?: ImageDimensions | null) {
  if (!dimensions) return null;
  const { width, height } = dimensions;
  if (!(width > 0 && height > 0)) return null;
  const ratio = width / height;
  return Number.isFinite(ratio) ? ratio : null;
}

export function chooseCardLayout(cover: CardCover | null): CardLayout {
  if (!cover) return "text";
  // A cover whose header could not be sized is still shown; the square panel
  // contains any ratio.
  const ratio = validRatio(cover.dimensions) ?? 1;
  if (ratio >= LANDSCAPE_MIN_RATIO) return "landscape";
  if (ratio < PORTRAIT_MAX_RATIO) return "portrait";
  return "square";
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** The full-bleed image panel. Square and portrait panels match the cover. */
function panelFor(layout: Exclude<CardLayout, "text">, ratio: number): Box {
  if (layout === "landscape") return { x: 560, y: 0, width: 640, height: H };
  if (layout === "square") {
    const width = Math.round(clamp(H * ratio, 560, 640));
    return { x: W - width, y: 0, width, height: H };
  }
  const width = Math.round(clamp(H * ratio, 300, 520));
  return { x: 0, y: 0, width, height: H };
}

/** `contain` the cover inside the panel: every pixel visible, none cropped. */
function plateFor(panel: Box, ratio: number): Box {
  let width = panel.width;
  let height = width / ratio;
  if (height > panel.height) {
    height = panel.height;
    width = height * ratio;
  }
  return {
    x: panel.x + (panel.width - width) / 2,
    y: panel.y + (panel.height - height) / 2,
    width,
    height,
  };
}

/**
 * Average advance in em, used only to choose line breaks; the text block is
 * measured from shaped glyphs afterwards. Inter Display Bold averages ~0.55em;
 * CJK, kana, Hangul and full-width forms take a full em.
 */
const WIDE_TEXT =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}　-〿＀-￯]/gu;
function emFor(text: string, latinEm: number) {
  const wide = text.match(WIDE_TEXT)?.length ?? 0;
  return (
    latinEm + (1.02 - latinEm) * Math.min(1, wide / Math.max(1, text.length))
  );
}

/**
 * Inter covers Latin, Greek and Cyrillic. Any other script keeps the original
 * DejaVu-first stack: putting Inter ahead of it splits shaping runs, which
 * breaks Arabic joining in pinned Resvg 2.6.2.
 */
const INTER_SCRIPTS =
  /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]*$/u;
const faceFor = (text: string, inter: string) =>
  INTER_SCRIPTS.test(text) ? inter : "DejaVu Sans";

const graphemeCount = (value: string) =>
  Array.from(ogTextGraphemes.segment(value)).length;

function initialOf(username: string | undefined) {
  if (!username) return "F";
  const [first] = Array.from(
    ogTextGraphemes.segment(username),
    ({ segment }) => segment,
  );
  return (first || "F").toLocaleUpperCase();
}

type Column = { x: number; width: number };
type Typesetting = { sizes: readonly number[]; maxLines: number };

const CAP = 0.73; // Inter's cap height, in em
const SUMMARY_SIZE = 23;
const SUMMARY_LEADING = 33;
const CHIP_HEIGHT = 34;

/**
 * Brand at the top; chip, title, summary and byline stacked up from the
 * bottom edge so the headline always lands in the same place however many
 * lines it takes. A long headline is the story: the summary yields first.
 */
function renderColumn(
  article: CardArticle,
  column: Column,
  { sizes, maxLines }: Typesetting,
) {
  const title = plainText(article.title, 125) || "A story on Free2Z";
  const summary = plainText(article.description || article.content, 190);
  const category = (plainText(article.category, 24) || "Story").toUpperCase();
  const username = plainText(article.creator?.username, 28);
  const language = article.actual_language;
  const { x, width } = column;

  const brandBaseline = MARGIN + 28;
  const bylineCenter = H - MARGIN - 22;
  const stackBottom = bylineCenter - 22 - 44; // last baseline above the byline
  const stackTop = brandBaseline + 56; // chip may start no higher than this

  const titleEm = emFor(title, 0.55);
  const summaryPerLine = Math.max(
    14,
    Math.floor(width / (SUMMARY_SIZE * emFor(summary, 0.5))),
  );

  let fit: { size: number; lines: string[]; summaryLines: string[] } | null =
    null;
  for (const size of sizes) {
    const perLine = Math.max(6, Math.floor(width / (size * titleEm)));
    const lines = wrapOgText(title, perLine, maxLines + 1);
    if (lines.length > maxLines) continue;
    const leading = Math.round(size * 1.08);
    const titleHeight = size * CAP + (lines.length - 1) * leading;
    const room = stackBottom - stackTop - CHIP_HEIGHT - 24 - titleHeight;
    if (room < 0) continue;
    const wanted = !summary ? 0 : Math.max(0, 3 - lines.length);
    const count = Math.min(
      wanted,
      2,
      Math.max(0, Math.floor((room - 26) / SUMMARY_LEADING) + 1),
    );
    fit = {
      size,
      lines,
      summaryLines: count ? wrapOgText(summary, summaryPerLine, count) : [],
    };
    break;
  }
  if (!fit) {
    const size = sizes[sizes.length - 1];
    const perLine = Math.max(6, Math.floor(width / (size * titleEm)));
    fit = {
      size,
      lines: wrapOgText(title, perLine, maxLines),
      summaryLines: [],
    };
  }

  const { size, lines, summaryLines } = fit;
  const leading = Math.round(size * 1.08);
  const lastTitleBaseline = summaryLines.length
    ? stackBottom -
      (summaryLines.length - 1) * SUMMARY_LEADING -
      SUMMARY_SIZE * CAP -
      24
    : stackBottom;
  const firstTitleBaseline = Math.round(
    lastTitleBaseline - (lines.length - 1) * leading,
  );
  const chipY = Math.round(firstTitleBaseline - size * CAP - 26 - CHIP_HEIGHT);

  const text = renderOgTextBlock(
    [
      ...lines.map((line, index) => ({
        text: line,
        y: firstTitleBaseline + index * leading,
        size,
        weight: 700,
        family: faceFor(title, DISPLAY),
        color: C.text,
      })),
      ...summaryLines.map((line, index) => ({
        text: line,
        y: Math.round(
          stackBottom - (summaryLines.length - 1 - index) * SUMMARY_LEADING,
        ),
        size: SUMMARY_SIZE,
        weight: 400,
        family: faceFor(summary, TEXT),
        color: C.textMuted,
      })),
    ],
    { x, width, language },
  );

  // DejaVu Sans Mono advances exactly 0.602em, so the chip is sized without
  // measuring. It mirrors the mono uppercase category chip on ZpageCard.
  const chipSize = 15;
  const tracking = 1.5;
  const chipWidth = Math.min(
    width,
    Math.round(
      graphemeCount(category) * (chipSize * 0.602 + tracking) - tracking + 32,
    ),
  );
  const name = escapeOgXml(username ? `@${username}` : "Free2Z creator");
  const avatarCx = x + 22;
  const nameFont = ogFontFamily(language, faceFor(name, TEXT));

  return `
    <text x="${x - 1}" y="${brandBaseline}" font-family="${BRAND_FONT}" font-size="36" font-weight="700" letter-spacing="-0.7" fill="${C.text}">Free<tspan fill="${C.accent}">2Z</tspan></text>
    <rect x="${x + 0.5}" y="${chipY + 0.5}" width="${chipWidth - 1}" height="${CHIP_HEIGHT - 1}" rx="7" fill="${C.accent}" fill-opacity=".08" stroke="${C.accent}" stroke-opacity=".32"/>
    <text x="${x + 16}" y="${chipY + 22.5}" font-family="${MONO},monospace" font-size="${chipSize}" font-weight="700" letter-spacing="${tracking}" fill="${C.accent}">${escapeOgXml(category)}</text>
    ${text}
    <circle cx="${avatarCx}" cy="${bylineCenter}" r="22" fill="${C.raised}" stroke="${C.accent}" stroke-opacity=".45" stroke-width="1.5"/>
    <text x="${avatarCx}" y="${bylineCenter + 7}" text-anchor="middle" font-family="${nameFont}" font-size="19" font-weight="700" fill="${C.accent}">${escapeOgXml(initialOf(username))}</text>
    <text x="${x + 58}" y="${bylineCenter + 8}" font-family="${nameFont}" font-size="22" font-weight="600" fill="${C.textSecondary}">${name}</text>`;
}

function svg(defs: string, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>${defs}</defs>
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    ${body}
  </svg>`;
}

function textOnlyCard(article: CardArticle) {
  const defs = `
      <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1080 640) scale(760 540)"><stop stop-color="${C.accent}" stop-opacity=".2"/><stop offset=".5" stop-color="${C.accent}" stop-opacity=".05"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
      <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="${C.text}" fill-opacity=".09"/></pattern>
      <linearGradient id="dotsFade" x1="0" y1="0" x2="1" y2="0"><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>
      <mask id="dotsMask"><rect width="${W}" height="${H}" fill="url(#dotsFade)"/></mask>`;
  const body = `
      <rect width="${W}" height="${H}" fill="url(#dots)" mask="url(#dotsMask)"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <text x="${W + 30}" y="${H + 78}" text-anchor="end" font-family="${BRAND_FONT}" font-size="520" font-weight="800" letter-spacing="-18" fill="none" stroke="${C.accent}" stroke-opacity=".16" stroke-width="2">2Z</text>
      ${renderColumn(
        article,
        { x: 72, width: 860 },
        { sizes: [84, 76, 68, 60, 54], maxLines: 3 },
      )}`;
  return svg(defs, body);
}

function coverCard(
  article: CardArticle,
  cover: CardCover,
  layout: Exclude<CardLayout, "text">,
) {
  const ratio = validRatio(cover.dimensions) ?? 1;
  const panel = panelFor(layout, ratio);
  const plate = plateFor(panel, ratio);
  const filled =
    plate.width >= panel.width - 1 && plate.height >= panel.height - 1;

  const column: Column =
    layout === "portrait"
      ? { x: panel.width + 64, width: W - panel.width - 64 - MARGIN }
      : { x: MARGIN + 8, width: panel.x - MARGIN - 8 - 56 };

  // One embedded raster, drawn as the plate and (only when the plate leaves
  // gaps) as the blurred pad. A cover data URI can be megabytes on a
  // memory-bounded pod, so it is never duplicated in the SVG string. The blur
  // region is the panel in user space, which bounds the blur work to the
  // panel. Do not make it a percentage of the over-scaled pad's bbox: inside
  // a clip, pinned Resvg 2.6.2 has been seen to drop part of the image then.
  const padScale = Math.max(
    (panel.width * 1.2) / plate.width,
    (panel.height * 1.2) / plate.height,
  );
  const padX = panel.x + (panel.width - plate.width * padScale) / 2;
  const padY = panel.y + (panel.height - plate.height * padScale) / 2;
  const edgeX = layout === "portrait" ? panel.x + panel.width : panel.x;
  const towardText = layout === "portrait" ? 1 : 0;
  const seamWidth = 28;
  const seamX = layout === "portrait" ? edgeX - seamWidth : edgeX;

  const defs = `
      <radialGradient id="warm" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${column.x} 0) scale(620 460)"><stop stop-color="${C.accent}" stop-opacity=".09"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
      <clipPath id="panel"><rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}"/></clipPath>
      <filter id="padBlur" filterUnits="userSpaceOnUse" x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="38"/></filter>
      <linearGradient id="seam" x1="${towardText}" y1="0" x2="${1 - towardText}" y2="0"><stop stop-color="${C.bg}" stop-opacity=".45"/><stop offset="1" stop-color="${C.bg}" stop-opacity="0"/></linearGradient>
      <image id="art" href="${cover.href}" width="${plate.width.toFixed(2)}" height="${plate.height.toFixed(2)}" preserveAspectRatio="xMidYMid meet"/>`;

  const pad = filled
    ? ""
    : `<g filter="url(#padBlur)"><use href="#art" transform="translate(${padX.toFixed(1)} ${padY.toFixed(1)}) scale(${padScale.toFixed(4)})"/></g>
        <rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" fill="${C.bg}" fill-opacity=".5"/>`;

  const body = `
      <rect width="${W}" height="${H}" fill="url(#warm)"/>
      <g clip-path="url(#panel)">
        <rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" fill="${C.surface}"/>
        ${pad}
        <use href="#art" x="${plate.x.toFixed(2)}" y="${plate.y.toFixed(2)}"/>
        <rect x="${seamX}" y="0" width="${seamWidth}" height="${H}" fill="url(#seam)"/>
      </g>
      <rect x="${edgeX - 0.5}" y="0" width="1" height="${H}" fill="${C.text}" fill-opacity=".1"/>
      ${renderColumn(article, column, {
        sizes:
          layout === "portrait"
            ? [72, 66, 60, 54, 48, 44]
            : [64, 58, 52, 47, 42, 38],
        maxLines: 4,
      })}`;
  return svg(defs, body);
}

export function buildZpageCardSvg(
  article: CardArticle,
  cover: CardCover | null,
) {
  const layout = chooseCardLayout(cover);
  return layout === "text" || !cover
    ? textOnlyCard(article)
    : coverCard(article, cover, layout);
}
