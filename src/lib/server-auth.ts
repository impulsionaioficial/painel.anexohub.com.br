import crypto from 'crypto';
import { prisma } from './prisma';
import { UserAccount, ALL_PERMISSIONS } from './auth-types';

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'ALLWHATSPY_SALT_2026').digest('hex');
}

export async function seedAdminUserIfEmpty(): Promise<void> {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      const allPerms = ALL_PERMISSIONS.map((p) => p.key);
      await prisma.user.create({
        data: {
          name: 'Administrador',
          email: 'admin@allwhatspy.com',
          password: hashPassword('admin123'),
          role: 'admin',
          permissions: allPerms,
        },
      });
      console.log('🟢 Admin user seeded into PostgreSQL DB.');
    }
  } catch (err) {
    console.error('Error seeding admin user:', err);
  }
}

export async function authenticateUserServer(email: string, passwordRaw: string): Promise<UserAccount | null> {
  await seedAdminUserIfEmpty();
  const hashedPassword = hashPassword(passwordRaw);

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (!user || user.password !== hashedPassword) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as any,
    permissions: user.permissions as any,
    createdAt: user.createdAt.toLocaleDateString('pt-BR'),
  };
}
