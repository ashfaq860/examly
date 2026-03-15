// src/app/api/profile/check-cellno/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { cellno } = body;

    if (!cellno) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    // Validate phone number format
    const cleanCellno = cellno.replace(/\D/g, '');
    if (!/^03\d{9}$/.test(cleanCellno)) {
      return NextResponse.json({ error: "Phone number must be 11 digits starting with 03" }, { status: 400 });
    }

    // Check if cellno already exists for another user
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
      return NextResponse.json({ error: "Phone number already registered" }, { status: 400 });
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    console.error("Unexpected server error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}