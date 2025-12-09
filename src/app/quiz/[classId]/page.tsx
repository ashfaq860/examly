// examly/src/app/quiz/[classId]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

export default function SubjectsPage() {
  const { classId } = useParams();
  const router = useRouter();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [className, setClassName] = useState<string>("");
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true); // ✅ loading state

  // Subject → Icon mapping
  const subjectIcons: Record<string, string> = {
    math: "📐",
    mathematics: "📊",
    science: "🔬",
    physics: "⚛️",
    chemistry: "🧪",
    biology: "🧬",
    english: "📖",
    urdu: "📝",
    islamiyat: "☪️",
    computer: "💻",
    geography: "🌍",
    history: "📜",
  };

  // Subject → Color mapping
  const subjectColors: Record<string, string> = {
    math: "#0d6efd",
    mathematics: "#0d6efd",
    science: "#198754",
    physics: "#6f42c1",
    chemistry: "#d63384",
    biology: "#20c997",
    english: "#6c757d",
    urdu: "#fd7e14",
    islamiyat: "#198754",
    computer: "#0dcaf0",
    geography: "#ffc107",
    history: "#dc3545",
  };

  const getIcon = (name: string) => {
    const key = name.toLowerCase();
    return subjectIcons[key] || "📘";
  };

  const getGradient = (name: string) => {
    const key = name.toLowerCase();
    const base = subjectColors[key] || "#0d6efd";
    return `linear-gradient(135deg, ${base}, ${base}cc)`;
  };

  useEffect(() => {
    if (!classId) return;

    const fetchData = async () => {
      setLoading(true); // ✅ show loading spinner
      const { data: subjectData, error: subjectError } = await supabase
        .from("class_subjects")
        .select(`
          subjects ( id, name, description ),
          classes ( id, name )
        `)
        .eq("class_id", classId);

      if (subjectError) {
        console.error("Supabase error:", subjectError.message);
      } else {
        setSubjects(subjectData.map((row) => row.subjects));
        if (subjectData.length > 0 && subjectData[0].classes) {
          setClassName(subjectData[0].classes.name);
        }
      }
      setLoading(false); // ✅ hide loader
    };

    fetchData();
  }, [classId]);

  return (
    <>
      <Header darkMode={darkMode} setDarkMode={setDarkMode} />

      <div className="container py-5" style={{ marginTop: "100px" }}>
        {/* Title */}
        <div className="text-center mb-5">
          <h2 className="fw-bold text-primary">
            📘 Subjects for {className || `Class ${classId}`} Class
          </h2>
          <p className="text-muted">
            Choose a subject below to start practicing quizzes and chapters.
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
            <p className="mt-3 text-muted">Loading subjects...</p>
          </div>
        ) : (
          <>
            {/* Subjects Grid */}
            <div className="row justify-content-center">
              {subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="col-12 col-sm-6 col-md-4 col-lg-3 mb-4"
                >
                  <div
                    className="card shadow-lg border-0 rounded-4 subject-card h-100 text-white"
                    style={{
                      background: getGradient(subject.name),
                      transition: "transform 0.3s, box-shadow 0.3s",
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      router.push(`/quiz/${classId}/${subject.id}`)
                    }
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(-8px)";
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 1rem 2rem rgba(0,0,0,.3)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(0)";
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 .5rem 1rem rgba(0,0,0,.15)";
                    }}
                  >
                    <div className="card-body d-flex flex-column justify-content-center text-center p-4">
                      {/* Circle Icon */}
                      <div
                        className="rounded-circle bg-white text-dark d-flex align-items-center justify-content-center mx-auto mb-3 subject-icon"
                        style={{
                          width: "70px",
                          height: "70px",
                          fontSize: "2rem",
                          transition: "transform 0.3s",
                        }}
                      >
                        {getIcon(subject.name)}
                      </div>

                      <h5 className="fw-bold">{subject.name}</h5>
                      <p className="small">
                        {subject.description ||
                          "Start learning this subject now"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* No subjects */}
            {subjects.length === 0 && (
              <div className="alert alert-warning text-center mt-5">
                No subjects found for this class.
              </div>
            )}
          </>
        )}
      </div>

      <Footer darkMode={darkMode} />

      <style jsx>{`
        .subject-card:hover .subject-icon {
          transform: scale(1.2) rotate(10deg);
        }
      `}</style>
    </>
  );
}
