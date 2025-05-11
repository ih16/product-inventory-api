// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const { v4: uuidv4 } = require("uuid");
const { generateMockProducts } = require("./mockData");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 8000;

// Import database operations
const {
  initializeDatabase,
  getProductsFromDb,
  saveProductsToDb,
  getApiKeysFromDb,
  saveApiKeyToDb,
  removeApiKeyFromDb,
  initializeWithMockDataIfEmpty,
} = require("./db");

// Initialize database
let products = [];
let apiKeys = {};

// Asynchronously initialize the application
const initializeApp = async () => {
  try {
    await initializeDatabase();
    await initializeWithMockDataIfEmpty();

    // Load products and API keys
    products = (await getProductsFromDb()) || [];
    apiKeys = await getApiKeysFromDb();

    console.log(`Loaded ${products.length} products from database`);
    console.log(`Loaded ${Object.keys(apiKeys).length} API keys from database`);
  } catch (err) {
    console.error("Error initializing application:", err);
  }
};

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
        url: process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : `http://localhost:${PORT}`,
        description: process.env.VERCEL_URL
          ? "Production server"
          : "Development server",
      },
    ],
  },
  apis: ["./server.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Key middleware
const validateApiKey = async (req, res, next) => {
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
    // Remove the expired key from database
    await removeApiKeyFromDb(apiKey);
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
app.post("/api/auth/generate-key", async (req, res) => {
  const { expiresIn = "1d", masterKey } = req.body;

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

  const keyData = {
    expiresAt,
    createdAt: Date.now(),
  };

  apiKeys[apiKey] = keyData;

  // Save to database
  try {
    await saveApiKeyToDb(apiKey, keyData);

    res.json({
      apiKey,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  } catch (err) {
    console.error("Error saving API key:", err);
    res.status(500).json({ message: "Error generating API key" });
  }
});

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
app.post("/api/admin/regenerate-products", async (req, res) => {
  const { count = 100, masterKey } = req.body;

  if (masterKey !== process.env.MASTER_KEY) {
    return res.status(403).json({ message: "Invalid master key" });
  }

  try {
    products = generateMockProducts(count);
    await saveProductsToDb(products);

    res.json({
      message: "Products regenerated successfully",
      count: products.length,
    });
  } catch (err) {
    console.error("Error regenerating products:", err);
    res.status(500).json({ message: "Error regenerating products" });
  }
});

// Initialize app and start server
initializeApp().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(
      `Swagger documentation available at http://localhost:${PORT}/api-docs`
    );
  });
});
