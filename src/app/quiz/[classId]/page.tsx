"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import BreadcrumbAuto from "@/components/BreadcrumbAuto";
import { toSlug } from "@/lib/slugUtils";
import Link from "next/link";

const SUBJECT_CONFIG: Record<string, { icon: string; gradient: string }> = {
  math:         { icon:"📐", gradient:"linear-gradient(135deg,#073e8c,#0b63d4)" },
  mathematics:  { icon:"📊", gradient:"linear-gradient(135deg,#073e8c,#0b63d4)" },
  science:      { icon:"🔬", gradient:"linear-gradient(135deg,#0f766e,#1ba699)" },
  physics:      { icon:"⚛️", gradient:"linear-gradient(135deg,#7c3aed,#a78bfa)" },
  chemistry:    { icon:"🧪", gradient:"linear-gradient(135deg,#d97706,#f59e0b)" },
  biology:      { icon:"🧬", gradient:"linear-gradient(135deg,#059669,#34d399)" },
  english:      { icon:"📖", gradient:"linear-gradient(135deg,#0369a1,#38bdf8)" },
  urdu:         { icon:"📝", gradient:"linear-gradient(135deg,#dc2626,#f87171)" },
  islamiyat:    { icon:"☪️",  gradient:"linear-gradient(135deg,#065f46,#34d399)" },
  computer:     { icon:"💻", gradient:"linear-gradient(135deg,#0e7490,#22d3ee)" },
  geography:    { icon:"🌍", gradient:"linear-gradient(135deg,#b45309,#fcd34d)" },
  history:      { icon:"📜", gradient:"linear-gradient(135deg,#9d174d,#f472b6)" },
  "pak studies":{ icon:"🇵🇰", gradient:"linear-gradient(135deg,#065f46,#1ba699)" },
};

const DEFAULT_CFG = { icon:"📘", gradient:"linear-gradient(135deg,#073e8c,#1ba699)" };

export default function SubjectsPage() {
  const { classId } = useParams();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    const supabase = createSupabaseBrowserClient();
    const fetch = async () => {
      const { data: classData } = await supabase
        .from("classes").select("id,name").eq("name", classId).single();
      if (!classData) { setLoading(false); return; }

      const { data: subjectData } = await supabase
        .from("class_subjects")
        .select("subjects(id,name,description)")
        .eq("class_id", classData.id);

      setSubjects((subjectData || []).map((r: any) => r.subjects).filter(Boolean));
      setLoading(false);
    };
    fetch();
  }, [classId]);

  return (
    <>
      <Header />
      <div className="container pt-header pb-2">
        <BreadcrumbAuto labels={{ [String(classId)]: `Class ${classId}` }} />
      </div>
      <div style={{ background:"linear-gradient(135deg,#073e8c 0%,#0e7a71 100%)", paddingTop:40 }}>
        <div className="container text-white py-4">
          <Link href="/quiz" style={{ color:"rgba(255,255,255,0.7)", fontSize:"0.85rem", textDecoration:"none", display:"inline-flex", alignItems:"center", gap:6, marginBottom:12 }}>
            ← Back to Classes
          </Link>
          <h1 style={{ fontSize:"clamp(1.6rem,4vw,2.4rem)", fontWeight:800, marginBottom:6 }}>
            Class {classId} — Select a Subject
          </h1>
          <p style={{ opacity:0.82, fontSize:"0.95rem" }}>Choose a subject to view chapters or start a full subject quiz</p>
        </div>
        <div style={{ height:36, background:"#f8fafc", borderRadius:"50% 50% 0 0 / 36px 36px 0 0" }} />
      </div>

      <div className="container py-4" style={{ background:"#f8fafc", minHeight:"60vh" }}>
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" style={{ color:"#073e8c", width:"3rem", height:"3rem" }} role="status" />
            <p className="mt-3 text-muted">Loading subjects…</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="alert alert-warning text-center mt-4">No subjects found for Class {classId}.</div>
        ) : (
          <div className="row g-3">
            {subjects.map((subject) => {
              const key = subject.name.toLowerCase();
              const cfg = SUBJECT_CONFIG[key] || DEFAULT_CFG;
              return (
                <div key={subject.id} className="col-6 col-sm-4 col-md-3">
                  <Link href={`/quiz/${classId}/${toSlug(subject.name)}`} style={{ textDecoration:"none" }}>
                    <div className="subj-card" style={{ background: cfg.gradient }}>
                      <div className="subj-icon">{cfg.icon}</div>
                      <div className="subj-name">{subject.name}</div>
                      <div className="subj-desc">{subject.description || "Start Quiz →"}</div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
      <style jsx global>{`
        .subj-card {
          border-radius: 16px;
          padding: 1.6rem 1rem 1.3rem;
          text-align: center;
          color: #fff;
          cursor: pointer;
          transition: transform 0.22s ease, box-shadow 0.22s ease;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .subj-card:hover { transform: translateY(-6px) scale(1.03); box-shadow: 0 12px 32px rgba(0,0,0,0.22); }
        .subj-icon { font-size: 2.4rem; }
        .subj-name { font-size: 1rem; font-weight: 700; }
        .subj-desc { font-size: 0.75rem; opacity: 0.82; }
      `}</style>
    </>
  );
}
