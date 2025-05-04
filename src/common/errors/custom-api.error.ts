export class CustomAPIError extends Error {
  constructor(error: string) {
    super(error);
  }
}
