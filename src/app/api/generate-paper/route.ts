// app/api/generate-paper/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes
import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { PaperGenerationRequest } from '@/types/types';
import { translate } from '@vitalets/google-translate-api';

// --- Puppeteer for PDF generation ---
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// 1. Puppeteer browser instance singleton
let browserPromise: Promise<any> | null = null;

async function getPuppeteerBrowser() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      if (browser.connected) return browser;
    } catch (error) {
      console.warn('Existing browser promise rejected, creating new one');
      browserPromise = null;
    }
  }

  const launchBrowser = async () => {
    try {
      console.log('🚀 Launching browser with @sparticuz/chromium...');
      
      // ALWAYS use @sparticuz/chromium - never try to find system Chrome
      const executablePath = await chromium.executablePath();
      console.log('📁 Chromium executable path:', executablePath);

      const launchOptions = {
        args: chromium.args,
        executablePath: executablePath,
        headless: chromium.headless,
        timeout: 30000,
      };

      console.log('🎯 Browser launch options ready');
      
      const browser = await puppeteer.launch(launchOptions);
      console.log('✅ Browser launched successfully');
      
      browser.on('disconnected', () => {
        console.log('🔌 Browser disconnected');
        browserPromise = null;
      });
      
      return browser;
    } catch (error) {
      console.error('Failed to launch playwright:', error);
      browserPromise = null; // Reset promise on failure
      throw new Error('PDF generation is not available at this time');
    }
  };

  browserPromise = launchBrowser();
  return browserPromise;
}

// 2. In-memory cache for fonts to avoid disk I/O on every request.
const fontCache = new Map<string, string>();

// Function to load font as base64
function loadFontAsBase64(fontFileName: string): string {
  if (fontCache.has(fontFileName)) {
    return fontCache.get(fontFileName)!;
  }
  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fontFileName);
    console.log(fontPath);
    if (fs.existsSync(fontPath)) {
      const fontBuffer = fs.readFileSync(fontPath);
      const base64Font = fontBuffer.toString('base64');
      fontCache.set(fontFileName, base64Font);
      return base64Font;
    } else {
      console.warn(`Font file not found: ${fontPath}`);
      return '';
    }
  } catch (error) {
    console.error('Error loading font:', error);
    return '';
  }
}

// 3. In-memory cache for translations to avoid network calls on every request.
const translationCache = new Map<string, string>();

// 🔥 CRITICAL: Function to sync user to users table (for foreign key constraint)
async function ensureUserExists(supabase: any, userId: string) {
  try {
    // First check if user exists in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    
    if (authError || !authUser) {
      console.error('User not found in auth:', authError);
      throw new Error('User not authenticated');
    }

    // Check if user exists in public.users table
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') { // No rows found - user doesn't exist
        console.log(`🔄 OAuth user ${userId} not found in public.users, creating record...`);
        
        // Get user data from auth
        const userEmail = authUser.user.email;
        const userName = authUser.user.user_metadata?.full_name || 
                        authUser.user.user_metadata?.name ||
                        authUser.user.user_metadata?.user_name ||
                        'User';
        
        // Create user in public.users table with required fields
        const userData = {
          id: userId,
          name: userName,
          email: userEmail,
          role: 'teacher', // Default role
          created_at: new Date().toISOString()
        };

        console.log(`📝 Creating user record in public.users for: ${userEmail}`);

        // Insert the user
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert(userData)
          .select()
          .single();

        if (createError) {
          console.error('❌ Error creating user in public.users:', createError);
          throw createError;
        }

        console.log('✅ Created user in public.users:', newUser.id);
        return newUser;
      } else {
        console.error('❌ Error checking users table:', checkError);
        throw checkError;
      }
    }

    console.log('✅ User exists in public.users:', existingUser.id);
    return existingUser;
  } catch (error) {
    console.error('❌ Failed to ensure user exists:', error);
    throw error;
  }
}

// Function to map frontend source_type to database source_type
function mapSourceType(sourceType: string): string {
  const sourceTypeMap: Record<string, string> = {
    'model': 'model_paper',
    'past': 'past_paper',
    'book': 'book',
    'all': 'all'
  };
  
  return sourceTypeMap[sourceType] || sourceType;
}

// 🔥 Fisher-Yates shuffle algorithm for proper randomization
function shuffleArray<T>(array: T[], seed?: number): T[] {
  const shuffled = [...array];
  const random = seed ? createSeededRandom(seed) : Math.random;
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 🔥 Create seeded random number generator
function createSeededRandom(seed: number): () => number {
  return function() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
}

// 🔥 Enhanced question selection with proper randomization
async function findQuestionsWithRandomization(
  supabase: any,
  type: string,
  subjectId: string,
  chapterIds: string[],
  source_type: string | undefined,
  difficulty: string | undefined,
  count: number,
  randomSeed?: number,
  shuffleQuestions: boolean = true
) {
  console.log(`\n🔍 Finding ${count} ${type} questions with randomization...`);
  console.log(`📋 Filters: source_type=${source_type}, difficulty=${difficulty}, shuffle=${shuffleQuestions}, seed=${randomSeed}`);
  
  // Map source_type to database values
  const dbSourceType = source_type ? mapSourceType(source_type) : undefined;
  
  // Build base query
  let query = supabaseAdmin
    .from('questions')
    .select('*') // Select all fields for better randomization
    .eq('question_type', type)
    .eq('subject_id', subjectId);

  if (chapterIds.length > 0) {
    query = query.in('chapter_id', chapterIds);
  }
  
  // Filter by source type if specified and not 'all'
  if (dbSourceType && dbSourceType !== 'all') {
    query = query.eq('source_type', dbSourceType);
  }
  
  if (difficulty && difficulty !== 'any') {
    query = query.eq('difficulty', difficulty);
  }

  // Get ALL matching questions first for proper randomization
  const { data: allQuestions, error } = await query;

  if (error) {
    console.error(`Error in query:`, error);
    return [];
  }

  if (!allQuestions || allQuestions.length === 0) {
    console.log(`❌ No ${type} questions found`);
    return [];
  }

  console.log(`✅ Found ${allQuestions.length} total ${type} questions`);

  // Apply randomization if enabled
  let questionsToUse = allQuestions;
  if (shuffleQuestions) {
    questionsToUse = shuffleArray(allQuestions, randomSeed);
    console.log(`🎲 Randomized ${questionsToUse.length} questions using seed: ${randomSeed}`);
  }

  // Take the required number of questions
  const selectedQuestions = questionsToUse.slice(0, count);
  console.log(`✅ Selected ${selectedQuestions.length} ${type} questions after randomization`);

  return selectedQuestions;
}

// Function to format question text for better display
function formatQuestionText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic text
    .replace(/\n/g, '<br>'); // Line breaks
}

// Function to simplify HTML content
function simplifyHtmlContent(html: string): string {
  // Remove unnecessary whitespace and comments
  return html
    .replace(/\s+/g, ' ')
    .replace(/<!--.*?-->/g, '')
    .trim();
}

// Function to check if Urdu text exists and is not just English
function hasActualUrduText(text: string | null): boolean {
  if (!text) return false;
  
  // Check if text contains Urdu characters (Unicode range for Urdu/Arabic)
  const urduRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return urduRegex.test(text);
}

// increment function if paper is generated
// Function to increment papers_generated count for a user
async function incrementPapersGenerated(supabase: any, userId: string) {
  try {
    const { error } = await supabase.rpc('increment_papers_generated', {
      user_id: userId
    });

    if (error) {
      console.error('Error incrementing papers generated:', error);
      // Fallback: use update query if RPC fails
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('papers_generated')
        .eq('id', userId)
        .single();

      if (profile) {
        const newCount = (profile.papers_generated || 0) + 1;
        await supabase
          .from('profiles')
          .update({ papers_generated: newCount })
          .eq('id', userId);
      }
    }
  } catch (error) {
    console.error('Failed to update papers_generated:', error);
  }
}

// function to check user subscription if any
async function checkUserSubscription(supabaseAdmin: any, userId: string): Promise<boolean> {
  try {
    const { data: subscription, error } = await supabaseAdmin
      .from('user_subscriptions')
      .select('status, plan_type')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.warn('Error fetching subscription:', error);
      // Assume trial if no subscription found
      return true;
    }

    // Return true if user is on trial or has no active paid subscription
    return subscription?.status === 'trialing' || 
           subscription?.plan_type === 'free' || 
           !subscription;
  } catch (error) {
    console.warn('Error checking subscription:', error);
    return true; // Assume trial on error
  }
}

// Add this function to generate watermark CSS
// Watermark CSS
function getWatermarkStyle(): string {
  return `
    .watermark {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9999;
      pointer-events: none;
      overflow: hidden;
    }

    .watermark-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 98px;
      line-height: 1.4;
      text-align: center;
      color: rgba(200, 0, 0, 0.08);
      font-weight: bold;
      font-family: Arial, sans-serif;
      white-space: pre-line; /* allows multi-line */
    }
  `;
}

async function generatePaperHtml({
  paper,
  paperQuestions,
  isUrdu,
  isBilingual,
  isEnglish,
  separateMCQ,
  englishTitle,
  subject,
  subject_ur,
  paperClass,
  timeToDisplay,
  timeMinutes,
  subjectiveTimeMinutes,
  totalMarks,
  objectiveMarks,
  subjectMarks,
  isTrialUser,
  // Add these new parameters
  isBoardPaper,
  shortToAttempt,
  longToAttempt
}: any) {
  // Load fonts
  const jameelNooriBase64 = loadFontAsBase64('JameelNooriNastaleeqKasheeda.ttf');
  const notoNastaliqBase64 = loadFontAsBase64('NotoNastaliqUrdu-Regular.ttf');

  /** CONVERT PAPER MINUTES INTO HOURS */
  function convertMinutesToTimeFormat(minutes: number): string {
    if (minutes <= 0) return '0:00';
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    // Format with leading zero for minutes
    const formattedMinutes = remainingMinutes.toString().padStart(2, '0');
    
    return `${hours}:${formattedMinutes}`;
  }

// Function to generate catchy footer for trial users
function generateCatchyFooter(isTrialUser: boolean, sectionType: 'mcq' | 'subjective' = 'subjective'): string {
  if (!isTrialUser) return '';
  
  const sectionSpecificText = sectionType === 'mcq' 
    ? 'MCQ Papers • Instant Generation • Perfect for Quizzes'
    : 'Full Papers • Complete Solutions • Exam Ready';
  
  return `
<div style="margin-top: 8px; text-align: center; font-size: 10px; color: #666; padding: 5px 0; border-top: 1px solid #eee;">
    <p class="english" style="margin: 2px 0; font-weight: 500;">
        📄 www.examly.pk - Smart Paper Generation | 💡 Save 2+ Hours | Full Book | Half Book | Custom Chapter Selection
    </p>
   
</div>`;
}

  // Build HTML content
  let htmlContent = `
<!DOCTYPE html>
<html lang="${isUrdu ? 'ur' : 'en'}">
<head>
<meta charset="UTF-8">
<title>${isUrdu ? subject_ur : subject} </title>

<style>
${getWatermarkStyle()}
 @font-face {
    font-family: 'Jameel Noori Nastaleeq';
    src: url('data:font/truetype;charset=utf-8;base64,${jameelNooriBase64}') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  
  @font-face {
    font-family: 'Noto Nastaliq Urdu';
    src: url('data:font/truetype;charset=utf-8;base64,${notoNastaliqBase64}') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 14px; }
  .container { max-width: 900px; margin: 14 auto; background: white; padding: 0;  }

  .header {text-align:center; font-size: 12px;  }
  .header h1 { font-size: 16px; }
  .header h2 { font-size: 14px; }
  .urdu { font-family: "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", serif; direction: rtl;  font-size:${separateMCQ?'12px;':'11px;'} }
  .eng { font-family: "Times New Roman", serif; direction: ltr;  font-size: ${separateMCQ?'14px;':'14px;'} }
   .options .urdu {
  font-family: "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu";
  direction: rtl;
   font-size:10px;
}
.options .eng {
  font-family: "Times New Roman", serif;
  direction: ltr;
   font-size: 10px; 
}
  .meta { display: flex; justify-content: space-between; margin: 0 0; font-size: 12px; 1.4; font-weight:bold }
  .note {  padding: 0px; margin:0 0; font-size: 11px; line-height: 1.4; }
  
  table { width: 100%; border-collapse: collapse; margin: ${separateMCQ?'12px 0;':'12px 0;'} font-size: 11px; ${isEnglish? ' direction:ltr' : ' direction:rtl'}}
  table, th, td { border: 1px solid #000; }
  td { padding: ${separateMCQ?'7px;':'3px;'} line-height:1.1; vertical-align: top; }
  .qnum { width: 30px; text-align: center; font-weight: bold; }
  .question { display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0; 
  line-height:1.1;
  }
  .options { margin-top: 2px; display: flex; justify-content: space-between; font-size: ${separateMCQ?'12;':'10;'} }
  .footer { text-align: left; margin-top: 10px; font-size: 10px; }
</style>
</head>
<body>
<div class="container">
<div class="header">
    <h1 class="eng">${englishTitle}</h1>
   </div>
`;

  htmlContent += `
  ${!separateMCQ ?`
    <div class="heade">
  ${isUrdu || isBilingual ? ` <p class="urdu"><span>رولنمبر۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔</span> <span> (اُمیدوار خُود پٗر کرے) </span> <span> (تعلیمی سال  20025-2026) </span></p> ` : ''}
  ${isEnglish || isBilingual ? `<p class="eng"> <span>Student Name#_______________________</span></p>` : ''}
</div>

  ${isUrdu ? `<div class="meta urdu">` : `<div class="meta">`}
    ${isEnglish ? `<span class="eng">${subject}</span><span><strong>Class ${paperClass}</strong></span>` : ''}
    ${isUrdu ? `<span class="urdu">${subject_ur}</span><span><strong>${paperClass} کلاس</strong></span>` : ''}
    ${isBilingual ? `<span class="eng">${subject}</span><span><strong>${paperClass} کلاس</strong></span><span class="urdu">${subject_ur}</span>` : ''}
  </div>

  ${isUrdu ? `<div class="meta urdu">` : `<div class="meta">`}
    ${isEnglish ? `<span class="eng">Time Allowed: ${convertMinutesToTimeFormat(subjectiveTimeMinutes || timeMinutes)} Minutes</span>` : ''}
    ${isUrdu ? `<span class="urdu">وقت:${convertMinutesToTimeFormat(subjectiveTimeMinutes || timeMinutes)} منٹ</span>` : ''}
    ${isBilingual ? `<span class="eng">Time Allowed: ${convertMinutesToTimeFormat(subjectiveTimeMinutes || timeMinutes)} Minutes</span><span class="urdu">وقت:${convertMinutesToTimeFormat(timeToDisplay || timeMinutes)} منٹ</span>` : ''}
  </div>
  ${isUrdu ? `<div class="meta urdu">` : `<div class="meta">`}
    ${isEnglish ? `<span class="eng">Maximum Marks: ${subjectMarks}</span>` : ''}
    ${isUrdu ? `<span class="urdu"><span>کل نمبر</span>:<span>${subjectMarks}</span> </span>` : ''}
    ${isBilingual ? `<span class="eng">Maximum Marks: ${subjectMarks}</span><span class="urdu"><span>کل نمبر</span>:<span>${subjectMarks}</span> </span>` : ''}
  </div>

    `:``
  }    
  `;

  // Get MCQ questions
  const mcqQuestions = paperQuestions.filter((pq: any) => 
    pq.question_type === 'mcq' && pq.questions
  );

  // Add MCQ questions if they exist
  if (mcqQuestions.length > 0) {
    htmlContent += `<div class="note">`;
    if (isUrdu || isBilingual) {
      htmlContent += `<p class="urdu">نوٹ: ہر سوال کے چار ممکنہ جوابات A,B,C اور D دیئے گئے ہیں۔ درست جواب کے مطابق دائرہ پُر کریں۔ ایک سے زیادہ دائروں کو پُر کرنے کی صورت میں جواب غلط تصور ہوگا۔</p>`;
    }
    if (isEnglish || isBilingual) {
      htmlContent += `<p class="eng">Note: Four possible answers A, B, C and D to each question are given. Fill the correct option's circle. More than one filled circle will be treated wrong.</p>`;
    }
    htmlContent += `</div><table>`;

    // Process MCQ questions
    mcqQuestions.forEach((pq: any, index: number) => {
      const q = pq.questions;
      const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
      const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
      const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';
      
      let questionDisplayHtml = '<div class="question">';
      if (isEnglish) {
          questionDisplayHtml += `<span class="eng">${englishQuestion}</span>`;
      } else if (isUrdu) {
          questionDisplayHtml += `<span class="urdu">${urduQuestion || englishQuestion}</span>`;
      } else { // bilingual
          questionDisplayHtml += `<span class="urdu">${urduQuestion}</span><span class="eng">${englishQuestion}</span>`;
      }
      questionDisplayHtml += '</div>';

      const options = [
        { 
          letter: 'A', 
          english: q.option_a || '', 
          urdu: hasActualUrduText(q.option_a_ur) ? q.option_a_ur : '',
          hasUrdu: hasActualUrduText(q.option_a_ur)
        },
        { 
          letter: 'B', 
          english: q.option_b || '', 
          urdu: hasActualUrduText(q.option_b_ur) ? q.option_b_ur : '',
          hasUrdu: hasActualUrduText(q.option_b_ur)
        },
        { 
          letter: 'C', 
          english: q.option_c || '', 
          urdu: hasActualUrduText(q.option_c_ur) ? q.option_c_ur : '',
          hasUrdu: hasActualUrduText(q.option_c_ur)
        },
        { 
          letter: 'D', 
          english: q.option_d || '', 
          urdu: hasActualUrduText(q.option_d_ur) ? q.option_d_ur : '',
          hasUrdu: hasActualUrduText(q.option_d_ur)
        }
      ];

      let optionsHtml = '';
      options.forEach(option => {
        if (option.english || option.urdu) {
          let optionDisplayHtml = `<span>(${option.letter}) `;
          if (isEnglish) {
              optionDisplayHtml += `<span class="eng">${option.english}</span>`;
          } else if (isUrdu) {
              optionDisplayHtml += `<span class="urdu">${option.urdu || option.english}</span>`;
          } else { // bilingual
              optionDisplayHtml += `<span><span class="urdu">${option.urdu}</span> <span class="eng">${option.english}</span></span>`;
          }
          optionDisplayHtml += '</span>';
          optionsHtml += optionDisplayHtml;
        }
      });

      htmlContent += `
   <tr>
      <td class="qnum">${pq.order_number}</td>
      <td>
        ${questionDisplayHtml}
        <div class="options">${optionsHtml}</div>
      </td>
    </tr>
  `;
    });

    htmlContent += `
       </table>
</div>`;
  // Add MCQ footer for trial users
    if (separateMCQ && isTrialUser) {
      htmlContent += generateCatchyFooter(isTrialUser, 'mcq');
    }

    htmlContent += ` ${separateMCQ ? `
    <!-- Page break before subjective section -->
    <div style="page-break-before: always;"></div>` : ''}
`;
  }

  // Get subjective questions
  const subjectiveQuestions = paperQuestions.filter((pq: any) => 
    pq.question_type !== 'mcq' && pq.questions
  );

  // Helper: Convert number to roman style (i, ii, iii …)
  function toRoman(num: number): string {
    const romans = ['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv','xvi','xvii','xviii'];
    return romans[num - 1] || num.toString();
  }

  htmlContent += `
  ${separateMCQ ?`
    <div class="heade">
  ${isUrdu || isBilingual ? ` <p class="urdu"><span>رولنمبر۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔۔</span> <span> (اُمیدوار خُود پٗر کرے) </span> <span> (تعلیمی سال  20025-2026) </span></p> ` : ''}
  ${isEnglish || isBilingual ? `<p class="eng"> <span>Student Name#_______________________</span></p>` : ''}
</div>

  ${isUrdu ? `<div class="meta urdu">` : `<div class="meta">`}
    ${isEnglish ? `<span class="eng">${subject}</span><span><strong>Class ${paperClass}</strong></span>` : ''}
    ${isUrdu ? `<span class="urdu">${subject_ur}</span><span><strong>${paperClass} کلاس</strong></span>` : ''}
    ${isBilingual ? `<span class="eng">${subject}</span><span><strong>${paperClass} کلاس</strong></span><span class="urdu">${subject_ur}</span>` : ''}
  </div>

  ${isUrdu ? `<div class="meta urdu">` : `<div class="meta">`}
    ${isEnglish ? `<span class="eng">Time Allowed: ${convertMinutesToTimeFormat(subjectiveTimeMinutes || timeMinutes)} Minutes</span>` : ''}
    ${isUrdu ? `<span class="urdu">وقت:${convertMinutesToTimeFormat(subjectiveTimeMinutes || timeMinutes)} منٹ</span>` : ''}
    ${isBilingual ? `<span class="eng">Time Allowed: ${convertMinutesToTimeFormat(subjectiveTimeMinutes || timeMinutes)} Minutes</span><span class="urdu">وقت:${convertMinutesToTimeFormat(timeToDisplay || timeMinutes)} منٹ</span>` : ''}
  </div>
  ${isUrdu ? `<div class="meta urdu">` : `<div class="meta">`}
    ${isEnglish ? `<span class="eng">Maximum Marks: ${subjectMarks}</span>` : ''}
    ${isUrdu ? `<span class="urdu"><span>کل نمبر</span>:<span>${subjectMarks}</span> </span>` : ''}
    ${isBilingual ? `<span class="eng">Maximum Marks: ${subjectMarks}</span><span class="urdu"><span>کل نمبر</span>:<span>${subjectMarks}</span> </span>` : ''}
  </div>

    `:``
  }    
  `;

  // Add subjective questions
  if (subjectiveQuestions.length > 0) {
    htmlContent += `
  <!-- Short Questions Section -->
  <div class="header">
   
    (<span class="english">${(isEnglish || isBilingual)? 'Part - I':''}<span><span class="urdu"> ${(isUrdu || isBilingual)? 'حصہ اول':''}  </span>)
  </div>

`;

    // Separate short and long questions
    const shortQuestions = subjectiveQuestions.filter((pq: any) => pq.question_type === 'short');

    // Add short questions
    if (isBoardPaper) {
      // For board papers: group short questions (6 per group)
      const questionsPerGroup = 6;
      const totalGroups = Math.ceil(shortQuestions.length / questionsPerGroup);
      
      // Calculate attempts per group for board papers
      const attemptsPerGroup = Math.floor(shortToAttempt / totalGroups);
      const remainingAttempts = shortToAttempt % totalGroups;

      for (let g = 0; g < totalGroups; g++) {
        const groupQuestions = shortQuestions.slice(
          g * questionsPerGroup,
          (g + 1) * questionsPerGroup
        );

        // Q. numbering starts from 2
        const questionNumber = g + 2;
        
        // Distribute remaining attempts across groups
        const groupAttempts = g < remainingAttempts ? attemptsPerGroup + 1 : attemptsPerGroup;

        let instructionHtml = '<div style="display:flex; justify-content:space-between; margin-bottom:0px; font-weight:bold">';
        if (isEnglish || isBilingual) {
          instructionHtml += `<div class="eng"><strong>${questionNumber}.</strong>Write short answers to any ${groupAttempts} questions.<span></span></div>`;
        }
        if (isUrdu || isBilingual) {
          instructionHtml += `<div class="urdu" style="direction:rtl;"><strong><span>${questionNumber}.</span>کوئی سے ${groupAttempts} سوالات کے مختصر جوابات لکھئے  </strong></div>`;
        }
        instructionHtml += '</div>';

        htmlContent += `
        <div class="short-questions ${isUrdu?'urdu':''}">
          ${instructionHtml}
        `;

        groupQuestions.forEach((pq: any, idx: number) => {
          const q = pq.questions;
          const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
          const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
          const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';

          let questionItemHtml = '<div class="short-question-item" style="display:flex; justify-content:space-between; margin-bottom:0px;">';
          if (isEnglish) {
              questionItemHtml += `<div class="eng">(${toRoman(idx + 1)}) ${englishQuestion}</div>`;
          } else if (isUrdu) {
              questionItemHtml += `<div class="urdu" style="direction:rtl;">(${toRoman(idx + 1)}) ${urduQuestion || englishQuestion}</div>`;
          } else { // bilingual
              questionItemHtml += `<div class="eng">(${toRoman(idx + 1)}) ${englishQuestion}</div>`;
              if (hasUrduQuestion) {
                  questionItemHtml += `<div class="urdu" style="direction:rtl;">(${toRoman(idx + 1)}) ${urduQuestion}</div>`;
              }
          }
          questionItemHtml += '</div>';

          htmlContent += `
          ${questionItemHtml}
          `;
        });

        htmlContent += `</div>`;
      }
    } else {
      // For custom papers: show all short questions sequentially without grouping
      let instructionHtml = '<div style="display:flex; justify-content:space-between; margin-bottom:0px; font-weight:bold">';
      if (isEnglish || isBilingual) {
        instructionHtml += `<div class="eng"><strong>2.</strong>Write short answers to any ${shortToAttempt} questions.<span></span></div>`;
      }
      if (isUrdu || isBilingual) {
        instructionHtml += `<div class="urdu" style="direction:rtl;"><strong><span>2.</span>کوئی سے ${shortToAttempt} سوالات کے مختصر جوابات لکھئے  </strong></div>`;
      }
      instructionHtml += '</div>';

      htmlContent += `
      <div class="short-questions ${isUrdu?'urdu':''}">
        ${instructionHtml}
      `;

      // List all short questions without grouping
      shortQuestions.forEach((pq: any, idx: number) => {
        const q = pq.questions;
        const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
        const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
        const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';

        let questionItemHtml = '<div class="short-question-item" style="display:flex; justify-content:space-between; margin-bottom:0px;">';
        if (isEnglish) {
            questionItemHtml += `<div class="eng">(${toRoman(idx + 1)}) ${englishQuestion}</div>`;
        } else if (isUrdu) {
            questionItemHtml += `<div class="urdu" style="direction:rtl;">(${toRoman(idx + 1)}) ${urduQuestion || englishQuestion}</div>`;
        } else { // bilingual
            questionItemHtml += `<div class="eng">(${toRoman(idx + 1)}) ${englishQuestion}</div>`;
            if (hasUrduQuestion) {
                questionItemHtml += `<div class="urdu" style="direction:rtl;">(${toRoman(idx + 1)}) ${urduQuestion}</div>`;
            }
        }
        questionItemHtml += '</div>';

        htmlContent += `
        ${questionItemHtml}
        `;
      });

      htmlContent += `</div>`;
    }
  }

  const longQuestions = subjectiveQuestions.filter((pq: any) => pq.question_type === 'long');

  // Add long questions
  if (longQuestions.length > 0) {
    htmlContent += `
  <div class="header">
      (<span class="english">${(isEnglish || isBilingual)? 'Part - II':''}<span> <span class="urdu"> ${(isUrdu || isBilingual)? 'حصہ دوم ':''}  </span>)
  </div>
  <div class="instructions" style="font-weight:bold">`;
  if(isEnglish || isBilingual) {
    htmlContent += `<div class="instruction-text eng">
                      <span>Note:</span> Attempt any ${longToAttempt} questions.
                    </div>`;
  }
  if(isUrdu || isBilingual) {
    htmlContent += `<div class="instruction-text urdu" style="direction: rtl;">
                      <span>نوٹ:</span> کوئی ${longToAttempt} سوالات حل کریں۔
                    </div>`;
  }
  htmlContent += `</div>
`;

    longQuestions.forEach((pq: any, idx: number) => {
      const q = pq.questions;
      const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
      const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
      const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';

      // Sub-questions
      const subQuestions = pq.sub_questions || [];
      let subQsHTML = '';

      if (subQuestions.length > 0) {
        subQsHTML += `
      <div style="display: flex; justify-content: space-between; margin-top:6px;">
        ${isEnglish || isBilingual ? `<div class="eng" style="width: 48%;"><ol type="a">${subQuestions.map((sq: any) => `<li>${formatQuestionText(sq.question_text || '')}</li>`).join('')}</ol></div>` : ''}
        ${isUrdu || isBilingual ? `<div class="urdu" style="width: 48%; direction: rtl; text-align: right;"><ol type="a">${subQuestions.map((sq: any) => `<li>${formatQuestionText(sq.question_text_ur || '')}</li>`).join('')}</ol></div>` : ''}
      </div>
    `;
      }

      let longQuestionDisplayHtml = '<div class="long-question" style="margin-bottom:12px;"><div style="display:flex; justify-content:space-between; align-items:flex-start;">';
      if (isEnglish) {
          longQuestionDisplayHtml += `<div class="eng" style="width:100%;"><strong>Q.${idx + 1}.</strong> ${englishQuestion}</div>`;
      } else if (isUrdu) {
          longQuestionDisplayHtml += `<div class="urdu" style="width:100%; direction:rtl; text-align:right;"><strong>سوال ${idx + 1}:</strong> ${urduQuestion || englishQuestion}</div>`;
      } else { // bilingual
          longQuestionDisplayHtml += `<div class="eng" style="width:48%;"><strong>Q.${idx + 1}.</strong> ${englishQuestion}</div>`;
          if (hasUrduQuestion) {
              longQuestionDisplayHtml += `<div class="urdu" style="width:48%; direction:rtl; text-align:right;"><strong>سوال ${idx + 1}:</strong> ${urduQuestion}</div>`;
          }
      }
      longQuestionDisplayHtml += `</div>${subQsHTML}</div>`;

      htmlContent += `
    ${longQuestionDisplayHtml}
  `;
    });
  }

  htmlContent += `
  </div>
`;

  // Footer
  if ( isTrialUser) {
    htmlContent += generateCatchyFooter(isTrialUser, 'subjective');
  }

  htmlContent += `

${isTrialUser ? `<div class="watermark">
<div class="watermark-text">
  www.examly.pk  
</div>
</div>
` : ''}
</body>
</html>
`;

  return simplifyHtmlContent(htmlContent);
}

export async function POST(request: Request) {
  console.log('📄 POST request received to generate paper');
  
  // Development fallback - completely skip browser operations
  if (process.env.NODE_ENV === 'development') {
    console.log('🛑 Development mode: PDF generation disabled');
    
    try {
      const requestData: PaperGenerationRequest = await request.json();
      const token = request.headers.get('Authorization')?.split(' ')[1];
      
      if (!token) {
        return NextResponse.json({ error: 'Authorization token required' }, { status: 401 });
      }

      // Verify user
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Create a mock paper for development
      const paperData = {
        title: requestData.title,
        subject_id: requestData.subjectId,
        class_id: requestData.classId,
        created_by: user.id,
        total_marks: 100,
        time_minutes: requestData.timeMinutes || 60,
        language: requestData.language || 'bilingual'
      };

      const { data: paper, error: paperError } = await supabaseAdmin
        .from('papers')
        .insert(paperData)
        .select()
        .single();

      if (paperError) throw paperError;

      return NextResponse.json({
        success: true,
        paperId: paper.id,
        message: 'Paper created successfully (Development Mode - No PDF)',
        questionsCount: 0,
        developmentMode: true
      });

    } catch (error) {
      console.error('Development mode error:', error);
      return NextResponse.json(
        { error: 'Development: Failed to create paper' },
        { status: 500 }
      );
    }
  }

  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return NextResponse.json({ error: 'Authorization token required' }, { status: 401 });
  }

  // Verify user
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    console.error('Authentication error:', userError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`👤 Authenticated user: ${user.id} (${user.email})`);

  // ✅ CRITICAL: Ensure user exists in public.users table (for foreign key constraint)
  try {
    await ensureUserExists(supabaseAdmin, user.id);
    console.log(`✅ User synchronization completed for: ${user.id}`);
  } catch (error) {
    console.error('❌ Failed to ensure user exists in public.users:', error);
    return NextResponse.json(
      { error: 'User account setup failed. Please try again.' },
      { status: 500 }
    );
  }

  // Check if user is on trial
  const isTrialUser = await checkUserSubscription(supabaseAdmin, user.id);
  console.log(`👤 User ${user.id} is ${isTrialUser ? 'on trial' : 'paid'}`);

  try {
    const requestData: PaperGenerationRequest = await request.json();
    console.log('📋 Request data received');

    const { 
      language = 'bilingual', 
      mcqMarks = 1, 
      shortMarks = 2, 
      longMarks = 5, 
      mcqPlacement = 'separate',
      selectionMethod,
      selectedQuestions,
      paperType = 'all',
      title,
      subjectId,
      classId,
      chapterOption = 'full_book',
      selectedChapters = [],
      source_type = 'all',
      mcqCount = 0,
      shortCount = 0,
      longCount = 0,
      mcqDifficulty = 'any',
      shortDifficulty = 'any',
      longDifficulty = 'any',
      easyPercent,
      mediumPercent,
      hardPercent,
      timeMinutes = 60,
      mcqToAttempt,
      shortToAttempt,
      longToAttempt,
      mcqTimeMinutes,
      subjectiveTimeMinutes,
      shuffleQuestions = true,
      randomSeed = Date.now()
    } = requestData;

    // Validation
    if (!title || !subjectId) {
      return NextResponse.json(
        { error: 'Title and subject ID are required' },
        { status: 400 }
      );
    }

    // 🔥 FIXED: Validate that at least one question type has questions
    const totalRequestedQuestions = mcqCount + shortCount + longCount;
    if (totalRequestedQuestions === 0) {
      return NextResponse.json(
        { error: 'Please add at least one question (MCQ, Short, or Long)' },
        { status: 400 }
      );
    }

    console.log(`📊 Question distribution: MCQs=${mcqCount}, Short=${shortCount}, Long=${longCount}`);
    
    // Test database connection
    const { data: testQuestions, error: testError } = await supabaseAdmin
      .from('questions')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('Database test failed:', testError);
      return NextResponse.json(
        { error: 'Database connection failed', details: testError.message },
        { status: 500 }
      );
    }

    console.log('✅ Database connection successful');
    console.log(`📋 Source type: ${source_type}`);
    console.log(`🌐 Language: ${language}`);
    console.log(`🎲 Random seed: ${randomSeed}`);
    console.log(`🔄 Shuffle enabled: ${shuffleQuestions}`);

    // Determine chapters to include
    let chapterIds: string[] = [];
    if (chapterOption === 'full_book') {
      const { data: chapters, error: chaptersError } = await supabaseAdmin
        .from('chapters')
        .select('id')
        .eq('subject_id', subjectId);
      
      if (chaptersError) {
        console.error('Error fetching chapters:', chaptersError);
        return NextResponse.json(
          { error: 'Failed to fetch chapters' },
          { status: 500 }
        );
      }
      
      chapterIds = chapters?.map(c => c.id) || [];
      console.log(`📚 Full book chapters found: ${chapterIds.length}`);
    } else if (chapterOption === 'custom' && selectedChapters && selectedChapters.length > 0) {
      chapterIds = selectedChapters;
      console.log(`🎯 Custom chapters selected: ${chapterIds.length}`);
    }

    // Calculate total marks
    const totalMarks = (mcqToAttempt || mcqCount || 0) * mcqMarks + 
                      (shortToAttempt || shortCount || 0) * shortMarks + 
                      (longToAttempt || longCount || 0) * longMarks;
    const objectiveMarks = (mcqToAttempt || mcqCount || 0) * mcqMarks ; 
    const subjectMarks = (shortToAttempt || shortCount || 0) * shortMarks + 
                      (longToAttempt || longCount || 0) * longMarks;
    
    // 🔥 FIXED: Create paper record without the missing columns
    const paperData: any = {
      title: title,
      subject_id: subjectId,
      class_id: classId,
      created_by: user.id,
      paper_type: paperType,
      chapter_ids: chapterOption === 'custom' ? selectedChapters : null,
      difficulty: 'medium',
      total_marks: totalMarks,
      time_minutes: timeMinutes,
      mcq_to_attempt: mcqToAttempt,
      short_to_attempt: shortToAttempt,
      long_to_attempt: longToAttempt,
      language: language
    };

    let paper;
    try {
      // Try to include source_type if the column exists
      const { data: paperWithSource, error: paperErrorWithSource } = await supabaseAdmin
        .from('papers')
        .insert({
          ...paperData,
          source_type: source_type
        })
        .select()
        .single();

      if (paperErrorWithSource) {
        // If error is about missing source_type column, try without it
        if (paperErrorWithSource.message.includes('source_type') && 
            paperErrorWithSource.message.includes('column')) {
          console.log('⚠️ source_type column not found in papers table, inserting without it');
          
          const { data: paperWithoutSource, error: paperErrorWithoutSource } = await supabaseAdmin
            .from('papers')
            .insert(paperData)
            .select()
            .single();
          
          if (paperErrorWithoutSource) {
            console.error('Error creating paper:', paperErrorWithoutSource);
            throw paperErrorWithoutSource;
          }
          
          paper = paperWithoutSource;
        } else {
          console.error('Error creating paper:', paperErrorWithSource);
          throw paperErrorWithSource;
        }
      } else {
        paper = paperWithSource;
      }

      console.log(`✅ Paper created with ID: ${paper.id}`);
    } catch (error) {
      console.error('Error creating paper:', error);
      throw error;
    }

    // 🔥 Process question types with enhanced randomization
    const questionInserts = [];
    const questionTypes = [
      { type: 'mcq', count: mcqCount, difficulty: mcqDifficulty },
      { type: 'short', count: shortCount, difficulty: shortDifficulty },
      { type: 'long', count: longCount, difficulty: longDifficulty }
    ];

    for (const qType of questionTypes) {
      if (qType.count > 0) {
        let questions;
        
        if (selectionMethod === 'manual' && selectedQuestions && selectedQuestions[qType.type as keyof typeof selectedQuestions]) {
          // Manual selection - use the pre-selected question IDs
          const manualQuestionIds = selectedQuestions[qType.type as keyof typeof selectedQuestions];
          console.log(`👤 Manual selection for ${qType.type}: ${manualQuestionIds?.length || 0} questions`);
          
          if (manualQuestionIds && manualQuestionIds.length > 0) {
            // Fetch the manually selected questions
            const { data: manualQuestions, error: manualError } = await supabaseAdmin
              .from('questions')
              .select('*')
              .in('id', manualQuestionIds);
              
            if (manualError) {
              console.error(`Error fetching manual questions:`, manualError);
              questions = [];
            } else {
              questions = manualQuestions || [];
            }
          } else {
            questions = [];
          }
        } else {
          // Auto selection with randomization
          questions = await findQuestionsWithRandomization(
            supabaseAdmin,
            qType.type,
            subjectId,
            chapterIds,
            source_type,
            qType.difficulty,
            qType.count,
            randomSeed + qType.type.charCodeAt(0), // Different seed for each question type
            shuffleQuestions
          );
        }

        if (questions.length > 0) {
          // Apply additional shuffling to the final selection if shuffle is enabled
          let finalQuestions = questions;
          if (shuffleQuestions && selectionMethod === 'auto') {
            finalQuestions = shuffleArray(questions, randomSeed + qType.type.charCodeAt(0) + 1000);
            console.log(`🎲 Final shuffle applied to ${qType.type} questions`);
          }

          finalQuestions.forEach((q, index) => {
            questionInserts.push({
              paper_id: paper.id,
              question_id: q.id,
              order_number: questionInserts.length + 1,
              question_type: qType.type
            });
          });
          console.log(`✅ Added ${finalQuestions.length} ${qType.type} questions`);
        } else {
          console.warn(`⚠️ No ${qType.type} questions found for the given criteria`);
        }
      } else {
        console.log(`⏭️ Skipping ${qType.type} questions (count: ${qType.count})`);
      }
    }

    // 🔥 FIXED: Insert paper questions with better validation
    if (questionInserts.length > 0) {
      console.log(`📝 Inserting ${questionInserts.length} questions into paper_questions`);
      
      const { error: insertError } = await supabaseAdmin
        .from('paper_questions')
        .insert(questionInserts);

      if (insertError) {
        console.error('Error inserting paper questions:', insertError);
        
        // Delete the paper since questions couldn't be added
        await supabaseAdmin
          .from('papers')
          .delete()
          .eq('id', paper.id);
        
        throw insertError;
      }

      console.log(`✅ Successfully inserted ${questionInserts.length} questions`);
    } else {
      console.warn('⚠️ No questions to insert');
      
      // Check if this is because user intentionally set all counts to 0
      const totalRequestedQuestions = mcqCount + shortCount + longCount;
      
      if (totalRequestedQuestions === 0) {
        return NextResponse.json(
          { 
            error: 'Please add at least one question. All question counts are zero.',
            details: {
              mcqCount,
              shortCount, 
              longCount
            }
          },
          { status: 400 }
        );
      } else {
        // Delete the empty paper
        await supabaseAdmin
          .from('papers')
          .delete()
          .eq('id', paper.id);
        
        return NextResponse.json(
          { 
            error: 'No questions found matching your criteria. Please try different filters.',
            details: {
              subjectId,
              chapterIds,
              source_type,
              mcqCount,
              shortCount,
              longCount
            }
          },
          { status: 400 }
        );
      }
    }

    // Fetch paper questions with full question data
    console.log('📋 Fetching paper questions with details...');
    const { data: paperQuestions, error: pqError } = await supabaseAdmin
      .from('paper_questions')
      .select(`
        order_number, 
        question_type, 
        question_id, 
        questions (
          question_text, 
          question_text_ur,
          option_a, 
          option_a_ur,
          option_b, 
          option_b_ur,
          option_c, 
          option_c_ur,
          option_d, 
          option_d_ur,
          answer_text,
          answer_text_ur,
          difficulty,
          chapter_id,
          correct_option,
          source_type
        )
      `)
      .eq('paper_id', paper.id)
      .order('order_number', { ascending: true });

    if (pqError) {
      console.error('Error fetching paper questions:', pqError);
      throw pqError;
    }

    console.log(`✅ Found ${paperQuestions?.length || 0} paper questions`);

    if (!paperQuestions || paperQuestions.length === 0) {
      // Delete the paper if no questions were found
      await supabaseAdmin
        .from('papers')
        .delete()
        .eq('id', paper.id);
      
      return NextResponse.json(
        { error: 'No questions found for the generated paper' },
        { status: 404 }
      );
    }

    // Generate HTML content for PDF
    const isUrdu = language === 'urdu';
    const isBilingual = language === 'bilingual';
    const isEnglish = language === 'english';
    const separateMCQ = mcqPlacement === 'separate';
    const isBoardPaper = paperType === 'model';
    
    // Handle title
    const englishTitle = `${paper.title}`;
    const urduTitle = paper.title;

    // Load fonts
    const jameelNooriBase64 = loadFontAsBase64('JameelNooriNastaleeqKasheeda.ttf');
    const notoNastaliqBase64 = loadFontAsBase64('NotoNastaliqUrdu-Regular.ttf');

    let paperClass = '';
    let subject = '';
    let subject_ur = '';
    
    try {
      // Fetch subject details
      const { data: subjectData, error: subjectError } = await supabaseAdmin
        .from('subjects')
        .select('name')
        .eq('id', subjectId)
        .single();

      if (!subjectError && subjectData) {
        subject = subjectData.name;
        const cachedTranslation = translationCache.get(subject);
        if (cachedTranslation) {
          subject_ur = cachedTranslation;
        } else {
          const translatedSubject = await translate(subject, { to: 'ur' });
          subject_ur = translatedSubject.text;
          translationCache.set(subject, subject_ur);
        }
      } else {
        console.warn('Using fallback subject data due to error:', subjectError);
      }

      // Fetch class details
      const { data: classData, error: classError } = await supabaseAdmin
        .from('classes')
        .select('name')
        .eq('id', classId)
        .single();

      if (!classError && classData) {
        paperClass = classData.name;
      } else {
        console.warn('Using fallback class data due to error:', classError);
      }
    } catch (error) {
      console.error('Error fetching subject/class details:', error);
      // Continue with fallback values
    }

    /** CONVERT PAPER MINUTES INTO HOURS */
    function convertMinutesToTimeFormat(minutes: number): string {
      if (minutes <= 0) return '0:00';
      
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      
      // Format with leading zero for minutes
      const formattedMinutes = remainingMinutes.toString().padStart(2, '0');
      
      return `${hours}:${formattedMinutes}`;
    }

    const timeToDisplay = separateMCQ ? mcqTimeMinutes : timeMinutes;
    const subjectiveTimeToDisplay = separateMCQ ? subjectiveTimeMinutes : timeMinutes;

    // Generate the HTML content with the updated function
    const htmlContent = await generatePaperHtml({
      paper,
      paperQuestions,
      isUrdu,
      isBilingual,
      isEnglish,
      separateMCQ,
      englishTitle,
      subject,
      subject_ur,
      paperClass,
      timeToDisplay,
      timeMinutes,
      subjectiveTimeMinutes,
      totalMarks,
      objectiveMarks,
      subjectMarks,
      isTrialUser,
      isBoardPaper,
      shortToAttempt: shortToAttempt || shortCount,
      longToAttempt: longToAttempt || longCount
    });

    // Generate PDF with Puppeteer
    let browser = null;
    let page = null;
    
    try {
      console.log('🔄 Starting PDF generation with Puppeteer...');
      
      // Using singleton browser instance for performance
      browser = await getPuppeteerBrowser();
      page = await browser.newPage();
      
      // Set a longer timeout for page operations
      page.setDefaultTimeout(60000);
      page.setDefaultNavigationTimeout(60000);
      
      console.log('📄 Setting page content...');
      
      // Use setContent directly instead of file for better Vercel compatibility
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });
      
      // Wait for fonts to load (especially important for Urdu fonts)
      console.log('⏳ Waiting for fonts to load...');
      await page.evaluate(() => {
        return document.fonts.ready;
      });

      // Wait a bit more for all content to render
      await page.waitForTimeout(2000);
      
      console.log('📊 Generating PDF buffer...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
        displayHeaderFooter: false
      });

      await page.close();
      console.log(`✅ PDF generated successfully: ${pdfBuffer.length} bytes`);
      
      // Increment papers_generated count for the user
      await incrementPapersGenerated(supabaseAdmin, user.id);
      
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${paper.title.replace(/\s+/g, '_')}.pdf"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      });

    } catch (error) {
      console.error('❌ PDF generation error:', error);
      
      // Clean up resources in case of error
      if (page) await page.close().catch(() => {});
      
      // Return paper data even if PDF generation fails
      return NextResponse.json(
        { 
          success: true, 
          paperId: paper.id, 
          message: 'Paper created but PDF generation failed',
          questionsCount: paperQuestions.length,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 200 }
      );
    }

  } catch (error) {
    console.error('❌ Paper generation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate paper', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
