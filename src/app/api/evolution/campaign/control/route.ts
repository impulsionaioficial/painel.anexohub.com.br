import { NextResponse } from 'next/server';
import { controlCampaign } from '@/lib/campaign-runner';

export async function POST(request: Request) {
  try {
    const { campaignId, action } = await request.json();

    if (!campaignId || !action) {
      return NextResponse.json({ success: false, error: 'ID da campanha e ação são obrigatórios' });
    }

    const success = controlCampaign(campaignId, action);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
