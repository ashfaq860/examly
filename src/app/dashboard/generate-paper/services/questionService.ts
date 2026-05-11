// src/app/dashboard/generate-paper/services/questionService.ts
import axios from 'axios';
import { Question, QuestionFilters } from '@/types/types';

export class QuestionService {
  static async fetchQuestions(filters: QuestionFilters): Promise<Question[]> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          params.append(key, value.join(','));
        } else {
          params.append(key, String(value));
        }
      }
    });

    // Add cache busting
    params.append('timestamp', Date.now().toString());

    const response = await axios.get('/api/questions', { params });
    return response.data || [];
  }

  static async fetchQuestionsByIds(
    questionIds: string[],
    language: string
  ): Promise<Question[]> {
    if (questionIds.length === 0) return [];

    const response = await axios.get('/api/questions', {
      params: {
        questionIds: questionIds.join(','),
        language,
        includeUrdu: language !== 'english',
      },
    });

    return response.data || [];
  }

  static translateQuestions(questions: Question[], language: string): Question[] {
    if (language === 'english') return questions;

    return questions.map(question => {
      const translated = { ...question };
      
      // Translate based on language preference
      if (language === 'urdu' && question.question_text_ur) {
        translated.question_text = question.question_text_ur;
      } else if (language === 'bilingual') {
        translated.question_text_english = question.question_text;
        translated.question_text_urdu = question.question_text_ur;
      }

      // Translate MCQ options if present
      if (question.question_type === 'mcq' && language !== 'english') {
        ['option_a', 'option_b', 'option_c', 'option_d'].forEach(opt => {
          const urduField = `${opt}_ur`;
          if (question[urduField]) {
            if (language === 'bilingual') {
              translated[`${opt}_english`] = question[opt];
              translated[`${opt}_urdu`] = question[urduField];
            } else {
              translated[opt] = question[urduField];
            }
          }
        });
      }

      return translated;
    });
  }
}