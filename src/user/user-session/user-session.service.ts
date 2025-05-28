import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserSessionService {
  constructor(private readonly prisma: PrismaService) {}
  async createSession(userId: string, sessionId: string, tokenHash: string) {
    try {
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      const session = await this.prisma.user_session.create({
        data: {
          user: { connect: { userid: userId } },
          sessionid: sessionId,
          refresh_token: tokenHash,
          refresh_required: false,
          expires_at: new Date(Date.now() + oneWeekMs),
        },
      });

      return session;
    } catch (error) {
      console.error('User session creation failed. Error:', error);
      throw new Error('User session creation failed.');
    }
  }
}
