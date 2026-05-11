// src/app/dashboard/generate-paper/utils/helpers.ts
export const isEnglishSubject = (subjects: Subject[], subjectId: string): boolean => {
  const subject = subjects.find(s => s.id === subjectId);
  return subject?.name.toLowerCase() === 'english';
};

export const isUrduSubject = (subjects: Subject[], subjectId: string): boolean => {
  const subject = subjects.find(s => s.id === subjectId);
  return subject?.name.toLowerCase() === 'urdu';
};

export const getQuestionTypes = (subjects: Subject[], subjectId: string) => {
  if (isEnglishSubject(subjects, subjectId)) return englishTypes;
  if (isUrduSubject(subjects, subjectId)) return urduTypes;
  return defaultTypes;
};

export const getChapterIdsToUse = (
  chapters: Chapter[],
  subjectId: string,
  classId: string,
  chapterOption: string,
  selectedChapters: string[]
): string[] => {
  const subjectChapters = chapters.filter(
    chapter => chapter.subject_id === subjectId && chapter.class_id === classId
  );

  switch (chapterOption) {
    case 'full_book':
      return subjectChapters.map(c => c.id);
    case 'half_book':
      const halfIndex = Math.ceil(subjectChapters.length / 2);
      return subjectChapters.slice(0, halfIndex).map(c => c.id);
    case 'single_chapter':
    case 'custom':
      return selectedChapters.filter(id => 
        subjectChapters.some(c => c.id === id)
      );
    default:
      return [];
  }
};

export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};