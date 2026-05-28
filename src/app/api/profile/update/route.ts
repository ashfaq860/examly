// api/profile/update/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function GET() {
  const auth = await getSessionFromRequest();
  if (auth.error) return auth.error;

  const userId = auth.user.id;

  try {
    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError) {
      // Profile doesn't exist yet — create it
      if (fetchError.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from("profiles")
          .insert({
            id: userId,
            email: auth.user.email,
            full_name:
              auth.user.user_metadata?.name ||
              auth.user.email?.split('@')[0] ||
              'User',
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating profile:", createError);
          return NextResponse.json({ error: createError.message }, { status: 500 });
        }

        return NextResponse.json(newProfile);
      }

      console.error("Error fetching profile:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json(existingProfile);
  } catch (error) {
    console.error("Unexpected server error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await getSessionFromRequest();
  if (auth.error) return auth.error;

  const userId = auth.user.id;

  try {
    const body = await request.json();
    const { full_name, institution, cellno, address } = body;

    // Validate phone number format
    if (cellno) {
      const cleanCellno = cellno.replace(/\D/g, '');
      if (!/^03\d{9}$/.test(cleanCellno)) {
        return NextResponse.json(
          { error: "Phone number must be 11 digits starting with 03" },
          { status: 400 }
        );
      }

      // Check uniqueness
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("cellno", cleanCellno)
        .neq("id", userId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "Phone number already registered with another account" },
          { status: 400 }
        );
      }
    }

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name,
        institution,
        cellno: cellno ? cellno.replace(/\D/g, '') : null,
        address: address || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating profile:", updateError);
      if (updateError.code === '23505' && updateError.details?.includes('cellno')) {
        return NextResponse.json(
          { error: "Phone number already registered with another account" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error("Unexpected server error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}