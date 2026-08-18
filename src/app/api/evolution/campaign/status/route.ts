import { NextResponse } from 'next/server';
import { getActiveCampaign, getCampaignById } from '@/lib/campaign-runner';
import { requireSession } from '@/lib/server-auth';

export async function GET(request: Request) {
  const authError = await requireSession(request, 'can_start_campaign');
  if (authError) return authError;
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('id');

    let campaign = campaignId ? getCampaignById(campaignId) : getActiveCampaign();

    if (!campaign) {
      return NextResponse.json({ success: true, hasActive: false, campaign: null });
    }

    const { evolutionConfig: _privateConfig, ...safeCampaign } = campaign;
    void _privateConfig;
    return NextResponse.json({
      success: true,
      hasActive: campaign.status === 'running' || campaign.status === 'paused',
      campaign: safeCampaign,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
