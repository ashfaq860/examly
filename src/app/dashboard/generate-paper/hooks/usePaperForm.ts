// src/app/dashboard/generate-paper/hooks/usePaperForm.ts (Updated)
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { paperSchema, PaperFormData, defaultFormValues } from '../schema/paperSchema';
import { useApiCache } from './useApiCache';
import { fetchSubjectRules } from '@/lib/questionRules';
import { Class, Subject, Chapter, RuleValidation } from '@/types/types';

export const usePaperForm = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subjectRules, setSubjectRules] = useState<any[]>([]);
  const [ruleValidation, setRuleValidation] = useState<RuleValidation>({
    isValid: true,
    missing: {},
    warnings: []
  });
  const [isLoading, setIsLoading] = useState(true);

  const { cachedGet } = useApiCache();

  const form = useForm<PaperFormData>({
    resolver: zodResolver(paperSchema),
    defaultValues: defaultFormValues,
  });

  const watchedClassId = form.watch('classId');
  const watchedSubjectId = form.watch('subjectId');
  const watchedChapterOption = form.watch('chapterOption');
  const watchedSelectedChapters = form.watch('selectedChapters');

  // Initialize with institution name
  useEffect(() => {
    const loadInstitutionName = async () => {
      try {
        const data = await cachedGet('/api/instituteName');
        form.setValue('title', data?.profile?.institution || 'BISE LAHORE');
      } catch (error) {
        console.error('Error loading institution name:', error);
        form.setValue('title', 'BISE LAHORE');
      } finally {
        setIsLoading(false);
      }
    };
    loadInstitutionName();
  }, [form, cachedGet]);

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const data = await cachedGet('/api/classes');
        setClasses(data || []);
      } catch (error) {
        console.error('Error fetching classes:', error);
        setClasses([]);
      }
    };
    fetchClasses();
  }, [cachedGet]);

  // Fetch subjects when class changes
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!watchedClassId) {
        setSubjects([]);
        return;
      }
      try {
        const data = await cachedGet(`/api/subjects?classId=${watchedClassId}`);
        setSubjects(data || []);
      } catch (error) {
        console.error('Error fetching subjects:', error);
        setSubjects([]);
      }
    };
    fetchSubjects();
  }, [watchedClassId, cachedGet]);

  // Fetch chapters when subject changes
  useEffect(() => {
    const fetchChapters = async () => {
      if (!watchedSubjectId || !watchedClassId) {
        setChapters([]);
        return;
      }
      try {
        const data = await cachedGet(
          `/api/chapters?subjectId=${watchedSubjectId}&classId=${watchedClassId}`
        );
        setChapters(data || []);
      } catch (error) {
        console.error('Error fetching chapters:', error);
        setChapters([]);
      }
    };
    fetchChapters();
  }, [watchedSubjectId, watchedClassId, cachedGet]);

  // Fetch subject rules
  useEffect(() => {
    const fetchRules = async () => {
      if (!watchedSubjectId || !watchedClassId) {
        setSubjectRules([]);
        return;
      }
      try {
        const rules = await fetchSubjectRules(watchedSubjectId, watchedClassId);
        setSubjectRules(rules || []);
      } catch (error) {
        console.error('Error fetching subject rules:', error);
        setSubjectRules([]);
      }
    };
    fetchRules();
  }, [watchedSubjectId, watchedClassId]);

  // Clear subject when class changes
  useEffect(() => {
    if (watchedClassId) {
      form.setValue('subjectId', '');
      setSubjects([]);
      setChapters([]);
    }
  }, [watchedClassId, form]);

  // Clear chapters when subject changes
  useEffect(() => {
    if (watchedSubjectId) {
      form.setValue('selectedChapters', []);
      setChapters([]);
    }
  }, [watchedSubjectId, form]);

  return {
    form,
    classes,
    subjects,
    chapters,
    subjectRules,
    ruleValidation,
    setRuleValidation,
    isLoading,
    watchedClassId,
    watchedSubjectId,
    watchedChapterOption,
    watchedSelectedChapters,
  };
};