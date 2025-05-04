import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RoleEnum } from '../common/role.enum';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { Password } from '../common/password';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private passwordProvider: Password,
  ) {}

  async create(createUserDto: CreateUserDto, role: RoleEnum) {
    try {
      // check user is exist or not
      const user = await this.prisma.user.findUnique({
        where: {
          email: createUserDto.email,
        },
      });

      if (user) {
        throw new CustomAPIError('Email already in use');
      }

      /// hash password
      const hashedPassword = await this.passwordProvider.generate(
        createUserDto.password,
      );

      // create new user
      await this.prisma.user.create({
        data: {
          name: createUserDto.name,
          email: createUserDto.email,
          password: hashedPassword,
          role: {
            connectOrCreate: {
              where: {
                role_name: role,
              },
              create: {
                role_name: role,
              },
            },
          },
          is_active: true,
        },
      });

      return { message: 'User registered successfully' };
    } catch (error) {
      console.error('User creation failed. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new CustomAPIError('User creation failed.');
    }
  }

  async findAll() {
    try {
      const users = await this.prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          roleid: true,
          is_active: true,
        },
      });

      return users;
    } catch (error) {
      console.log('Users could not fetched. Error:', error);
      throw new CustomAPIError('Users could not fetched');
    }
  }

  async findOne(id: number) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          password: true,
          role: {
            select: {
              id: true,
              role_name: true,
            },
          },
          is_active: true,
          cart: true,
        },
      });

      return user;
    } catch (error) {
      console.log('User could not be fetched. Error:', error);
      throw new CustomAPIError('User could not be fetched.');
    }
  }

  async findBy(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          password: true,
          role: {
            select: {
              id: true,
              role_name: true,
            },
          },
          is_active: true,
          cart: true,
        },
      });

      return user;
    } catch (error) {
      console.log('User could not be fetched. Error:', error);
      throw new CustomAPIError('User could not be fetched.');
    }
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    try {
      const { name, email, role, password } = updateUserDto;
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
        userUpdateObject.role = { connect: { role_name: role } };
      }

      if (password) {
        userUpdateObject.password =
          await this.passwordProvider.generate(password);
      }

      await this.prisma.user.update({
        where: { id },
        data: userUpdateObject,
      });
      return { message: 'User updated successfully' };
    } catch (error) {
      console.error('User could not be deleted. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new CustomAPIError('User could not be updated');
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.user.delete({
        where: { id },
      });
      return { message: 'User deleted successfully' };
    } catch (error) {
      console.error('user could not be deleted. Error:', error);
      throw new CustomAPIError('User could not be deleted');
    }
  }

  async createPasswordResetToken(userId: number) {
    try {
      const disposableToken = uuidv4();

      const tenMinutes = 10 * 60 * 1000;

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          password_reset_tokens: {
            create: {
              token: disposableToken,
              expires_at: new Date(Date.now() + tenMinutes),
            },
          },
        },
      });
      return disposableToken;
    } catch (error) {
      console.error('Password reset token could not be created. Error:', error);
      throw new CustomAPIError('Password reset token could not be created.');
    }
  }

  async resetPassword(email: string, token: string, newPassword: string) {
    try {
      // get password_reset_tokens
      const passwordResetToken =
        await this.prisma.password_reset_tokens.findUnique({
          where: { token },
        });

      // check token validty
      if (!passwordResetToken) throw new CustomAPIError('Invalid token');

      // delete disposable password reset token
      await this.prisma.password_reset_tokens.delete({ where: { token } });

      // check token expiration
      if (passwordResetToken.expires_at < new Date(Date.now())) {
        throw new CustomAPIError('Expired token');
      }

      // get user with email
      const user = await this.findBy(email);

      // check user correctness
      if (user.id !== passwordResetToken.userid)
        throw new CustomAPIError('Invalid email');

      // compare new password with old password
      if (await this.passwordProvider.compare(newPassword, user.password)) {
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

      throw new CustomAPIError('Password could not be reset.');
    }
  }
}
