import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RoleEnum } from '../common/role.enum';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const roundsOfHashing = 10;
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, role: RoleEnum) {
    // check user is exist or not
    const user = await this.prisma.user.findUnique({
      where: {
        email: createUserDto.email,
      },
    });

    if (user) {
      throw new BadRequestException('Email already in use');
    }

    // hash password
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      roundsOfHashing,
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
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        roleid: true,
        is_active: true,
      },
    });

    if (!users) return [];
    return users;
  }

  async findOne(id: number) {
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
    if (!user) throw new Error('User not found.');
    return user;
  }

  async findBy(email: string) {
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
      },
    });
    if (!user) throw new Error('User not found.');
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    try {
      const { name, email, role, password } = updateUserDto;
      if (!name && !email && !role && !password) {
        throw new Error('No changes provided.');
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
        userUpdateObject.password = await bcrypt.hash(
          password,
          roundsOfHashing,
        );
      }

      await this.prisma.user.update({
        where: { id },
        data: userUpdateObject,
      });
      return { message: 'User updated successfully' };
    } catch (error) {
      console.error('User could not be deleted. Error:', error);
      throw new BadRequestException('User could not be updated');
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.user.delete({
        where: { id },
      });
      return { message: 'User deleted successfully' };
    } catch (error) {
      throw new BadRequestException('User could not be deleted');
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
      throw new Error('Password reset token could not be created.');
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
      if (!passwordResetToken) throw new BadRequestException('Invalid token');

      // delete disposable password reset token
      await this.prisma.password_reset_tokens.delete({ where: { token } });

      // check token expiration
      if (passwordResetToken.expires_at < new Date(Date.now())) {
        throw new BadRequestException('Expired token');
      }

      // get user with email
      const user = await this.findBy(email);

      // check user correctness
      if (user.id !== passwordResetToken.userid)
        throw new BadRequestException('Invalid email');

      // compare new password with old password
      if (await bcrypt.compare(newPassword, user.password)) {
        throw new BadRequestException(
          'New password must be different from the current password. Please try again.',
        );
      }
      // hash password
      const hashedPassword = await bcrypt.hash(newPassword, roundsOfHashing);

      // update user password
      await this.update(user.id, { password: hashedPassword });

      return { message: 'Password reset successfully' };
    } catch (error) {
      console.error('Password could not be reset. Error:', error);

      if (error instanceof BadRequestException) throw error;

      throw new Error('Password could not be reset.');
    }
  }
}
