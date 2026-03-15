"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import BreadcrumbAuto from '@/components/BreadcrumbAuto';
export default function ChaptersPage() {
  const { classId, subjectId } = useParams();
  const router = useRouter();
  const [chapters, setChapters] = useState<any[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!subjectId || !classId) return;

    const fetchChapters = async () => {
      setLoading(true);
      setErrorMessage("");

      try {

    const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("id, name")
        .eq("name", classId)
        .single();

      if (classError || !classData) {
        console.error("Class not found:", classError?.message);
        setLoading(false);
        return;
      }
       const classUUID = classData.id;
        // ✅ Step 1: Get the specific class-subject relationship
        const { data: classSubjectData, error: relError } = await supabase
          .from("class_subjects")
          .select(`
            id,
            classes:class_id (id, name),
            subjects:subject_id (id, name)
          `)
          .eq("class_id", classUUID)
          .eq("subject_id", subjectId)
          .single();

        if (relError || !classSubjectData) {
          setErrorMessage("⚠️ This subject does not belong to the selected class.");
          setChapters([]);
          setLoading(false);
          return;
        }

        // ✅ Step 2: Fetch chapters for this specific class_subject
        const { data: chaptersData, error: chapError } = await supabase
          .from("chapters")
          .select("id, name, chapterNo, class_subject_id")
          .eq("class_subject_id", classSubjectData.id)
          .order("chapterNo", { ascending: true });

        if (chapError) {
          console.error("Error fetching chapters:", chapError.message);
          setErrorMessage("Failed to load chapters.");
        } else {
          setChapters(chaptersData || []);
          setSubjectName((classSubjectData.subjects as any)?.name || "");
          setClassName((classSubjectData.classes as any)?.name || "");
        }
      } catch (err) {
        console.error(err);
        setErrorMessage("Something went wrong while loading chapters.");
      } finally {
        setLoading(false);
      }
    };

    fetchChapters();
  }, [subjectId, classId]);

  // ✅ Loading Spinner
  if (loading) {
    return (
      <>
        <Header darkMode={darkMode} setDarkMode={setDarkMode} />
        <div
          className="d-flex flex-column align-items-center justify-content-center text-center"
          style={{ minHeight: "80vh" }}
        >
          <div
            className="spinner-border text-primary mb-4"
            style={{ width: "4rem", height: "4rem" }}
            role="status"
          ></div>
          <h5 className="fw-semibold text-muted mb-2">Loading Chapters...</h5>
          <p className="text-secondary small">
            Please wait while we load the chapters for this subject ⏳
          </p>
        </div>
        <Footer darkMode={darkMode} />
      </>
    );
  }

  // ✅ Invalid Relationship or Error Message
  if (errorMessage) {
    return (
      <>
        <Header darkMode={darkMode} setDarkMode={setDarkMode} />
        <div
          className="d-flex flex-column align-items-center justify-content-center text-center"
          style={{ minHeight: "80vh" }}
        >
          <div className="alert alert-danger w-75">{errorMessage}</div>
          <button
            className="btn btn-outline-primary mt-3"
            onClick={() => router.back()}
          >
            🔙 Go Back
          </button>
        </div>
        <Footer darkMode={darkMode} />
      </>
    );
  }

  return (
    <>
      <Header darkMode={darkMode} setDarkMode={setDarkMode} />

      <div className="container py-5" style={{ marginTop: "100px" }}>
        {/* Title */}
        <BreadcrumbAuto />
        <div className="text-center mb-5">
          <h2 className="fw-bold text-primary">
            📖 Chapters for {subjectName || "Subject"}
          </h2>
          <p className="text-muted">
            Class {className} • Select a chapter to start the quiz or attempt the full subject quiz.
          </p>
        </div>

        {/* Full Subject Quiz Button */}
        <div className="text-center mb-5">
          <button
            onClick={() => router.push(`/quiz/${classId}/${subjectId}/full`)}
            className="btn btn-lg btn-primary shadow-sm px-5 py-3 rounded-4 fw-semibold"
            style={{ transition: "0.3s" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = "scale(1.05)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.transform = "scale(1)")
            }
          >
            🚀 Start Full Subject Quiz
          </button>
        </div>

        {/* Chapters Grid */}
        <div className="row justify-content-center">
          {chapters.map((ch, index) => (
            <div key={ch.id} className="col-12 col-sm-6 col-md-4 col-lg-3 mb-4">
              <div
                className="card shadow-lg border-0 rounded-4 chapter-card h-100"
                style={{
                  transition: "transform 0.3s, box-shadow 0.3s",
                  cursor: "pointer",
                }}
                onClick={() =>
                  router.push(
                    `/quiz/${classId}/${subjectId}/chapter/${ch.id}`
                  )
                }
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-8px)";
                  e.currentTarget.style.boxShadow =
                    "0 1rem 2rem rgba(0,0,0,.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 .5rem 1rem rgba(0,0,0,.1)";
                }}
              >
                <div className="card-body text-center p-4 d-flex flex-column justify-content-center">
                  <div
                    className="rounded-circle bg-primary text-white mx-auto mb-3 d-flex align-items-center justify-content-center"
                    style={{
                      width: "60px",
                      height: "60px",
                      fontSize: "1.3rem",
                      transition: "transform 0.3s",
                    }}
                  >
                    {["📘", "📗", "📕", "📙"][index % 4]}
                  </div>
                  <h5 className="fw-bold">
                    {ch.chapterNo ? `Chapter ${ch.chapterNo}: ` : ""}
                    {ch.name}
                  </h5>
                  <small className="text-muted mt-1">
                    Class {className} • {subjectName}
                  </small>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* No Chapters */}
        {chapters.length === 0 && !errorMessage && (
          <div className="alert alert-warning text-center mt-5">
            No chapters found for {subjectName} in Class {className}.
          </div>
        )}
      </div>

      <Footer darkMode={darkMode} />

      <style jsx>{`
        .chapter-card:hover div.rounded-circle {
          transform: scale(1.2) rotate(10deg);
          background: #0d6efd;
        }
      `}</style>
    </>
  );
}
