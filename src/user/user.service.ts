import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
@Injectable()
export class UserService {
  private users = [];
  constructor() {}

  async create(createUserDto: CreateUserDto) {
    // check user is exist or not
    const user = this.users.find((user) => createUserDto.email === user.email);

    if (user) {
      throw new BadRequestException('Email already in use');
    }

    // hash password
    const hashedPassword = createUserDto.password;

    const id = this.users.length + 1;
    // create new user
    const newUser = {
      name: createUserDto.name,
      email: createUserDto.email,
      password: hashedPassword,
      role: 'user',
      id,
    };

    this.users.push(newUser);

    return { message: 'User registered successfully' };
  }

  async findAll() {
    return this.users;
  }

  async findOne(id: number) {
    const user = this.users.find((user) => id === user.id);
    if (!user) {
      throw new NotFoundException('User is not exist');
    }
    return user;
  }

  async findBy(email: string) {
    const user = this.users.find((user) => email === user.email);
    if (!user) {
      throw new NotFoundException('User is not exist');
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    // check user existence
    const userIndex = this.users.findIndex((user) => id === user.id);

    if (userIndex < 0) {
      throw new BadRequestException('User could not be updated');
    }

    // update user
    this.users[userIndex].email =
      updateUserDto.email || this.users[userIndex].email;

    this.users[userIndex].password =
      updateUserDto.password || this.users[userIndex].password;

    this.users[userIndex].name =
      updateUserDto.name || this.users[userIndex].name;

    return { message: 'User updated successfully' };
  }

  async remove(id: number) {
    // check user existence
    const userIndex = this.users.findIndex((user) => id === user.id);

    if (userIndex < 0) {
      throw new BadRequestException('User could not be deleted');
    }
    // delete user
    this.users.splice(userIndex, 1);
    return { message: 'User deleted successfully' };
  }
}
