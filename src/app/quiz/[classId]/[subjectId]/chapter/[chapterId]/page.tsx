'use client';
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Breadcrumb from "@/components/Breadcrumb";
import QuizModeSelector from "@/components/QuizModeSelector";
import SwimmerGame from "@/components/SwimmerGame";
import { toSlug, chapterNoFromSlug } from "@/lib/slugUtils";
import { renderHtmlWithMath } from "@/lib/renderHtmlWithMath";
import 'katex/dist/katex.min.css';

export default function ChapterQuizPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const { chapterId, subjectId, classId } = useParams();

  const [questions, setQuestions]         = useState<any[]>([]);
  const [answers, setAnswers]             = useState<Record<string, string>>({});
  const [submitted, setSubmitted]         = useState(false);
  const [score, setScore]                 = useState(0);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");
  const [timeLeft, setTimeLeft]           = useState(15 * 60);
  const [current, setCurrent]             = useState(0);
  const [lang, setLang]                   = useState<"en"|"ur">("en");
  const [forceUrdu, setForceUrdu]         = useState(false);
  const [subjectName, setSubjectName]     = useState("");
  const [chapterName, setChapterName]     = useState("");
  const [saving, setSaving]               = useState(false);
  const [user, setUser]                   = useState<any>(null);

  // Game mode
  const [quizMode, setQuizMode]           = useState<null | 'simple' | 'game'>(null);
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const [lastResult, setLastResult]       = useState<'correct'|'wrong'|null>(null);
  const [swimmerDead, setSwimmerDead]     = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data?.user) setUser(data.user); });
  }, [supabase]);

  useEffect(() => {
    if (!chapterId || !subjectId || !classId) return;
    const load = async () => {
      setLoading(true); setError("");
      try {
        const urduSlugs = ["urdu","islamiyat","islamyat","pak-studies","tarjuma-tul-quran"];
        const isUrdu = urduSlugs.includes((subjectId as string).toLowerCase());
        setForceUrdu(isUrdu); setLang(isUrdu ? "ur" : "en");

        const { data: classData } = await supabase.from("classes").select("id").eq("name", classId).single();
        if (!classData) { setError("Class not found."); setLoading(false); return; }

        // Subjects can have duplicate rows for the same name (different
        // casing) which all share one slug — check each candidate against
        // class_subjects and use whichever is actually linked to this class
        // instead of blindly taking the first slug match.
        const { data: allSubjects } = await supabase.from("subjects").select("id,name");
        const candidates = (allSubjects || []).filter(s => toSlug(s.name) === (subjectId as string));
        if (candidates.length === 0) { setError("Subject not found."); setLoading(false); return; }

        let subject: { id: string; name: string } | null = null;
        let cs: { id: string } | null = null;
        for (const candidate of candidates) {
          const { data: csRow } = await supabase.from("class_subjects").select("id")
            .eq("class_id", classData.id).eq("subject_id", candidate.id).maybeSingle();
          if (csRow) { subject = candidate; cs = csRow; break; }
        }
        if (!subject || !cs) { setError("Subject not available for this class."); setLoading(false); return; }
        setSubjectName(subject.name);

        const chNo = chapterNoFromSlug(chapterId as string);
        const { data: chapter } = await supabase.from("chapters").select("id,name")
          .eq("class_subject_id", cs.id).eq("chapterNo", chNo).single();
        if (!chapter) { setError("Chapter not found."); setLoading(false); return; }
        setChapterName(chapter.name);

        const { data: topics } = await supabase.from("topics").select("id").eq("chapter_id", chapter.id);
        const topicIds = (topics || []).map((t: any) => t.id);
        if (topicIds.length === 0) { setError("No topics found in this chapter."); setLoading(false); return; }

        const { data: qs } = await supabase.from("questions").select("*")
          .in("topic_id", topicIds).eq("question_type", "mcq");
        if (!qs || qs.length === 0) { setError("No questions found for this chapter."); setLoading(false); return; }

        const shuffled = [...qs].sort(() => 0.5 - Math.random());
        setQuestions(shuffled.slice(0, 30));
      } catch { setError("Failed to load quiz. Please try again."); }
      setLoading(false);
    };
    load();
  }, [chapterId, subjectId, classId, supabase]);

  // Timer
  useEffect(() => {
    if (submitted || loading || error || !quizMode || swimmerDead) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, submitted, loading, error, quizMode, swimmerDead]);

  const handleSelect = (qId: string, opt: string) => {
    if (answers[qId] || submitted || swimmerDead || timeLeft <= 0) return;
    const question = questions.find(q => q.id === qId);
    if (!question) return;
    const isCorrect = question.correct_option === opt;

    setAnswers(prev => ({ ...prev, [qId]: opt }));
    setLastResult(isCorrect ? 'correct' : 'wrong');

    if (quizMode === 'game') {
      if (isCorrect) {
        setConsecutiveWrong(0);
      } else {
        const next = consecutiveWrong + 1;
        setConsecutiveWrong(next);
        if (next >= 3) {
          // Delay so drowning animation plays
          setTimeout(() => setSwimmerDead(true), 1400);
        }
      }
    }

    setTimeout(() => {
      if (current < questions.length - 1) setCurrent(p => p + 1);
    }, 500);
  };

  const handleSubmit = useCallback(async () => {
    if (submitted) return;
    setSaving(true);
    const finalScore = questions.filter(q => answers[q.id] === q.correct_option).length;
    setScore(finalScore);
    setSubmitted(true);
    if (user) {
      await supabase.from("results").insert([{
        user_id: user.id, score: finalScore,
        total_questions: questions.length, in_progress: false,
      }]);
    }
    setSaving(false);
  }, [submitted, questions, answers, user, supabase]);

  const resetQuiz = () => {
    setAnswers({}); setSubmitted(false); setScore(0); setCurrent(0);
    setTimeLeft(15*60); setConsecutiveWrong(0); setLastResult(null);
    setSwimmerDead(false); setQuizMode(null);
    setQuestions(q => [...q].sort(() => 0.5 - Math.random()));
  };

  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const pct = questions.length ? ((current + 1) / questions.length) * 100 : 0;
  const timerWarn = timeLeft < 120;

  /* ── LOADING ── */
  if (loading) return (
    <>
      <Header />
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight:"100vh", background:"#f8fafc" }}>
        <div className="text-center">
          <div className="spinner-border mb-3" style={{ color:"#073e8c", width:"3.5rem", height:"3.5rem" }} />
          <p className="fw-semibold text-muted">Loading quiz…</p>
        </div>
      </div>
      <Footer />
    </>
  );

  /* ── ERROR ── */
  if (error) return (
    <>
      <Header />
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight:"80vh", background:"#f8fafc", paddingTop:90 }}>
        <div className="text-center" style={{ maxWidth:400, padding:"2rem" }}>
          <div style={{ fontSize:"3rem", marginBottom:16 }}>😕</div>
          <h4 style={{ color:"#0f172a", fontWeight:700, marginBottom:8 }}>Oops!</h4>
          <p className="text-muted mb-4">{error}</p>
          <button className="btn btn-primary px-4" onClick={() => router.back()}>← Go Back</button>
        </div>
      </div>
      <Footer />
    </>
  );

  /* ── RESULT SCREEN ── */
  if (submitted || swimmerDead) {
    const finalScore = questions.filter(q => answers[q.id] === q.correct_option).length;
    const pct2 = questions.length ? Math.round((finalScore / questions.length) * 100) : 0;
    return (
      <>
        <Header />
        <div className="container pt-header pb-0">
          <Breadcrumb items={[
            { label: 'Home', href: '/' },
            { label: 'Quiz', href: '/quiz' },
            { label: `Class ${classId}`, href: `/quiz/${classId}` },
            { label: subjectName, href: `/quiz/${classId}/${subjectId}` },
            { label: chapterName },
          ]} />
        </div>
        <div style={{ minHeight:"100vh", background:"#f8fafc", display:"flex", alignItems:"center", justifyContent:"center", padding:"2rem", paddingTop:"2rem" }}>
          <div style={{ background:"#fff", borderRadius:24, padding:"2.5rem", maxWidth:460, width:"100%", textAlign:"center", boxShadow:"0 8px 40px rgba(15,23,42,0.12)", border:"1px solid #e2e8f0" }}>
            {swimmerDead && !submitted ? (
              <>
                <div style={{ fontSize:"3.5rem", marginBottom:8 }}>🌊</div>
                <h2 style={{ fontWeight:800, color:"#0f172a", marginBottom:4 }}>Your Swimmer Drowned!</h2>
                <p className="text-muted mb-4">{chapterName} • 3 consecutive wrong answers</p>
              </>
            ) : (
              <>
                <div style={{ fontSize:"3.5rem", marginBottom:8 }}>{pct2 >= 70 ? "🎉" : pct2 >= 40 ? "👍" : "💪"}</div>
                <h2 style={{ fontWeight:800, color:"#0f172a", marginBottom:4 }}>Quiz Complete!</h2>
                <p className="text-muted mb-4">{chapterName} • {subjectName}</p>
              </>
            )}
            <div style={{ background: pct2>=70?"#f0fdf4": pct2>=40?"#fffbeb":"#fef2f2", border:`2px solid ${pct2>=70?"#22c55e":pct2>=40?"#f59e0b":"#ef4444"}`, borderRadius:16, padding:"1.5rem", marginBottom:24 }}>
              <div style={{ fontSize:"2.8rem", fontWeight:800, color: pct2>=70?"#16a34a":pct2>=40?"#d97706":"#dc2626" }}>{pct2}%</div>
              <div style={{ fontSize:"1rem", color:"#475569", fontWeight:500 }}>{finalScore} / {questions.length} correct</div>
            </div>
            <div className="d-flex gap-2 justify-content-center flex-wrap">
              <button className="btn btn-outline-secondary" onClick={() => router.back()}>← Back to Chapters</button>
              <button className="btn btn-primary" onClick={resetQuiz}>🔄 Try Again</button>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  /* ── QUIZ UI ── */
  const q = questions[current];
  const options = [
    { key:"A", en: q.option_a, ur: q.option_a_ur },
    { key:"B", en: q.option_b, ur: q.option_b_ur },
    { key:"C", en: q.option_c, ur: q.option_c_ur },
    { key:"D", en: q.option_d, ur: q.option_d_ur },
  ];
  const qText = lang === "ur" ? q.question_text_ur : q.question_text;
  const selected = answers[q.id];
  const correctCount = questions.filter(x => answers[x.id] === x.correct_option).length;

  return (
    <>
      <Header />

      {/* Mode selector overlay — shown until user picks */}
      {!quizMode && <QuizModeSelector onSelect={setQuizMode} />}

      <div style={{ background:"#f8fafc", minHeight:"100vh", paddingTop:70 }}>
        {/* Sticky top bar */}
        <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", position:"sticky", top:62, zIndex:100, padding:"0.6rem 0" }}>
          <div className="container d-flex align-items-center gap-3" style={{ flexWrap:"wrap" }}>
            <button onClick={() => router.back()} style={{ background:"none", border:"1px solid #e2e8f0", borderRadius:8, padding:"5px 12px", fontSize:"0.82rem", cursor:"pointer", color:"#475569" }}>
              ← Back
            </button>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:"0.9rem", color:"#0f172a", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {chapterName || `Chapter ${chapterId}`}
                {quizMode === 'game' && <span style={{ marginLeft:8, fontSize:"0.72rem", background:"linear-gradient(135deg,#0369a1,#0c4a6e)", color:"#fff", borderRadius:6, padding:"2px 7px", verticalAlign:"middle" }}>🎮 Game Mode</span>}
              </div>
              <div style={{ fontSize:"0.75rem", color:"#64748b" }}>{subjectName} • Q {current + 1}/{questions.length}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
              <div style={{ background: timerWarn?"#fef2f2":"#eff6ff", border:`1px solid ${timerWarn?"#fca5a5":"#bfdbfe"}`, borderRadius:8, padding:"4px 12px", fontWeight:700, fontSize:"0.9rem", color: timerWarn?"#dc2626":"#073e8c", minWidth:64, textAlign:"center" }}>
                ⏱ {fmt(timeLeft)}
              </div>
              <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"4px 12px", fontWeight:600, fontSize:"0.85rem", color:"#16a34a" }}>
                ✓ {correctCount}
              </div>
              {!forceUrdu && (
                <button onClick={() => setLang(l => l==="en"?"ur":"en")} style={{ background:"none", border:"1px solid #e2e8f0", borderRadius:8, padding:"4px 10px", fontSize:"0.8rem", cursor:"pointer", color:"#475569" }}>
                  {lang==="en"?"🇵🇰 اردو":"🇬🇧 Eng"}
                </button>
              )}
            </div>
          </div>
          <div style={{ height:3, background:"#e2e8f0", marginTop:6 }}>
            <div style={{ height:"100%", background:"linear-gradient(90deg,#073e8c,#1ba699)", width:`${pct}%`, transition:"width 0.4s ease", borderRadius:999 }} />
          </div>
        </div>

        <div className="container py-4" style={{ maxWidth:700 }}>
          {/* Swimmer (game mode only) */}
          {quizMode === 'game' && (
            <SwimmerGame
              consecutiveWrong={Math.min(consecutiveWrong, 3)}
              lastResult={lastResult}
              gameOver={consecutiveWrong >= 3}
            />
          )}

          {/* Question card */}
          <div style={{ background:"#fff", borderRadius:20, border:"1px solid #e2e8f0", boxShadow:"0 4px 20px rgba(15,23,42,0.06)", padding:"1.8rem", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <span style={{ background:"linear-gradient(135deg,#073e8c,#0b63d4)", color:"#fff", borderRadius:8, padding:"3px 12px", fontSize:"0.78rem", fontWeight:700 }}>
                Q {current + 1}
              </span>
              {q.difficulty && (
                <span style={{ background: q.difficulty==="easy"?"#f0fdf4": q.difficulty==="hard"?"#fef2f2":"#fffbeb", color: q.difficulty==="easy"?"#16a34a": q.difficulty==="hard"?"#dc2626":"#d97706", border:"1px solid currentColor", borderRadius:6, padding:"2px 8px", fontSize:"0.72rem", fontWeight:600 }}>
                  {q.difficulty}
                </span>
              )}
            </div>
            <p
              className={lang==="ur" ? "urdu-text" : ""}
              style={{ fontSize: lang==="ur"?"1.2rem":"1rem", fontWeight:600, color:"#0f172a", lineHeight:1.7, margin:0, direction: lang==="ur"?"rtl":"ltr", textAlign: lang==="ur"?"right":"left" }}
              dangerouslySetInnerHTML={{ __html: renderHtmlWithMath(qText || q.question_text) }}
            />
          </div>

          {/* Options */}
          <div className="row g-2 mb-4" dir={lang==="ur"?"rtl":"ltr"}>
            {options.map(({ key, en, ur }) => {
              const text = lang==="ur" ? ur : en;
              const isSelected = selected === key;
              const isCorrect = key === q.correct_option;
              const showResult = !!selected;
              let bg="#fff", border="1px solid #e2e8f0", color="#0f172a";
              if (showResult && isCorrect) { bg="#f0fdf4"; border="2px solid #22c55e"; color="#15803d"; }
              else if (showResult && isSelected && !isCorrect) { bg="#fef2f2"; border="2px solid #ef4444"; color="#dc2626"; }
              else if (isSelected) { bg="#eff6ff"; border="2px solid #073e8c"; color="#073e8c"; }
              return (
                <div key={key} className="col-12 col-sm-6">
                  <div
                    onClick={() => handleSelect(q.id, key)}
                    style={{ background:bg, border, borderRadius:14, padding:"0.9rem 1.1rem", cursor:selected?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:10, transition:"all 0.18s ease", boxShadow:"0 2px 6px rgba(15,23,42,0.04)" }}
                    className="opt-btn"
                  >
                    <span style={{ width:28, height:28, borderRadius:8, background:"rgba(0,0,0,0.06)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:"0.85rem", color, flexShrink:0 }}>{key}</span>
                    <span
                      className={lang==="ur"?"urdu-text":""}
                      style={{ fontSize: lang==="ur"?"1rem":"0.9rem", color, lineHeight:1.5, direction: lang==="ur"?"rtl":"ltr" }}
                      dangerouslySetInnerHTML={{ __html: renderHtmlWithMath(text || en || "") }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
            <button className="btn btn-outline-secondary" onClick={() => setCurrent(p => Math.max(0, p-1))} disabled={current === 0}>
              ← Prev
            </button>
            <span style={{ fontSize:"0.82rem", color:"#94a3b8" }}>{current + 1} of {questions.length}</span>
            {current < questions.length - 1 ? (
              <button className="btn btn-primary" onClick={() => setCurrent(p => p+1)}>Next →</button>
            ) : (
              <button className="btn btn-success px-4" onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving…" : "Finish Quiz ✓"}
              </button>
            )}
          </div>
        </div>
      </div>
      <Footer />
      <style jsx global>{`
        @font-face {
          font-family: "JameelNooriNastaleeqKasheeda";
          src: url("/fonts/JameelNooriNastaleeqKasheeda.ttf") format("truetype");
          font-display: swap;
        }
        .urdu-text { font-family: "JameelNooriNastaleeqKasheeda", serif; line-height: 2.4; }
        .opt-btn:not([style*="not-allowed"]):hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(7,62,140,0.1) !important; }
      `}</style>
    </>
  );
}
