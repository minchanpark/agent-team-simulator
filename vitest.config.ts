import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
