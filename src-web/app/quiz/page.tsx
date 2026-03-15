// examly/src/app/quiz/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import BreadcrumbAuto from '@/components/BreadcrumbAuto';
export default function QuizHome() {
  const [classes, setClasses] = useState<any[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Icons for each class (1–12)
  const classIcons: Record<string, string> = {
    "1": "🧒",
    "2": "👦",
    "3": "👧",
    "4": "🎒",
    "5": "📘",
    "6": "📗",
    "7": "📙",
    "8": "🧠",
    "9": "🧮",
    "10": "🧑‍🏫",
    "11": "📚",
    "12": "🎓",
  };

  useEffect(() => {
    const fetchClasses = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .order("name");
      if (!error) setClasses(data || []);
      setLoading(false);
    };
    fetchClasses();
  }, []);

  return (
    <>
      <Header darkMode={darkMode} setDarkMode={setDarkMode} />

      <div className="container py-5" style={{ marginTop: "100px" }}>
         <BreadcrumbAuto />
        {/* Title */}
        <div className="text-center mb-5">
          <h2 className="fw-bold text-primary">📚 Choose Your Class</h2>
          <p className="text-muted">
            Select a class to start exploring subjects and quizzes.
          </p>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="text-center my-5">
            <div
              className="spinner-border text-primary"
              role="status"
              style={{ width: "3rem", height: "3rem" }}
            >
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted">Loading classes...</p>
          </div>
        ) : (
          <div className="row justify-content-center">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className="col-12 col-sm-6 col-md-4 col-lg-3 mb-4"
              >
                <Link
                  href={`/quiz/${cls.name}`}
                  className="text-decoration-none">
                  <div
                    className="card shadow-lg border-0 rounded-4 text-center p-4 h-100 quiz-card"
                    style={{ transition: "0.3s" }}
                  >
                    <div className="card-body d-flex flex-column align-items-center justify-content-center">
                      <div
                        className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center mb-3"
                        style={{
                          width: "60px",
                          height: "60px",
                          fontSize: "1.5rem",
                        }}
                      >
                        {classIcons[cls.name] || "📖"}
                      </div>
                      <h5 className="fw-bold text-dark">Class {cls.name}</h5>
                      <p className="text-muted small mb-0">
                        Start learning now
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer darkMode={darkMode} />

      <style jsx>{`
        .quiz-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </>
  );
}
