const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const { generateMockProducts } = require("./mockData");

// Create the data directory if it doesn't exist
const DB_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR);
}

const DB_PATH = path.join(DB_DIR, "inventory.sqlite");
const db = new sqlite3.Database(DB_PATH);

// Initialize database
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Products table
      db.run(
        `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT,
        category TEXT,
        images TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`,
        (err) => {
          if (err) reject(err);
        }
      );

      // API Keys table
      db.run(
        `CREATE TABLE IF NOT EXISTS api_keys (
        api_key TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`,
        (err) => {
          if (err) reject(err);
        }
      );

      resolve();
    });
  });
}

// Products operations
function getProductsFromDb() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM products", (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      if (rows && rows.length > 0) {
        // Parse JSON string back to array for images
        const products = rows.map((product) => ({
          ...product,
          images: JSON.parse(product.images),
        }));
        resolve(products);
      } else {
        resolve(null); // No products found
      }
    });
  });
}

function saveProductsToDb(products) {
  return new Promise((resolve, reject) => {
    // Begin transaction
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      // Clear existing products
      db.run("DELETE FROM products", (err) => {
        if (err) {
          db.run("ROLLBACK");
          reject(err);
          return;
        }

        // Prepare statement for inserting products
        const stmt = db.prepare(`INSERT INTO products 
          (id, title, price, description, category, images, createdAt, updatedAt) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

        // Insert all products
        products.forEach((product) => {
          stmt.run(
            product.id,
            product.title,
            product.price,
            product.description,
            product.category,
            JSON.stringify(product.images),
            product.createdAt,
            product.updatedAt
          );
        });

        stmt.finalize();

        // Commit transaction
        db.run("COMMIT", (err) => {
          if (err) {
            db.run("ROLLBACK");
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  });
}

// API Keys operations
function getApiKeysFromDb() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM api_keys", (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      const apiKeys = {};
      if (rows && rows.length > 0) {
        rows.forEach((row) => {
          apiKeys[row.api_key] = {
            expiresAt: row.expires_at,
            createdAt: row.created_at,
          };
        });
      }
      resolve(apiKeys);
    });
  });
}

function saveApiKeyToDb(apiKey, data) {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT OR REPLACE INTO api_keys (api_key, expires_at, created_at) VALUES (?, ?, ?)",
      [apiKey, data.expiresAt, data.createdAt],
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

function removeApiKeyFromDb(apiKey) {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM api_keys WHERE api_key = ?", [apiKey], (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

// Initialize database with products if empty
async function initializeWithMockDataIfEmpty() {
  try {
    const products = await getProductsFromDb();
    if (!products) {
      const mockProducts = generateMockProducts(100);
      await saveProductsToDb(mockProducts);
      console.log("Database initialized with mock products");
    }
  } catch (err) {
    console.error("Error initializing with mock data:", err);
  }
}

module.exports = {
  db,
  initializeDatabase,
  getProductsFromDb,
  saveProductsToDb,
  getApiKeysFromDb,
  saveApiKeyToDb,
  removeApiKeyFromDb,
  initializeWithMockDataIfEmpty,
};
