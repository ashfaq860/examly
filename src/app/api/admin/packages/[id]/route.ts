import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRole } from "@/lib/api-auth";

// Updates a package. Same whitelist-every-column approach as POST — a
// partial `.update()` with a field silently missing from this list would
// otherwise leave stale/wrong data on the row (e.g. an edited "seats"
// value not actually saving) while the request still returns 200.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin", "super_admin"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const features: string[] = Array.isArray(body.features) && body.features.includes("paper_checker")
    ? ["paper_generation", "paper_checker"]
    : ["paper_generation"];

  const seatsNum = Number(body.seats);
  const scanQtyNum = Number(body.scan_quantity);

  const payload = {
    name: body.name,
    type: body.type === "subscription" ? "subscription" : "paper_pack",
    price: body.price,
    currency: body.currency || "PKR",
    duration_days: body.duration_days ?? null,
    paper_quantity: body.paper_quantity ?? null,
    description: body.description ?? null,
    is_active: body.is_active !== false,
    features,
    seats: Number.isFinite(seatsNum) && seatsNum >= 1 ? Math.floor(seatsNum) : 1,
    scan_quantity: body.scan_quantity === null || body.scan_quantity === undefined || body.scan_quantity === ""
      ? null
      : Math.max(0, Math.floor(scanQtyNum)),
  };

  const { data, error } = await supabaseAdmin
    .from("packages")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin", "super_admin"]);
  if (auth.error) return auth.error;

  const { id } = await params;

  const { error } = await supabaseAdmin.from("packages").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
