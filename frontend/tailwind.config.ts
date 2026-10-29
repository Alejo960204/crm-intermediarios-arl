import type { Config } from "tailwindcss";

/** Colores ligados a variables CSS (ver globals.css) para que el modo claro/oscuro cambie toda la aplicación. */
const v = (n: string) => `rgb(var(--${n}) / <alpha-value>)`;
const escala = (base: string, tonos: number[]) => Object.fromEntries(tonos.map((t) => [t, v(`${base}-${t}`)]));

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: escala("slate", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        blue: escala("blue", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        green: escala("green", [50, 100, 200, 300, 500, 600, 700, 800]),
        red: escala("red", [50, 100, 200, 300, 500, 600, 700, 800]),
        amber: escala("amber", [50, 100, 200, 300, 400, 500, 700, 800, 900]),
        marca: { marino: "#14405F", cielo: "#10A0D0", verde: "#80B030" },
      },
      keyframes: {
        entrar: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        flotar: { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(24px,-18px) scale(1.06)" } },
      },
      animation: { entrar: "entrar .35s ease-out both", flotar: "flotar 14s ease-in-out infinite" },
    },
  },
  plugins: [],
};
export default config;
