import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { UpdateUserDTO } from 'src/common/dto/update-user.dto';
import { UpdateProfileDTO } from 'src/common/dto/update-profile.dto';
import { RoleEnum } from 'src/common/enum/role.enum';
import { Roles } from 'src/common/decorator/role/role.decorator';
import { CustomAPIError } from 'src/common/errors/custom-api.error';
import { UserDTO } from 'src/common/dto/user.dto';
import { ReviewsService } from 'src/reviews/reviews.service';
import { OrdersService } from 'src/orders/orders.service';

import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiBadRequestResponse,
  ApiQuery,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RoleGuard } from 'src/auth/guards/role.guard';
import { OrderDTO } from 'src/common/dto/order.dto';
import { ReviewDTO } from 'src/common/dto/review.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RoleGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly reviewsService: ReviewsService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @Roles([RoleEnum.Admin, RoleEnum.User])
  @ApiOperation({ summary: 'Get the profile of the current user' })
  @ApiOkResponse({
    description: 'User profile retrieved',
    type: UserDTO,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async profile(@Req() request: Request): Promise<UserDTO> {
    const user = new UserDTO(
      request.user['id'],
      request.user['name'],
      request.user['email'],
      request.user['role'],
    );

    return user;
  }

  @Put('profile')
  @HttpCode(HttpStatus.OK)
  @Roles([RoleEnum.Admin, RoleEnum.User])
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBody({ type: UpdateProfileDTO })
  @ApiOkResponse({
    description: 'Profile updated successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          $ref: getSchemaPath(UserDTO),
        },
        loginRequired: {
          type: 'boolean',
          example: true,
          description:
            'Indicates whether the user must log in again due to password change',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request or no updates provided',
  })
  @ApiInternalServerErrorResponse({ description: 'Failed to update profile' })
  async updateProfile(
    @Req() request: Request,
    @Body() updateUserProfileDto: UpdateProfileDTO,
  ): Promise<{ data: UserDTO; loginRequired: boolean }> {
    try {
      const { name, email, password, newPassword } = updateUserProfileDto;

      if (!password) {
        throw new BadRequestException('Password is required.');
      }

      if (!name && !email && !newPassword) {
        throw new BadRequestException('No changes provided.');
      }

      if (password === newPassword) {
        throw new BadRequestException(
          'New password must be different from old password.',
        );
      }

      await this.userService.checkUserWithPassword(
        request.user['email'],
        password,
      );

      const updateData = new UpdateUserDTO();

      let loginRequired = false;

      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (newPassword) {
        updateData.password = newPassword;
        loginRequired = true;
      }
      const user = await this.userService.update(
        request.user['id'],
        updateData,
      );
      return { data: user, loginRequired };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof CustomAPIError) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException('User profile update failed.');
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles([RoleEnum.Admin])
  @ApiOperation({ summary: 'Get all registered users (Admin only)' })
  @ApiOkResponse({
    description: 'Users retrieved successfully',
    type: [UserDTO],
  })
  @ApiInternalServerErrorResponse({
    description: 'Failed to retrieve users',
  })
  async viewAllRegisteredUsers(): Promise<UserDTO[]> {
    try {
      return await this.userService.findAll();
    } catch (error) {
      throw new InternalServerErrorException('Users could not be retrieved.');
    }
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @Roles([RoleEnum.Admin])
  @ApiOperation({ summary: 'Update a specific user by ID (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiBody({ type: UpdateUserDTO })
  @ApiOkResponse({
    description: 'User updated successfully',
    type: UserDTO,
  })
  @ApiInternalServerErrorResponse({ description: 'Failed to update user' })
  async updateUser(
    @Param('id') userId: string,
    @Body() updateUserDTO: UpdateUserDTO,
  ): Promise<UserDTO> {
    try {
      return await this.userService.update(userId, updateUserDTO);
    } catch (error) {
      if (error instanceof CustomAPIError) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException('User update failed.');
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles([RoleEnum.Admin])
  @ApiOperation({ summary: 'Delete a user by ID (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiOkResponse({
    description: 'User deleted successfully',
    schema: { example: { message: 'User deleted successfully' } },
  })
  @ApiInternalServerErrorResponse({ description: 'User could not be deleted' })
  async deleteUser(@Param('id') userId: string): Promise<{ message: string }> {
    try {
      return await this.userService.remove(userId);
    } catch (error) {
      throw new InternalServerErrorException('User could not be deleted.');
    }
  }

  @Get(':id/reviews')
  @HttpCode(HttpStatus.OK)
  @Roles([RoleEnum.Admin])
  @ApiOperation({ summary: 'Get all reviews of a user by ID (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the user',
    type: String,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Number of reviews per page',
  })
  @ApiOkResponse({
    description: 'User reviews retrieved',
    schema: {
      properties: {
        data: {
          properties: {
            data: {
              properties: {
                reviews: {
                  type: 'array',
                  items: {
                    $ref: getSchemaPath(ReviewDTO),
                  },
                },
                rating: { type: 'number', example: 4.5 },
              },
            },
            meta: {
              properties: {
                userId: { type: 'string', example: 'user-id-uuid' },
                totalReviewCount: { type: 'number', example: 12 },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 10 },
                totalPages: { type: 'number', example: 2 },
              },
            },
          },
        },
      },
    },
  })
  async getUserReviews(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query('page', ParseIntPipe) page,
    @Query('limit', ParseIntPipe) limit,
  ): Promise<{
    data: {
      data: {
        reviews: ReviewDTO[];
        rating: number;
      };
      meta: {
        userId: string;
        totalReviewCount: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    };
  }> {
    try {
      return {
        data: await this.reviewsService.getReviewsForUser(userId, page, limit),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to retrieve user reviews.',
      );
    }
  }

  @Get(':id/orders')
  @HttpCode(HttpStatus.OK)
  @Roles([RoleEnum.Admin])
  @ApiOperation({ summary: 'Get all orders of a user by ID (Admin only)' })
  @ApiOkResponse({
    description: 'User orders retrieved',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(OrderDTO) },
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
  })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  async getUserOrders(@Param('id', ParseUUIDPipe) userId: string): Promise<{
    data: OrderDTO[];
  }> {
    try {
      return {
        data: await this.ordersService.getUserOrders(userId),
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve user orders.');
    }
  }
}
