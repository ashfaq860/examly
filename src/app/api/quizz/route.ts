import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

// ✅ GET /api/quizz — Get all classes
export async function GET() {
  try {
    const { data: classes, error } = await supabase
      .from("classes")
      .select("*")
      .order("name");

    if (error) throw error;
    return NextResponse.json(classes);
  } catch (error) {
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

    if (quizType === "chapter" && chapters?.length > 0) {
      query = query.in("chapter_id", chapters);
    }

    if (difficulty && difficulty !== "all") {
      query = query.eq("difficulty", difficulty);
    }

    if (questionCount) {
      query = query.limit(questionCount);
    }

    const { data: questions, error } = await query;

    if (error) throw error;
    return NextResponse.json(questions);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
