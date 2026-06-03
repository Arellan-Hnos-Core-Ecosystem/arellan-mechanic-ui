import type { Config } from "tailwindcss";

export default {
  presets: [require("@arellan-hnos-core-ecosystem/ui/tailwind/arellan-preset")],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
