import { Injectable } from '@nestjs/common';
import { UpdateUserDTO } from '../common/dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RoleEnum } from '../common/enum/role.enum';
import { Prisma } from '@prisma/client';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { HelperService } from '../common/helper.service';
import { UserDTO } from '../common/dto/user.dto';
import { validate } from 'class-validator';

@Injectable()
export class UserService {
  private readonly userSelect = {
    id: true,
    name: true,
    email: true,
    password: true,
    role: { select: { id: true, name: true } },
  };

  constructor(private readonly prisma: PrismaService) {}

  async create(userData: {
    name: string;
    email: string;
    password: string;
    role: RoleEnum;
  }): Promise<UserDTO> {
    try {
      // check user is exist or not
      const existingUser = await this.findUser({ email: userData.email });

      if (existingUser) {
        throw new CustomAPIError('Email already in use');
      }

      /// hash password
      const hashedPassword = await HelperService.generateHash(
        userData.password,
      );

      // create new user
      const user = await this.prisma.user.create({
        data: {
          name: userData.name,
          email: userData.email,
          password: hashedPassword,
          role: {
            connectOrCreate: {
              where: {
                name: userData.role,
              },
              create: {
                name: userData.role,
              },
            },
          },
          isActive: true,
          lastPasswordResetAt: new Date(),
        },
        select: this.userSelect,
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
      };
    } catch (error) {
      console.error('User creation failed. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new Error('User creation failed.');
    }
  }

  async findAll(): Promise<UserDTO[]> {
    try {
      const users = await this.prisma.user.findMany({
        select: this.userSelect,
      });

      return await Promise.all(
        users.map((user) => this.transformSelectedUserToUser(user)),
      );
    } catch (error) {
      console.error('Users could not retrieved. Error:', error);
      throw new Error('Users could not retrieved.');
    }
  }

  async findById(id: string): Promise<UserDTO | null> {
    try {
      const user = await this.findUser({ id });

      if (!user) return null;

      return await this.transformSelectedUserToUser(user);
    } catch (error) {
      console.error('User could not retrieved. Error:', error);
      throw new Error('User could not retrieved.');
    }
  }

  async findByEmail(email: string): Promise<UserDTO | null> {
    try {
      const user = await this.findUser({ email });

      if (!user) return null;

      return await this.transformSelectedUserToUser(user);
    } catch (error) {
      console.error('User could not retrieved. Error:', error);
      throw new Error('User could not retrieved.');
    }
  }

  private async findUser(where: Prisma.UserWhereUniqueInput) {
    return await this.prisma.user.findUnique({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        isActive: true,
      },
    });
  }

  async update(id: string, updateUserDTO: UpdateUserDTO): Promise<UserDTO> {
    try {
      const { name, email, role, password } = updateUserDTO;
      if (!name && !email && !role && !password) {
        throw new CustomAPIError('No changes provided.');
      }

      const userUpdateObject: Prisma.UserUpdateInput = {};

      if (name) {
        userUpdateObject.name = name;
      }

      if (email) {
        userUpdateObject.email = email;
      }

      if (role) {
        userUpdateObject.role = { connect: { name: role } };
      }

      if (password) {
        userUpdateObject.password = await HelperService.generateHash(password);
        userUpdateObject.lastPasswordResetAt = new Date();
      }

      const user = await this.prisma.user.update({
        where: { id },
        data: userUpdateObject,
        select: this.userSelect,
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
      };
    } catch (error) {
      console.error('User could not be deleted. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new Error('User could not be updated');
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      await this.prisma.user.delete({
        where: { id },
      });
      return { message: 'User deleted successfully' };
    } catch (error) {
      console.error('user could not be deleted. Error:', error);
      throw new Error('User could not be deleted');
    }
  }

  async createPasswordResetToken(userId: string): Promise<{
    token: string;
    expiresAt: Date;
  }> {
    try {
      const disposableToken = HelperService.generateUUID();

      const tenMinutes = 10 * 60 * 1000;

      const expiresAt = new Date(Date.now() + tenMinutes);
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordResetTokens: {
            create: {
              token: disposableToken,
              expiresAt: expiresAt,
            },
          },
        },
      });
      return { token: disposableToken, expiresAt: expiresAt };
    } catch (error) {
      console.error('Password reset token could not be created. Error:', error);
      throw new CustomAPIError('Password reset token could not be created.');
    }
  }

  async resetPassword(
    email: string,
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    try {
      // get password_reset_tokens
      const passwordResetToken =
        await this.prisma.passwordResetToken.findUnique({
          where: { token },
        });

      // check token validty
      if (!passwordResetToken) throw new CustomAPIError('Invalid token');

      // delete disposable password reset token
      await this.prisma.passwordResetToken.delete({ where: { token } });

      // check token expiration
      if (passwordResetToken.expiresAt < new Date(Date.now())) {
        throw new CustomAPIError('Expired token');
      }

      // get user with email
      const user = await this.findUser({ email });

      // check user correctness
      if (!user || user.id !== passwordResetToken.userId)
        throw new CustomAPIError('Invalid email');

      // compare new password with old password
      if (await HelperService.compareHash(newPassword, user.password)) {
        throw new CustomAPIError(
          'New password must be different from the current password. Please try again.',
        );
      }

      // update user password
      await this.update(user.id, { password: newPassword });

      return { message: 'Password reset successfully' };
    } catch (error) {
      console.error('Password could not be reset. Error:', error);

      if (error instanceof CustomAPIError) throw error;

      throw new Error('Password could not be reset.');
    }
  }

  async checkUserWithPassword(
    email: string,
    password: string,
  ): Promise<UserDTO> {
    try {
      const user = await this.findUser({ email });

      if (!user) throw new CustomAPIError('Invalid user credentials');

      const isCorrect = await HelperService.compareHash(
        password,
        user.password,
      );

      if (!isCorrect) throw new CustomAPIError('Invalid user credentials');

      return await this.transformSelectedUserToUser(user);
    } catch (error) {
      console.error('User password check failed. Error:', error);

      if (error instanceof CustomAPIError) throw error;

      throw new Error('User password check failed.');
    }
  }

  private async transformSelectedUserToUser(
    selectedUser: any,
  ): Promise<UserDTO> {
    const user = new UserDTO(
      selectedUser.id,
      selectedUser.name,
      selectedUser.email,
      selectedUser.role.name,
    );

    const errors = await validate(user);

    if (errors.length > 0) {
      console.error('Validation failed. Error:', errors);
      throw new Error('Validation failed');
    }

    return user;
  }
}
