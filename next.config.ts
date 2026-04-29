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
};

export default nextConfig;
