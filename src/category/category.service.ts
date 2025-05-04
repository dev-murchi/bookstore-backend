import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDTO } from './dto/create-category.dto';
import { CustomAPIError } from '../common/errors/custom-api.error';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}
  async getAll() {
    try {
      const categories = await this.prisma.category.findMany({
        select: { id: true, category_name: true },
      });

      return categories;
    } catch (error) {
      console.error('Categories could not be fetched. Error:', error);
      throw new Error('Categories could not be fetched.');
    }
  }

  async create(createCategoryDTO: CreateCategoryDTO) {
    try {
      const category = await this.prisma.category.create({
        data: { category_name: createCategoryDTO.category },
        select: { id: true, category_name: true },
      });

      return category;
    } catch (error) {
      console.error('Category could not be created. Error:', error);
      // unique constraint
      if (error.code === 'P2002')
        throw new CustomAPIError('Category is already exist.');
      throw new Error('Category could not be created.');
    }
  }

  async update(categoryId: number, name: string) {
    try {
      return await this.prisma.category.update({
        where: { id: categoryId },
        data: { category_name: name },
        select: { id: true, category_name: true },
      });
    } catch (error) {
      console.error('Category name could not be updated. Error:', error);
      throw new Error('Category name could not be updated.');
    }
  }

  async delete(categoryId: number) {
    try {
      await this.prisma.category.delete({ where: { id: categoryId } });
      return { message: 'Category deleted successfully' };
    } catch (error) {
      console.error('Category name could not be deleted. Error:', error);
      throw new Error('Category name could not be deleted.');
    }
  }
}
