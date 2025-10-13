// src/app/quiz/[classId]/[subjectId]/chapter/[chapterId]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

export default function QuizScreen({ paperId = null }) {
  const supabase = createClientComponentClient();
  const { chapterId } = useParams();
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [previousBest, setPreviousBest] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [user, setUser] = useState<any>(null);

  // Timer
  const [timeLeft, setTimeLeft] = useState(10 * 60);

  // Language toggle
  const [lang, setLang] = useState<"en" | "ur">("en");

  // Stats
  const [percentile, setPercentile] = useState<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [topper, setTopper] = useState<number | null>(null);
  const [bottom, setBottom] = useState<number | null>(null);
  const [rankMessage, setRankMessage] = useState<string>("");

  // Monkey state
  const [monkeyHealth, setMonkeyHealth] = useState(50); // 0-100 scale
  const [monkeyExpression, setMonkeyExpression] = useState("🙃");
  const [bounce, setBounce] = useState(false);

  // Fetch logged-in user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user) setUser(user);
      else setUser(null);
    };
    getUser();
  }, [supabase]);

  // Fetch questions
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("chapter_id", chapterId)
        .eq("question_type", "mcq");
      if (!error && data) {
        const shuffled = [...data].sort(() => 0.5 - Math.random());
        setQuestions(shuffled.slice(0, 10));
      }
      setLoading(false);
    };
    if (chapterId) fetchQuestions();
  }, [chapterId, supabase]);

  // Fetch previous best
  useEffect(() => {
    if (!user || !paperId) return;
    const fetchPrevious = async () => {
      const { data, error } = await supabase
        .from("results")
        .select("score")
        .eq("user_id", user.id)
        .eq("paper_id", paperId)
        .order("score", { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) setPreviousBest(data[0].score);
    };
    fetchPrevious();
  }, [user, paperId, supabase]);

  // Timer countdown
  useEffect(() => {
    if (submitted || loading) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted, loading]);

  // Update stats dynamically
  const updateLiveStats = async (currentScore: number) => {
    if (!chapterId) return;
    const { data: allResults, error } = await supabase
      .from("results")
      .select("score")
      .eq("chapter_id", chapterId)
      .eq("in_progress", false);
    if (!error && allResults && allResults.length > 0) {
      const scores = allResults.map((r) => r.score);
      const sortedScores = [...scores].sort((a, b) => b - a);
      const rankPosition = sortedScores.filter((s) => s > currentScore).length + 1;
      const perc = Math.round((scores.filter((s) => s < currentScore).length / scores.length) * 100);
      setPercentile(perc);
      setRank(rankPosition);
      setTopper(sortedScores[0]);
      setBottom(sortedScores[sortedScores.length - 1]);
      setTotalStudents(scores.length);
    }
  };

  // Handle answer selection
  const handleSelect = (qId: string, opt: string) => {
    if (submitted || timeLeft <= 0 || answers[qId]) return;

    setAnswers((prev) => {
      const updated = { ...prev, [qId]: opt };
      const currentScore = questions.filter((q) => updated[q.id] === q.correct_option).length;

      const question = questions.find((q) => q.id === qId);
      if (question) {
        if (opt === question.correct_option) {
          setMonkeyHealth((h) => Math.min(100, h + 10));
          setMonkeyExpression("😄");
        } else {
          setMonkeyHealth((h) => Math.max(0, h - 10));
          setMonkeyExpression("😢");
        }
      }

      setBounce(true);
      setTimeout(() => setBounce(false), 300);

      updateLiveStats(currentScore);
      return updated;
    });

    setTimeout(() => {
      if (currentQuestion < questions.length - 1) setCurrentQuestion((prev) => prev + 1);
    }, 600);
  };

  // Submit quiz
  const handleSubmit = async () => {
    if (submitted) return;
    if (!user) return alert("⚠️ You must be logged in to save results.");
    setSaving(true);

    const finalScore = questions.filter((q) => answers[q.id] === q.correct_option).length;
    setScore(finalScore);
    setSubmitted(true);

    const { error } = await supabase.from("results").insert([
      { user_id: user.id, paper_id: paperId, chapter_id: chapterId, score: finalScore, total_questions: questions.length, in_progress: false },
    ]);

    if (!error) updateLiveStats(finalScore);
    else alert("❌ Error saving your result.");
    setSaving(false);
  };

  // Save progress
  const handleSaveProgress = async () => {
    if (!user) return alert("⚠️ You must be logged in to save progress.");
    setSaving(true);
    const partialScore = questions.filter((q) => answers[q.id] === q.correct_option).length;
    await supabase.from("results").insert([
      { user_id: user.id, paper_id: paperId, chapter_id: chapterId, score: partialScore, total_questions: questions.length, in_progress: true },
    ]);
    setSaving(false);
    alert("✅ Progress saved!");
  };

  // Start new quiz
  const handleNewQuiz = () => {
    if (!confirm("⚠️ This will reset your current progress. Continue?")) return;
    setAnswers({});
    setSubmitted(false);
    setShowResult(false);
    setScore(0);
    setCurrentQuestion(0);
    setTimeLeft(10 * 60);
    setPercentile(null);
    setRank(null);
    setTopper(null);
    setBottom(null);
    setRankMessage("");
    setMonkeyHealth(50);
    setMonkeyExpression("🙃");
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    setQuestions(shuffled.slice(0, 10));
  };

  const liveScore = questions.filter((q) => answers[q.id] === q.correct_option).length;
  const formatTime = (secs: number) => `${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`;

  if (loading) return (
    <div className="container text-center py-5">
      <div className="spinner-border text-primary" role="status" />
      <p className="mt-3 fw-semibold text-muted">Loading questions...</p>
    </div>
  );

  if (!questions.length) return (
    <div className="container text-center py-5">
      <div className="alert alert-warning shadow-sm rounded-3">No MCQs found for this chapter.</div>
    </div>
  );

  const q = questions[currentQuestion];
  const progress = ((currentQuestion + 1)/questions.length) * 100;
  const getText = (en?: string, ur?: string) => (lang === "ur" && ur?.trim() ? ur : en || "");
  const optionKeys = [
    { key: "A", en: q.option_a || q.option1, ur: q.option_a_ur || q.option1_ur },
    { key: "B", en: q.option_b || q.option2, ur: q.option_b_ur || q.option2_ur },
    { key: "C", en: q.option_c || q.option3, ur: q.option_c_ur || q.option3_ur },
    { key: "D", en: q.option_d || q.option4, ur: q.option_d_ur || q.option4_ur },
  ];

  const isTimeUp = timeLeft <= 0 || submitted;

  return (
    <>
      <Header darkMode={false} setDarkMode={()=>{}}/>
      <div className="container py-5" style={{ minHeight: "80vh", marginTop: "100px" }}>
        {/* Timer & Live Stats Panel */}
        {!submitted && (
          <div className="alert alert-info d-flex justify-content-between align-items-center shadow-sm rounded-3 flex-wrap">
            <span>⏳ Time Left: <strong>{formatTime(timeLeft)}</strong></span>
            <span>📊 Score: <strong>{liveScore}</strong> / {questions.length}</span>
            {rank && totalStudents && <span>🏅 Live Rank: <strong>{rank}</strong> / {totalStudents}</span>}
            {percentile && <span>📈 Live Percentile: <strong>{percentile}%</strong></span>}
            <div>
              <div className="form-check form-switch d-inline-flex align-items-center">
                <input className="form-check-input" type="checkbox" id="langToggle" checked={lang==="ur"} onChange={()=>setLang(lang==="en"?"ur":"en")} disabled={isTimeUp}/>
                <label className="form-check-label ms-2 fw-semibold" htmlFor="langToggle">{lang==="en"?"English":"اردو"}</label>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar with Monkey */}
        <div className="mb-4 position-relative" style={{ height: "40px" }}>
          <div className="progress" style={{ height: "10px" }}>
            <div className="progress-bar bg-primary" role="progressbar" style={{ width: `${progress}%` }} />
          </div>
          <div className={`monkey ${bounce?"bounce":""}`} style={{
            position: "absolute",
            left: `${progress}%`,
            bottom: "100%",
            transform: "translateX(-50%)",
            fontSize: `${16 + monkeyHealth/5}px`,
            transition: "all 0.5s ease",
          }}>{monkeyExpression}</div>
        </div>

        {/* Question Card */}
        <div className="card shadow-lg border-0 rounded-4 p-4 animate__animated animate__fadeIn">
          <h5 className="mb-4 fw-bold text-primary" style={{direction: lang==="ur"?"rtl":"ltr"}}>
            {getText(q.question_text || q.question, q.question_text_ur || q.question_ur)}
          </h5>
          <div className="row">
            {optionKeys.map(({key,en,ur}) => en && (
              <div key={key} className="col-12 col-md-6 mb-3">
                <div className={`card p-3 shadow-sm rounded-3 d-flex align-items-center option-card ${
                  answers[q.id]
                  ? answers[q.id] === key
                    ? key === q.correct_option ? "border-success bg-success text-white" : "border-danger bg-danger text-white"
                    : key === q.correct_option ? "border-success bg-light":"border-light"
                  :"border-light"
                }`}
                  onClick={()=>handleSelect(q.id,key)}
                  style={{ transition:"all 0.3s ease", cursor:isTimeUp||answers[q.id]?"not-allowed":"pointer", direction: lang==="ur"?"rtl":"ltr", opacity:isTimeUp?0.6:1 }}
                >
                  <span className="fw-bold me-2">{key}.</span>
                  <span>{getText(en,ur)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="d-flex justify-content-between mt-4">
            <button className="btn btn-outline-secondary px-4" onClick={()=>setCurrentQuestion(p=>p-1)} disabled={currentQuestion===0||isTimeUp}>⬅ Previous</button>
            {currentQuestion < questions.length-1
              ? <button className="btn btn-outline-primary px-4" onClick={()=>setCurrentQuestion(p=>p+1)} disabled={!answers[q.id]||isTimeUp}>Next ➡</button>
              : <button className="btn btn-success px-4" onClick={handleSubmit} disabled={saving||!answers[q.id]||isTimeUp}>{saving?"Saving...":"Finish & Save"}</button>
            }
          </div>
        </div>

        {/* Progress Buttons */}
        {!submitted && (
          <div className="d-flex gap-2 mt-4 justify-content-center">
            <button className="btn btn-success" onClick={handleSaveProgress} disabled={saving||isTimeUp}>💾 Save Progress</button>
            <button className="btn btn-primary" onClick={handleNewQuiz} disabled={isTimeUp}>🔄 Start New Quiz</button>
          </div>
        )}

        {/* Show Result */}
        {submitted && !showResult && (
          <div className="text-center mt-4">
            <button className="btn btn-lg btn-primary" onClick={()=>setShowResult(true)}>Show Result</button>
          </div>
        )}

        {submitted && showResult && (
          <div className="alert alert-success mt-3 shadow-sm rounded-3 text-center">
            <h4 className="fw-bold">🎉 Final Score: {score}/{questions.length}</h4>
            {percentile!==null && <p>📊 You scored better than <strong>{percentile}%</strong> of students</p>}
            {rank!==null && totalStudents!==null && <p>🏅 Your Rank: <strong>{rank}</strong> out of <strong>{totalStudents}</strong> students</p>}
            {rankMessage && <p className="fw-semibold">{rankMessage}</p>}
            {topper!==null && bottom!==null && (
              <div className="d-flex justify-content-center gap-3 mt-2">
                <span className="badge bg-warning text-dark px-3 py-2 fs-6 shadow-sm">🥇 Topper Score: {topper}</span>
                <span className="badge bg-secondary px-3 py-2">🔻 Lowest Score: {bottom}</span>
              </div>
            )}
            {previousBest!==null && <p className="mb-0 mt-3">📈 Your previous best: <strong>{previousBest}</strong>{" "}{score>previousBest?"👏 New High Score!":score===previousBest?"⚖️ Matched your best score.":"⬇️ Lower than your best. Try again!"}</p>}
            <button className="btn btn-outline-primary mt-3" onClick={handleNewQuiz}>🔄 Start Another Quiz</button>
          </div>
        )}

      </div>
      <Footer darkMode={false} />
      <style jsx global>{`
        .option-card:hover { transform: scale(1.02); box-shadow: 0 6px 16px rgba(0,0,0,0.12) !important; }
        .monkey { transition: all 0.5s ease; }
        .bounce { animation: bounce 0.3s ease; }
        @keyframes bounce { 0% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-15px); } 100% { transform: translateX(-50%) translateY(0); } }
      `}</style>
    </>
  );
}
