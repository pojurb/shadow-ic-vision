export const OLLAMA_MODEL_IDS = [
  'gemini-3-flash-preview',
  'kimi-k2.7-code:cloud',
  'qwen3.5:cloud',
  'deepseek-v4-pro:cloud',
  'deepseek-v4-flash:cloud',
  'minimax-m3:cloud',
] as const;

export type OllamaModelId = typeof OLLAMA_MODEL_IDS[number];

export const OLLAMA_MODEL_EVAL_ORDER = [
  'kimi-k2.7-code:cloud',
  'gemini-3-flash-preview',
  'deepseek-v4-pro:cloud',
  'deepseek-v4-flash:cloud',
  'qwen3.5:cloud',
  'minimax-m3:cloud',
] as const satisfies ReadonlyArray<OllamaModelId>;

export const OLLAMA_MODEL_OPTIONS = [
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview',
    description: 'Multimodal, fast preview model for text and image workflows.',
    vision: true,
    contextLimit: 128_000,
  },
  {
    id: 'kimi-k2.7-code:cloud',
    label: 'Kimi K2.7 Code',
    description: 'Multimodal code-heavy model with image support.',
    vision: true,
    contextLimit: 128_000,
  },
  {
    id: 'qwen3.5:cloud',
    label: 'Qwen 3.5',
    description: 'Balanced multimodal model for general thesis work.',
    vision: true,
    contextLimit: 128_000,
  },
  {
    id: 'deepseek-v4-pro:cloud',
    label: 'DeepSeek V4 Pro',
    description: 'High-reasoning text model with long context.',
    vision: true,
    contextLimit: 128_000,
  },
  {
    id: 'deepseek-v4-flash:cloud',
    label: 'DeepSeek V4 Flash',
    description: 'Faster, lighter text model for routine work.',
    vision: true,
    contextLimit: 128_000,
  },
  {
    id: 'minimax-m3:cloud',
    label: 'MiniMax M3',
    description: 'Premium multimodal model for image and long-context work.',
    vision: true,
    contextLimit: 128_000,
  },
] as const satisfies ReadonlyArray<{
  id: OllamaModelId;
  label: string;
  description: string;
  vision: boolean;
  contextLimit: number;
}>;

const OLLAMA_MODEL_ID_SET = new Set<string>(OLLAMA_MODEL_IDS);

export function isOllamaModelId(value: unknown): value is OllamaModelId {
  return typeof value === 'string' && OLLAMA_MODEL_ID_SET.has(value);
}

export function getOllamaModelOption(modelId: string | null | undefined) {
  return OLLAMA_MODEL_OPTIONS.find((option) => option.id === modelId) ?? null;
}

export function getOllamaModelEvalOrder() {
  return [...OLLAMA_MODEL_EVAL_ORDER];
}
