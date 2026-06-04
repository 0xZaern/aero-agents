/**
 * mergeFiles.ts - merges AI-extracted files with user overrides.
 *   deleted   → excluded
 *   edit      → user content wins, unless the AI wrote a newer version after the
 *               edit (then AI wins, since it already saw the edit via context)
 *   created   → user file
 *   no override → source 'ai'
 * Ported from an earlier prototype.
 */

import type { ExtractedFile, FileOverride, MergedFile } from "./types";

export function mergeFiles(extracted: ExtractedFile[], overrides: FileOverride[]): MergedFile[] {
  const overrideMap = new Map<string, FileOverride>();
  for (const ov of overrides) overrideMap.set(ov.filePath, ov);

  const extractedMap = new Map<string, ExtractedFile>();
  for (const ef of extracted) extractedMap.set(ef.path, ef);

  const result: MergedFile[] = [];

  for (const ef of extracted) {
    const ov = overrideMap.get(ef.path);

    if (!ov) {
      result.push({ path: ef.path, content: ef.content, language: ef.language, source: "ai", createdAt: ef.createdAt });
      continue;
    }
    if (ov.source === "deleted") continue;

    const aiTime = new Date(ef.createdAt).getTime();
    const editTime = new Date(ov.updatedAt).getTime();
    if (!isNaN(aiTime) && !isNaN(editTime) && aiTime > editTime) {
      result.push({ path: ef.path, content: ef.content, language: ef.language, source: "ai", createdAt: ef.createdAt });
      continue;
    }

    result.push({
      path: ef.path,
      content: ov.content,
      language: ov.language,
      source: "edit",
      overrideId: ov.id,
      originalContent: ef.content,
      createdAt: ov.createdAt,
    });
  }

  // overrides with no matching AI file (user-created files / stray tombstones)
  for (const ov of overrides) {
    if (extractedMap.has(ov.filePath) || ov.source === "deleted") continue;
    result.push({
      path: ov.filePath,
      content: ov.content,
      language: ov.language,
      source: ov.source === "created" ? "created" : "edit",
      overrideId: ov.id,
      createdAt: ov.createdAt,
    });
  }

  return result.sort((a, b) => a.path.localeCompare(b.path));
}
