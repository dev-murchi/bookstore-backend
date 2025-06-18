import { PrismaClient } from '@prisma/client';
import { HelperService } from '../src/common/helper.service';
const prisma = new PrismaClient();
const roles = ['admin', 'user', 'author'];

const categories = [
  'history',
  'fiction',
  'travel',
  'action-and-adventure',
  'comedy',
  'crime-and-mystery',
  'horror',
  'science-fiction',
  'nonfiction',
];

const users = [
  {
    name: 'Sauron the Dark Lord',
    email: 'sauron@bookstore.com',
    password: 'EyeSeeAll!',
    role: 'admin',
    isActive: true,
  },

  {
    name: 'Bilbo Baggins',
    email: 'bilbo@bookstore.com',
    password: 'TookishTales#1937',
    role: 'author',
    isActive: true,
  },
  {
    name: 'Gandalf the White',
    email: 'gandalf@middleearth.com',
    password: 'YouShallNotPass123!',
    role: 'user',
    isActive: true,
  },
];

const booksData = [
  {
    title: 'Ale and Axes: A Dwarf’s Guide to Drinking Across Middle-earth',
    authorId: null,
    categoryId: null,
    isbn: '978-1-111-11111-1',
    price: 15.99,
    description:
      'A hearty travelogue through taverns, tunnels, and toast-worthy tales.',
    stockQuantity: 40,
    rating: 4.7,
    imageUrl: 'http://example.com/ale-axes.jpg',
    isActive: true,
  },
  {
    title: 'Elven Etiquette: Speaking Lightly and Living Longer',
    authorId: null,
    categoryId: null,
    isbn: '978-1-222-22222-2',
    price: 21.5,
    description:
      'Everything you never asked about Elven manners, music, and mystery.',
    stockQuantity: 33,
    rating: 4.3,
    imageUrl: 'http://example.com/elven-etiquette.jpg',
    isActive: true,
  },
  {
    title: 'There and Snack Again: A Hungry Hobbit’s Guide',
    authorId: null,
    categoryId: null,
    isbn: '978-1-333-33333-3',
    price: 13.99,
    description: 'Proudfoot Took explores Middle-earth one meal at a time.',
    stockQuantity: 50,
    rating: 4.9,
    imageUrl: 'http://example.com/snack-again.jpg',
    isActive: true,
  },
  {
    title: 'The Witch-king’s Journal: Confessions of a Fallen King',
    authorId: null,
    categoryId: null,
    isbn: '978-1-444-44444-4',
    price: 17.99,
    description: 'A cursed collection of thoughts, threats, and shrieks.',
    stockQuantity: 20,
    rating: 4.0,
    imageUrl: 'http://example.com/witchking-journal.jpg',
    isActive: true,
  },
  {
    title: 'Gardens of the Shire: A Hobbit’s Planting Almanac',
    authorId: null,
    categoryId: null,
    isbn: '978-1-555-55555-5',
    price: 12.5,
    description: 'Samwise Gamgee’s notes on turnips, taters, and topsoil.',
    stockQuantity: 45,
    rating: 4.8,
    imageUrl: 'http://example.com/shire-gardens.jpg',
    isActive: true,
  },
  {
    title: 'Rangers and Recipes: Meals from the Wild',
    authorId: null,
    categoryId: null,
    isbn: '978-1-666-66666-6',
    price: 16.99,
    description:
      'Strider’s foraging cookbook, featuring squirrel stew and lembas pairings.',
    stockQuantity: 25,
    rating: 4.4,
    imageUrl: 'http://example.com/ranger-recipes.jpg',
    isActive: true,
  },
  {
    title: 'Shadowfax and Me',
    authorId: null,
    categoryId: null,
    isbn: '978-1-777-77777-7',
    price: 14.0,
    description:
      'Gandalf’s reflections on the fastest friendship in Middle-earth.',
    stockQuantity: 38,
    rating: 4.6,
    imageUrl: 'http://example.com/shadowfax-me.jpg',
    isActive: true,
  },
  {
    title: 'One Does Not Simply: A Memoir',
    authorId: null,
    categoryId: null,
    isbn: '978-1-888-88888-8',
    price: 18.0,
    description:
      'Boromir’s tragic (and occasionally sarcastic) thoughts on destiny.',
    stockQuantity: 30,
    rating: 4.2,
    imageUrl: 'http://example.com/boromir-memoir.jpg',
    isActive: true,
  },
  {
    title: 'The Lost Scrolls of Númenor',
    authorId: null,
    categoryId: null,
    isbn: '978-1-999-99999-9',
    price: 22.5,
    description:
      'Ancient wisdom, royal maps, and seafaring legends from the West.',
    stockQuantity: 27,
    rating: 4.5,
    imageUrl: 'http://example.com/numenor-scrolls.jpg',
    isActive: true,
  },
  {
    title: 'Gollum’s Guide to Fine Dining (With Fish)',
    authorId: null,
    categoryId: null,
    isbn: '978-1-000-00000-0',
    price: 11.11,
    description: 'Raw, wriggling, and weird — precious culinary insights.',
    stockQuantity: 13,
    rating: 3.7,
    imageUrl: 'http://example.com/gollum-cookbook.jpg',
    isActive: true,
  },
];

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        name: role,
      },
      create: {
        name: role,
      },
      update: {},
    });
  }
  for (const category of categories) {
    await prisma.category.upsert({
      where: {
        name: category,
      },
      create: {
        name: category,
      },
      update: {},
    });
  }

  const savedCategories = await prisma.category.findMany();
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        isActive: user.isActive,
        name: user.name,
        password: await HelperService.generateHash(user.password),
        role: {
          connect: {
            name: user.role,
          },
        },
        lastPasswordResetAt: new Date(),
      },
      update: {},
    });
  }
  const author = await prisma.user.findUnique({
    where: { email: 'bilbo@bookstore.com' },
  });

  for (const book of booksData) {
    book.authorId = author.id;
    const categoryIndex = Math.floor(Math.random() * savedCategories.length);
    book.categoryId = savedCategories[categoryIndex].id;
    await prisma.book.upsert({
      where: { isbn: book.isbn },
      create: { ...book },
      update: {},
    });
  }
  const bookCount = await prisma.book.count({});
  const userCount = await prisma.user.count({});
  console.log({ bookCount, userCount });
  console.log('Books have been seeded successfully!');
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
