import { v4 as uuidv4 } from 'uuid';
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
}
