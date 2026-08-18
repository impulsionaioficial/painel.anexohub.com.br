import { NextResponse } from 'next/server';
import { deleteSessionForRequest, SESSION_COOKIE_NAME } from '@/lib/server-auth';

export async function POST(request: Request) {
  await deleteSessionForRequest(request).catch(() => undefined);
  const response = NextResponse.json({ success: true, message: 'Sessão encerrada' });
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete('awp_session_user');
  return response;
}
