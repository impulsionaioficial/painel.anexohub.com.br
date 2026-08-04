import { NextResponse } from 'next/server';
import { startBackgroundCampaign } from '@/lib/campaign-runner';

export async function POST(request: Request) {
  try {
    const { contacts, messageTemplate, minDelay, maxDelay, enableSpintax, baseUrl, apiKey, selectedInstances, attachment } = await request.json();

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ success: false, error: 'Selecione contatos para disparar.' });
    }

    const instancesArray = Array.isArray(selectedInstances) && selectedInstances.length > 0
      ? selectedInstances
      : ['minha_instancia'];

    const campaign = startBackgroundCampaign(
      contacts,
      messageTemplate,
      Number(minDelay) || 10,
      Number(maxDelay) || 25,
      Boolean(enableSpintax),
      instancesArray,
      { baseUrl, apiKey },
      attachment
    );

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      message: `Campanha iniciada com rotação entre ${instancesArray.length} instâncias no servidor!`,
      campaign,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Erro ao iniciar campanha no servidor' });
  }
}
