"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import BreadcrumbAuto from "@/components/BreadcrumbAuto";

const CLASS_ICONS: Record<string, string> = {
  "1":"🧒","2":"👦","3":"👧","4":"🎒","5":"📘","6":"📗",
  "7":"📙","8":"🧠","9":"🧮","10":"🧑‍🏫","11":"📚","12":"🎓",
};
const GRADIENTS = [
  "linear-gradient(135deg,#073e8c,#0b63d4)",
  "linear-gradient(135deg,#0f766e,#1ba699)",
  "linear-gradient(135deg,#7c3aed,#a78bfa)",
  "linear-gradient(135deg,#d97706,#f59e0b)",
  "linear-gradient(135deg,#dc2626,#ef4444)",
  "linear-gradient(135deg,#0369a1,#38bdf8)",
  "linear-gradient(135deg,#065f46,#34d399)",
  "linear-gradient(135deg,#9d174d,#f472b6)",
];

export default function QuizHome() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("classes").select("id,name").then(({ data }) => {
      const sorted = (data || []).sort((a, b) => Number(a.name) - Number(b.name));
      setClasses(sorted);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <Header />
      <div className="container pt-header pb-2"><BreadcrumbAuto /></div>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg,#073e8c 0%,#0e7a71 100%)", paddingTop: 40 }}>
        <div className="container text-center text-white py-5">
          <div style={{ display:"inline-flex", alignItems:"center", gap:10, background:"rgba(255,255,255,0.12)", borderRadius:999, padding:"6px 18px", fontSize:"0.8rem", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:20, border:"1px solid rgba(255,255,255,0.2)" }}>
            📝 Online Quiz System
          </div>
          <h1 style={{ fontSize:"clamp(2rem,5vw,3.2rem)", fontWeight:800, marginBottom:12, letterSpacing:"-0.02em" }}>
            Practice Smarter, Score Higher
          </h1>
          <p style={{ fontSize:"1.1rem", opacity:0.85, maxWidth:520, margin:"0 auto 0" }}>
            Chapter-wise quizzes &amp; full subject tests for classes 5 to 12 — BISE pattern, instant results.
          </p>
        </div>
        <div style={{ height:40, background:"#f8fafc", borderRadius:"50% 50% 0 0 / 40px 40px 0 0", marginTop:-1 }} />
      </div>

      <div className="container py-4" style={{ background:"#f8fafc", minHeight:"60vh" }}>
        <h2 className="fw-bold text-center mb-2" style={{ color:"#0f172a", fontSize:"1.4rem" }}>Select Your Class</h2>
        <p className="text-center text-muted mb-4" style={{ fontSize:"0.92rem" }}>Choose a class to explore subjects and start quizzing</p>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" style={{ color:"#073e8c", width:"3rem", height:"3rem" }} role="status" />
            <p className="mt-3 text-muted">Loading classes…</p>
          </div>
        ) : (
          <div className="row justify-content-center g-3">
            {classes.map((cls, idx) => (
              <div key={cls.id} className="col-6 col-sm-4 col-md-3 col-lg-2">
                <Link href={`/quiz/${cls.name}`} style={{ textDecoration:"none" }}>
                  <div className="quiz-class-card" style={{ background: GRADIENTS[idx % GRADIENTS.length] }}>
                    <div className="qcc-icon">{CLASS_ICONS[cls.name] || "📖"}</div>
                    <div className="qcc-label">Class {cls.name}</div>
                    <div className="qcc-sub">Start →</div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />

      <style jsx global>{`
        .quiz-class-card {
          border-radius: 16px;
          padding: 1.5rem 1rem 1.2rem;
          text-align: center;
          color: #fff;
          cursor: pointer;
          transition: transform 0.22s ease, box-shadow 0.22s ease;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        }
        .quiz-class-card:hover {
          transform: translateY(-6px) scale(1.03);
          box-shadow: 0 12px 32px rgba(0,0,0,0.2);
        }
        .qcc-icon { font-size: 2.2rem; margin-bottom: 8px; }
        .qcc-label { font-size: 1rem; font-weight: 700; margin-bottom: 4px; }
        .qcc-sub { font-size: 0.78rem; opacity: 0.8; font-weight: 500; }
      `}</style>
    </>
  );
}
