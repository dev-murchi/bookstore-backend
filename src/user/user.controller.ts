import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { Request } from 'express';
import { AuthGuard } from '../guard/auth/auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcrypt';
const roundsOfHashing = 10;

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(AuthGuard)
  @Get('profile')
  async profile(@Req() request: Request) {
    const { name, email } = await this.userService.findOne(request.user['id']);

    return { name, email };
  }

  @UseGuards(AuthGuard)
  @Put('profile')
  async updateProfile(
    @Req() request: Request,
    @Body() updateUserProfileDto: Partial<UpdateProfileDto>,
  ) {
    const { name, email, oldPassword, newPassword } = updateUserProfileDto;

    if (!oldPassword) throw new BadRequestException('Password is required.');

    const user = await this.userService.findOne(request.user['id']);

    if (!(await bcrypt.compare(oldPassword, user.password)))
      throw new BadRequestException('Invalid password.');

    if (oldPassword === newPassword)
      throw new BadRequestException('Choose a different password.');

    const updateData = new UpdateUserDto();

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (newPassword)
      updateData.password = await bcrypt.hash(newPassword, roundsOfHashing);

    if (!Object.keys(updateData).length)
      throw new BadRequestException('No changes provided.');

    return await this.userService.update(request.user['id'], updateData);
  }
}
