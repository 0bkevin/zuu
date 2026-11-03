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
 * The zPage social card, laid out from the cover's real aspect ratio.
 *
 * The author chose the cover, so the card never crops it: the framed artwork
 * keeps its intrinsic ratio and the rest of the card arranges itself around
 * that frame. The same raster, blurred and darkened, fills the background so
 * every card carries its own cover's colours while the type stays on the
 * site's dark surface tokens (globals.css `.dark`) and lime accent.
 *
 *   landscape  ratio >= 1.15   text left, wide frame right, vertically centred
 *   square     0.85 .. 1.15    text left, tall square-ish frame right
 *   portrait   ratio <  0.85   poster frame left, text right with a larger title
 *   text       no cover        full-width title on the house-card backdrop
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

// Dark-mode design tokens from src/styles/globals.css.
const TOKENS = {
  bg: "#0a0a0c",
  surface: "#141417",
  text: "#f4f4f5",
  textSecondary: "#d4d4d8",
  textMuted: "#a1a1aa",
  accent: "#a3e635",
  accentStrong: "#84cc16",
  accentLight: "#bef264",
} as const;

const W = OG_CARD_WIDTH;
const H = OG_CARD_HEIGHT;
const PAD = 64;
const GUTTER = 60;
const SANS = "Arial,DejaVu Sans,sans-serif";

/** Above this, a frame wider than it is tall reads as landscape. */
const LANDSCAPE_MIN_RATIO = 1.15;
/** Below this, the cover is a poster and earns the left-hand column. */
const PORTRAIT_MAX_RATIO = 0.85;
/**
 * Extreme ratios still get a usable frame. Past these clamps the artwork is
 * letterboxed inside the frame (over the blurred ambient copy) rather than
 * cropped, so a 1:4 strip or a 5:1 banner is still shown complete.
 */
const MIN_FRAME_RATIO = 0.45;
const MAX_FRAME_RATIO = 4;

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
  // A cover whose header we could not size is still shown; it gets the
  // square frame, whose `meet` fit keeps any ratio complete.
  const ratio = validRatio(cover.dimensions) ?? 1;
  if (ratio >= LANDSCAPE_MIN_RATIO) return "landscape";
  if (ratio < PORTRAIT_MAX_RATIO) return "portrait";
  return "square";
}

/** Size the cover frame to the artwork's own ratio inside a bounding box. */
function frameFor(layout: CardLayout, ratio: number): Box {
  const r = Math.min(MAX_FRAME_RATIO, Math.max(MIN_FRAME_RATIO, ratio));
  if (layout === "portrait") {
    const height = H - 2 * 48;
    const width = Math.round(height * r);
    return { x: 48, y: 48, width, height };
  }
  const maxWidth = layout === "landscape" ? 560 : 520;
  const maxHeight = layout === "landscape" ? 470 : 486;
  let width = maxWidth;
  let height = width / r;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * r;
  }
  width = Math.round(width);
  height = Math.round(height);
  return {
    x: W - PAD + 8 - width,
    y: Math.round((H - height) / 2),
    width,
    height,
  };
}

type TitleFit = { lines: string[]; size: number };

/**
 * Average advance in em, used only to choose line breaks. Bold DejaVu Sans
 * (the production Latin face) averages ~0.62em; CJK, kana, Hangul and
 * full-width forms are a full em. Underestimating makes the measured block
 * shrink as a whole, summary included, so the estimate follows the script.
 */
const WIDE_TEXT =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff00-\uffef]/gu;
function emFor(text: string, latinEm: number) {
  const total = Math.max(1, text.length);
  const wide = text.match(WIDE_TEXT)?.length ?? 0;
  return latinEm + (1.02 - latinEm) * Math.min(1, wide / total);
}

/**
 * Pick the largest title size whose word-wrapped lines fit the column. The
 * character estimate only chooses the break points; `renderOgTextBlock`
 * still measures shaped glyphs and shrinks the block if a line runs long.
 */
function fitTitle(
  title: string,
  width: number,
  sizes: readonly number[],
  maxLines: number,
): TitleFit {
  const em = emFor(title, 0.62);
  for (const size of sizes) {
    const perLine = Math.max(6, Math.floor(width / (size * em)));
    const lines = wrapOgText(title, perLine, maxLines + 1);
    if (lines.length <= maxLines) return { lines, size };
  }
  const size = sizes[sizes.length - 1];
  const perLine = Math.max(6, Math.floor(width / (size * em)));
  return { lines: wrapOgText(title, perLine, maxLines), size };
}

function initialOf(username: string | undefined) {
  if (!username) return "F";
  const [first] = Array.from(
    ogTextGraphemes.segment(username),
    ({ segment }) => segment,
  );
  return (first || "F").toLocaleUpperCase();
}

type Column = { x: number; width: number; top: number; bottom: number };

/**
 * Everything typographic: wordmark, category, title, summary, byline. The
 * column is the only geometry it needs, which is what lets one implementation
 * serve every layout.
 */
function renderColumn(
  article: CardArticle,
  column: Column,
  options: {
    titleSizes: readonly number[];
    titleLines: number;
    subtitleLines: number;
  },
) {
  const title = plainText(article.title, 125) || "A story on Free2Z";
  const subtitle =
    plainText(article.description || article.content, 190) ||
    "Independent publishing and direct creator support.";
  const category = escapeOgXml(
    (plainText(article.category, 30) || "Story").toUpperCase(),
  );
  const username = plainText(article.creator?.username, 28);
  const author = escapeOgXml(username ? `@${username}` : "Free2Z creator");

  const { x, width } = column;
  const fit = fitTitle(title, width, options.titleSizes, options.titleLines);
  const titleLeading = Math.round(fit.size * 1.14);
  const subtitleSize = 24;
  const subtitleLeading = 34;
  const subtitleLines = wrapOgText(
    subtitle,
    Math.max(12, Math.floor(width / (subtitleSize * emFor(subtitle, 0.53)))),
    fit.lines.length >= options.titleLines
      ? Math.max(1, options.subtitleLines - 1)
      : options.subtitleLines,
  );

  // Centre the title + summary block in the space between the masthead and
  // the byline, measured from cap height to the last descender.
  const gap = 26;
  const blockHeight =
    fit.size * 0.74 +
    (fit.lines.length - 1) * titleLeading +
    gap +
    subtitleLines.length * subtitleLeading -
    8;
  const regionTop = column.top + 108;
  const regionBottom = column.bottom - 96;
  const start = Math.max(
    regionTop,
    regionTop + (regionBottom - regionTop - blockHeight) / 2,
  );
  const firstBaseline = Math.round(start + fit.size * 0.74);
  const subtitleStart =
    firstBaseline + (fit.lines.length - 1) * titleLeading + gap + 26;

  const text = renderOgTextBlock(
    [
      ...fit.lines.map((line, index) => ({
        text: line,
        y: firstBaseline + index * titleLeading,
        size: fit.size,
        bold: true,
        color: TOKENS.text,
      })),
      ...subtitleLines.map((line, index) => ({
        text: line,
        y: subtitleStart + index * subtitleLeading,
        size: subtitleSize,
        color: TOKENS.textSecondary,
      })),
    ],
    { x, width, language: article.actual_language },
  );

  const mast = column.top;
  const by = column.bottom;
  const avatarCx = x + 26;
  const avatarCy = by - 26;
  return `
    <text x="${x - 2}" y="${mast + 34}" font-family="${SANS}" font-size="40" font-weight="700" fill="${TOKENS.accent}" letter-spacing="-1.4">Free2Z</text>
    <text x="${x}" y="${mast + 76}" font-family="${SANS}" font-size="15" font-weight="700" fill="${TOKENS.accent}" letter-spacing="2.6">${category}</text>
    ${text}
    <rect x="${x}" y="${by - 82}" width="${width}" height="1.5" fill="url(#accentLine)"/>
    <circle cx="${avatarCx}" cy="${avatarCy}" r="26" fill="${TOKENS.accent}"/>
    <text x="${avatarCx}" y="${avatarCy + 8}" text-anchor="middle" font-family="${ogFontFamily(article.actual_language)}" font-size="23" font-weight="700" fill="${TOKENS.bg}">${escapeOgXml(initialOf(username))}</text>
    <text x="${x + 68}" y="${by - 32}" font-family="${ogFontFamily(article.actual_language)}" font-size="21" font-weight="700" fill="${TOKENS.text}">${author}</text>
    <text x="${x + 68}" y="${by - 7}" font-family="${SANS}" font-size="15" font-weight="700" fill="${TOKENS.textMuted}" letter-spacing="1.6">FREE2Z.CASH</text>`;
}

function shared(defs = "") {
  return `
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#09090b"/><stop offset=".58" stop-color="#111114"/><stop offset="1" stop-color="#17171b"/></linearGradient>
      <linearGradient id="accentLine" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${TOKENS.accent}" stop-opacity=".85"/><stop offset="1" stop-color="${TOKENS.accent}" stop-opacity="0"/></linearGradient>
      <clipPath id="card"><rect width="${W}" height="${H}" rx="30"/></clipPath>
      ${defs}`;
}

function wrap(defs: string, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>${shared(defs)}</defs>
    <g clip-path="url(#card)">
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      ${body}
    </g>
    <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="29.5" fill="none" stroke="${TOKENS.text}" stroke-opacity=".12"/>
  </svg>`;
}

function textOnlyCard(article: CardArticle) {
  const defs = `
      <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1010 92) rotate(132) scale(560 420)"><stop stop-color="${TOKENS.accent}" stop-opacity=".22"/><stop offset=".55" stop-color="${TOKENS.accentStrong}" stop-opacity=".06"/><stop offset="1" stop-color="${TOKENS.accentStrong}" stop-opacity="0"/></radialGradient>
      <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M56 0H0V56" fill="none" stroke="${TOKENS.text}" stroke-opacity=".045"/></pattern>
      <linearGradient id="gridFade" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>
      <mask id="gridMask"><rect width="${W}" height="${H}" fill="url(#gridFade)"/></mask>`;
  const body = `
      <rect width="${W}" height="${H}" fill="url(#grid)" mask="url(#gridMask)"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <circle cx="1018" cy="190" r="150" fill="none" stroke="${TOKENS.accent}" stroke-opacity=".16"/>
      <path d="M900 520C980 470 1040 470 1088 330" fill="none" stroke="${TOKENS.accent}" stroke-opacity=".4" stroke-width="2.5" stroke-dasharray="6 11"/>
      <circle cx="900" cy="520" r="5" fill="${TOKENS.accent}"/><circle cx="1088" cy="330" r="5" fill="${TOKENS.accent}"/>
      ${renderColumn(
        article,
        { x: 76, width: 820, top: 62, bottom: H - 56 },
        { titleSizes: [70, 64, 58, 52], titleLines: 3, subtitleLines: 2 },
      )}`;
  return wrap(defs, body);
}

function coverCard(
  article: CardArticle,
  cover: CardCover,
  layout: Exclude<CardLayout, "text">,
) {
  const ratio = validRatio(cover.dimensions) ?? 1;
  const frame = frameFor(layout, ratio);
  const href = cover.href;

  const column: Column =
    layout === "portrait"
      ? {
          x: frame.x + frame.width + GUTTER + 8,
          width: W - PAD - (frame.x + frame.width + GUTTER + 8),
          top: 62,
          bottom: H - 56,
        }
      : {
          x: 72,
          width: frame.x - GUTTER - 72,
          top: 62,
          bottom: H - 56,
        };
  const typography =
    layout === "portrait"
      ? {
          titleSizes: [64, 58, 52, 46, 42] as const,
          titleLines: 3,
          subtitleLines: 3,
        }
      : {
          titleSizes: [54, 48, 43, 38, 34] as const,
          titleLines: 4,
          subtitleLines: 2,
        };

  // Darken hardest where the type sits so contrast does not depend on the
  // cover's palette, and leave the frame side lighter so it still glows.
  const textSide = layout === "portrait" ? 1 : 0;
  const defs = `
      <filter id="ambientBlur" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="46"/></filter>
      <filter id="frameShadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#000" flood-opacity=".55"/></filter>
      <linearGradient id="scrim" x1="${textSide}" y1="0" x2="${1 - textSide}" y2="0"><stop stop-color="${TOKENS.bg}" stop-opacity=".94"/><stop offset=".5" stop-color="${TOKENS.bg}" stop-opacity=".82"/><stop offset="1" stop-color="${TOKENS.bg}" stop-opacity=".58"/></linearGradient>
      <radialGradient id="frameGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${frame.x + frame.width / 2} ${frame.y + frame.height / 2}) scale(${frame.width * 0.78} ${frame.height * 0.78})"><stop stop-color="${TOKENS.accent}" stop-opacity=".14"/><stop offset="1" stop-color="${TOKENS.accent}" stop-opacity="0"/></radialGradient>
      <clipPath id="frameClip"><rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="20"/></clipPath>
      <image id="art" href="${href}" width="${frame.width}" height="${frame.height}" preserveAspectRatio="xMidYMid meet"/>`;

  // The blur region is the card in user space, never a percentage of the
  // over-scaled ambient copy's bbox: pinned Resvg 2.6.2 mis-renders that
  // case inside the rounded card clip and drops part of the framed cover.
  //
  // One embedded raster, placed twice: a cover data URI can be megabytes and
  // this renders in a memory-bounded pod, so it is never duplicated in the
  // SVG string. The ambient copy is scaled to over-fill the card so the blur
  // has no transparent edge to bleed in.
  const ambientScale = Math.max(
    (W * 1.16) / frame.width,
    (H * 1.16) / frame.height,
  );
  const ambientX = (W - frame.width * ambientScale) / 2;
  const ambientY = (H - frame.height * ambientScale) / 2;

  // The portrait poster sits on a faint offset sheet, like the top print of a
  // stack, so a narrow frame still has visual weight on the card.
  const sheet =
    layout === "portrait"
      ? `<rect x="${frame.x + 16}" y="${frame.y + 12}" width="${frame.width}" height="${frame.height}" rx="20" fill="${TOKENS.surface}" fill-opacity=".7" stroke="${TOKENS.accent}" stroke-opacity=".22" transform="rotate(2.4 ${frame.x + frame.width / 2} ${frame.y + frame.height / 2})"/>`
      : "";

  const body = `
      <g filter="url(#ambientBlur)" opacity=".95"><use href="#art" transform="translate(${ambientX.toFixed(1)} ${ambientY.toFixed(1)}) scale(${ambientScale.toFixed(4)})"/></g>
      <rect width="${W}" height="${H}" fill="url(#scrim)"/>
      <rect width="${W}" height="${H}" fill="url(#frameGlow)"/>
      ${sheet}
      <rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="20" fill="${TOKENS.bg}" filter="url(#frameShadow)"/>
      <g clip-path="url(#frameClip)">
        <rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" fill="${TOKENS.surface}"/>
        <use href="#art" x="${frame.x}" y="${frame.y}"/>
      </g>
      <rect x="${frame.x + 0.75}" y="${frame.y + 0.75}" width="${frame.width - 1.5}" height="${frame.height - 1.5}" rx="19.25" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1.5"/>
      ${renderColumn(article, column, typography)}`;
  return wrap(defs, body);
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
