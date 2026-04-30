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
   ship a 600 weight, so we use 400/500/700 there; serif presets use body
   400, heading 600, and table/strong 700, so 400/600/700 is enough.

   Why all four scripts: Han characters render with subtle stylistic
   differences across SC/TC/JP variants (e.g., 直 has different hooks).
   Loading all four lets the browser pick the right variant based on the
   document's content; Hangul-only Korean text falls cleanly to Noto Sans/
   Serif KR. */

export type CjkScript = "han" | "kana" | "hangul";

const CJK_SCRIPT_DEFINITIONS: Record<
  CjkScript,
  {
    sansQuery: string;
    serifQuery: string;
    regex: RegExp;
  }
> = {
  han: {
    sansQuery: "Noto+Sans+SC:wght@400;500;700",
    serifQuery: "Noto+Serif+SC:wght@400;600;700",
    regex: /[㐀-䶿一-鿿]/,
  },
  kana: {
    sansQuery: "Noto+Sans+JP:wght@400;500;700",
    serifQuery: "Noto+Serif+JP:wght@400;600;700",
    regex: /[぀-ゟ゠-ヿ]/,
  },
  hangul: {
    sansQuery: "Noto+Sans+KR:wght@400;500;700",
    serifQuery: "Noto+Serif+KR:wght@400;600;700",
    regex: /[가-힯ᄀ-ᇿ㄰-㆏]/,
  },
};

/* Broad preview fallback URL. The preview uses a long-lived browser tab, so
   one superset request is acceptable and prevents a visible font swap when a
   user edits from Chinese to Japanese/Korean. Export narrows this dynamically
   with getCjkFontsHref() below. */
export const CJK_FONTS_HREF = [
  "https://fonts.googleapis.com/css2",
  "?family=Noto+Sans+SC:wght@400;500;700",
  "&family=Noto+Sans+TC:wght@400;500;700",
  "&family=Noto+Sans+JP:wght@400;500;700",
  "&family=Noto+Sans+KR:wght@400;500;700",
  "&family=Noto+Serif+SC:wght@400;600;700",
  "&family=Noto+Serif+TC:wght@400;600;700",
  "&family=Noto+Serif+JP:wght@400;600;700",
  "&family=Noto+Serif+KR:wght@400;600;700",
  "&display=swap",
].join("");

export const CJK_FONTS_LINK = getCjkFontsLink({
  scripts: ["han", "kana", "hangul"],
  serif: true,
});

/* Detect whether the document needs CJK fonts loaded. Covers:
   - CJK Unified Ideographs (Han characters used by Chinese/Japanese/Korean)
   - CJK Unified Ideographs Extension A
   - Hiragana + Katakana (Japanese)
   - Hangul Syllables (Korean)
   - Hangul Jamo + Compatibility Jamo

   We over-include rather than under-include — false positive ships an extra
   <link> the browser may not need; false negative renders tofu. */
export function hasCJK(markdown: string): boolean {
  return getCjkScripts(markdown).length > 0;
}

export function getCjkScripts(markdown: string): CjkScript[] {
  return (Object.keys(CJK_SCRIPT_DEFINITIONS) as CjkScript[]).filter((script) =>
    CJK_SCRIPT_DEFINITIONS[script].regex.test(markdown),
  );
}

export function getCjkFontsHref({
  scripts,
  serif,
}: {
  scripts: CjkScript[];
  serif: boolean;
}) {
  const uniqueScripts = [...new Set(scripts)];
  const families = uniqueScripts.flatMap((script) => {
    const definition = CJK_SCRIPT_DEFINITIONS[script];
    return [
      `family=${definition.sansQuery}`,
      ...(serif ? [`family=${definition.serifQuery}`] : []),
    ];
  });

  if (families.length === 0) return "";
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

export function getCjkFontsLink({
  scripts,
  serif,
}: {
  scripts: CjkScript[];
  serif: boolean;
}) {
  const href = getCjkFontsHref({ scripts, serif });
  if (!href) return "";

  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${href}" data-md2pdf-cjk-fonts data-cjk-scripts="${scripts.join(",")}" data-cjk-serif="${serif ? "true" : "false"}" />`;
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

/* Code blocks should stay Latin-monospace for ASCII, but CJK glyphs need a
   real fallback in the PDF lambda. Chromium's bundled monospace fonts do not
   cover Han/kana/Hangul, so put sans CJK families before Latin fallbacks. */
export const CJK_MONO_STACK =
  '"Noto Sans SC", "Noto Sans TC", "Noto Sans JP", "Noto Sans KR", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Yu Gothic"';
