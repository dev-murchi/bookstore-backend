import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RoleGuard } from 'src/auth/guards/role.guard';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateCategoryDTO } from 'src/common/dto/create-category.dto';
import { CategoryDTO } from 'src/common/dto/category.dto';
import { CustomAPIError } from 'src/common/errors/custom-api.error';

const mockCategoryService = {
  getAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('CategoryController', () => {
  let controller: CategoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [{ provide: CategoryService, useValue: mockCategoryService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ handleRequest: jest.fn() })
      .overrideGuard(RoleGuard)
      .useValue({ handleRequest: jest.fn() })
      .compile();

    controller = module.get<CategoryController>(CategoryController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('viewAllCategories', () => {
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockCategoryService.getAll.mockRejectedValue(new Error('Unknown Error'));

      try {
        await controller.viewAllCategories();
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Categories could not be fetched due to an unexpected error. ',
        );
      }
    });

    it('should return all categories', async () => {
      const categories: CategoryDTO[] = [{ id: 1, value: 'Fiction' }];
      mockCategoryService.getAll.mockResolvedValue(categories);
      const result = await controller.viewAllCategories();
      expect(result).toEqual(categories);
      expect(mockCategoryService.getAll).toHaveBeenCalled();
    });
  });

  describe('createCategory', () => {
    it('should throw BadRequestException if service throws CustomAPIError', async () => {
      const body: CreateCategoryDTO = { value: 'Science' };

      mockCategoryService.create.mockRejectedValue(
        new CustomAPIError('Category is already exist.'),
      );

      try {
        await controller.createCategory(body);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Category is already exist.');
      }
    });

    it('should throw InternalServerErrorException on unknown error', async () => {
      const body: CreateCategoryDTO = { value: 'Science' };

      mockCategoryService.create.mockRejectedValue(new Error('Unknown Error'));

      try {
        await controller.createCategory(body);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Category creation failed due to an unxpected error.',
        );
      }
    });

    it('should create a category', async () => {
      const body: CreateCategoryDTO = { value: 'Science' };
      const expectedData: CategoryDTO = { id: 2, value: 'Science' };
      mockCategoryService.create.mockResolvedValue(expectedData);
      const result = await controller.createCategory(body);
      expect(result).toEqual(expectedData);
      expect(mockCategoryService.create).toHaveBeenCalledWith(body);
    });
  });

  describe('updateCategory', () => {
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      const body: CreateCategoryDTO = { value: 'Math' };
      mockCategoryService.update.mockRejectedValue(new Error('Unknown Error'));

      try {
        await controller.updateCategory(3, body);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Category could be updated due to an unexpected error.',
        );
      }
    });

    it('should update a category', async () => {
      const body: CreateCategoryDTO = { value: 'Math' };
      const expectedData: CategoryDTO = { id: 3, value: 'Math' };
      mockCategoryService.update.mockResolvedValue(expectedData);
      const result = await controller.updateCategory(3, body);
      expect(result).toEqual(expectedData);
      expect(mockCategoryService.update).toHaveBeenCalledWith(3, body.value);
    });
  });

  describe('deleteCategory', () => {
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockCategoryService.delete.mockRejectedValue(new Error('Unknown Error'));

      try {
        await controller.deleteCategory(2);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Category could be deleted due to an unexpected error.',
        );
      }
    });

    it('should delete a category', async () => {
      mockCategoryService.delete.mockResolvedValue({
        message: 'Category deleted successfully',
      });
      const result = await controller.deleteCategory(2);
      expect(result).toEqual({ message: 'Category deleted successfully' });
      expect(mockCategoryService.delete).toHaveBeenCalledWith(2);
    });
  });
});
