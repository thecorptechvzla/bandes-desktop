import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Export estático: la UI se empotra en Tauri y habla directo con el sidecar
  // (http://127.0.0.1:3001) vía axios en src/lib/api.ts — sin route handlers ni server.
  output: "export",
  trailingSlash: true, // directorios/index.html → compatible con el asset protocol de Tauri
  images: { unoptimized: true },
};

export default nextConfig;