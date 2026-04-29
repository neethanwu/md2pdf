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
    "/api/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
