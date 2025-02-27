## Todos

Step 1: Authentication & User Management (Backend)

1. [x] User Registration Endpoint:
   - Implement the API endpoint to handle user registration.
   - Ensure password hashing and validate input data (e.g., email format).
   - Store new user in the database.
   - Specific Details:
     - Use bcrypt for hashing passwords.
     - Validate unique email addresses and strong password criteria.
2. [x] Login Endpoint (JWT Authentication):
   - Implement login API to authenticate users and generate JWT tokens.
   - Implement quard for token validation for protected routes.
   - Specific Details:
     - Store JWT token in cookies or return in the response body for frontend to store.
3. [] Password Reset Endpoint:
   - Create an endpoint that generates a password reset token and sends it to the user’s email.
   - Implement token validation when the user clicks the reset link.
   - Specific Details:
     - Token expiration (e.g., 1 hour).
     - Send a temporary link to the user’s email to reset the password.
4. [] User Profile Management Endpoint:
   - Create an API endpoint to get and update the user’s profile (name, email).
   - Implement a PUT method for updating user profile data.
   - Specific Details:
     - Ensure that password updates require a confirmation (old password + new password).

Step 2: Book Management (Backend)

1. [] Create CRUD Operations for Books:
   - Create API endpoints for creating, updating, reading, and deleting books.
   - Implement validation for book fields (e.g., title, price, description).
   - Specific Details:
     - Ensure all book data is sanitized before storage.
2. [] Book Search & Filter Endpoint:
   - Implement an endpoint to allow searching by title, author, category, and ISBN.
   - Add filtering for price range, rating, and stock availability.
   - Specific Details:
     - Pagination for search results.
     - Provide sorting options (price, rating).
3. [] Admin Authentication & Authorization:
   - Implement authentication for admin users (JWT token).
   - Create role-based access to ensure only admins can add/update books.
   - Specific Details:
     - Use guard to check for admin role before granting access to certain endpoints.

Step 3: Cart and Checkout System (Backend)

1. [] Cart API:
   - Create API endpoints to manage cart operations (add/remove/update items).
   - Track user sessions for the cart (create cart, update cart based on user).
   - Specific Details:
     - Store cart data temporarily in the session or in the database for persistence.
2. [] Order Creation Endpoint:
   - Implement the order creation endpoint to capture user details, cart items, and payment.
   - Calculate the total price, including taxes and discounts.
   - Specific Details:
     - Associate the order with the logged-in user and update inventory levels.
3. [] Payment Gateway Integration:
   - Integrate a payment gateway (Stripe/PayPal) for handling payments.
   - Implement API logic to verify payment status (successful/failed).
   - Specific Details:
     - Store payment transaction details (transaction ID, status).

Step 4: Order Management & Payment Processing (Backend)

1. [] Order Status Update Endpoint:
   - Create an endpoint to update the status of orders (pending, shipped, delivered).
   - Specific Details:
     - Notify users of status changes via email.
2. [] Payment Verification:
   - Implement payment verification to check for successful payments.
   - Integrate with the payment gateway’s API to validate the transaction.
   - Specific Details:
     - Handle failures (e.g., payment declined) and notify the user.
3. [] Inventory Update After Order:
   - Automatically reduce stock in inventory based on the order items.
   - Prevent over-selling by ensuring the stock level is checked before order finalization.
   - Specific Details:
     - Ensure stock levels are updated in real-time upon order placement.

Step 5: Review & Rating System (Backend)

1. [] Review Creation Endpoint:
   - Create an endpoint to submit reviews with ratings and text.
   - Ensure each user can only submit one review per book.
   - Specific Details:
     - Store review data and associate it with the correct book and user.
2. [] Fetch Reviews Endpoint:
   - Create API to fetch reviews for a specific book.
   - Calculate average rating for the book and return it in the response.
   - Specific Details:
     - Include pagination for fetching reviews if there are many.

Step 6: Admin Features & Security (Backend)

1. [] Admin Role Management:
   - Implement role-based access control (RBAC) for admins.
   - Allow only users with admin roles to access certain APIs (like book management).
   - Specific Details:
     - Use guard to protect sensitive admin routes.
2. [] Generate Reports for Admins:
   - Create endpoints for generating sales reports (e.g., total sales, bestselling books).
   - Allow admins to download reports as CSV files.
   - Specific Details:
     - Enable filtering for date ranges and categories.

Step 7: Testing, Bug Fixing, and Performance Optimization

1. [] Backend Testing:
   - Write unit tests for authentication, book CRUD operations, order processing.
   - Use Supertest or Mocha for API testing.
   - Specific Details:
     - Test edge cases and error handling (e.g., invalid book data, payment failures).
2. [] Performance Optimization:
   - Optimize backend performance by indexing frequently queried database columns.
   - Specific Details:
     - Perform load testing to ensure scalability under high traffic.

Step 8: Deployment & Final Polish

1. [] Deploy to Production:
   - Set up production environments for backend.
   - Deploy the backend to Heroku or AWS.
   - Specific Details:
     - Implement continuous integration/deployment (CI/CD) for automated deployment.
2. [] Post-Launch Monitoring:
   - Monitor for any critical issues post-launch.
   - Collect user feedback and fix any issues as necessary.
   - Specific Details:
     - Set up logging and error tracking tools (e.g., Sentry, LogRocket).
