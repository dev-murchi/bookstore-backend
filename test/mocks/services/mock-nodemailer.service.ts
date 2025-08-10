import { Injectable } from '@nestjs/common';

@Injectable()
export class MockNodemailerService {
  async sendMail(email: string, subject: string, text: string, html: string) {
    return { messageId: 'mock-message-id' };
  }
}
