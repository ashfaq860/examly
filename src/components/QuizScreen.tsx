"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function QuizScreen({ chapterId, paperId = null, user }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  // 🔹 Fetch MCQ questions
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("chapter_id", chapterId)
        .eq("question_type", "mcq");

      if (error) {
        console.error("Error fetching questions:", error);
      } else {
        setQuestions(data || []);
      }
      setLoading(false);
    };

    if (chapterId) fetchQuestions();
  }, [chapterId]);

  const handleSelect = (qId: string, opt: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: opt }));

    // auto-move to next after short delay
    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion((prev) => prev + 1);
      }
    }, 300);
  };

  const handleSubmit = async () => {
    if (!user) {
      alert("You must be logged in to save results.");
      return;
    }
    setSaving(true);

    const finalScore = questions.filter(
      (q) => answers[q.id] === q.correct_option
    ).length;

    setScore(finalScore);
    setSubmitted(true);

    // Save to DB
    const { error } = await supabase.from("results").insert([
      {
        user_id: user.id,
        paper_id: paperId,
        score: finalScore,
        total_questions: questions.length,
      },
    ]);

    if (error) {
      console.error("Error saving result:", error.message);
      alert("Error saving your result.");
    }

    setSaving(false);
  };

  // 🔹 Loading state
  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Loading questions...</p>
      </div>
    );
  }

  // 🔹 No questions
  if (!questions || questions.length === 0) {
    return (
      <div className="container mt-5 text-center">
        <p className="alert alert-warning">No MCQ questions found for this chapter.</p>
      </div>
    );
  }

  const q = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="container mt-5">
      {/* Progress */}
      <div className="mb-4">
        <div className="d-flex justify-content-between">
          <small>
            Question {currentQuestion + 1} of {questions.length}
          </small>
          <small>{Math.round(progress)}%</small>
        </div>
        <div className="progress" style={{ height: "8px" }}>
          <div
            className="progress-bar bg-success"
            role="progressbar"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="card shadow p-4">
        <h5 className="mb-3">{q.question_text}</h5>

        <div className="row">
          {["A", "B", "C", "D"].map(
            (opt) =>
              q[`option_${opt.toLowerCase()}`] && (
                <div key={opt} className="col-12 mb-3">
                  <div
                    className={`card p-3 cursor-pointer ${
                      submitted
                        ? answers[q.id] === opt
                          ? opt === q.correct_option
                            ? "border-success bg-success text-white"
                            : "border-danger bg-danger text-white"
                          : opt === q.correct_option
                          ? "border-success bg-light"
                          : "border-light"
                        : answers[q.id] === opt
                        ? "border-primary bg-light"
                        : "border-light"
                    }`}
                    onClick={() => !submitted && handleSelect(q.id, opt)}
                    style={{ transition: "0.3s" }}
                  >
                    <strong>{opt}.</strong> {q[`option_${opt.toLowerCase()}`]}
                  </div>
                </div>
              )
          )}
        </div>

        {/* Navigation */}
        <div className="d-flex justify-content-between mt-4">
          <button
            className="btn btn-secondary"
            onClick={() => setCurrentQuestion((p) => p - 1)}
            disabled={currentQuestion === 0 || submitted}
          >
            Previous
          </button>

          {currentQuestion < questions.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setCurrentQuestion((p) => p + 1)}
              disabled={!answers[q.id] || submitted}
            >
              Next
            </button>
          ) : (
            <button
              className="btn btn-success"
              onClick={handleSubmit}
              disabled={saving || !answers[q.id] || submitted}
            >
              {saving ? "Saving..." : "Submit Quiz"}
            </button>
          )}
        </div>
      </div>

      {submitted && (
        <div className="alert alert-info mt-4">
          <h4>
            Your Score: {score}/{questions.length}
          </h4>
        </div>
      )}
    </div>
  );
}
