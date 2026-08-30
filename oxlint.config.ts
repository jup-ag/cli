import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    correctness: "warn",
  },
  rules: {
    curly: "error",
    "no-unused-vars": "allow",
  },
});
