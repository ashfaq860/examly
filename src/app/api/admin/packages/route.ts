import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireRole(["admin", "super_admin"]);
  if (auth.error) return auth.error;

  const { data, error } = await supabaseAdmin
    .from("packages")
    .select("*")
    .order("price");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify(data), { status: 200 });
}
