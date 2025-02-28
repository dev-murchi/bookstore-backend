import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // check user is exist or not
    const user = await this.prisma.user.findUnique({
      where: {
        email: createUserDto.email,
      },
    });

    if (user) {
      throw new BadRequestException('Email already in use');
    }

    // create new user
    await this.prisma.user.create({
      data: {
        name: createUserDto.name,
        email: createUserDto.email,
        password: createUserDto.password,
        role: {
          connectOrCreate: {
            where: {
              role_name: 'user',
            },
            create: {
              role_name: 'user',
            },
          },
        },
        is_active: true,
      },
    });

    return { message: 'User registered successfully' };
  }

  async findAll() {
    const users = await this.prisma.user.findMany();

    if (!users) return [];
    return users;
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      return null;
    }
    return user;
  }

  async findBy(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return null;
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    try {
      await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
      });
      return { message: 'User updated successfully' };
    } catch (error) {
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
