import { normalizeText } from '../verifier';

export type ChunkedPage = {
  pageNumber: number;
  text: string;
};

export type SelectedChunk = {
  pageNumber: number;
  text: string;
  chunkId: string;
  provenance: {
    pageRange: [number, number];
    sectionId: string;
  };
};

export function selectMostRelevantChunk(pages: ChunkedPage[], query: string): SelectedChunk | null {
  const queryTokens = tokens(query);
  const ranked = pages
    .map((page) => ({
      page,
      score: [...queryTokens].filter((token) => tokens(page.text).has(token)).length,
    }))
    .filter((item) => item.score > 0 && normalizeText(item.page.text).length > 0)
    .sort((left, right) => right.score - left.score || left.page.pageNumber - right.page.pageNumber);

  const selected = ranked[0]?.page;
  if (!selected) return null;

  return {
    pageNumber: selected.pageNumber,
    text: normalizeText(selected.text),
    chunkId: `page-${selected.pageNumber}`,
    provenance: {
      pageRange: [selected.pageNumber, selected.pageNumber],
      sectionId: `synthetic-page-${selected.pageNumber}`,
    },
  };
}

function tokens(text: string) {
  return new Set(normalizeText(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}
