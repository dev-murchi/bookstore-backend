import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
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
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { RoleEnum } from '../common/role.enum';
import { Roles } from '../common/decorator/role/role.decorator';
import { Password } from '../common/password';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { User } from '../common/types';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly passwordProvider: Password,
  ) {}

  @UseGuards(AuthGuard)
  @Get('profile')
  async profile(@Req() request: Request): Promise<User> {
    return {
      id: request.user['id'],
      name: request.user['name'],
      email: request.user['email'],
      role: { value: request.user['role']['name'] },
    };
  }

  @UseGuards(AuthGuard)
  @Put('profile')
  async updateProfile(
    @Req() request: Request,
    @Body() updateUserProfileDto: UpdateProfileDto,
  ): Promise<User> {
    try {
      const { name, email, password, newPassword } = updateUserProfileDto;

      if (!password) throw new BadRequestException('Password is required.');

      if (!name && !email && !newPassword)
        throw new BadRequestException('No changes provided.');

      if (
        !(await this.passwordProvider.compare(
          password,
          request.user['password'],
        ))
      )
        throw new BadRequestException('Invalid password.');

      if (password === newPassword)
        throw new BadRequestException('Choose a different password.');

      const updateData = new UpdateUserDto();

      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (newPassword) updateData.password = newPassword;

      return await this.userService.update(request.user['id'], updateData);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);
      throw new InternalServerErrorException('User profile update failed.');
    }
  }

  @Get()
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async viewAllRegisteredUsers(): Promise<User[]> {
    try {
      return await this.userService.findAll();
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException('User could not be fetched.');
    }
  }

  @Put(':userId')
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async updateUser(
    @Param('userId') userId: string,
    @Body()
    updateUserDto: UpdateUserDto,
  ): Promise<User> {
    try {
      return await this.userService.update(userId, updateUserDto);
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException('User update failed.');
    }
  }

  @Delete(':id')
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async deleteUser(
    @Param('userId') userId: string,
  ): Promise<{ message: string }> {
    try {
      return await this.userService.remove(userId);
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException('User could not be deleted.');
    }
  }
}
