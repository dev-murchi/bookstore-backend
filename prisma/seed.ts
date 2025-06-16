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
    is_active: true,
  },

  {
    name: 'Bilbo Baggins',
    email: 'bilbo@bookstore.com',
    password: 'TookishTales#1937',
    role: 'author',
    is_active: true,
  },
  {
    name: 'Gandalf the White',
    email: 'gandalf@middleearth.com',
    password: 'YouShallNotPass123!',
    role: 'user',
    is_active: true,
  },
];

const booksData = [
  {
    title: 'Ale and Axes: A Dwarf’s Guide to Drinking Across Middle-earth',
    authorid: null,
    categoryid: null,
    isbn: '978-1-111-11111-1',
    price: 15.99,
    description:
      'A hearty travelogue through taverns, tunnels, and toast-worthy tales.',
    stock_quantity: 40,
    rating: 4.7,
    image_url: 'http://example.com/ale-axes.jpg',
    is_active: true,
  },
  {
    title: 'Elven Etiquette: Speaking Lightly and Living Longer',
    authorid: null,
    categoryid: null,
    isbn: '978-1-222-22222-2',
    price: 21.5,
    description:
      'Everything you never asked about Elven manners, music, and mystery.',
    stock_quantity: 33,
    rating: 4.3,
    image_url: 'http://example.com/elven-etiquette.jpg',
    is_active: true,
  },
  {
    title: 'There and Snack Again: A Hungry Hobbit’s Guide',
    authorid: null,
    categoryid: null,
    isbn: '978-1-333-33333-3',
    price: 13.99,
    description: 'Proudfoot Took explores Middle-earth one meal at a time.',
    stock_quantity: 50,
    rating: 4.9,
    image_url: 'http://example.com/snack-again.jpg',
    is_active: true,
  },
  {
    title: 'The Witch-king’s Journal: Confessions of a Fallen King',
    authorid: null,
    categoryid: null,
    isbn: '978-1-444-44444-4',
    price: 17.99,
    description: 'A cursed collection of thoughts, threats, and shrieks.',
    stock_quantity: 20,
    rating: 4.0,
    image_url: 'http://example.com/witchking-journal.jpg',
    is_active: true,
  },
  {
    title: 'Gardens of the Shire: A Hobbit’s Planting Almanac',
    authorid: null,
    categoryid: null,
    isbn: '978-1-555-55555-5',
    price: 12.5,
    description: 'Samwise Gamgee’s notes on turnips, taters, and topsoil.',
    stock_quantity: 45,
    rating: 4.8,
    image_url: 'http://example.com/shire-gardens.jpg',
    is_active: true,
  },
  {
    title: 'Rangers and Recipes: Meals from the Wild',
    authorid: null,
    categoryid: null,
    isbn: '978-1-666-66666-6',
    price: 16.99,
    description:
      'Strider’s foraging cookbook, featuring squirrel stew and lembas pairings.',
    stock_quantity: 25,
    rating: 4.4,
    image_url: 'http://example.com/ranger-recipes.jpg',
    is_active: true,
  },
  {
    title: 'Shadowfax and Me',
    authorid: null,
    categoryid: null,
    isbn: '978-1-777-77777-7',
    price: 14.0,
    description:
      'Gandalf’s reflections on the fastest friendship in Middle-earth.',
    stock_quantity: 38,
    rating: 4.6,
    image_url: 'http://example.com/shadowfax-me.jpg',
    is_active: true,
  },
  {
    title: 'One Does Not Simply: A Memoir',
    authorid: null,
    categoryid: null,
    isbn: '978-1-888-88888-8',
    price: 18.0,
    description:
      'Boromir’s tragic (and occasionally sarcastic) thoughts on destiny.',
    stock_quantity: 30,
    rating: 4.2,
    image_url: 'http://example.com/boromir-memoir.jpg',
    is_active: true,
  },
  {
    title: 'The Lost Scrolls of Númenor',
    authorid: null,
    categoryid: null,
    isbn: '978-1-999-99999-9',
    price: 22.5,
    description:
      'Ancient wisdom, royal maps, and seafaring legends from the West.',
    stock_quantity: 27,
    rating: 4.5,
    image_url: 'http://example.com/numenor-scrolls.jpg',
    is_active: true,
  },
  {
    title: 'Gollum’s Guide to Fine Dining (With Fish)',
    authorid: null,
    categoryid: null,
    isbn: '978-1-000-00000-0',
    price: 11.11,
    description: 'Raw, wriggling, and weird — precious culinary insights.',
    stock_quantity: 13,
    rating: 3.7,
    image_url: 'http://example.com/gollum-cookbook.jpg',
    is_active: true,
  },
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

  const savedCategories = await prisma.category.findMany();
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        is_active: user.is_active,
        name: user.name,
        password: await HelperService.generateHash(user.password),
        role: {
          connect: {
            role_name: user.role,
          },
        },
        last_password_reset_at: new Date(),
      },
      update: {},
    });
  }
  const author = await prisma.user.findUnique({
    where: { email: 'bilbo@bookstore.com' },
  });

  for (const book of booksData) {
    book.authorid = author.id;
    const categoryIndex = Math.floor(Math.random() * savedCategories.length);
    book.categoryid = savedCategories[categoryIndex].id;
    await prisma.books.upsert({
      where: { isbn: book.isbn },
      create: { ...book },
      update: {},
    });
  }
  const bookCount = await prisma.books.count({});
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
