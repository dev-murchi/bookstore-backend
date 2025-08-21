import { PrismaService } from 'src/prisma/prisma.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import { HelperService } from 'src/common/helper.service';

export interface MockUserType {
  email: string;
  name: string;
  role: string;
  password: string;
  isActive?: boolean;
}

export interface MockBookType {
  title: string;
  author: string;
  description?: string;
  isbn: string;
  price: number;
  categoryId: number;
  isActive?: boolean;
  stockQuantity: number;
  imageUrl?: string;
}

const execAsync = promisify(exec);

export class TestDBManager {
  private schemaName: string;
  private prismaService: PrismaService | null = null;
  private baseDbUrl: string;

  constructor(baseDbUrl: string) {
    this.baseDbUrl = baseDbUrl;
    const workerId = process.env.JEST_WORKER_ID ?? '1';
    this.schemaName = `test_schema_${workerId}_${randomUUID().replace(/-/g, '')}`;
  }

  private async createSchema() {
    const client = new Client({ connectionString: this.baseDbUrl });
    await client.connect();

    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${this.schemaName}"`);
    } finally {
      await client.end();
    }
  }

  private async dropSchema() {
    const client = new Client({ connectionString: this.baseDbUrl });
    await client.connect();

    try {
      await client.query(`DROP SCHEMA IF EXISTS "${this.schemaName}" CASCADE`);
    } finally {
      await client.end();
    }
  }

  public getSchemaDbUrl(): string {
    const url = new URL(this.baseDbUrl);
    url.searchParams.set('schema', this.schemaName);
    return url.toString();
  }

  private async resetAndMigrate() {
    const schemaDbUrl = this.getSchemaDbUrl();

    const command = `DATABASE_URL="${schemaDbUrl}" npx prisma db push --force-reset`;

    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      console.error('Migration stderr:', stderr);
    }
    console.log('Migration stdout:', stdout);
  }

  async setup() {
    await this.createSchema();
    await this.resetAndMigrate();

    this.prismaService = new PrismaService(this.getSchemaDbUrl());
    await this.prismaService.$connect();

    return this.prismaService;
  }

  async teardown() {
    if (this.prismaService) {
      await this.prismaService.$disconnect();
      this.prismaService = null;
    }

    await this.dropSchema();
  }

  async seedUsers(users: MockUserType[]): Promise<void> {
    if (!this.prismaService) {
      throw new Error('Database not initialized');
    }
    for (const user of users) {
      await this.prismaService.user.upsert({
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
          lastPasswordResetAt: new Date(),
          isActive: user.isActive,
          password: await HelperService.generateHash(user.password),
        },
      });
    }
  }

  // seed categories
  async seedCategories(categories: { name: string }[]): Promise<void> {
    if (!this.prismaService) {
      throw new Error('Database not initialized');
    }
    for (const category of categories) {
      await this.prismaService.category.upsert({
        where: { name: category.name },
        update: {},
        create: { name: category.name },
      });
    }
  }
  // seed books
  async seedBooks(books: MockBookType[]): Promise<void> {
    if (!this.prismaService) {
      throw new Error('Database not initialized');
    }
    try {
      for (const book of books) {
        await this.prismaService.book.upsert({
          where: { isbn: book.isbn },
          update: {},
          create: {
            title: book.title,
            isbn: book.isbn,
            price: book.price,
            stockQuantity: book.stockQuantity,
            isActive: book.isActive,
            description: book.description,
            imageUrl: book.imageUrl,
            author: {
              connect: { email: book.author },
            },
            category: {
              connect: { id: book.categoryId },
            },
          },
        });
      }
    } catch (error) {
      console.error('Error seeding books:', error);
      throw error;
    }
  }
}
