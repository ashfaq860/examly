"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Breadcrumb from "@/components/Breadcrumb";
import Link from "next/link";
import { toSlug, chapterSlug } from "@/lib/slugUtils";

export default function ChaptersPage() {
  const { classId, subjectId } = useParams();
  const router = useRouter();
  const [chapters, setChapters] = useState<any[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!subjectId || !classId) return;
    const fetch = async () => {
      setLoading(true);
      setError("");
      try {
        // Resolve class
        const { data: classData } = await supabase
          .from("classes").select("id,name").eq("name", classId).single();
        if (!classData) { setError("Class not found."); setLoading(false); return; }
        setClassName(classData.name);

        // Resolve subject slug → id. The subjects table has duplicate rows
        // for the same subject name (different casing, e.g. "PHYSICS" vs
        // "Physics"), which all produce the same slug — so instead of
        // taking the first slug match, check each candidate against
        // class_subjects and use whichever one is actually linked to this
        // class. This is what "This subject is not available for this
        // class" was wrongly reporting when a *different* same-named
        // duplicate (not linked to this class) got matched first.
        const { data: allSubjects } = await supabase.from("subjects").select("id,name");
        const candidates = (allSubjects || []).filter(s => toSlug(s.name) === (subjectId as string));
        if (candidates.length === 0) { setError("Subject not found."); setLoading(false); return; }

        let subject: { id: string; name: string } | null = null;
        let cs: { id: string } | null = null;
        for (const candidate of candidates) {
          const { data: csRow } = await supabase
            .from("class_subjects").select("id")
            .eq("class_id", classData.id).eq("subject_id", candidate.id).maybeSingle();
          if (csRow) { subject = candidate; cs = csRow; break; }
        }
        if (!subject || !cs) { setError("This subject is not available for this class."); setLoading(false); return; }
        setSubjectName(subject.name);

        // Get chapters
        const { data: ch } = await supabase
          .from("chapters").select("id,name,chapterNo")
          .eq("class_subject_id", cs.id).order("chapterNo", { ascending: true });
        setChapters(ch || []);
      } catch { setError("Something went wrong."); }
      setLoading(false);
    };
    fetch();
  }, [subjectId, classId]);

  if (loading) return (
    <>
      <Header />
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight:"100vh" }}>
        <div className="text-center">
          <div className="spinner-border mb-3" style={{ color:"#073e8c", width:"3.5rem", height:"3.5rem" }} />
          <p className="text-muted fw-semibold">Loading chapters…</p>
        </div>
      </div>
      <Footer />
    </>
  );

  if (error) return (
    <>
      <Header />
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight:"80vh" }}>
        <div className="text-center">
          <div className="alert alert-danger">{error}</div>
          <button className="btn btn-outline-primary" onClick={() => router.back()}>← Go Back</button>
        </div>
      </div>
      <Footer />
    </>
  );

  return (
    <>
      <Header />
      <div className="container pt-header pb-2">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'Quiz', href: '/quiz' },
          { label: `Class ${classId}`, href: `/quiz/${classId}` },
          { label: subjectName },
        ]} />
      </div>

      {/* Header band */}
      <div style={{ background:"linear-gradient(135deg,#073e8c 0%,#0e7a71 100%)", paddingTop:40 }}>
        <div className="container text-white py-4">
          <Link href={`/quiz/${classId}`} style={{ color:"rgba(255,255,255,0.7)", fontSize:"0.85rem", textDecoration:"none", display:"inline-flex", alignItems:"center", gap:6, marginBottom:12 }}>
            ← Class {classId}
          </Link>
          <h1 style={{ fontSize:"clamp(1.5rem,4vw,2.3rem)", fontWeight:800, marginBottom:4 }}>{subjectName}</h1>
          <p style={{ opacity:0.82, fontSize:"0.92rem" }}>Class {className} • {chapters.length} chapter{chapters.length !== 1 ? "s" : ""}</p>
        </div>
        <div style={{ height:36, background:"#f8fafc", borderRadius:"50% 50% 0 0 / 36px 36px 0 0" }} />
      </div>

      <div className="container py-4" style={{ background:"#f8fafc", minHeight:"60vh" }}>
        {/* Full subject quiz CTA */}
        <div className="full-quiz-cta" onClick={() => router.push(`/quiz/${classId}/${subjectId}/full`)}>
          <div>
            <div style={{ fontWeight:700, fontSize:"1.05rem", marginBottom:2 }}>🚀 Full Subject Quiz</div>
            <div style={{ fontSize:"0.83rem", opacity:0.8 }}>30 random questions from all chapters</div>
          </div>
          <span style={{ fontSize:"1.4rem" }}>→</span>
        </div>

        {/* Chapters */}
        <h3 style={{ fontWeight:700, fontSize:"1.05rem", color:"#334155", marginBottom:12, marginTop:24 }}>
          Chapter-wise Practice
        </h3>
        {chapters.length === 0 ? (
          <div className="alert alert-info">No chapters found for {subjectName}.</div>
        ) : (
          <div className="row g-3">
            {chapters.map((ch, idx) => (
              <div key={ch.id} className="col-12 col-sm-6 col-md-4">
                <div
                  className="chapter-card"
                  onClick={() => router.push(`/quiz/${classId}/${subjectId}/chapter/${chapterSlug(ch.chapterNo, idx)}`)}
                >
                  <div className="ch-num">{ch.chapterNo ?? idx + 1}</div>
                  <div className="ch-info">
                    <div className="ch-title">{ch.name}</div>
                    <div className="ch-meta">Class {className} • {subjectName}</div>
                  </div>
                  <span className="ch-arrow">›</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
      <style jsx global>{`
        .full-quiz-cta {
          background: linear-gradient(135deg,#073e8c,#0e7a71);
          color: #fff;
          border-radius: 16px;
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(7,62,140,0.25);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .full-quiz-cta:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(7,62,140,0.35); }

        .chapter-card {
          background: #fff;
          border-radius: 14px;
          padding: 1rem 1.1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          cursor: pointer;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(15,23,42,0.05);
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }
        .chapter-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(7,62,140,0.12);
          border-color: #073e8c;
        }
        .ch-num {
          width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
          background: linear-gradient(135deg,#073e8c,#0b63d4);
          color: #fff; font-weight: 800; font-size: 1.1rem;
          display: flex; align-items: center; justify-content: center;
        }
        .ch-info { flex: 1; min-width: 0; }
        .ch-title { font-weight: 600; font-size: 0.92rem; color: #0f172a; line-height: 1.4; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ch-meta { font-size: 0.75rem; color: #64748b; }
        .ch-arrow { font-size: 1.5rem; color: #94a3b8; flex-shrink: 0; }
        .chapter-card:hover .ch-arrow { color: #073e8c; }
      `}</style>
    </>
  );
}
