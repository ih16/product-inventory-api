# Product Inventory API Server

A lightweight mock API server for product inventory management with time-bound API keys and Swagger documentation.

## Features

- RESTful API endpoints for product inventory management
- Pagination, filtering, sorting, and search capabilities
- Time-bound API key authentication
- Swagger documentation
- Mock data generation
- Persistent data storage in JSON files

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with:

   ```
   PORT=8000
   MASTER_KEY=your-master-key-here
   ```

4. Start the server:
   ```bash
   npm start
   ```

## API Documentation

Access the Swagger documentation at:

```
http://localhost:8000/api-docs
```

## API Authentication

### Generate an API Key

Send a POST request to `/api/auth/generate-key` with the master key and expiration time:

```bash
curl -X POST http://localhost:8000/api/auth/generate-key \
  -H "Content-Type: application/json" \
  -d '{"expiresIn": "1d", "masterKey": "your-master-key-here"}'
```

Response:

```json
{
  "apiKey": "8f9e1a2b-3c4d-5e6f-7g8h-9i0j1k2l3m4n",
  "expiresAt": "2023-06-01T12:00:00.000Z"
}
```

Valid expiration formats: `1h` (hours), `1d` (days), `1w` (weeks)

### Using the API Key

Include the API key in your requests as an `x-api-key` header:

```bash
curl -X GET http://localhost:8000/api/products \
  -H "x-api-key: 8f9e1a2b-3c4d-5e6f-7g8h-9i0j1k2l3m4n"
```

## API Endpoints

### Products

- `GET /api/products`: Get a list of products with filtering, sorting, and pagination
- `GET /api/products/:id`: Get a specific product by ID

### Categories

- `GET /api/categories`: Get a list of all product categories

### Admin

- `POST /api/admin/regenerate-products`: Regenerate mock products (requires master key)

## Query Parameters

### Product List Endpoint

| Parameter | Type   | Description                          | Example               |
| --------- | ------ | ------------------------------------ | --------------------- |
| limit     | number | Number of products per page          | ?limit=20             |
| offset    | number | Number of products to skip           | ?offset=20            |
| sort      | string | Field to sort by (price, title, id)  | ?sort=price           |
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

### Regenerate mock products

```bash
curl -X POST http://localhost:8000/api/admin/regenerate-products \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-valid-api-key" \
  -d '{"count": 100, "masterKey": "your-master-key-here"}'
```

## Data Persistence

The server stores:

- Products data in `products.json`
- API keys in `apiKeys.json`

These files are created automatically if they don't exist.
