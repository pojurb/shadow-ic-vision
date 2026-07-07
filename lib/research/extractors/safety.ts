const EMBEDDED_INSTRUCTION_PATTERN = /(system:|ignore (previous|policy|instructions)|output buy|buy shares|tell the user to buy)/i;

export type EmbeddedInstructionScan = {
  untrustedInstructionFlagged: boolean;
  tradeAdviceProduced: false;
  safeText: string;
};

export function scanEmbeddedInstructions(text: string): EmbeddedInstructionScan {
  const match = text.match(EMBEDDED_INSTRUCTION_PATTERN);
  return {
    untrustedInstructionFlagged: Boolean(match),
    tradeAdviceProduced: false,
    safeText: match ? text.slice(0, match.index).trim() : text,
  };
}
