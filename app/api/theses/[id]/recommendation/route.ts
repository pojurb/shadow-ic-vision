import { NextResponse } from 'next/server';
import { generateDecisionRecommendation } from '@/lib/research/service';
import { isOllamaModelId } from '@/lib/ai/ollama-models';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: thesisId } = await params;
  try {
    const modelId = new URL(request.url).searchParams.get('modelId');
    if (modelId && !isOllamaModelId(modelId)) {
      return NextResponse.json({ error: 'Unsupported model selection.' }, { status: 400 });
    }
    const data = await generateDecisionRecommendation(thesisId, { llmModelId: modelId });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to generate decision recommendation.' },
      { status: 500 }
    );
  }
}
