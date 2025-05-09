import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
const roundsOfHashing = 10;

export class HelperService {
  static slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with -
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  static generateUUID(): string {
    return uuidv4();
  }

  static async generateHash(data: string | Buffer): Promise<string> {
    try {
      return await bcrypt.hash(data, roundsOfHashing);
    } catch (error) {
      console.error('Password generation failed. Error:', error);
      throw new Error('Password generation failed.');
    }
  }

  static async compareHash(
    data: string | Buffer,
    encrypted: string,
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(data, encrypted);
    } catch (error) {
      console.error('Comparison failed. Error:', error);
      throw new Error('comparison failed.');
    }
  }
}
