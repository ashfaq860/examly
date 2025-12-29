import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { action } = await request.json()

    // Fetch the user package with package details
    const { data: userPackage, error: fetchError } = await supabase
      .from('user_packages')
      .select(`
        *,
        packages (*)
      `)
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (action === 'approve') {
      // Calculate expires_at based on package type
      let expiresAt = null
      
      if (userPackage.packages.type === 'papers') {
        // For paper packages, set expiration to 30 days from now
        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() + 30) // 30 days
        expiresAt = expiryDate.toISOString()
      } else if (userPackage.packages.duration_days) {
        // For other packages with duration_days, use that
        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() + userPackage.packages.duration_days)
        expiresAt = expiryDate.toISOString()
      }
      // If no duration_days and not a paper package, expires_at remains null

      // Update the user package
      const { error: updateError } = await supabase
        .from('user_packages')
        .update({
          is_active: true,
          expires_at: expiresAt,
          // If it's a paper package, also set papers_remaining
          papers_remaining: userPackage.packages.type === 'papers' 
            ? userPackage.packages.paper_quantity 
            : null
        })
        .eq('id', id)

      if (updateError) {
        console.error('Update error:', updateError)
        return NextResponse.json(
          { error: 'Failed to approve order' },
          { status: 500 }
        )
      }

      return NextResponse.json({ message: 'Order approved successfully' })
    
    } else if (action === 'reject') {
      // For rejection, delete the record
      const { error: deleteError } = await supabase
        .from('user_packages')
        .delete()
        .eq('id', id)

      if (deleteError) {
        return NextResponse.json(
          { error: 'Failed to reject order' },
          { status: 500 }
        )
      }

      return NextResponse.json({ message: 'Order rejected successfully' })
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error processing order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}