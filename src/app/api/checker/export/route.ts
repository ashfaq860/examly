// app/api/checker/export/route.ts
// Server-generated xlsx gradebook for one paper's submissions. This
// project's only prior xlsx usage (admin/management/questions/page.tsx)
// builds the workbook entirely client-side and never streams file bytes
// from a route — this establishes that pattern fresh, using the same
// XLSX.utils.json_to_sheet call (keys become the header row) for
// consistency with the one existing precedent.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { verifyPaperOwnership } from '@/lib/checker/ownership';
import { effectiveOption, isAnswerCorrect } from '@/lib/checker/answers';

export async function GET(req: NextRequest) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    const paperId = searchParams.get('paperId');
    if (!paperId) return NextResponse.json({ error: 'Missing paperId' }, { status: 400 });

    const ownership = await verifyPaperOwnership(paperId, user.id);
    if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });
    const paper = ownership.paper;

    const { data: submissions, error: subsErr } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('paper_id', paperId)
      .order('roll_no_raw', { ascending: true });
    if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 });

    const submissionIds = (submissions || []).map(s => s.id);
    let answers: any[] = [];
    if (submissionIds.length > 0) {
      const { data: answerRows, error: answersErr } = await supabaseAdmin
        .from('submission_answers')
        .select('*')
        .in('submission_id', submissionIds)
        .order('q_number', { ascending: true });
      if (answersErr) return NextResponse.json({ error: answersErr.message }, { status: 500 });
      answers = answerRows || [];
    }

    const answersBySubmission = new Map<string, any[]>();
    const questionNumbers = new Set<number>();
    for (const a of answers) {
      if (!answersBySubmission.has(a.submission_id)) answersBySubmission.set(a.submission_id, []);
      answersBySubmission.get(a.submission_id)!.push(a);
      const n = Number(a.q_number);
      if (!Number.isNaN(n)) questionNumbers.add(n);
    }
    const sortedQNumbers = Array.from(questionNumbers).sort((a, b) => a - b);

    const rows = (submissions || []).map(s => {
      const subAnswers = answersBySubmission.get(s.id) || [];
      const byQNumber = new Map(subAnswers.map(a => [Number(a.q_number), a]));

      const row: Record<string, string | number> = {
        'Roll No': s.roll_no_raw || '',
        'Name': s.student_name_raw || '',
        'MCQ Score': s.mcq_score ?? '',
        'Max': s.max_score ?? '',
        'Status': s.status,
      };

      for (const qNum of sortedQNumbers) {
        const a = byQNumber.get(qNum);
        row[`Q${qNum} Detected`] = a?.detected_option || '';
        row[`Q${qNum} Final`] = a ? (effectiveOption(a) || '') : '';
        if (a) row[`Q${qNum} Correct`] = isAnswerCorrect(a) ? 'Y' : 'N';
      }

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const safeTitle = (paper.title || 'paper').replace(/[^a-z0-9-_ ]/gi, '').trim() || 'paper';

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeTitle}-results.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting results:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
