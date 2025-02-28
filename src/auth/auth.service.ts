import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';

import * as bcrypt from 'bcrypt';
import { LoginDto } from 'src/user/dto/login.dto';
import { JwtService } from '@nestjs/jwt';

const roundsOfHashing = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
  ) {}

  async register(user: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(user.password, roundsOfHashing);
    return await this.userService.create({
      ...user,
      password: hashedPassword,
    });
  }

  async login({ email, password }: LoginDto) {
    // check user existence
    const user = await this.userService.findBy(email);
    if (!user) throw new UnauthorizedException('Invalid user credentials');

    // compare password
    if (!(await bcrypt.compare(password, user.password)))
      throw new UnauthorizedException('Invalid user credentials');

    // generate jwt token
    const payload = {
      id: user.id,
      role: user.roleid,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }
}
