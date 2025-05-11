# Product Inventory API Server

A lightweight mock API server for product inventory management with time-bound API keys and Swagger documentation.

## Features

- RESTful API endpoints for product management
- Pagination, filtering, sorting, and search capabilities
- Time-bound API key authentication
- Swagger documentation
- Mock data generation

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

For development with hot-reload:

```bash
npm run dev
```

## API Documentation

Access the Swagger documentation at:

```
http://localhost:3001/api-docs
```

## API Authentication

### Generate an API Key

Send a POST request to `/api/auth/generate-key` with an optional expiration time:

```bash
curl -X POST http://localhost:3001/api/auth/generate-key \
  -H "Content-Type: application/json" \
  -d '{"expiresIn": "1d"}'
```

Response:

```json
{
  "apiKey": "8f9e1a2b-3c4d-5e6f-7g8h-9i0j1k2l3m4n",
  "expiresAt": "2023-06-01T12:00:00.000Z"
}
```

### Using the API Key

Include the API key in your requests as an `x-api-key` header:

```bash
curl -X GET http://localhost:3001/api/products \
  -H "x-api-key: 8f9e1a2b-3c4d-5e6f-7g8h-9i0j1k2l3m4n"
```

## API Endpoints

### Products

- `GET /api/products`: Get a list of products with filtering, sorting, and pagination
- `GET /api/products/:id`: Get a specific product by ID

### Categories

- `GET /api/categories`: Get a list of all product categories

## Query Parameters

### Product List Endpoint

| Parameter | Type   | Description                          | Example               |
| --------- | ------ | ------------------------------------ | --------------------- |
| limit     | number | Number of products per page          | ?limit=20             |
| offset    | number | Number of products to skip           | ?offset=20            |
| sort      | string | Field to sort by (price, title)      | ?sort=price           |
| order     | string | Sort order (asc, desc)               | ?order=desc           |
| category  | string | Filter by category (comma-separated) | ?category=Electronics |
| minPrice  | number | Minimum price filter                 | ?minPrice=50          |
| maxPrice  | number | Maximum price filter                 | ?maxPrice=500         |
| search    | string | Search in title and description      | ?search=wireless      |

## Example Usage

### Get products with pagination

```
GET /api/products?limit=10&offset=0
```

### Search products

```
GET /api/products?search=wireless
```

### Filter by category and price range

```
GET /api/products?category=Electronics&minPrice=50&maxPrice=200
```

### Sort products by price in descending order

```
GET /api/products?sort=price&order=desc
```
