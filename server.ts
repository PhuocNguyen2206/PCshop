import express from "express";
import { createServer as createViteServer } from "vite";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ CẤU HÌNH MySQL ============
// Cấu hình trong file .env.local:
//   DB_HOST=localhost
//   DB_USER=root
//   DB_PASSWORD=matkhau
//   DB_NAME=pcmaster
const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "0795662034",
  database: process.env.DB_NAME || "pcmaster",
  waitForConnections: true,
  connectionLimit: 10,
};

async function initDatabase() {
  // Tạo database nếu chưa tồn tại
  const tempConn = await mysql.createConnection({
    host: DB_CONFIG.host,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
  });
  await tempConn.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\``);
  await tempConn.end();

  // Tạo connection pool
  const pool = mysql.createPool(DB_CONFIG);

  // Tạo bảng
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      price INT NOT NULL,
      stock INT DEFAULT 0,
      image_url TEXT,
      category_id INT,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      customer_name VARCHAR(255) NOT NULL,
      customer_email VARCHAR(255) NOT NULL,
      total_amount INT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT,
      product_id INT,
      quantity INT,
      price INT,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // Seed dữ liệu mẫu nếu bảng trống
  const [catRows] = await pool.execute("SELECT COUNT(*) as count FROM categories") as any;
  if (catRows[0].count === 0) {
    await pool.execute("INSERT INTO categories (name, slug) VALUES ('CPU', 'cpu'), ('VGA', 'vga'), ('RAM', 'ram'), ('Mainboard', 'mainboard'), ('SSD', 'ssd')");

    await pool.execute(
      "INSERT INTO products (name, slug, description, price, stock, image_url, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["Intel Core i9-14900K", "i9-14900k", "Vi xử lý Intel Core i9 thế hệ 14 mạnh mẽ nhất.", 15500000, 10, "https://picsum.photos/seed/cpu/400/400", 1]
    );
    await pool.execute(
      "INSERT INTO products (name, slug, description, price, stock, image_url, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["NVIDIA RTX 4090", "rtx-4090", "Card đồ họa đỉnh cao cho gaming và đồ họa.", 45000000, 5, "https://picsum.photos/seed/vga/400/400", 2]
    );
    await pool.execute(
      "INSERT INTO products (name, slug, description, price, stock, image_url, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["Corsair Vengeance RGB 32GB", "corsair-ram-32gb", "Ram DDR5 tốc độ cao với đèn LED RGB.", 3500000, 20, "https://picsum.photos/seed/ram/400/400", 3]
    );
  }

  const [userRows] = await pool.execute("SELECT COUNT(*) as count FROM users") as any;
  if (userRows[0].count === 0) {
    // DEMO MODE: Lưu plain text password tạm thời (không dùng bcrypt)
    const adminPassword = "admin123";
    await pool.execute(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      ["Admin", "admin@pcmaster.vn", adminPassword, "admin"]
    );
  } else {
    // Cập nhật user admin nếu đã tồn tại (cho DEMO MODE)
    await pool.execute(
      "UPDATE users SET password = ? WHERE email = ?",
      ["admin123", "admin@pcmaster.vn"]
    );
  }

  console.log("Kết nối MySQL thành công & khởi tạo database xong!");
  return pool;
}

async function startServer() {
  const db = await initDatabase();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body;
    try {
      // DEMO MODE: Lưu plain text password tạm thời (không dùng bcrypt)
      const [result] = await db.execute(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name, email, password]
      ) as any;
      res.status(201).json({ id: result.insertId, name, email, role: "user" });
    } catch (error) {
      res.status(400).json({ error: "Email đã tồn tại" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [email]) as any;
    const user = rows[0];
    // DEMO MODE: So sánh plain text (khi chuyển production, dùng bcrypt.compare)
    if (user && password === user.password) {
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ error: "Sai email hoặc mật khẩu" });
    }
  });

  // API Routes
  app.get("/api/categories", async (req, res) => {
    const [categories] = await db.execute("SELECT * FROM categories");
    res.json(categories);
  });

  app.get("/api/products", async (req, res) => {
    const { category } = req.query;
    let products;
    if (category) {
      [products] = await db.execute(
        `SELECT p.*, c.name as category_name 
         FROM products p 
         JOIN categories c ON p.category_id = c.id 
         WHERE c.slug = ?`,
        [category]
      );
    } else {
      [products] = await db.execute(
        `SELECT p.*, c.name as category_name 
         FROM products p 
         JOIN categories c ON p.category_id = c.id`
      );
    }
    res.json(products);
  });

  app.get("/api/products/:slug", async (req, res) => {
    const [rows] = await db.execute("SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.slug = ?", [req.params.slug]) as any;
    if (rows[0]) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ error: "Không tìm thấy sản phẩm" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    const { user_id, customer_name, customer_email, items, total_amount } = req.body;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [orderResult] = await conn.execute(
        "INSERT INTO orders (user_id, customer_name, customer_email, total_amount) VALUES (?, ?, ?, ?)",
        [user_id, customer_name, customer_email, total_amount]
      ) as any;

      const orderId = orderResult.insertId;

      for (const item of items) {
        await conn.execute(
          "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
          [orderId, item.id, item.quantity, item.price]
        );
        await conn.execute(
          "UPDATE products SET stock = stock - ? WHERE id = ?",
          [item.quantity, item.id]
        );
      }

      await conn.commit();
      res.status(201).json({ id: orderId, message: "Đặt hàng thành công" });
    } catch (error) {
      await conn.rollback();
      res.status(500).json({ error: "Đặt hàng thất bại" });
    } finally {
      conn.release();
    }
  });

  // Admin API
  app.get("/api/admin/stats", async (req, res) => {
    const [orderRows] = await db.execute("SELECT COUNT(*) as count FROM orders") as any;
    const [revenueRows] = await db.execute("SELECT SUM(total_amount) as total FROM orders") as any;
    const [productRows] = await db.execute("SELECT COUNT(*) as count FROM products") as any;

    res.json({
      totalOrders: orderRows[0].count,
      totalRevenue: revenueRows[0].total || 0,
      totalProducts: productRows[0].count,
    });
  });

  app.get("/api/admin/orders", async (req, res) => {
    const [orders] = await db.execute("SELECT * FROM orders ORDER BY created_at DESC");
    res.json(orders);
  });

  app.put("/api/admin/orders/:id", async (req, res) => {
    const { status } = req.body;
    const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ" });
    }
    try {
      await db.execute(
        "UPDATE orders SET status = ? WHERE id = ?",
        [status, req.params.id]
      );
      res.json({ message: "Cập nhật trạng thái thành công" });
    } catch (error) {
      res.status(400).json({ error: "Cập nhật trạng thái thất bại" });
    }
  });

  app.post("/api/admin/products", async (req, res) => {
    const { name, slug, description, price, stock, image_url, category_id } = req.body;
    try {
      const [result] = await db.execute(
        "INSERT INTO products (name, slug, description, price, stock, image_url, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [name, slug, description, price, stock, image_url, category_id]
      ) as any;
      res.status(201).json({ id: result.insertId });
    } catch (error) {
      res.status(400).json({ error: "Thêm sản phẩm thất bại" });
    }
  });

  app.delete("/api/admin/products/:id", async (req, res) => {
    await db.execute("DELETE FROM products WHERE id = ?", [req.params.id]);
    res.json({ message: "Đã xóa sản phẩm" });
  });

  app.put("/api/admin/products/:id", async (req, res) => {
    const { name, slug, description, price, stock, image_url, category_id } = req.body;
    try {
      await db.execute(
        `UPDATE products 
         SET name = ?, slug = ?, description = ?, price = ?, stock = ?, image_url = ?, category_id = ?
         WHERE id = ?`,
        [name, slug, description, price, stock, image_url, category_id, req.params.id]
      );
      res.json({ message: "Cập nhật sản phẩm thành công" });
    } catch (error) {
      res.status(400).json({ error: "Cập nhật sản phẩm thất bại" });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    const [users] = await db.execute("SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC");
    res.json(users);
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    const [rows] = await db.execute("SELECT role FROM users WHERE id = ?", [req.params.id]) as any;
    if (rows[0] && rows[0].role === "admin") {
      return res.status(403).json({ error: "Không thể xóa tài khoản admin" });
    }
    await db.execute("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ message: "Đã xóa người dùng" });
  });

  // Vite middleware cho development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
}

startServer();
