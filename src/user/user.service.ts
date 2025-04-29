import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RoleEnum } from '../common/role.enum';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
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
}
