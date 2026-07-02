// app/api/profile/logo/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Only allow real raster image types — reject SVG (can carry embedded
    // <script>/onload payloads) and any non-image upload.
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPEG, WEBP or GIF images are allowed' }, { status: 400 });
    }

    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Logo must be smaller than 2MB' }, { status: 400 });
    }

    // Use your existing bucket name
    const bucketName = 'profile_logo';

    // Derive the extension from the validated MIME type — never trust the
    // client-supplied filename (it could contain "/" and land the object
    // in an unexpected storage path).
    const EXT_BY_TYPE: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const fileExt = EXT_BY_TYPE[file.type];
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
    const supabase = await createSupabaseServerClient();
    
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