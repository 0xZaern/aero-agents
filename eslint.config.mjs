import next from "eslint-config-next";

// eslint-config-next@16 ships a native flat-config array - spread it directly.
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "_old-static/**",
      "backend/**",
      "telegram/**",
    ],
  },
  ...next,
];

export default eslintConfig;
