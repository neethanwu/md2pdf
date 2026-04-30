/* CJK font loading for the PDF lambda and the browser preview.

   Why CDN, not inline: Noto Sans/Serif CJK fonts run 5-10MB per weight raw.
   Inlining four scripts (SC + TC + JP + KR) × two styles × multiple weights
   would mean 50-100MB of base64 in every PDF HTML — even for documents that
   never touch CJK. Google Fonts smart-subsets via unicode-range, so a typical
   Chinese-only doc downloads ~200-500KB of chunks at render time. The CDN
   round-trip is the price of CJK support.

   Why these weights: the preset CSS uses 400/500/600/650/700. CJK fonts
   carry more ink per glyph than Latin, so a CJK 700 reads heavier than a
   Latin 700. Loading the closest set per family and letting the browser
   weight-match keeps headings visually balanced. Sans CJK families don't
   ship a 600 weight, so we use 400/500/700 there; serif families ship 600
   and use 400/500/600/700.

   Why all four scripts: Han characters render with subtle stylistic
   differences across SC/TC/JP variants (e.g., 直 has different hooks).
   Loading all four lets the browser pick the right variant based on the
   document's content; Hangul-only Korean text falls cleanly to Noto Sans/
   Serif KR. */

const CJK_FONTS_LINK_HREF = [
  "https://fonts.googleapis.com/css2",
  "?family=Noto+Sans+SC:wght@400;500;700",
  "&family=Noto+Sans+TC:wght@400;500;700",
  "&family=Noto+Sans+JP:wght@400;500;700",
  "&family=Noto+Sans+KR:wght@400;500;700",
  "&family=Noto+Serif+SC:wght@400;500;600;700",
  "&family=Noto+Serif+TC:wght@400;500;600;700",
  "&family=Noto+Serif+JP:wght@400;500;600;700",
  "&family=Noto+Serif+KR:wght@400;500;600;700",
  "&display=swap",
].join("");

export const CJK_FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${CJK_FONTS_LINK_HREF}" />`;

/* Detect whether the document needs CJK fonts loaded. Covers:
   - CJK Unified Ideographs (Han characters used by Chinese/Japanese/Korean)
   - CJK Unified Ideographs Extension A
   - Hiragana + Katakana (Japanese)
   - Hangul Syllables (Korean)
   - Hangul Jamo + Compatibility Jamo

   We over-include rather than under-include — false positive ships an extra
   <link> the browser may not need; false negative renders tofu. */
export function hasCJK(markdown: string): boolean {
  return /[぀-ゟ゠-ヿ㐀-䶿一-鿿가-힯ᄀ-ᇿ㄰-㆏]/.test(
    markdown,
  );
}

/* Font-family stacks for preset CSS — Latin first, CJK by frequency
   (SC → TC → JP → KR), then system CJK fallbacks for the brief moment before
   Noto loads in the browser, then Latin system fallbacks. The lambda has no
   system CJK fonts, so during the Google Fonts load it'll show tofu — but
   document.fonts.ready in POST_RENDER_SCRIPT gates the PDF capture on the
   load completing, so that intermediate state is never captured. */
export const CJK_SANS_STACK =
  '"Noto Sans SC", "Noto Sans TC", "Noto Sans JP", "Noto Sans KR", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Yu Gothic"';

export const CJK_SERIF_STACK =
  '"Noto Serif SC", "Noto Serif TC", "Noto Serif JP", "Noto Serif KR", "PingFang SC", "Hiragino Mincho ProN", "Yu Mincho", "MS Mincho"';
