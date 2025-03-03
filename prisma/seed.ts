import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const roles = ['admin', 'client', 'author', 'user'];
const categories = [
  'history',
  'fiction',
  'action-and-adventure',
  'comedy',
  'crime-and-mystery',
  'horror',
  'science-fiction',
  'nonfiction',
];
async function main() {
  for (const role of roles) {
    await prisma.roles.upsert({
      where: {
        role_name: role,
      },
      create: {
        role_name: role,
      },
      update: {},
    });
  }

  for (const category of categories) {
    await prisma.category.upsert({
      where: {
        category_name: category,
      },
      create: {
        category_name: category,
      },
      update: {},
    });
  }

  const savedRoles = await prisma.roles.findMany({
    select: { role_name: true },
  });

  const savedCategories = await prisma.category.findMany({
    select: { category_name: true },
  });

  console.log({ savedRoles, savedCategories });
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
