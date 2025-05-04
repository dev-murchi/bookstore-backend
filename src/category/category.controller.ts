import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CreateCategoryDTO } from './dto/create-category.dto';
import { CategoryService } from './category.service';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { Roles } from '../common/decorator/role/role.decorator';
import { RoleEnum } from '../common/role.enum';
import { CustomAPIError } from '../common/errors/custom-api.error';

@Controller('category')
@UseGuards(UserAccessGuard)
export class CategoryController {
  constructor(private categoryService: CategoryService) {}
  @Get()
  @Roles([RoleEnum.Admin, RoleEnum.Author, RoleEnum.User, RoleEnum.GuestUser])
  async viewAllCategories() {
    try {
      return await this.categoryService.getAll();
    } catch (error) {
      throw new InternalServerErrorException(
        'Categories could not be fetched due to an unexpected error. ',
      );
    }
  }

  @Post()
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async createCategory(@Body() createCategoryDTO: CreateCategoryDTO) {
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
  async updateCategory(
    @Param('id', ParseIntPipe) categoryId: number,
    @Body() name: string,
  ) {
    try {
      return await this.categoryService.update(categoryId, name);
    } catch (error) {
      throw new InternalServerErrorException(
        'Category could be updated due to an unexpected error.',
      );
    }
  }

  @Delete(':id')
  @Roles([RoleEnum.Admin])
  async deleteCategory(@Param('id', ParseIntPipe) categoryId: number) {
    try {
      return this.categoryService.delete(categoryId);
    } catch (error) {
      throw new InternalServerErrorException(
        'Category could be deleted due to an unexpected error.',
      );
    }
  }
}
