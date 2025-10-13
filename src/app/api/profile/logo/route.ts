// app/api/profile/logo/route.ts
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
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Use your existing bucket name
    const bucketName = 'profile_logo';

    const fileExt = file.name.split('.').pop();
    const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    // Upload image to Supabase Storage using admin client to bypass RLS
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading logo:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public URL using admin client
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    // Use admin client to bypass RLS policy for database update
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        logo: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Error updating profile with logo:', updateError);
      
      // Try to delete the uploaded file if profile update fails
      await supabaseAdmin.storage
        .from(bucketName)
        .remove([filePath]);
      
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, logo: publicUrl });
  } catch (err: any) {
    console.error('Unexpected error in logo upload API:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // First get the current logo URL to delete it from storage
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('logo')
      .eq('id', session.user.id)
      .single();

    if (fetchError) {
      console.error('Error fetching profile:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // If there's a logo, try to delete it from storage
    if (profile?.logo) {
      try {
        // Extract the filename from the URL
        const urlParts = profile.logo.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        await supabaseAdmin.storage
          .from('profile_logo')
          .remove([fileName]);
      } catch (storageError) {
        console.error('Error deleting logo from storage:', storageError);
        // Continue with profile update even if storage deletion fails
      }
    }

    // Use admin client to bypass RLS policy
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ 
        logo: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.user.id);

    if (error) {
      console.error('Error removing logo:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Unexpected error in logo delete API:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}