import {
  Body,
  Controller,
  Delete,
  Get,
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

@Controller('category')
@UseGuards(UserAccessGuard)
export class CategoryController {
  constructor(private categoryService: CategoryService) {}
  @Get()
  @Roles([RoleEnum.Admin, RoleEnum.Author, RoleEnum.User, RoleEnum.GuestUser])
  async viewAllCategories() {
    return await this.categoryService.getAll();
  }

  @Post()
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async createCategory(@Body() createCategoryDTO: CreateCategoryDTO) {
    return await this.categoryService.create(createCategoryDTO);
  }

  @Put(':id')
  @Roles([RoleEnum.Admin])
  async updateCategory(
    @Param('id', ParseIntPipe) categoryId: number,
    @Body() name: string,
  ) {
    return await this.categoryService.update(categoryId, name);
  }

  @Delete(':id')
  @Roles([RoleEnum.Admin])
  async deleteCategory(@Param('id', ParseIntPipe) categoryId: number) {
    return this.categoryService.delete(categoryId);
  }
}
