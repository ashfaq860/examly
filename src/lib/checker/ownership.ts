// Shared ownership checks for the checker API routes — mirrors the inline
// pattern already used by papers/delete/route.ts and grade-mcq/route.ts
// (resource owner, or an admin/super_admin override), factored out once
// four different routes need the same check.
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type OwnershipResult =
  | { authorized: true; paper: any }
  | { authorized: false; status: number; message: string };

export async function verifyPaperOwnership(paperId: string, userId: string): Promise<OwnershipResult> {
  const { data: paper, error } = await supabaseAdmin.from('papers').select('*').eq('id', paperId).maybeSingle();
  if (error || !paper) return { authorized: false, status: 404, message: error?.message || 'Paper not found' };
  if (paper.created_by === userId) return { authorized: true, paper };

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile && ['admin', 'super_admin'].includes(profile.role)) return { authorized: true, paper };

  return { authorized: false, status: 403, message: 'Forbidden' };
}

export type SubmissionOwnershipResult =
  | { authorized: true; submission: any }
  | { authorized: false; status: number; message: string };

export async function verifySubmissionOwnership(submissionId: string, userId: string): Promise<SubmissionOwnershipResult> {
  const { data: submission, error } = await supabaseAdmin.from('submissions').select('*').eq('id', submissionId).maybeSingle();
  if (error || !submission) return { authorized: false, status: 404, message: error?.message || 'Submission not found' };
  if (submission.uploaded_by === userId) return { authorized: true, submission };

  const paperOwnership = await verifyPaperOwnership(submission.paper_id, userId);
  if (paperOwnership.authorized) return { authorized: true, submission };

  return { authorized: false, status: 403, message: 'Forbidden' };
}
