import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paperId } = body;

    if (!paperId) {
      return NextResponse.json({ error: 'Missing paperId' }, { status: 400 });
    }

    // Create Supabase admin client with service role key (bypasses RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get paper record
    const { data: paper, error: fetchError } = await supabaseAdmin
      .from('papers')
      .select('*')
      .eq('id', paperId)
      .single();

    if (fetchError || !paper) {
      return NextResponse.json({ error: fetchError?.message || 'Paper not found' }, { status: 404 });
    }

    // Helper to extract path from storage URL
    const extractPathFromUrl = (url: string): string | null => {
      if (!url) return null;
      try {
        // Remove the base URL and get just the path part
        const baseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
        if (url.startsWith(baseUrl)) {
          return url.substring(baseUrl.length);
        }
        return null;
      } catch (error) {
        console.error('Error extracting path from URL:', error);
        return null;
      }
    };

    // Delete storage files
    const deletions = [];

    // Delete PDF
    if (paper.paperPdf) {
      const pdfPath = extractPathFromUrl(paper.paperPdf);
      if (pdfPath) {
        // Extract bucket name from path (first part before '/')
        const bucket = pdfPath.split('/')[0];
        const filePath = pdfPath.substring(bucket.length + 1);
        
        deletions.push(
          supabaseAdmin.storage
            .from(bucket)
            .remove([filePath])
            .catch(error => {
              console.error(`Error deleting PDF (${filePath}) from ${bucket}:`, error);
            })
        );
      }
    }

    // Delete Key
    if (paper.paperKey) {
      const keyPath = extractPathFromUrl(paper.paperKey);
      if (keyPath) {
        const bucket = keyPath.split('/')[0];
        const filePath = keyPath.substring(bucket.length + 1);
        
        deletions.push(
          supabaseAdmin.storage
            .from(bucket)
            .remove([filePath])
            .catch(error => {
              console.error(`Error deleting Key (${filePath}) from ${bucket}:`, error);
            })
        );
      }
    }

    // Wait for all storage deletions to complete
    if (deletions.length > 0) {
      await Promise.all(deletions);
    }

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from('papers')
       .update({ paperPdf: null, paperKey: null })
      .eq('id', paperId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Paper deleted successfully' 
    });

  } catch (err: any) {
    console.error('Error deleting paper:', err);
    return NextResponse.json({ 
      error: err.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}