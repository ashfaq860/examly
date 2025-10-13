// api/profile/update/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use admin client to bypass RLS
    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (fetchError) {
      console.error("Error fetching profile:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!existingProfile) {
      // Create profile with admin client
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating profile:", createError);
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
      
      return NextResponse.json(newProfile);
    }

    return NextResponse.json(existingProfile);
  } catch (error) {
    console.error("Unexpected server error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, institution, cellno } = body;

    // Validate phone number format
    if (cellno) {
      const cleanCellno = cellno.replace(/\D/g, '');
      if (!/^03\d{9}$/.test(cleanCellno)) {
        return NextResponse.json({ error: "Phone number must be 11 digits starting with 03" }, { status: 400 });
      }
    }

    // Check if cellno is being changed and if it already exists
    if (cellno) {
      const cleanCellno = cellno.replace(/\D/g, '');
      const { data: existingProfile, error: checkError } = await supabaseAdmin
        .from("profiles")
        .select("id, cellno")
        .eq("cellno", cleanCellno)
        .neq("id", session.user.id)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking cellno:", checkError);
        return NextResponse.json({ error: "Error checking phone number availability" }, { status: 500 });
      }

      if (existingProfile) {
        return NextResponse.json({ error: "Phone number already registered with another account" }, { status: 400 });
      }
    }

    // Use admin client to update profile
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name,
        institution,
        cellno: cellno ? cellno.replace(/\D/g, '') : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", session.user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating profile:", updateError);
      
      // Handle unique constraint violation
      if (updateError.code === '23505' && updateError.details?.includes('cellno')) {
        return NextResponse.json({ error: "Phone number already registered with another account" }, { status: 400 });
      }
      
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error("Unexpected server error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}