import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

// ✅ GET /api/quizz — Get all classes
export async function GET() {
  try {
    const { data: classes, error } = await supabase
      .from("classes")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json(classes, { status: 200 });
  } catch (error) {
    console.error("Error fetching classes:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ POST /api/quizz — Generate quiz based on selection
export async function POST(request) {
  try {
    const body = await request.json();
    const { classId, subjectId, quizType, chapters, questionCount, difficulty } = body;

    let query = supabase
      .from("questions")
      .select("*")
      .eq("subject_id", subjectId)
      .eq("class_subject_id", classId)
      .eq("question_type", "mcq");

    if (quizType === "chapter" && Array.isArray(chapters) && chapters.length > 0) {
      query = query.in("chapter_id", chapters);
    }

    if (difficulty && difficulty !== "all") {
      query = query.eq("difficulty", difficulty);
    }

    if (questionCount && Number(questionCount) > 0) {
      query = query.limit(Number(questionCount));
    }

    const { data: questions, error } = await query;

    if (error) throw error;

    if (!questions || questions.length === 0) {
      return NextResponse.json(
        { message: "No questions found for the selected criteria." },
        { status: 404 }
      );
    }

    return NextResponse.json(questions, { status: 200 });
  } catch (error) {
    console.error("Error generating quiz:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
