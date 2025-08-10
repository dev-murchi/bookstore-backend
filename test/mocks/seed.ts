import { PrismaService } from 'src/prisma/prisma.service';
import {
  adminUser,
  authorUser,
  resetTargetUser,
  registeredUser,
} from './mock-users';
import { HelperService } from 'src/common/helper.service';

export async function seedUsers(prisma: PrismaService) {
  try {
    for (const user of [
      adminUser,
      authorUser,
      resetTargetUser,
      registeredUser,
    ]) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: {
          email: user.email,
          name: user.name,
          role: {
            connectOrCreate: {
              where: { name: user.role },
              create: { name: user.role },
            },
          },
          lastPasswordResetAt: user.lastPasswordResetAt,
          isActive: user.isActive,
          password: await HelperService.generateHash(user.password),
        },
      });
    }
  } catch (error) {
    console.error('Test user could not be seeded. Error:', error);
    throw new Error('Test user could not be seeded');
  }
}
