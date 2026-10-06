import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    allowedDevOrigins: ['192.168.1.162'],
    async redirects() {
        return [
            // The host-only board was replaced by the public preview page.
            { source: "/rooms/:slug/board", destination: "/rooms/:slug/preview", permanent: false },
        ];
    },
};

export default nextConfig;
