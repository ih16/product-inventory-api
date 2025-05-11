// mockData.js
const { faker } = require("@faker-js/faker");

// Categories for products
const categories = [
  "Electronics",
  "Clothing",
  "Home & Kitchen",
  "Books",
  "Sports & Outdoors",
  "Beauty & Personal Care",
  "Toys & Games",
  "Automotive",
  "Health & Wellness",
  "Office Supplies",
];

// Generate a random product
const generateProduct = (id) => {
  const category = categories[Math.floor(Math.random() * categories.length)];
  const createdAt = faker.date.past();

  return {
    id,
    title: faker.commerce.productName(),
    price: parseFloat(faker.commerce.price({ min: 5, max: 1000 })),
    description: faker.commerce.productDescription(),
    category,
    images: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () =>
      faker.image.url({ width: 640, height: 480, category: "product" })
    ),
    createdAt: createdAt.toISOString(),
    updatedAt: faker.date
      .between({ from: createdAt, to: new Date() })
      .toISOString(),
  };
};

// Generate an array of products
const generateMockProducts = (count) => {
  return Array.from({ length: count }, (_, index) =>
    generateProduct(index + 1)
  );
};

module.exports = {
  generateMockProducts,
  categories,
};
