// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const { v4: uuidv4 } = require("uuid");
const { generateMockProducts } = require("./mockData");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 8000;

const PRODUCTS_FILE = path.join(__dirname, "products.json");
const API_KEYS_FILE = path.join(__dirname, "apiKeys.json");

// In-memory storage for Vercel environment
let inMemoryProducts = null;
let inMemoryApiKeys = {};

// Check if we're running in Vercel's production environment
const isVercel = process.env.VERCEL === "1";

// Function to save products to file or memory
const saveProductsToFile = (products) => {
  if (isVercel) {
    inMemoryProducts = products;
    console.log("Products saved to memory");
  } else {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
    console.log("Products saved to file");
  }
};

// Function to save API keys to file or memory
const saveApiKeysToFile = (keys) => {
  if (isVercel) {
    inMemoryApiKeys = keys;
    console.log("API keys saved to memory");
  } else {
    fs.writeFileSync(API_KEYS_FILE, JSON.stringify(keys, null, 2));
    console.log("API keys saved to file");
  }
};

// Function to load products from file or memory
const loadProductsFromFile = () => {
  if (isVercel) {
    if (inMemoryProducts) {
      return inMemoryProducts;
    }
    // Initialize with products.json if available
    try {
      const data = fs.readFileSync(PRODUCTS_FILE, "utf8");
      console.log("Products loaded from initial file");
      return JSON.parse(data);
    } catch (err) {
      console.error("Error loading initial products:", err);
      return null;
    }
  }

  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const data = fs.readFileSync(PRODUCTS_FILE, "utf8");
      console.log("Products loaded from file");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error loading products from file:", err);
  }
  return null;
};

// Function to load API keys from file or memory
const loadApiKeysFromFile = () => {
  if (isVercel) {
    return inMemoryApiKeys;
  }

  try {
    if (fs.existsSync(API_KEYS_FILE)) {
      const data = fs.readFileSync(API_KEYS_FILE, "utf8");
      console.log("API keys loaded from file");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error loading API keys from file:", err);
  }
  return {};
};

// Load existing products or generate new ones
let products = loadProductsFromFile();
if (!products) {
  products = generateMockProducts(100);
  saveProductsToFile(products);
}

// Load existing API keys
let apiKeys = loadApiKeysFromFile();

// Middleware
app.use(express.json());
app.use(cors());

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Product Inventory API",
      version: "1.0.0",
      description: "A mock API for product inventory management",
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Development server",
      },
    ],
  },
  apis: ["./server.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Key middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  // Skip validation for API key generation endpoint
  if (req.path === "/api/auth/generate-key") {
    return next();
  }

  if (!apiKey) {
    return res.status(401).json({ message: "API key is required" });
  }

  const keyData = apiKeys[apiKey];

  if (!keyData) {
    return res.status(401).json({ message: "Invalid API key" });
  }

  if (Date.now() > keyData.expiresAt) {
    delete apiKeys[apiKey];
    // Save the updated apiKeys object after removing expired keys
    saveApiKeysToFile(apiKeys);
    return res.status(401).json({ message: "API key has expired" });
  }

  next();
};

app.use(validateApiKey);

/**
 * @swagger
 * /api/auth/generate-key:
 *   post:
 *     summary: Generate a new API key
 *     description: Creates a new time-bound API key for access to the API
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expiresIn:
 *                 type: string
 *                 description: Duration for which the key should be valid (e.g., '1h', '1d', '7d')
 *                 default: '1d'
 *               masterKey:
 *                 type: string
 *                 description: Master key for generating API keys
 *                 default: 'your-master-key'
 *     responses:
 *       200:
 *         description: Successfully generated API key
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKey:
 *                   type: string
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 */
app.post("/api/auth/generate-key", (req, res) => {
  const { expiresIn = "1d", masterKey } = req.body;

  console.log("Master Key:", masterKey);
  console.log("masterKey from env:", process.env.MASTER_KEY);
  if (masterKey !== process.env.MASTER_KEY) {
    return res.status(403).json({ message: "Invalid master key" });
  }

  // Convert expiresIn to milliseconds
  const durationMap = {
    h: 60 * 60 * 1000, // hours
    d: 24 * 60 * 60 * 1000, // days
    w: 7 * 24 * 60 * 60 * 1000, // weeks
  };

  const match = expiresIn.match(/^(\d+)([hdw])$/);
  if (!match) {
    return res.status(400).json({
      message: "Invalid expiresIn format. Use format like 1h, 1d, 7d",
    });
  }

  const [, amount, unit] = match;
  const durationMs = parseInt(amount) * durationMap[unit];

  const expiresAt = Date.now() + durationMs;
  const apiKey = uuidv4();

  apiKeys[apiKey] = {
    expiresAt,
    createdAt: Date.now(),
  };

  // Save updated API keys to file
  saveApiKeysToFile(apiKeys);

  res.json({
    apiKey,
    expiresAt: new Date(expiresAt).toISOString(),
  });
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The product ID
 *         title:
 *           type: string
 *           description: The product title
 *         price:
 *           type: number
 *           format: float
 *           description: The product price
 *         description:
 *           type: string
 *           description: The product description
 *         category:
 *           type: string
 *           description: The product category
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: URLs to product images
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     description: Retrieve a list of products with pagination, sorting, filtering, and search
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of products to return per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of products to skip
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [price, title]
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order (ascending or descending)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category (comma-separated for multiple)
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price for filtering
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price for filtering
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *     responses:
 *       200:
 *         description: A list of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
app.get("/api/products", (req, res) => {
  let {
    limit = 10,
    offset = 0,
    sort = "id",
    order = "asc",
    category,
    minPrice,
    maxPrice,
    search,
  } = req.query;

  // Convert to appropriate types
  limit = parseInt(limit);
  offset = parseInt(offset);
  minPrice = minPrice ? parseFloat(minPrice) : undefined;
  maxPrice = maxPrice ? parseFloat(maxPrice) : undefined;

  // Filter products
  let filteredProducts = [...products];

  // Category filter
  if (category) {
    const categories = category.split(",");
    filteredProducts = filteredProducts.filter((product) =>
      categories.includes(product.category)
    );
  }

  // Price range filter
  if (minPrice !== undefined) {
    filteredProducts = filteredProducts.filter(
      (product) => product.price >= minPrice
    );
  }

  if (maxPrice !== undefined) {
    filteredProducts = filteredProducts.filter(
      (product) => product.price <= maxPrice
    );
  }

  // Search filter
  if (search) {
    const searchLower = search.toLowerCase();
    filteredProducts = filteredProducts.filter(
      (product) =>
        product.title.toLowerCase().includes(searchLower) ||
        product.description.toLowerCase().includes(searchLower)
    );
  }

  // Sort products
  filteredProducts.sort((a, b) => {
    let comparison = 0;
    if (sort === "price") {
      comparison = a.price - b.price;
    } else if (sort === "title") {
      comparison = a.title.localeCompare(b.title);
    } else {
      comparison = a.id - b.id;
    }

    return order === "desc" ? -comparison : comparison;
  });

  // Pagination
  const total = filteredProducts.length;
  const paginatedProducts = filteredProducts.slice(offset, offset + limit);

  res.json({
    products: paginatedProducts,
    pagination: {
      total,
      limit,
      offset,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get a product by ID
 *     description: Retrieve detailed information about a specific product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The product ID
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 */
app.get("/api/products/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const product = products.find((p) => p.id === id);

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  res.json(product);
});

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     description: Retrieve a list of all product categories
 *     responses:
 *       200:
 *         description: A list of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
app.get("/api/categories", (req, res) => {
  const categories = [...new Set(products.map((p) => p.category))];
  res.json(categories);
});

/**
 * @swagger
 * /api/admin/regenerate-products:
 *   post:
 *     summary: Regenerate mock products
 *     description: Regenerates the mock product data (requires master key)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               count:
 *                 type: integer
 *                 description: Number of products to generate
 *                 default: 100
 *               masterKey:
 *                 type: string
 *                 description: Master key for authentication
 *     responses:
 *       200:
 *         description: Successfully regenerated products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 count:
 *                   type: integer
 *       403:
 *         description: Invalid master key
 */
app.post("/api/admin/regenerate-products", (req, res) => {
  const { count = 100, masterKey } = req.body;

  if (masterKey !== process.env.MASTER_KEY) {
    return res.status(403).json({ message: "Invalid master key" });
  }

  products = generateMockProducts(count);
  saveProductsToFile(products);

  res.json({
    message: "Products regenerated successfully",
    count: products.length,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `Swagger documentation available at http://localhost:${PORT}/api-docs`
  );
});
