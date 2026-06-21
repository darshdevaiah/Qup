import type { NextConfig } from "next";

/** Hostnames allowed to load dev-only /_next assets (LAN mobile testing). */
function collectAllowedDevOrigins(): string[] {
  const hosts = new Set<string>();
  const share = process.env.NEXT_PUBLIC_SHARE_ORIGIN?.trim();

  if (share) {
    try {
      const url = new URL(share);
      hosts.add(url.hostname);
      hosts.add(url.host);
    } catch {
      // ignore malformed NEXT_PUBLIC_SHARE_ORIGIN
    }
  }

  return [...hosts];
}

const allowedDevOrigins = collectAllowedDevOrigins();

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
