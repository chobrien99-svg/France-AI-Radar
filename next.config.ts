import type { NextConfig } from "next";
import { embedFrameAncestors } from "./lib/embed/hosts";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Embeds may only be shown inside our own sites (see lib/embed/hosts.ts).
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: `frame-ancestors ${embedFrameAncestors()}` }],
      },
    ];
  },
};

export default nextConfig;
