import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// MCQ grading is deterministic (fiducial homography + bubble-darkness
// sampling) and must cost ZERO Claude tokens — no vision call should ever
// be needed to score a bubble sheet. This is a source-text regression
// guard, not a mock-based unit test: a future edit that reintroduces a
// model call into this file (even indirectly, via callClaudeJson) fails
// this test immediately, rather than only showing up as a cost regression
// weeks later.
describe('gradeMcq.ts never calls Claude', () => {
  it('does not call callClaudeJson anywhere in its source', () => {
    const source = readFileSync(join(__dirname, 'gradeMcq.ts'), 'utf8');
    expect(source).not.toMatch(/callClaudeJson\s*\(/);
  });

  it('only imports from claude.ts for error classification, not for making calls', () => {
    const source = readFileSync(join(__dirname, 'gradeMcq.ts'), 'utf8');
    const claudeImportMatch = source.match(/import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/checker\/claude['"]/);
    expect(claudeImportMatch).not.toBeNull();
    const importedNames = (claudeImportMatch?.[1] ?? '').split(',').map(s => s.trim());
    for (const name of importedNames) {
      expect(['describeClaudeError', 'ErrorKind']).toContain(name);
    }
  });
});
