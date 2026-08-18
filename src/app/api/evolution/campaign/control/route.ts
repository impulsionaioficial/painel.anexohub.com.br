import { NextResponse } from 'next/server';
import { controlCampaign } from '@/lib/campaign-runner';
import { requireSession } from '@/lib/server-auth';

export async function POST(request: Request) {
  const authError = await requireSession(request, 'can_start_campaign');
  if (authError) return authError;
  try {
    const { campaignId, action } = await request.json();

    if (typeof campaignId !== 'string' || !['pause', 'resume', 'stop'].includes(action)) {
      return NextResponse.json({ success: false, error: 'ID da campanha e ação válida são obrigatórios' }, { status: 400 });
    }

    const success = controlCampaign(campaignId, action);
    return NextResponse.json(
      { success, error: success ? undefined : 'Campanha não encontrada ou sem contatos pendentes selecionados.' },
      { status: success ? 200 : 404 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Falha ao controlar campanha.' },
      { status: 400 }
    );
  }
}
