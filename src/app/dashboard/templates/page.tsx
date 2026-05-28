// src/app/dashboard/templates/page.tsx
// TemplateManager requires props and cannot be a standalone Next.js page.
// It is rendered from within the paper builder flow.
'use client';

export default function TemplatesPage() {
  return (
    <div className="container py-5 text-center text-muted">
      <h2>Templates</h2>
      <p>Templates are managed from within the paper builder.</p>
    </div>
  );
}
