import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "out/**", "dist/**", "coverage/**", "next-env.d.ts"]
  },
  ...nextVitals,
  {
    rules: {
      "@next/next/no-img-element": "off"
    }
  }
];

export default eslintConfig;
