// app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireRole(["admin", "super_admin"]);
  if (auth.error) return auth.error;

  try {
const { data, error } = await supabaseAdmin
  .from("user_packages")
  .select(`
    id,
    is_trial,
    is_active,
    expires_at,
    created_at,
    packages (*),
    profiles (id, full_name, email, cellno, institution)
  `)
  .eq("is_active", false)
  .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
