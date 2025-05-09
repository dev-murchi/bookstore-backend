import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Put,
  Query,
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
import { CustomAPIError } from '../common/errors/custom-api.error';
import { User } from '../common/types';
import { HelperService } from '../common/helper.service';
import { ReviewsService } from '../reviews/reviews.service';
import { OrdersService } from '../orders/orders.service';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly reviewsService: ReviewsService,
    private readonly ordersService: OrdersService,
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
        !(await HelperService.compareHash(password, request.user['password']))
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

  @Put(':id')
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async updateUser(
    @Param('id') userId: string,
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

  @Get(':id/reviews')
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async getUserReviews(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    try {
      return {
        data: await this.reviewsService.getReviewsForUser(userId, page, limit),
      };
    } catch (error) {
      throw new InternalServerErrorException('');
    }
  }

  @Get(':id/orders')
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async getUserOrders(@Param('id', ParseUUIDPipe) userId: string) {
    try {
      return {
        data: await this.ordersService.getUserOrders(userId),
      };
    } catch (error) {
      throw new InternalServerErrorException('');
    }
  }
}
