import { NextResponse } from 'next/server';
import { updateBackgroundCampaign } from '@/lib/campaign-runner';
import { requireSession } from '@/lib/server-auth';

export async function PATCH(request: Request) {
  const authError = await requireSession(request, 'can_start_campaign');
  if (authError) return authError;

  try {
    const { campaignId, updates } = await request.json();
    if (typeof campaignId !== 'string' || !updates || typeof updates !== 'object') {
      return NextResponse.json({ success: false, error: 'Campanha e alterações são obrigatórias.' }, { status: 400 });
    }

    const result = updateBackgroundCampaign(campaignId, updates);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Não foi possível atualizar a campanha.' },
      { status: 400 }
    );
  }
}
