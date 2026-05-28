// src/app/admin/templates/page.tsx
// TemplateManager is a component that requires props (currentConfig,
// onTemplateSelect, onClose) — it cannot be used as a standalone Next.js
// page. It is rendered from within the paper builder flow.
// This page acts as a placeholder for the /admin/templates route.
'use client';

export default function TemplatesPage() {
  return (
    <div className="container py-5 text-center text-muted">
      <h2>Templates</h2>
      <p>Templates are managed from within the paper builder.</p>
    </div>
  );
}
