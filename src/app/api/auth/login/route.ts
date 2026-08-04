import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Preencha o e-mail e a senha.' }, { status: 400 });
    }

    // Default admin account credential check (admin@allwhatspy.com / admin123)
    if (email === 'admin@allwhatspy.com' && password === 'admin123') {
      return NextResponse.json({
        success: true,
        user: {
          id: 'admin_default_id',
          name: 'Administrador',
          email: 'admin@allwhatspy.com',
          role: 'admin',
          permissions: [
            'module_whatsapp_disparador',
            'module_whatsapp_config',
            'module_whatsapp_logs',
            'module_email_disparador',
            'module_email_config',
            'module_users_admin',
            'can_start_campaign',
            'can_delete_instance',
            'can_manage_smtp',
            'can_clear_logs',
          ],
        },
      });
    }

    return NextResponse.json({ success: true, message: 'Autenticado' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
