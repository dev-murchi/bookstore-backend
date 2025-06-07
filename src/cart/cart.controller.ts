import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  Req,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDTO } from '../common/dto/add-to-cart.dto';
import { Request } from 'express';
import { Roles } from '../common/decorator/role/role.decorator';
import { RoleEnum } from '../common/enum/role.enum';
import { CreateCheckoutDTO } from '../common/dto/create-checkout.dto';
import { CheckoutService } from './checkout/checkout.service';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { CartDTO } from '../common/dto/cart.dto';
import { CartItemDTO } from '../common/dto/cart-item.dto';
import { CheckoutDTO } from '../common/dto/checkout.dto';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RoleGuard } from '../auth/guards/role.guard';
import { CartGuard } from './guards/cart.guard';

@Controller('cart')
@UseGuards(CartGuard, RoleGuard)
@ApiTags('Cart')
@ApiBearerAuth()
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly checkoutService: CheckoutService,
  ) {}

  @Post()
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new shopping cart for the current user or guest',
    description:
      'Creates a new shopping cart for the authenticated user or guest if no active cart exists. If the user already has an existing active cart, the same cart is returned instead of creating a new one.',
  })
  @ApiCreatedResponse({
    description: 'Cart successfully created',
    type: CartDTO,
    examples: {
      emptyCart: {
        summary: 'Empty cart for a new user or guest',
        value: {
          id: 102,
          owner: 'abcdef01-2345-6789-abcd-ef0123456789',
          items: [],
          totalPrice: 0,
        },
      },
      withItems: {
        summary: 'User already has an existing active cart',
        value: {
          id: 101,
          owner: 'abcdef01-2345-6789-abcd-ef0123456789',
          items: [
            {
              quantity: 2,
              item: {
                id: 'a1b2c3d4-e5f6-7890-ab12-cd34ef56gh78',
                title: "Wanderlust: A Traveler's Guide to the World",
                description:
                  "Explore the world's most breathtaking destinations.",
                isbn: '978-0451526342',
                author: {
                  name: 'Traveler Hobbits',
                },
                category: {
                  id: 3,
                  value: 'Travel',
                },
                price: 19.99,
                rating: 4.5,
                imageUrl:
                  'https://example.com/images/wanderlust-book-cover.jpg',
              },
            },
          ],
          totalPrice: 49.99,
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async createCart(@Req() request: Request): Promise<CartDTO> {
    try {
      const userId = request.user ? request.user['id'] : null;
      return await this.cartService.createCart(userId);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to create the cart due to an unexpected error.',
      );
    }
  }

  @Post('checkout')
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Checkout the current user's cart (Authenticated User and Guest only)",
  })
  @ApiOkResponse({
    description: 'Checkout completed successfully',
    type: CheckoutDTO,
  })
  @ApiBadRequestResponse({
    description: 'Invalid checkout data or cart not found',
  })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async checkout(
    @Req() request: Request,
    @Body() createCheckoutDto: CreateCheckoutDTO,
  ): Promise<CheckoutDTO> {
    try {
      // guest user can also checkout
      const userId = request.user ? request.user['id'] : null;

      return await this.checkoutService.checkout(userId, createCheckoutDto);
    } catch (error) {
      if (error instanceof CustomAPIError) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException(
        'Failed to checkout due to an unexpected error.',
      );
    }
  }

  @Get(':id')
  @Roles([RoleEnum.Admin, RoleEnum.User, RoleEnum.GuestUser])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'View a specific cart by ID (Admin, Authenticated User and Guest only)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Cart ID' })
  @ApiOkResponse({ description: 'Cart fetched successfully', type: CartDTO })
  @ApiUnauthorizedResponse({
    description: 'User not authorized to view this cart',
  })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async viewCart(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<{ data: CartDTO | null }> {
    try {
      const cart = await this.cartService.findCartById(id);

      // admin access
      if (request.user && request.user['role'] === RoleEnum.Admin) {
        return { data: cart };
      }

      const userId = request.user ? request.user['id'] : null;

      if (!cart || cart.owner !== userId) {
        throw new UnauthorizedException('Unable to access this cart.');
      }

      return { data: cart };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch the cart due to an unexpected error.',
      );
    }
  }

  @Post(':id/claim')
  @Roles([RoleEnum.User])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Claim an existing guest cart as a user (Authenticated User only)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Cart ID' })
  @ApiOkResponse({ description: 'Cart claimed successfully', type: CartDTO })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async claim(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<CartDTO> {
    try {
      return await this.cartService.claim(request.user['id'], id);
    } catch (error) {
      if (error instanceof CustomAPIError) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException(
        'Failed to calim the cart due to an unexpected error.',
      );
    }
  }

  @Post(':id/items')
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Add or update an item in the cart (Authenticated User and Guest only)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Cart ID' })
  @ApiOkResponse({
    description: 'Item added or updated in cart',
    type: CartItemDTO,
  })
  @ApiBadRequestResponse({ description: 'Invalid data or cart not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access to cart' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async addOrUpdateItem(
    @Req() request: Request,
    @Param('id', ParseUUIDPipe) cartId: string,
    @Body() data: AddToCartDTO,
  ): Promise<CartItemDTO> {
    try {
      if (request.user && request.user['cartId'] === null) {
        throw new BadRequestException('Please create a cart.');
      }

      const userId = request.user ? request.user['id'] : null;

      const cart = await this.cartService.findCartById(cartId);
      if (!cart) {
        throw new UnauthorizedException('Unable to access this cart1.');
      }

      if (cart.owner !== userId) {
        throw new UnauthorizedException('Unable to access this cart.');
      }

      return await this.cartService.upsertItem(cartId, data);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof CustomAPIError) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException(
        'Failed to add the item to the cart due to an unexpected error.',
      );
    }
  }

  @Delete(':id/items/:itemId')
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove an item from the cart (Authenticated User and Guest only)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Cart ID' })
  @ApiParam({ name: 'itemId', type: String, description: 'Book ID to remove' })
  @ApiOkResponse({ description: 'Item removed from cart', type: Object })
  @ApiBadRequestResponse({ description: 'Cart is empty or invalid' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async removeItem(
    @Req() request: Request,
    @Param('id', ParseUUIDPipe) cartId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<{ message: string }> {
    try {
      if (request.user && request.user['cartId'] === null) {
        throw new BadRequestException(
          'Item could not deleted. Please be sure you have a cart!',
        );
      }

      const userId = request.user ? request.user['id'] : null;

      const cart = await this.cartService.findCartById(cartId);

      if (!cart || cart.owner !== userId) {
        throw new Error('Unable to access this cart.');
      }

      if (cart.items.length === 0) {
        throw new BadRequestException('Cart is empty!');
      }

      return await this.cartService.removeItem(cartId, { bookId: itemId });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        'Failed to delete the cart due to an unexpected error.',
      );
    }
  }

  @Post('clear')
  @Roles([RoleEnum.Admin])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove inactive guest carts (Admin only)' })
  @ApiOkResponse({ description: 'Inactive guest carts removed', type: Object })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  removeInactiveGuestCarts(): Promise<{ removed: number }> {
    try {
      return this.cartService.removeInactiveGuestCarts();
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to remove inactive guest carts due to an unexpected error.',
      );
    }
  }
}
