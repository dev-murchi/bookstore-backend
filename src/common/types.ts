export interface Category {
  id: number;
  value: string;
}

export interface Role {
  value: string;
}

export interface Payment {
  transactionId: string;
  status: string;
  method: string;
  amount: number;
}

export interface Address {
  country: string;
  state: string;
  city: string;
  line1: string;
  line2: string;
  postalCode: string;
}

export interface Shipping {
  email: string;
  phone: string;
  address: Address;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface PasswordResetToken {
  token: string;
  expiresAt: Date;
}

export interface Book {
  id: string;
  title: string;
  description: string;
  isbn: string;
  author: {
    name: string;
  };
  category: Category;
  price: number;
  rating: number;
  imageUrl: string;
}

export interface CartItem {
  item: Book;
  quantity: number;
}

export interface Cart {
  id: number;
  owner: string;
  items: CartItem[];
  totalPrice: number;
}

export interface Review {
  id: number;
  data: string;
  rating: number;
  book: string;
  owner: string;
}

export interface OrderItem {
  item: Book;
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  status: string;
  price: number;
  shipping?: Shipping;
  payment?: Payment;
}

export interface CheckoutData {
  order: Order;
  message: string;
  expiresAt: number;
  url: string;
}
