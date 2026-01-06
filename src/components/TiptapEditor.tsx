// src/components/TiptapEditor.tsx
'use client';

import { useEditor } from '@tiptap/react';
import { RichTextEditor } from '@mantine/tiptap';
import StarterKit from '@tiptap/starter-kit';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function TiptapEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '<p></p>',
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'border rounded p-2', // optional bootstrap styling
      },
    },
    immediatelyRender: false, // important for Next.js SSR
  });

  // ✅ Render only when editor is ready
  if (!editor) return <div>Loading editor...</div>;

  return <RichTextEditor editor={editor} placeholder={placeholder} />;
}
