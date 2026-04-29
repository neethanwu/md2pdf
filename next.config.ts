import type { NextConfig } from "next";

/* Deployed under labs.rewired.mx/md2pdf via a Cloudflare Worker that
   reverse-proxies /md2pdf/* to this Vercel project. basePath shifts every
   route, asset, and API endpoint under the prefix so the proxied URLs match
   what the Worker forwards. NEXT_PUBLIC_BASE_PATH mirrors the value to the
   client bundle for fetch() calls — Next prefixes <Link>/<Image> automatically,
   but the browser fetch API does not. */
const basePath = "/md2pdf";

const nextConfig: NextConfig = {
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  /* @sparticuz/chromium ships its Chromium build as brotli blobs in `bin/` and
     reads them at runtime via path.join(__dirname, "..", "..", "bin"). Next
     auto-externalizes the package, but file tracing can't see the binaries
     statically, so Vercel's serverless bundle omits them and the route throws
     "input directory ... does not exist". Force-include them on the PDF route. */
  outputFileTracingIncludes: {
    "/api/pdf": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
      /* lib/pdf-fonts.ts reads these WOFF2 blobs from disk via fs.readFileSync
         to base64-inline them into the PDF HTML. NFT can't trace dynamic
         readFileSync paths statically, so force-include them. */
      "./node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-*.woff2",
      "./node_modules/@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-*.woff2",
      /* lib/pdf-katex.ts reads katex.min.css and the KaTeX font woff2 blobs
         to inline math typesetting only when the markdown contains math. */
      "./node_modules/katex/dist/katex.min.css",
      "./node_modules/katex/dist/fonts/*.woff2",
    ],
  },
};

export default nextConfig;
