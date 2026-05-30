/**
 * Turns an analysis's file context sources into native Anthropic content blocks.
 * Images become `image` blocks and PDFs become `document` blocks (base64) — the
 * documented native path, so they work alongside structured outputs. Links and
 * web research are server-tool features handled separately (see P5b).
 */
import { getBlob } from "@/lib/repo";
import type { ContextSource } from "@/lib/domain/types";

/** Loose shape for an Anthropic content block built client-side. */
export interface ApiContentBlock {
  type: string;
  [key: string]: unknown;
}

/** Read a Blob as a bare base64 string (no data: prefix). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Build image/document blocks for every file source whose bytes are still in the
 * blob store. Missing blobs are skipped silently (the source row stays visible so
 * the user can remove it). Returns [] when there are no usable file sources.
 */
export async function buildFileBlocks(sources: ContextSource[]): Promise<ApiContentBlock[]> {
  const blocks: ApiContentBlock[] = [];
  for (const s of sources) {
    if (s.kind !== "file") continue;
    const blob = await getBlob(s.blobId);
    if (!blob) continue;
    const data = await blobToBase64(blob);
    if (s.fileKind === "image") {
      blocks.push({ type: "image", source: { type: "base64", media_type: s.mime, data } });
    } else {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data },
        title: s.name,
      });
    }
  }
  return blocks;
}
