//src/hooks/useBoardPattern.ts
'use client';
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export const useBoardPattern = () => {
  const [isLoading, setIsLoading] = useState(false);

  const generateBoardPatternPaper = useCallback(async (
    subjectId: string,
    classId: string,
    selectedChapters: string[],
    language: string,
    layout: string
  ) => {
    setIsLoading(true);
    try {
      // Fetch board pattern rules
      const { data: rules, error: rulesError } = await supabase
        .from('chapter_range_rules')
        .select('*')
        .eq('subject_id', subjectId)
        .eq('class_id', classId)
        .in('question_type', ['mcq', 'short', 'long'])
        .order('chapter_start');

      if (rulesError) throw rulesError;
      if (!rules || rules.length === 0) {
        console.log('No board pattern rules found');
        return null;
      }

      // Fetch questions based on rules
      const sections = [];
      
      for (const rule of rules) {
        // Get chapters in range
        const chaptersInRange = selectedChapters.filter(chapterId => {
          // You'll need to map chapterId to chapter number
          // This is a placeholder - adjust based on your data structure
          const chapterNum = parseInt(chapterId.split('-')[1] || '0');
          return chapterNum >= rule.chapter_start && chapterNum <= rule.chapter_end;
        });

        if (chaptersInRange.length === 0) continue;

        // Determine how many questions to fetch
        let questionCount = rule.min_questions;
        if (rule.rule_mode === 'per_chapter') {
          questionCount *= chaptersInRange.length;
        }

        // Fetch questions using new schema with topic_id
        const { data: questions, error: questionsError } = await supabase
          .from('questions')
          .select(`
            id,
            question_text,
            question_text_ur,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_option,
            difficulty,
            question_type,
            topic:topics(
              id,
              name,
              chapter_id,
              chapter:chapters(
                id,
                class_subject_id,
                class_subject:class_subjects(
                  id,
                  class_id,
                  subject_id
                )
              )
            )
          `)
          .eq('topic.chapter.class_subject.subject_id', subjectId)
          .eq('topic.chapter.class_subject.class_id', classId)
          .in('topic.chapter_id', chaptersInRange)
          .eq('question_type', rule.question_type)
          .limit(questionCount);

        if (questionsError) throw questionsError;

        if (questions && questions.length > 0) {
          sections.push({
            id: `section-${rule.question_type}-${Date.now()}`,
            type: rule.question_type,
            questions: questions,
            totalQuestions: questions.length,
            attemptCount: questions.length, // Adjust based on rules
            marksEach: rule.question_type === 'mcq' ? 1 : 
                      rule.question_type === 'short' ? 2 : 5, // Adjust as needed
            totalMarks: questions.length * (rule.question_type === 'mcq' ? 1 : 
                                          rule.question_type === 'short' ? 2 : 5),
            subject: '', // Will be filled by parent
            language: language,
            layout: layout,
            timestamp: new Date().toISOString()
          });
        }
      }

      return { sections, totalMarks: sections.reduce((sum, s) => sum + s.totalMarks, 0) };
    } catch (error) {
      console.error('Error generating board pattern paper:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    generateBoardPatternPaper,
    isLoading
  };
};