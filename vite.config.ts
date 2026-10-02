import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// One config for three modes:
//   npm run dev        -> serves the lab (index.html + src/App.tsx)
//   npm run build      -> builds the library into dist/
//   npm run build:lab  -> builds the lab into dist-lab/, for GitHub Pages

// The GitHub repository, which is also the subdirectory Pages serves the lab
// under: https://farena.github.io/fa-wysiwyg-react/
const REPO = "fa-wysiwyg-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Pages serves the lab under /<repo>/, not at the domain root.
  base: mode === "lab" ? `/${REPO}/` : "/",
  // public/ only holds the lab's assets: the library does not ship them.
  publicDir: mode === "production" ? false : "public",
  build:
    mode === "lab"
      ? { outDir: "dist-lab", emptyOutDir: true }
      : {
          lib: {
            entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
            name: "FaWysiwyg",
            formats: ["es", "umd"],
            fileName: (format) =>
              format === "es" ? "fa-wysiwyg.js" : "fa-wysiwyg.umd.cjs",
            cssFileName: "style",
          },
          rollupOptions: {
            // React is provided by the application that consumes the package,
            // and DOMPurify is installed as a dependency: bundling it would
            // ship a second copy to apps that already use it.
            external: ["react", "react-dom", "react/jsx-runtime", "dompurify"],
            output: {
              globals: {
                react: "React",
                "react-dom": "ReactDOM",
                "react/jsx-runtime": "jsxRuntime",
                dompurify: "DOMPurify",
              },
              exports: "named",
            },
          },
        },
}));
