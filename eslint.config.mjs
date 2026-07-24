import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Route handlers must derive the acting user from the verified session
    // (createSupabaseServerClient) or use the admin client — never the
    // anon-key browser client, which carries no cookie/session context on
    // the server and silently runs every query as `anon`.
    files: ["src/app/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          {
            name: "@/lib/supabase/client",
            message: "Route handlers run server-side and never carry a browser session — use createSupabaseServerClient from '@/lib/supabase/server' (or getSessionFromRequest from '@/lib/api-auth') instead of the browser client.",
          },
        ],
      }],
    },
  },
];

export default eslintConfig;
