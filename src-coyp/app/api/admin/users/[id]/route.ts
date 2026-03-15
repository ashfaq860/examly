import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: body.full_name,
        role: body.role,
        institution: body.institution,
        subscription_status: body.subscription_status,
        trial_ends_at: body.trial_ends_at,
      })
      .eq("id", params.id)
      .select();

    if (error) throw error;

    return NextResponse.json({ user: data[0] });
  } catch (err) {
    console.error("Error updating user:", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
