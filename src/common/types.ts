export interface Category {
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
  title: string;
  description: string;
  isbn: string;
  author: {
    name: string;
  };
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
  items: CartItem[];
}

export interface Review {
  data: string;
  rating: number;
}

export interface OrderItem {
  item: Book;
  quantity: number;
  price: number;
}

export interface Order {
  id: number;
  items: OrderItem[];
  status: string;
  price: number;
  shipping: Shipping | null;
  payment: Payment | null;
}
