import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

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

      // Deactivate every other active package this user has. Without this,
      // approving a new order just stacked another is_active=true row on
      // top of whatever the user already had — get_active_package then had
      // several active rows to choose between and picked one arbitrarily
      // (observed picking the wrong one: a plain "Monthly" package over a
      // newer "Paper Checker Monthly" the user had actually paid for,
      // silently denying them a feature they were entitled to). Exactly one
      // active package per user is the invariant every entitlement RPC
      // assumes, so approval is where it must be enforced.
      const { error: deactivateOthersError } = await supabase
        .from('user_packages')
        .update({ is_active: false })
        .eq('user_id', userPackage.user_id)
        .neq('id', id)
        .eq('is_active', true)

      if (deactivateOthersError) {
        console.error('Failed to deactivate other active packages:', deactivateOthersError)
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