import { NextResponse } from 'next/server';
import { startBackgroundCampaign } from '@/lib/campaign-runner';
import { requireSession } from '@/lib/server-auth';
import { assertSafeEvolutionBaseUrl } from '@/lib/network-safety';
import { checkRateLimit } from '@/lib/rate-limit';
import { MAX_MESSAGE_PARTS, splitMessageSequence } from '@/lib/message-sequence';

export async function POST(request: Request) {
  const authError = await requireSession(request, 'can_start_campaign');
  if (authError) return authError;
  const rateLimitError = checkRateLimit(request, 'campaign-start', 10, 60_000);
  if (rateLimitError) return NextResponse.json({ success: false, error: rateLimitError.error }, { status: rateLimitError.status });
  try {
    const { contacts, messageTemplate, minDelay, maxDelay, enableSpintax, baseUrl, apiKey, selectedInstances, attachment, errorPolicy, typingSimulation } = await request.json();

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ success: false, error: 'Selecione contatos para disparar.' });
    }
    if (contacts.length > 1_000) {
      return NextResponse.json({ success: false, error: 'Limite de 1.000 contatos por campanha.' }, { status: 400 });
    }
    if (!contacts.some((contact) => contact && contact.selectedForSending !== false && contact.status !== 'sent')) {
      return NextResponse.json({ success: false, error: 'Marque pelo menos um contato pendente para disparar.' }, { status: 400 });
    }
    if (typeof messageTemplate !== 'string' || messageTemplate.length > 20_000) {
      return NextResponse.json({ success: false, error: 'Mensagem inválida ou acima de 20.000 caracteres.' }, { status: 400 });
    }
    const messageParts = splitMessageSequence(messageTemplate);
    if (messageParts.length === 0 && !attachment?.base64) {
      return NextResponse.json({ success: false, error: 'Digite pelo menos uma mensagem.' }, { status: 400 });
    }
    if (messageParts.length > MAX_MESSAGE_PARTS) {
      return NextResponse.json({ success: false, error: `Use no máximo ${MAX_MESSAGE_PARTS} mensagens por contato.` }, { status: 400 });
    }
    if (attachment?.base64 && String(attachment.base64).length > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'Anexo acima do limite de 7,5 MB.' }, { status: 413 });
    }

    const instancesArray = Array.isArray(selectedInstances) && selectedInstances.length > 0
      ? selectedInstances
      : ['minha_instancia'];
    if (instancesArray.length > 20 || instancesArray.some((instance) => typeof instance !== 'string' || !/^[\w .-]{1,100}$/.test(instance))) {
      return NextResponse.json({ success: false, error: 'Lista de instâncias inválida.' }, { status: 400 });
    }

    const safeMinDelay = Math.max(2, Math.min(3_600, Number(minDelay) || 10));
    const safeMaxDelay = Math.max(safeMinDelay, Math.min(3_600, Number(maxDelay) || 25));

    const safeBaseUrl = baseUrl && !baseUrl.includes('exemplo.com') ? await assertSafeEvolutionBaseUrl(baseUrl) : baseUrl;
    const campaign = startBackgroundCampaign(
      contacts,
      messageTemplate,
      safeMinDelay,
      safeMaxDelay,
      Boolean(enableSpintax),
      instancesArray,
      { baseUrl: safeBaseUrl, apiKey },
      attachment,
      errorPolicy,
      typingSimulation
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
