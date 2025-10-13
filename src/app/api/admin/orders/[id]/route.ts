import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { action } = await req.json(); // { action: "approve" | "reject" }
    const { id } = await params; // ✅ must await params

    if (!id || !action) {
      return NextResponse.json(
        { error: "Missing order ID or action" },
        { status: 400 }
      );
    }

    if (action === "approve") {
      // Approve order = set active true
      const { data, error } = await supabaseAdmin
        .from("user_packages")
        .update({ is_active: true })
        .eq("id", id)
        .select("id")
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: "Order approved",
        data,
      });
    }

    if (action === "reject") {
      // Reject order = delete it
      const { error } = await supabaseAdmin
        .from("user_packages")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: "Order rejected",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("PATCH /api/admin/orders/[id] error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
