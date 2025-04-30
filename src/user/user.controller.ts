import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth/auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcrypt';
import { UserDto } from './dto/user.dto';
import { UserAccessGuard } from 'src/common/guards/user-access/user-access.guard';
import { RoleEnum } from 'src/common/role.enum';
import { Roles } from 'src/common/decorator/role/role.decorator';
const roundsOfHashing = 10;

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(AuthGuard)
  @Get('profile')
  async profile(@Req() request: Request) {
    const user: UserDto = {
      id: request.user['id'],
      name: request.user['name'],
      email: request.user['email'],
      role: request.user['role']['name'],
    };

    return user;
  }

  @UseGuards(AuthGuard)
  @Put('profile')
  async updateProfile(
    @Req() request: Request,
    @Body() updateUserProfileDto: UpdateProfileDto,
  ) {
    const { name, email, password, newPassword } = updateUserProfileDto;

    if (!password) throw new BadRequestException('Password is required.');

    if (!(await bcrypt.compare(password, request.user['password'])))
      throw new BadRequestException('Invalid password.');

    if (password === newPassword)
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

  @Get()
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async viewAllRegisteredUsers() {
    return await this.userService.findAll();
  }

  @Put(':userId')
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async updateUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Body()
    updateUserDto: UpdateUserDto,
  ) {
    try {
      return await this.userService.update(userId, updateUserDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id')
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async deleteUser(@Param('userId', ParseIntPipe) userId: number) {
    return await this.userService.remove(userId);
  }
}
