/* Emoji font loading for the PDF lambda and the browser preview.

   Why CDN, not inline: the full Noto Color Emoji woff2 is ~5.7MB and the
   subsetted variant ships ~3.9MB across nine unicode-range chunks. Inlining
   that into every export — even Latin-only docs that never use emoji — would
   bloat the HTML payload by an order of magnitude. Google Fonts smart-subsets
   via unicode-range, so a typical doc only downloads the few hundred KB of
   chunks that contain its actual emoji.

   Why Noto Color Emoji specifically: @sparticuz/chromium ships without any
   system emoji font, so unsupported codepoints render as tofu. Adding Noto
   Color Emoji to the font-family stack and loading the CDN stylesheet gives
   per-character fallback a glyph to land on. Both the preview and the PDF
   reference the same family so cross-platform output looks identical.

   The Pictographic regex covers the practical surface: emoticons, symbols,
   transport, flags (regional indicators), and the supplementary symbols
   blocks. ZWJ sequences and variation selectors travel with their base
   pictographs, so detecting the base char is sufficient — the font handles
   the sequencing. */

const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

export const EMOJI_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap";

export const EMOJI_FONT_FAMILY = '"Noto Color Emoji"';

export function hasEmoji(text: string): boolean {
  return EMOJI_REGEX.test(text);
}

export function getEmojiFontsLink(needsEmoji: boolean): string {
  if (!needsEmoji) return "";
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${EMOJI_FONTS_HREF}" data-md2pdf-emoji-fonts />`;
}
