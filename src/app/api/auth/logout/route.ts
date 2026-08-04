import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Sessão encerrada' });
  response.cookies.delete('awp_session_user');
  return response;
}
