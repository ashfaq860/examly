// src/app/api/admin/profiles/[id]/route.ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ✅ GET single profile
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // 👈 fix
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

// ✅ UPDATE profile
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // 👈 fix
  const body = await req.json();

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data);
}

// ✅ DELETE profile

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    /* ----------------------------------
       1️⃣ Delete profile (DB CASCADE handles referrals)
    ---------------------------------- */
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", id);

    if (profileError) {
      return Response.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    /* ----------------------------------
       2️⃣ Delete auth user
    ---------------------------------- */
    const { error: authError } =
      await supabaseAdmin.auth.admin.deleteUser(id);

    if (authError) {
      return Response.json(
        { error: authError.message },
        { status: 500 }
      );
    }

    return Response.json({ success: true });

  } catch (err: any) {
    return Response.json(
      { error: err.message || "Unexpected delete error" },
      { status: 500 }
    );
  }
}

