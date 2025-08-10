import { PrismaService } from 'src/prisma/prisma.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Client } from 'pg';
import { randomUUID } from 'crypto';

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

  private getSchemaDbUrl(): string {
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
}
