import { defineConfig } from "vitest/config";
import path from "node:path";

// Tests for the one real algorithm in the app: the radar nowcast
// (pixel→intensity, sampling, motion, summary). The logic lives in the shared
// lib at mobile/src/lib; we resolve @/lib the same way the web app does.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/lib\//, replacement: path.resolve(__dirname, "mobile/src/lib") + "/" },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
