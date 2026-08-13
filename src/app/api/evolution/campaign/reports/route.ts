import { NextResponse } from 'next/server';
import { getAllServerCampaignReports } from '@/lib/campaign-runner';

export async function GET() {
  try {
    const reports = getAllServerCampaignReports();
    return NextResponse.json({
      success: true,
      reports,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao buscar relatórios do servidor',
      reports: [],
    });
  }
}
