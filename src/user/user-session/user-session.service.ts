import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserSessionService {
  constructor(private readonly prisma: PrismaService) {}
  async createSession(userId: string, sessionId: string, tokenHash: string) {
    try {
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      const session = await this.prisma.user_session.create({
        data: {
          user: { connect: { id: userId } },
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

  async deleteSession(userId: string, sessionId: string) {
    try {
      await this.prisma.user_session.delete({
        where: {
          userid: userId,
          sessionid: sessionId,
        },
      });
    } catch (error) {
      console.error('User session delete failed. Error:', error);
      throw new Error('User session delete failed.');
    }
  }

  async updateSession(userId: string, sessionId: string, token: string) {
    try {
      await this.prisma.user_session.update({
        where: {
          userid: userId,
          sessionid: sessionId,
        },
        data: {
          refresh_token: token,
          refresh_required: false,
        },
      });
    } catch (error) {
      console.error('User session update failed. Error:', error);
      throw new Error('User session update failed');
    }
  }
}
