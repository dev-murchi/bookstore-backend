import { Injectable } from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';

import * as bcrypt from 'bcrypt';

const roundsOfHashing = 10;

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {}

  async register(user: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(user.password, roundsOfHashing);
    return await this.userService.create({
      ...user,
      password: hashedPassword,
    });
  }
}
