import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, email, role, full_name } = body;

    if (!id || !email || !role) {
      return NextResponse.json({ error: 'Missing required fields: id, email, role' }, { status: 400 });
    }

    console.log(`Creating profile for user: ${id}, email: ${email}`);

    // Wait longer to ensure the user is created in auth.users table
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if user exists in auth.users table first
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', id)
      .single();

    if (userError || !user) {
      console.error('User not found in auth.users table:', userError);
      return NextResponse.json({ 
        error: 'User not found in database. Please try again later.',
        details: 'The user account needs more time to be created'
      }, { status: 404 });
    }

    // Check if profile already exists
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (profileCheckError) {
      console.error('Error checking for existing profile:', profileCheckError);
    }

    if (existingProfile) {
      console.log('Profile already exists, updating instead');
      // Update existing profile
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          email,
          role,
          full_name: full_name || null,
        })
        .eq('id', id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return NextResponse.json({ 
          error: `Failed to update profile: ${updateError.message}`,
          code: updateError.code
        }, { status: 500 });
      }

      return NextResponse.json({ message: 'Profile updated successfully' }, { status: 200 });
    }

    // Try to insert into profiles table
    try {
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: id,
          email: email,
          role: role,
          full_name: full_name || null,
        });

      if (insertError) {
        console.error("Error creating profile:", insertError);
        
        // If there's still a foreign key error, the user might not be fully created yet
        if (insertError.code === '23503') {
          return NextResponse.json({ 
            error: 'User account is not fully created yet',
            details: 'Please try again later or contact support',
            code: insertError.code
          }, { status: 202 }); // 202 Accepted - the request was accepted but not yet completed
        }
        
        return NextResponse.json({ 
          error: `Failed to create profile: ${insertError.message}`,
          code: insertError.code
        }, { status: 500 });
      }

      return NextResponse.json({ message: 'Profile created successfully' }, { status: 200 });

    } catch (insertErr) {
      console.error("Insert operation failed:", insertErr);
      return NextResponse.json({ 
        error: 'Insert operation failed',
        details: String(insertErr)
      }, { status: 500 });
    }

  } catch (err) {
    const error = err instanceof Error ? err : new Error(JSON.stringify(err));
    console.error('Create profile API error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}