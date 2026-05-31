/**
 * PDF text extraction via pdfjs-dist (browser-only). Used as a fallback for
 * providers that don't support native PDF content blocks (e.g. OpenAI).
 * The worker is served from /public so there's no CDN dependency.
 */
let workerConfigured = false;

export async function extractPdfText(blob: Blob): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerConfigured = true;
  }

  const arrayBuffer = await blob.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: unknown) => {
        const t = item as { str?: string };
        return t.str ?? "";
      })
      .join(" ");
    pages.push(pageText.trim());
  }

  return pages.filter(Boolean).join("\n\n");
}
