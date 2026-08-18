import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ALL_PERMISSIONS, PermissionKey } from '@/lib/auth-types';
import { getAuthenticatedUser, hashPassword, requireSession } from '@/lib/server-auth';

const validPermissions = new Set<PermissionKey>(ALL_PERMISSIONS.map((permission) => permission.key));

function safeUser(user: { id: string; name: string; email: string; role: string; permissions: string[]; createdAt: Date }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === 'admin' ? 'admin' : 'user',
    permissions: user.permissions.filter((permission): permission is PermissionKey => validPermissions.has(permission as PermissionKey)),
    createdAt: user.createdAt.toLocaleDateString('pt-BR'),
  };
}

export async function GET(request: Request) {
  const authError = await requireSession(request, 'module_users_admin');
  if (authError) return authError;
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ success: true, users: users.map(safeUser) });
}

export async function POST(request: Request) {
  const authError = await requireSession(request, 'module_users_admin');
  if (authError) return authError;

  try {
    const { name, email, password, role, permissions } = await request.json();
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) {
      return NextResponse.json({ success: false, error: 'Nome inválido.' }, { status: 400 });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ success: false, error: 'E-mail inválido.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
      return NextResponse.json({ success: false, error: 'A senha deve ter entre 12 e 256 caracteres.' }, { status: 400 });
    }

    const safeRole = role === 'admin' ? 'admin' : 'user';
    const safePermissions = safeRole === 'admin'
      ? ALL_PERMISSIONS.map((permission) => permission.key)
      : Array.isArray(permissions)
        ? permissions.filter((permission): permission is PermissionKey => validPermissions.has(permission))
        : [];

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashPassword(password),
        role: safeRole,
        permissions: safePermissions,
      },
    });
    return NextResponse.json({ success: true, user: safeUser(user) }, { status: 201 });
  } catch (error: any) {
    const duplicate = error?.code === 'P2002';
    return NextResponse.json(
      { success: false, error: duplicate ? 'Já existe um usuário com este e-mail.' : 'Não foi possível criar o usuário.' },
      { status: duplicate ? 409 : 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const authError = await requireSession(request, 'module_users_admin');
  if (authError) return authError;

  try {
    const currentUser = await getAuthenticatedUser(request);
    const { id, role, permissions } = await request.json();
    if (typeof id !== 'string' || !id) return NextResponse.json({ success: false, error: 'ID inválido.' }, { status: 400 });
    if (id === currentUser?.id && role && role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Você não pode remover seu próprio acesso administrativo.' }, { status: 400 });
    }

    const safeRole = role === 'admin' ? 'admin' : 'user';
    const safePermissions = safeRole === 'admin'
      ? ALL_PERMISSIONS.map((permission) => permission.key)
      : Array.isArray(permissions)
        ? permissions.filter((permission): permission is PermissionKey => validPermissions.has(permission))
        : [];
    const user = await prisma.user.update({ where: { id }, data: { role: safeRole, permissions: safePermissions } });
    return NextResponse.json({ success: true, user: safeUser(user) });
  } catch {
    return NextResponse.json({ success: false, error: 'Não foi possível atualizar o usuário.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authError = await requireSession(request, 'module_users_admin');
  if (authError) return authError;

  try {
    const currentUser = await getAuthenticatedUser(request);
    const { id } = await request.json();
    if (typeof id !== 'string' || !id) return NextResponse.json({ success: false, error: 'ID inválido.' }, { status: 400 });
    if (id === currentUser?.id) return NextResponse.json({ success: false, error: 'Você não pode excluir sua própria conta.' }, { status: 400 });
    await prisma.$transaction([prisma.session.deleteMany({ where: { userId: id } }), prisma.user.delete({ where: { id } })]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Não foi possível excluir o usuário.' }, { status: 500 });
  }
}
