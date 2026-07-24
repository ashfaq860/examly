// Old URL — Students moved to /dashboard/students (its own top-level
// sidebar identity, no longer nested under Paper Checker). This redirect
// keeps any existing bookmarks/browser history working.
import { redirect } from 'next/navigation';

export default function OldStudentsPageRedirect() {
  redirect('/dashboard/students');
}
