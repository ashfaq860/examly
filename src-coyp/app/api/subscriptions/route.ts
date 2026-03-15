import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 🔹 GET → return all available packages
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("packages") // your table with plan definitions
      .select("*")
      .order("price", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/subscriptions error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 🔹 POST → request subscription
export async function POST(req: NextRequest) {
  try {
    const { userId, packageId } = await req.json();

    if (!userId || !packageId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Validate profile completion
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, cellno")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.full_name || !profile.cellno) {
      return NextResponse.json(
        {
          error: "Please complete your profile and add your phone number before subscribing.",
        },
        { status: 400 }
      );
    }

    // 2. Ensure no active or pending subscription
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("user_packages")
      .select("id, is_active, expires_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (existingError) throw new Error(existingError.message);

    const hasPending = existing?.some(
      (sub) => sub.is_active || (sub.expires_at && new Date(sub.expires_at) > new Date())
    );

    if (hasPending) {
      return NextResponse.json(
        { error: "You already have a pending or active subscription." },
        { status: 400 }
      );
    }

    // 3. Insert new subscription request
    const { data, error } = await supabaseAdmin
      .from("user_packages")
      .insert([
        {
          user_id: userId,
          package_id: packageId,
          is_active: false, // pending until admin approves
        },
      ])
      .select("*, packages(id, name)")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/subscriptions error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
