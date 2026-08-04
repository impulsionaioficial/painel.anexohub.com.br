import { NextResponse } from 'next/server';
import { getActiveCampaign, getCampaignById } from '@/lib/campaign-runner';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('id');

    let campaign = campaignId ? getCampaignById(campaignId) : getActiveCampaign();

    if (!campaign) {
      return NextResponse.json({ success: true, hasActive: false, campaign: null });
    }

    return NextResponse.json({
      success: true,
      hasActive: campaign.status === 'running' || campaign.status === 'paused',
      campaign,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
