# Inventory & Sales Management System

A Node.js Express application with SQLite database for managing inventory, sales, customers, workers, and suppliers.

## Features

- User authentication with JWT
- Dashboard with key statistics
- Sales management
- Inventory tracking
- Customer management
- Worker management
- Supplier management

## Tech Stack

- Node.js
- Express.js
- Prisma ORM
- SQLite
- EJS Templates
- Bootstrap 5
- JWT Authentication

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up the database:
   ```
   npm run prisma:generate
   npm run prisma:migrate
   ```
4. Start the application:
   ```
   npm start
   ```
   
   For development with auto-reload:
   ```
   npm run dev
   ```

## Default Login

- Username: admin
- Password: admin123

## Environment Variables

The following environment variables can be configured in the `.env` file:

- `DATABASE_URL`: SQLite database connection string
- `JWT_SECRET`: Secret key for JWT token generation
- `PORT`: Port number for the server (default: 3000)

## Database Schema

The application uses the following data models:

- User: Authentication and user management
- Inventory: Products and services
- Customer: Customer information and balances
- Supplier: Supplier information and balances
- Worker: Worker information
- Sales: Sales transactions
- SalesItem: Individual items in a sale

## License

ISC 