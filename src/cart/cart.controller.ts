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
  NotFoundException,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDTO } from 'src/common/dto/add-to-cart.dto';
import { Request } from 'express';
import { Roles } from 'src/common/decorator/role/role.decorator';
import { RoleEnum } from 'src/common/enum/role.enum';
import { CreateCheckoutDTO } from 'src/common/dto/create-checkout.dto';
import { CheckoutService } from './checkout/checkout.service';
import { CustomAPIError } from 'src/common/errors/custom-api.error';
import { CartDTO } from 'src/common/dto/cart.dto';
import { CartItemDTO } from 'src/common/dto/cart-item.dto';
import { CheckoutDTO } from 'src/common/dto/checkout.dto';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { RoleGuard } from 'src/auth/guards/role.guard';
import { CartGuard } from './guards/cart.guard';
import { CartItemService } from './cart-item.service';
import { CheckoutRequestDTO } from 'src/common/dto/checkout-request.dto';
import { CartCheckoutAction } from 'src/common/enum/cart-checkout-action.enum';

@Controller('cart')
@UseGuards(CartGuard, RoleGuard)
@ApiTags('Cart')
@ApiBearerAuth()
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly cartItemService: CartItemService,
    private readonly checkoutService: CheckoutService,
  ) {}

  @Post()
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new shopping cart for the guest or current user.',
    description:
      'Creates a shopping cart for a guest or for a user who does not already have one.',
  })
  @ApiCreatedResponse({
    description: 'Cart successfully created',
    type: CartDTO,
    examples: {
      emptyGuestCart: {
        summary: 'Guest',
        value: {
          cart: {
            id: 'cart-uuid-1',
            owner: null,
            items: [],
            totalPrice: 0,
          },
          guestCartToken: 'guest cart token',
        },
      },
      emptyUserCart: {
        summary: 'Authenticated User',
        value: {
          cart: {
            id: 'cart-uuid-2',
            owner: 'abcdef01-2345-6789-abcd-ef0123456789',
            items: [],
            totalPrice: 0,
          },
          guestCartToken: null,
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'User already has a cart.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async createCart(@Req() request: Request): Promise<{
    cart: CartDTO;
    guestCartToken: any;
  }> {
    try {
      const user = request.user;
      if (user['role'] === RoleEnum.User) {
        if (user['cartId']) {
          throw new BadRequestException('You already have a cart.');
        }
        return await this.cartService.createCart(user['id']);
      }

      if (user['role'] === RoleEnum.GuestUser) {
        return await this.cartService.createCart(null);
      }

      throw new UnauthorizedException('Invalid user role');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException(
        'Failed to create the cart due to an unexpected error.',
      );
    }
  }

  @Get()
  @Roles([RoleEnum.User])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retrieve the shopping cart for the current authenticated user.',
  })
  @ApiOkResponse({
    description: 'Cart successfully retrieved',
    type: CartDTO,
    examples: {
      emptyUserCart: {
        summary: 'Empty cart',
        value: {
          data: {
            id: 'cart-uuid-2',
            owner: 'abcdef01-2345-6789-abcd-ef0123456789',
            items: [],
            totalPrice: 0,
          },
        },
      },
      userCartWithItems: {
        summary: 'Cart with items',
        value: {
          data: {
            id: 'cart-uuid-2',
            owner: 'abcdef01-2345-6789-abcd-ef0123456789',
            items: [
              {
                quantity: 2,
                item: {
                  id: 'a1b2c3d4-e5f6-4890-ab12-cd34ef56ab78',
                  title: "Wanderlust: A Traveler's Guide to the World",
                  description:
                    "Explore the world's most breathtaking destinations.",
                  isbn: '978-0451526342',
                  author: {
                    name: 'Bilbo Baggins',
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
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async retrieveCart(@Req() request: Request): Promise<{
    data: CartDTO | null;
  }> {
    try {
      const user = request.user;
      if (!user['cartId']) return { data: null };
      const cart = await this.cartService.findCart(user['cartId'], {
        userId: user['id'],
      });
      return { data: cart };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to retrieve the cart due to an unexpected error.',
      );
    }
  }

  @Post('checkout')
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Perform checkout for the current user's cart (Authenticated users and Guests only)",
  })
  @ApiHeader({
    name: 'x-guest-cart-token',
    description: 'Guest cart token (non-JWT)',
    required: false,
    example: 'guestCartTokeN...',
  })
  @ApiOkResponse({
    description: 'Checkout completed successfully',
    type: CheckoutDTO,
    schema: {
      properties: {
        data: {
          type: 'object',
          $ref: getSchemaPath(CheckoutDTO),
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid checkout data provided.',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access to checkout.' })
  @ApiNotFoundResponse({ description: 'Cart not found.' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async checkout(
    @Req() request: Request,
    @Body() createCheckoutDto: CreateCheckoutDTO,
  ): Promise<{ data: CheckoutDTO }> {
    console.log('');
    try {
      const user = request.user;
      await this.authorizeCartAccess(user, createCheckoutDto.cartId);
      return {
        data: await this.checkoutService.checkout(
          user['id'],
          createCheckoutDto,
        ),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof NotFoundException) throw error;
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
  @ApiHeader({
    name: 'x-guest-cart-token',
    description: 'Guest cart token (non-JWT)',
    required: false,
    example: 'guestCartTokeN...',
  })
  @ApiOperation({
    summary:
      'View a specific cart by ID (Admins, authenticated users, and guests)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Cart ID' })
  @ApiOkResponse({
    description: 'Cart fetched successfully',
    type: CartDTO,
    schema: {
      properties: {
        data: {
          type: 'object',
          $ref: getSchemaPath(CartDTO),
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'User not authorized to view this cart',
  })
  @ApiNotFoundResponse({ description: 'Cart not found or unauthorized.' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async viewCart(
    @Param('id', ParseUUIDPipe) carId: string,
    @Req() request: Request,
  ): Promise<{ data: CartDTO }> {
    try {
      const user: any = request.user;
      const cart = await this.authorizeCartAccess(user, carId);
      return { data: cart };
    } catch (error) {
      console.error({ error });
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch the cart due to an unexpected error.',
      );
    }
  }

  @Post('sync')
  @Roles([RoleEnum.User])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Synchronize a guest cart with the user's permanent cart on login or association.",
    description:
      'This endpoint allows an authenticated user to synchronize a temporary guest cart (identified by ID and token in the request body) with their existing user cart. Users can choose to merge items, keep only guest cart items, or keep only user cart items.',
  })
  @ApiBody({
    type: CheckoutRequestDTO,
    description:
      'Details of the guest cart and the desired synchronization action.',
  })
  @ApiOkResponse({
    description:
      'Cart synchronized successfully. Returns the updated user cart.',
    type: CartDTO,
    schema: {
      properties: {
        data: {
          type: 'object',
          $ref: getSchemaPath(CartDTO),
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Failed to synchronize cart due to invalid input, missing data, or business logic violations (e.g., invalid action, cart not found, invalid credentials).',
  })
  @ApiInternalServerErrorResponse({
    description:
      'An unexpected internal server error occurred during cart synchronization.',
  })
  async cartSynchronize(
    @Req() request: Request,
    @Body()
    body: CheckoutRequestDTO,
  ): Promise<{ data: CartDTO }> {
    try {
      const { id: userId, carId: userCartId } = request.user as any;
      const { guestCartId, guestCartToken, action } = body;

      if (guestCartToken.length !== guestCartToken.trim().length) {
        throw new UnauthorizedException(
          'Invalid or malformed guest cart token (contains leading/trailing spaces).',
        );
      }
      const guestCart = await this.cartService.findCart(guestCartId, {
        userId: null,
        guestToken: guestCartToken,
      });

      if (!guestCart) {
        throw new UnauthorizedException(
          'Guest cart not found or invalid guest cart credentials.',
        );
      }

      let finalCart: CartDTO;

      if (action === CartCheckoutAction.KEEP_GUEST) {
        if (userCartId) {
          await this.cartService.deleteCart(userCartId);
        }
        finalCart = await this.cartService.updateCart(
          guestCartId,
          userId,
          null,
        );
      } else if (action === CartCheckoutAction.KEEP_USER) {
        if (!userCartId) {
          const { cart: newEmptyUserCart } =
            await this.cartService.createCart(userId);
          finalCart = newEmptyUserCart;
        } else {
          finalCart = await this.cartService.findCart(userCartId, {
            userId: userId,
          });
        }
      } else if (action === CartCheckoutAction.MERGE) {
        if (!userCartId) {
          finalCart = await this.cartService.updateCart(
            guestCartId,
            userId,
            null,
          );
        }
        finalCart = await this.cartService.mergeCarts(guestCartId, userCartId);
      } else {
        throw new BadRequestException(
          'Invalid cart synchronization action specified.',
        );
      }

      return { data: finalCart };
    } catch (error) {
      if (error instanceof CustomAPIError) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException(
        'Failed to synchronize the cart due to an unexpected error.',
      );
    }
  }

  @Post(':id/items')
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'x-guest-cart-token',
    description: 'Guest cart token (non-JWT)',
    required: false,
    example: 'guestCartTokeN...',
  })
  @ApiOperation({
    summary:
      'Add or update an item in the cart (Authenticated users and Guests only)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Cart ID' })
  @ApiOkResponse({
    description: 'Item added or updated in cart',
    type: CartItemDTO,
    schema: {
      properties: {
        data: {
          type: 'object',
          $ref: getSchemaPath(CartItemDTO),
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Cart not found or unauthorized.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access to cart' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async addToCart(
    @Req() request: Request,
    @Param('id', ParseUUIDPipe) cartId: string,
    @Body() data: AddToCartDTO,
  ): Promise<{ data: CartItemDTO }> {
    try {
      const user = request.user;
      await this.authorizeCartAccess(user, cartId);
      return {
        data: await this.cartItemService.createOrUpdateItem(cartId, data),
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException(
        'Failed to add the item to the cart due to an unexpected error.',
      );
    }
  }

  @Delete(':id/items/:itemId')
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'x-guest-cart-token',
    description: 'Guest cart token (non-JWT)',
    required: false,
    example: 'guestCartTokeN...',
  })
  @ApiOperation({
    summary:
      'Remove an item from the cart (Authenticated users and Guests only)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Cart ID' })
  @ApiParam({ name: 'itemId', type: String, description: 'Book ID to remove' })
  @ApiOkResponse({
    description: 'Item removed from cart',
    schema: {
      properties: {
        message: {
          type: 'string',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Cart is empty or invalid request' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  @ApiNotFoundResponse({ description: 'Cart not found or unauthorized.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access to cart' })
  async removeItem(
    @Req() request: Request,
    @Param('id', ParseUUIDPipe) cartId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<{ message: string }> {
    try {
      const user = request.user;
      await this.authorizeCartAccess(user, cartId);
      return await this.cartItemService.deleteItem(cartId, { bookId: itemId });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to delete the cart due to an unexpected error.',
      );
    }
  }

  @Post('clear')
  @Roles([RoleEnum.Admin])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove all inactive guest carts (Admin only)' })
  @ApiOkResponse({
    description: 'Inactive guest carts removed',
    schema: {
      properties: {
        removed: {
          type: 'number',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized (Admin only)' })
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

  private async authorizeCartAccess(
    user: any,
    cartId: string,
  ): Promise<CartDTO> {
    let cart: CartDTO | null;

    if (user['role'] === RoleEnum.Admin) {
      cart = await this.cartService.findCart(cartId);
    } else if (user['role'] === RoleEnum.User) {
      if (!user['cartId']) {
        throw new UnauthorizedException('Please create a cart first.');
      }
      if (user['cartId'] !== cartId) {
        throw new UnauthorizedException('Unable to access this cart.');
      }
      cart = await this.cartService.findCart(cartId, {
        userId: user['id'],
      });
    } else if (user['role'] === RoleEnum.GuestUser) {
      if (!user['guestCartToken']) {
        throw new UnauthorizedException('Guest token missing from request.');
      }
      cart = await this.cartService.findCart(cartId, {
        guestToken: user['guestCartToken'],
      });
    } else {
      throw new UnauthorizedException('Invalid user role.');
    }

    if (!cart) {
      throw new NotFoundException('Cart not found or unauthorized.');
    }

    return cart;
  }
}
