import adapter from "@sveltejs/adapter-auto";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      "$lib/components": "src/lib/components",
      "$lib/utils": "src/lib/utils.ts",
      "$lib/hooks": "src/lib/hooks",
    },
  },
};

export default config;
