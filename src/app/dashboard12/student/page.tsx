'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

type Profile = {
  id: string;
  email: string;
  name?: string;
  role: string;
  class?: string;
  subject?: string;
};

type Quiz = {
  id: string;
  title: string;
  description: string;
};

export default function StudentDashboard() {
  const router = useRouter();

  // Auth & Profile State
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authorized, setAuthorized] = useState(false);

  // Editable profile fields
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');

  // Quiz & Analytics stub states
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loadingSave, setLoadingSave] = useState(false);

  // On mount: check user & role, load profile & quizzes
  useEffect(() => {
    async function fetchUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Please login first');
        router.push('/auth/login');
        return;
      }

      // Load profile
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error || !profileData) {
        toast.error('Could not fetch profile');
        router.push('/auth/login');
        return;
      }

      if (profileData.role !== 'student') {
        toast.error('Access denied: Not a student');
        router.push('/auth/login');
        return;
      }

      setProfile(profileData);
      setName(profileData.name ?? '');
      setClassName(profileData.class ?? '');
      setSubject(profileData.subject ?? '');

      setAuthorized(true);
      setLoadingAuth(false);

      // Load quizzes (example stub: replace with your real query)
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('student_id', user.id); // assuming quizzes table

      if (!quizError && quizData) setQuizzes(quizData);
    }

    fetchUser();
  }, [router]);

  if (loadingAuth) return <div className="container mt-5">Loading...</div>;
  if (!authorized) return null;

  // Save profile changes handler
  async function handleSaveProfile() {
    setLoadingSave(true);
    if (!profile) return;

    const { error } = await supabase.from('profiles').update({
      name,
      class: className,
      subject,
    }).eq('id', profile.id);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated');
      setProfile({ ...profile, name, class: className, subject });
    }
    setLoadingSave(false);
  }

  return (
    <div className="container mt-5">
      <h1 className="mb-4">Student Dashboard</h1>

      <section className="mb-5">
        <h2>Profile</h2>
        <div className="mb-3">
          <label className="form-label">Email (readonly)</label>
          <input
            type="email"
            className="form-control"
            value={profile?.email}
            disabled
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Full Name</label>
          <input
            type="text"
            className="form-control"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter your full name"
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Class</label>
          <input
            type="text"
            className="form-control"
            value={className}
            onChange={e => setClassName(e.target.value)}
            placeholder="Enter your class (e.g. 10th Grade)"
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Subject</label>
          <input
            type="text"
            className="form-control"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Favorite subject"
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSaveProfile}
          disabled={loadingSave}
        >
          {loadingSave ? 'Saving...' : 'Save Profile'}
        </button>
      </section>

      <section className="mb-5">
        <h2>Quizzes</h2>
        {quizzes.length === 0 && <p>No quizzes assigned yet.</p>}
        <ul className="list-group">
          {quizzes.map((quiz) => (
            <li key={quiz.id} className="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <strong>{quiz.title}</strong>
                <p className="mb-0">{quiz.description}</p>
              </div>
              <button className="btn btn-outline-primary btn-sm">Take Quiz</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-5">
        <h2>Analytics</h2>
        <p>Coming soon: Weekly progress and strong/weak areas visualization.</p>
      </section>
    </div>
  );
}
