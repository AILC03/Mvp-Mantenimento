import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../src/auth/password';

const prisma = new PrismaClient();
const accounts = [
  { username: 'mecanico.prueba.com', name: 'Mecánico de prueba', role: UserRole.LEAD_MECHANIC },
  { username: 'almacen.prueba.com', name: 'Almacén de prueba', role: UserRole.WAREHOUSE_CLERK },
  { username: 'chofer01.prueba.com', name: 'Chofer 01 de prueba', role: UserRole.DRIVER },
  { username: 'admin.prueba.com', name: 'Administrador de prueba', role: UserRole.ADMIN },
];

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('No se permite crear las cuentas de prueba en producción.');
  for (const account of accounts) {
    const existing = await prisma.user.findUnique({ where: { username: account.username } });
    if (existing) {
      console.log(`${account.username}: ya existe; no se modificaron contraseña, rol ni estado.`);
      continue;
    }
    await prisma.user.create({ data: { ...account, passwordHash: await hashPassword('PRUEBA123') } });
    console.log(`${account.username}: creado (${account.role}).`);
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
