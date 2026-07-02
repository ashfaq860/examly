// app/api/subscriptions/[userId]/route.ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function GET(
  req: NextRequest,
  context: { params: { userId: string } }
) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const { userId } = await context.params; // 👈 MUST await

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Ownership check — only the account owner or an admin may view these subscriptions
    if (userId !== user.id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from("user_packages")
      .select("*, packages(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
