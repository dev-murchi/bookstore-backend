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
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CreateCategoryDTO } from '../common/dto/create-category.dto';
import { CategoryService } from './category.service';
import { RoleGuard } from '../common/guards/role/role.guard';
import { JwtAuthGuard } from '../common/guards/auth/jwt-auth.guard';
import { Roles } from '../common/decorator/role/role.decorator';
import { RoleEnum } from '../common/enum/role.enum';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { CategoryDTO } from '../common/dto/category.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiInternalServerErrorResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

@ApiTags('Categories')
@ApiBearerAuth()
@Controller('category')
@UseGuards(JwtAuthGuard, RoleGuard)
export class CategoryController {
  constructor(private categoryService: CategoryService) {}
  @Get()
  @Roles([RoleEnum.Admin, RoleEnum.Author, RoleEnum.User, RoleEnum.GuestUser])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all book categories' })
  @ApiOkResponse({
    description: 'List of all available categories',
    type: [CategoryDTO],
  })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async viewAllCategories(): Promise<CategoryDTO[]> {
    try {
      return await this.categoryService.getAll();
    } catch (error) {
      throw new InternalServerErrorException(
        'Categories could not be fetched due to an unexpected error. ',
      );
    }
  }

  @Post()
  @Roles([RoleEnum.Admin])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new category (Admin only)' })
  @ApiBody({ type: CreateCategoryDTO })
  @ApiCreatedResponse({
    description: 'Category created successfully',
    type: CategoryDTO,
  })
  @ApiBadRequestResponse({ description: 'Bad request' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async createCategory(
    @Body() createCategoryDTO: CreateCategoryDTO,
  ): Promise<CategoryDTO> {
    try {
      return await this.categoryService.create(createCategoryDTO);
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException(
        'Category creation failed due to an unxpected error.',
      );
    }
  }

  @Put(':id')
  @Roles([RoleEnum.Admin])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a category by ID (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'ID of the category to update',
    example: 1,
    type: Number,
  })
  @ApiBody({
    description: 'New name for the category',
    type: CreateCategoryDTO,
  })
  @ApiOkResponse({
    description: 'Category updated successfully',
    type: CategoryDTO,
  })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async updateCategory(
    @Param('id', ParseIntPipe) categoryId: number,
    @Body() updatedCategory: CreateCategoryDTO,
  ): Promise<CategoryDTO> {
    try {
      return await this.categoryService.update(
        categoryId,
        updatedCategory.value,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'Category could be updated due to an unexpected error.',
      );
    }
  }

  @Delete(':id')
  @Roles([RoleEnum.Admin])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a category by ID (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'ID of the category to delete',
    example: 2,
    type: Number,
  })
  @ApiOkResponse({
    description: 'Category deleted successfully',
    schema: {
      example: {
        message: 'Category deleted successfully',
      },
    },
  })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async deleteCategory(@Param('id', ParseIntPipe) categoryId: number): Promise<{
    message: string;
  }> {
    try {
      return await this.categoryService.delete(categoryId);
    } catch (error) {
      throw new InternalServerErrorException(
        'Category could be deleted due to an unexpected error.',
      );
    }
  }
}
