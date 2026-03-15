import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- Helper functions (same as before) ---

function mapSourceType(sourceType: string): string {
  const map: Record<string, string> = {
    model: 'model_paper',
    past: 'past_paper',
    book: 'book',
    all: 'all'
  };
  return map[sourceType] || sourceType;
}

async function findQuestionsWithFallback(
  supabase: any,
  type: string,
  subjectId: string,
  chapterIds: string[],
  source_type: string | undefined,
  difficulty: string | undefined,
  count: number
) {
  const dbSourceType = source_type ? mapSourceType(source_type) : undefined;

  let query = supabase
    .from('questions')
    .select('id')
    .eq('question_type', type)
    .eq('subject_id', subjectId);

  if (chapterIds.length > 0) query = query.in('chapter_id', chapterIds);
  if (dbSourceType && dbSourceType !== 'all')
    query = query.eq('source_type', dbSourceType);
  if (difficulty && difficulty !== 'any')
    query = query.eq('difficulty', difficulty);

  query = query.order('id', { ascending: false }).limit(count);
  const { data, error } = await query;
  if (error) return [];

  if (data && data.length >= count) return data;

  // fallback to no difficulty
  let fallback = supabase
    .from('questions')
    .select('id')
    .eq('question_type', type)
    .eq('subject_id', subjectId);
  if (chapterIds.length > 0) fallback = fallback.in('chapter_id', chapterIds);
  if (dbSourceType && dbSourceType !== 'all')
    fallback = fallback.eq('source_type', dbSourceType);
  const { data: fb } = await fallback.order('id', { ascending: false }).limit(count);
  return fb || [];
}

// --- Main API Route ---

export async function POST(req: Request) {
  try {
    const {
      subjectId,
      selectedChapters,
      paperTitle,
      chapterOption,
      selectionMethod,
      selectedQuestions,
      mcqCount,
      mcqDifficulty = 'any',
      sourceType = 'all',
    } = await req.json();

    if (!subjectId) {
      return NextResponse.json({ message: 'Subject ID is required' }, { status: 400 });
    }

    let mcqs = [];

    // Manual selection
    if (selectedQuestions && selectedQuestions.mcq?.length > 0) {
      const { data, error } = await supabase
        .from('questions')
        .select(
          `id, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty, chapter_id, chapters!inner(chapterNo, name)`
        )
        .in('id', selectedQuestions.mcq);

      if (error) throw error;

      mcqs = selectedQuestions.mcq
        .map((id: string) => data.find((q: any) => q.id === id))
        .filter(Boolean);
    } else {
      const found = await findQuestionsWithFallback(
        supabase,
        'mcq',
        subjectId,
        chapterOption === 'custom' ? selectedChapters || [] : [],
        sourceType,
        mcqDifficulty,
        mcqCount
      );

      if (!found.length)
        return NextResponse.json({ message: 'No MCQs found' }, { status: 404 });

      const { data: full, error: fullError } = await supabase
        .from('questions')
        .select(
          `id, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty, chapter_id, chapters!inner(chapterNo, name)`
        )
        .in('id', found.map((q) => q.id))
        .order('id', { ascending: false });

      if (fullError) throw fullError;
      mcqs = full || [];
    }

    if (!mcqs.length) {
      return NextResponse.json({ message: 'No MCQs found' }, { status: 404 });
    }

    // --- Generate HTML for Puppeteer ---
    const htmlContent = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; font-size: 13px; color: #000; }
          h1 { text-align: center; margin-bottom: 10px; }
          .meta { text-align: center; margin-bottom: 20px; font-size: 12px; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ccc; padding: 8px; }
          th { background-color: #f9f9f9; text-align: left; }
          .answer { color: green; }
        </style>
      </head>
      <body>
        <h1>${paperTitle || 'Generated Paper'} - MCQ Answer Key</h1>
        <div class="meta">
          <p>Selection Method: ${selectionMethod}</p>
          <p>Total MCQs: ${mcqs.length}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Question</th>
              <th>Correct Answer</th>
            </tr>
          </thead>
          <tbody>
            ${mcqs
              .map((mcq: any, i: number) => {
                const optLetter = mcq.correct_option?.toUpperCase() || '?';
                const optKey = `option_${optLetter.toLowerCase()}`;
                const answer = mcq[optKey] || '';
                return `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${mcq.question_text}</td>
                    <td class="answer">${optLetter}. ${answer}</td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
        <p style="margin-top:30px; text-align:center; font-size:11px; color:#888;">
          Generated on ${new Date().toLocaleDateString()}
        </p>
      </body>
      </html>
    `;

    // --- Puppeteer PDF Generation ---
    const isLocal = !process.env.AWS_REGION;
    const executablePath = isLocal
      ? process.env.CHROME_PATH ||
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : await chromium.executablePath();

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });

    await browser.close();

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(paperTitle || 'mcq-key')
          .replace(/[^a-z0-9]/gi, '_')}-key.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('❌ Error generating MCQ key:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}
