"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

export default function FullSubjectQuizPage() {
  const supabase = createClientComponentClient();
  const { subjectId } = useParams();
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [lang, setLang] = useState<"en" | "ur">("en");
  const [monkeyExpression, setMonkeyExpression] = useState("🙃");
  const [monkeyHealth, setMonkeyHealth] = useState(50);
  const [bounce, setBounce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Fetch user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user) setUser(user);
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
        .eq("subject_id", subjectId)
        .eq("question_type", "mcq");

      if (!error && data) {
        const shuffled = [...data].sort(() => 0.5 - Math.random());
        setQuestions(shuffled.slice(0, 30));
      }
      setLoading(false);
    };
    if (subjectId) fetchQuestions();
  }, [subjectId, supabase]);

  // Timer
  useEffect(() => {
    if (submitted || loading) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted, loading]);

  const handleSelect = (qId: string, opt: string) => {
    if (submitted || timeLeft <= 0 || answers[qId]) return;
    setAnswers((prev) => {
      const updated = { ...prev, [qId]: opt };
      const question = questions.find((q) => q.id === qId);
      if (question) {
        if (opt === question.correct_option) {
          setMonkeyExpression("😄");
          setMonkeyHealth((h) => Math.min(100, h + 10));
        } else {
          setMonkeyExpression("😢");
          setMonkeyHealth((h) => Math.max(0, h - 10));
        }
      }
      setBounce(true);
      setTimeout(() => setBounce(false), 300);
      return updated;
    });
    setTimeout(() => {
      if (currentQuestion < questions.length - 1)
        setCurrentQuestion((p) => p + 1);
    }, 600);
  };

  const handleSubmit = async () => {
    if (submitted || !user) return;
    setSaving(true);
    const finalScore = questions.filter((q) => answers[q.id] === q.correct_option).length;
    setScore(finalScore);
    setSubmitted(true);
    await supabase.from("results").insert([
      { user_id: user.id, subject_id: subjectId, score: finalScore, total_questions: questions.length, in_progress: false },
    ]);
    setSaving(false);
  };

  const handleNewQuiz = () => {
    if (!confirm("Start a new quiz?")) return;
    setAnswers({});
    setSubmitted(false);
    setScore(0);
    setCurrentQuestion(0);
    setTimeLeft(15 * 60);
    setMonkeyHealth(50);
    setMonkeyExpression("🙃");
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    setQuestions(shuffled.slice(0, 30));
  };

  const q = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const formatTime = (secs: number) =>
    `${Math.floor(secs / 60).toString().padStart(2, "0")}:${(secs % 60)
      .toString()
      .padStart(2, "0")}`;
  const isTimeUp = timeLeft <= 0 || submitted;

  if (loading)
    return (
      <div className="container text-center py-5">
        <div className="spinner-border text-primary" />
        <p className="mt-3 fw-semibold text-muted">Loading questions...</p>
      </div>
    );

  if (!questions.length)
    return (
      <div className="container text-center py-5">
        <div className="alert alert-warning shadow-sm rounded-3">
          No questions found for this subject.
        </div>
      </div>
    );

  const optionKeys = [
    { key: "A", text: lang === "en" ? q.option_a || q.option1 : q.option_a_ur || q.option1_ur },
    { key: "B", text: lang === "en" ? q.option_b || q.option2 : q.option_b_ur || q.option2_ur },
    { key: "C", text: lang === "en" ? q.option_c || q.option3 : q.option_c_ur || q.option3_ur },
    { key: "D", text: lang === "en" ? q.option_d || q.option4 : q.option_d_ur || q.option4_ur },
  ];

  const questionText = lang === "en" ? q.question_text || q.question : q.question_ur || q.question_text_ur;

  return (
    <>
      <Header darkMode={false} setDarkMode={() => {}} />
      <div className="container py-5" style={{ marginTop: "100px" }}>
        {/* Timer and Language */}
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">
          <div className="alert alert-info py-2 px-3 shadow-sm mb-2">
            ⏳ Time Left: <strong>{formatTime(timeLeft)}</strong>
          </div>
          <button
            onClick={() => setLang(lang === "en" ? "ur" : "en")}
            className="btn btn-outline-secondary rounded-5 px-4 py-2"
          >
            {lang === "en" ? "🇵🇰 اردو" : "🇬🇧 English"}
          </button>
        </div>

        {/* Progress Bar + Monkey */}
        <div className="position-relative mb-4" style={{ height: "40px" }}>
          <div className="progress" style={{ height: "10px" }}>
            <div className="progress-bar bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <div
            className={`monkey ${bounce ? "bounce" : ""}`}
            style={{
              position: "absolute",
              left: `${progress}%`,
              bottom: "100%",
              transform: "translateX(-50%)",
              fontSize: `${16 + monkeyHealth / 5}px`,
              transition: "all 0.5s ease",
            }}
          >
            {monkeyExpression}
          </div>
        </div>

        {/* Question */}
        <div
          className={`card shadow-lg border-0 rounded-4 p-4 ${
            lang === "ur" ? "urdu-text" : ""
          }`}
          dir={lang === "ur" ? "rtl" : "ltr"}
        >
          <h5 className="mb-4 fw-bold text-primary">{questionText}</h5>
          <div className="row">
            {optionKeys.map(({ key, text }) => (
              <div key={key} className="col-12 col-md-6 mb-3">
                <div
                  className={`card p-3 shadow-sm option-card ${
                    answers[q.id]
                      ? answers[q.id] === key
                        ? key === q.correct_option
                          ? "border-success bg-success text-white"
                          : "border-danger bg-danger text-white"
                        : key === q.correct_option
                        ? "border-success bg-light"
                        : "border-light"
                      : "border-light"
                  }`}
                  onClick={() => handleSelect(q.id, key)}
                  style={{
                    cursor: isTimeUp || answers[q.id] ? "not-allowed" : "pointer",
                    transition: "all 0.3s ease",
                  }}
                >
                  <strong className="me-2">{key}.</strong> {text}
                </div>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="d-flex justify-content-between mt-4">
            <button
              className="btn btn-outline-secondary px-4"
              onClick={() => setCurrentQuestion((p) => p - 1)}
              disabled={currentQuestion === 0 || isTimeUp}
            >
              ⬅ Previous
            </button>
            {currentQuestion < questions.length - 1 ? (
              <button
                className="btn btn-outline-primary px-4"
                onClick={() => setCurrentQuestion((p) => p + 1)}
                disabled={!answers[q.id] || isTimeUp}
              >
                Next ➡
              </button>
            ) : (
              <button
                className="btn btn-success px-4"
                onClick={handleSubmit}
                disabled={saving || !answers[q.id] || isTimeUp}
              >
                {saving ? "Saving..." : "Finish & Save"}
              </button>
            )}
          </div>
        </div>

        {/* Result */}
        {submitted && (
          <div className="alert alert-success text-center mt-4 rounded-3 shadow-sm">
            <h4>🎉 Score: {score}/{questions.length}</h4>
            <button className="btn btn-outline-primary mt-3" onClick={handleNewQuiz}>
              🔄 Start Again
            </button>
          </div>
        )}
      </div>

      <Footer darkMode={false} />

      <style jsx global>{`
        @font-face {
          font-family: "JameelNooriNastaleeqKasheeda";
          src: url("/fonts/JameelNooriNastaleeqKasheeda.ttf") format("truetype");
          font-display: swap;
        }
        .urdu-text {
          font-family: "JameelNooriNastaleeqKasheeda", serif;
          font-size: 1.3rem;
          line-height: 2.2rem;
          text-align: right;
        }
        .option-card:hover {
          transform: scale(1.02);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12) !important;
        }
        .monkey { transition: all 0.5s ease; }
        .bounce {
          animation: bounce 0.3s ease;
        }
        @keyframes bounce {
          0% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-15px); }
          100% { transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
}
