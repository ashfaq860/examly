'use client';

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BreadcrumbAuto from "@/components/BreadcrumbAuto";

export default function ChapterQuizPage({ paperId = null }) {
  const supabase = createClientComponentClient();
  const { chapterId, subjectId } = useParams();

  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [lang, setLang] = useState<"en" | "ur">("en");
  const [forceUrdu, setForceUrdu] = useState(false);
  const [monkeyExpression, setMonkeyExpression] = useState("🙃");
  const [monkeyHealth, setMonkeyHealth] = useState(50);
  const [bounce, setBounce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);

  /* ================= USER ================= */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
  }, [supabase]);

  /* ================= RESOLVE CHAPTER ================= */
  useEffect(() => {
    if (!chapterId) return;

    const fetchQuestions = async () => {
      setLoading(true);

      const { data: questionsData } = await supabase
        .from("questions")
        .select("*")
        .eq("chapter_id", chapterId)
        .eq("question_type", "mcq");

      if (questionsData) {
        const shuffled = [...questionsData].sort(() => 0.5 - Math.random());
        setQuestions(shuffled.slice(0, 30));
      }

      // Force Urdu for certain subjects
      const urduSubjects = ["Urdu", "Islamyat", "Pak Studies", "Tarjuma Tul Quran"];
      if (subjectId) {
        const { data: subjectData } = await supabase
          .from("subjects")
          .select("name")
          .eq("id", subjectId)
          .single();

        if (subjectData && urduSubjects.includes(subjectData.name)) {
          setForceUrdu(true);
          setLang("ur");
        } else {
          setForceUrdu(false);
          setLang("en");
        }
      }

      setLoading(false);
    };

    fetchQuestions();
  }, [chapterId, subjectId, supabase]);

  /* ================= TIMER ================= */
  useEffect(() => {
    if (submitted || loading) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted, loading]);

  /* ================= HANDLE SELECTION ================= */
  const handleSelect = (qId: string, opt: string) => {
    if (answers[qId] || submitted || timeLeft <= 0) return;

    const question = questions.find(q => q.id === qId);
    if (!question) return;

    setAnswers(prev => ({ ...prev, [qId]: opt }));

    if (opt === question.correct_option) setCorrectCount(c => c + 1);

    // monkey animation/feedback
    if (question) {
      if (opt === question.correct_option) {
        setMonkeyExpression("😄");
        setMonkeyHealth(h => Math.min(100, h + 10));
      } else {
        setMonkeyExpression("😢");
        setMonkeyHealth(h => Math.max(0, h - 10));
      }
      setBounce(true);
      setTimeout(() => setBounce(false), 300);
    }

    // auto next question
    setTimeout(() => {
      if (currentQuestion < questions.length - 1)
        setCurrentQuestion(p => p + 1);
    }, 600);
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    if (submitted || !user) return;
    setSaving(true);
    const finalScore = Object.entries(answers).filter(([qid, opt]) => {
      const q = questions.find(q => q.id === qid);
      return q?.correct_option === opt;
    }).length;

    setScore(finalScore);
    setSubmitted(true);

    await supabase.from("results").insert([
      {
        user_id: user.id,
        paper_id: paperId,
        chapter_id: chapterId,
        score: finalScore,
        total_questions: questions.length,
        in_progress: false,
      },
    ]);

    setSaving(false);
  };

  const handleNewQuiz = () => {
    if (!confirm("Start a new quiz?")) return;
    setAnswers({});
    setSubmitted(false);
    setScore(0);
    setCorrectCount(0);
    setCurrentQuestion(0);
    setTimeLeft(15 * 60);
    setMonkeyHealth(50);
    setMonkeyExpression("🙃");

    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    setQuestions(shuffled.slice(0, 30));
  };

  /* ================= UI HELPERS ================= */
  if (loading)
    return (
      <div className="container text-center py-5">
        <div className="spinner-border text-primary" />
        <p className="mt-3 text-muted">Loading questions...</p>
      </div>
    );

  if (!questions.length)
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-warning">No questions found.</div>
      </div>
    );

  const q = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60)
      .toString()
      .padStart(2, "0")}`;

  const optionKeys = [
    { key: "A", text: lang === "en" ? q.option_a : q.option_a_ur },
    { key: "B", text: lang === "en" ? q.option_b : q.option_b_ur },
    { key: "C", text: lang === "en" ? q.option_c : q.option_c_ur },
    { key: "D", text: lang === "en" ? q.option_d : q.option_d_ur },
  ];

  const questionText = lang === "en" ? q.question_text : q.question_text_ur;

  return (
    <>
      <Header darkMode={false} setDarkMode={() => {}} />

      <div
        className="container py-5"
        style={{ marginTop: 100, direction: lang === "ur" ? "rtl" : "ltr" }}
      >
        <div className="mb-4" style={{ direction: "ltr", textAlign: "left" }}>
          <BreadcrumbAuto />
        </div>

        {/* INFO BAR: Timer Left / Score Center / Language Right */}
        <div
          className="alert alert-info d-flex align-items-center shadow-sm rounded-3 px-3"
          style={{
            direction: "ltr",
            justifyContent: "space-between",
            textAlign: "left",
            flexWrap: "wrap",
          }}
        >
          {/* Left: Timer */}
          <div className="flex-grow-0 mb-0">⏳ {formatTime(timeLeft)}</div>

          {/* Center: Score */}
          <div className="flex-grow-1 text-center mb-0">
            ✔ Correct: {correctCount} / {questions.length}
          </div>

          {/* Right: Language Switch */}
          {!forceUrdu && (
            <div className="flex-grow-0">
              <button
                onClick={() => setLang(lang === "en" ? "ur" : "en")}
                className="btn btn-outline-secondary rounded-5"
              >
                {lang === "en" ? "🇵🇰 اردو" : "🇬🇧 English"}
              </button>
            </div>
          )}
        </div>

        {/* PROGRESS BAR + MONKEY */}
        <div className="position-relative mb-4">
          <div className="progress" style={{ height: 10, direction: "ltr" }}>
            <div
              className="progress-bar bg-primary"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div
            className={`monkey ${bounce ? "bounce" : ""}`}
            style={{
              position: "absolute",
              left: `${progress}%`,
              bottom: "120%",
              transform: "translateX(-50%)",
              fontSize: `${16 + monkeyHealth / 5}px`,
            }}
          >
            {monkeyExpression}
          </div>
        </div>

        {/* QUESTION CARD */}
        <div
          className={`card shadow-lg border-0 rounded-4 p-4 ${
            lang === "ur" ? "urdu-text" : ""
          }`}
          dir={lang === "ur" ? "rtl" : "ltr"}
        >
          <h5
            className="mb-4 fw-bold text-primary"
            dangerouslySetInnerHTML={{ __html: questionText }}
          ></h5>

          <div className="row justify-content-center">
            {optionKeys.map(({ key, text }) => {
              const selected = answers[q.id];
              const isCorrect = key === q.correct_option;
              const isWrong = selected === key && !isCorrect;

              return (
                <div key={key} className="col-md-6 mb-3">
                  <div
                    className={`card p-3 shadow-sm option-card text-center ${
                      selected && isCorrect ? "bg-success text-white" : ""
                    } ${isWrong ? "bg-danger text-white" : ""}`}
                    onClick={() => handleSelect(q.id, key)}
                    style={{ cursor: selected ? "not-allowed" : "pointer" }}
                    dangerouslySetInnerHTML={{ __html: `<strong>${key}.</strong> ${text}` }}
                  />
                </div>
              );
            })}
          </div>

          {/* NAVIGATION */}
          <div className="d-flex justify-content-between mt-4">
            <button
              className="btn btn-outline-secondary"
              onClick={() => setCurrentQuestion(p => p - 1)}
              disabled={currentQuestion === 0}
            >
              ⬅ Previous
            </button>

            {currentQuestion < questions.length - 1 ? (
              <button
                className="btn btn-outline-primary"
                onClick={() => setCurrentQuestion(p => p + 1)}
                disabled={!answers[q.id]}
              >
                Next ➡
              </button>
            ) : (
              <button
                className="btn btn-success"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? "Saving..." : "Finish & Save"}
              </button>
            )}
          </div>
        </div>

        {submitted && (
          <div className="alert alert-success text-center mt-4">
            🎉 Score: {score}/{questions.length}
            <br />
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
        }
        .monkey {
          transition: all 0.5s ease;
        }
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
