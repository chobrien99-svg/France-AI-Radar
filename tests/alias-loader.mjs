// Lets `node --test` load app modules that import "@/..." (the tsconfig path alias).
import { register } from "node:module"

register(
  "data:text/javascript," + encodeURIComponent(`
    export async function resolve(specifier, context, next) {
      if (specifier.startsWith("@/")) specifier = new URL(specifier.slice(2) + ".ts", ${JSON.stringify(new URL("../", import.meta.url).href)}).href
      return next(specifier, context)
    }
  `),
  import.meta.url,
)
