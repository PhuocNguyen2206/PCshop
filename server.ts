import express from "express";
import { createServer as createViteServer } from "vite";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ CẤU HÌNH MySQL ============
// Cấu hình trong file .env.local:
//   DB_HOST=localhost
//   DB_USER=root
//   DB_PASSWORD=matkhau
//   DB_NAME=pcmaster
const JWT_SECRET = process.env.JWT_SECRET || "pcmaster_default_dev_key";
if (!process.env.JWT_SECRET) {
  console.warn("⚠️  CẢNH BÁO: JWT_SECRET chưa được cấu hình trong .env.local — đang dùng key mặc định (chỉ dùng cho dev)!");
}

// ============ CẤU HÌNH GHN / DEMO MODE ============
const GHN_TOKEN = process.env.GHN_TOKEN || "";
const GHN_SHOP_ID = process.env.GHN_SHOP_ID || "";
const SHIPPING_MODE = GHN_TOKEN ? "ghn" : "demo";  // demo = auto-simulate

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
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
      user_id INT DEFAULT NULL,
      customer_name VARCHAR(255) NOT NULL,
      customer_email VARCHAR(255) NOT NULL,
      total_amount INT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      tracking_code VARCHAR(255) DEFAULT NULL,
      shipping_provider VARCHAR(100) DEFAULT NULL,
      shipped_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
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

  // Auto-migrate: đảm bảo orders.user_id hỗ trợ ON DELETE SET NULL cho DB cũ
  try {
    const [fkRows] = await pool.execute(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'user_id' AND REFERENCED_TABLE_NAME = 'users'`,
      [DB_CONFIG.database]
    ) as any;
    if (fkRows.length > 0) {
      const fkName = fkRows[0].CONSTRAINT_NAME;
      // Kiểm tra nếu FK chưa có ON DELETE SET NULL thì migrate
      const [fkDetail] = await pool.execute(
        `SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS 
         WHERE CONSTRAINT_SCHEMA = ? AND CONSTRAINT_NAME = ?`,
        [DB_CONFIG.database, fkName]
      ) as any;
      if (fkDetail.length > 0 && fkDetail[0].DELETE_RULE !== 'SET NULL') {
        await pool.execute(`ALTER TABLE orders DROP FOREIGN KEY \`${fkName}\``);
        await pool.execute(`ALTER TABLE orders MODIFY user_id INT DEFAULT NULL`);
        await pool.execute(`ALTER TABLE orders ADD CONSTRAINT \`${fkName}\` FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL`);
        console.log("✅ Đã migrate FK orders.user_id → ON DELETE SET NULL");
      }
    }
  } catch (e) {
    // Bỏ qua nếu migrate thất bại (DB mới tạo sẽ không cần)
  }

  // Auto-migrate: thêm cột tracking nếu chưa có (cho DB cũ)
  try {
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'tracking_code'`,
      [DB_CONFIG.database]
    ) as any;
    if (cols.length === 0) {
      await pool.execute(`ALTER TABLE orders ADD COLUMN tracking_code VARCHAR(255) DEFAULT NULL`);
      await pool.execute(`ALTER TABLE orders ADD COLUMN shipping_provider VARCHAR(100) DEFAULT NULL`);
      await pool.execute(`ALTER TABLE orders ADD COLUMN shipped_at DATETIME DEFAULT NULL`);
      console.log("✅ Đã migrate: thêm cột tracking cho orders");
    }
  } catch (e) {
    // Bỏ qua
  }

  // Seed dữ liệu mẫu nếu bảng trống
  const [catRows] = await pool.execute("SELECT COUNT(*) as count FROM categories") as any;
  if (catRows[0].count === 0) {
    const categoryValues = [['CPU', 'cpu'], ['VGA', 'vga'], ['RAM', 'ram'], ['Mainboard', 'mainboard'], ['SSD', 'ssd']];
    for (const [name, slug] of categoryValues) {
      await pool.execute("INSERT INTO categories (name, slug) VALUES (?, ?)", [name, slug]);
    }

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
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await pool.execute(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      ["Admin", "admin@pcmaster.vn", hashedPassword, "admin"]
    );
  } else {
    // Migrate plain-text passwords to bcrypt (for existing databases)
    const [users] = await pool.execute("SELECT id, password FROM users") as any;
    for (const u of users) {
      if (!u.password.startsWith("$2a$") && !u.password.startsWith("$2b$")) {
        const hashed = await bcrypt.hash(u.password, 10);
        await pool.execute("UPDATE users SET password = ? WHERE id = ?", [hashed, u.id]);
      }
    }
  }

  console.log("Kết nối MySQL thành công & khởi tạo database xong!");
  return pool;
}

async function startServer() {
  const db = await initDatabase();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // JWT Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Chưa đăng nhập" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch {
      return res.status(403).json({ error: "Token không hợp lệ hoặc hết hạn" });
    }
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền truy cập" });
    }
    next();
  };

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body;
    // Validate input
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ error: "Họ tên phải có ít nhất 2 ký tự" });
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Email không hợp lệ" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự" });
    }
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const [result] = await db.execute(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name.trim(), email.trim().toLowerCase(), hashedPassword]
      ) as any;
      const user = { id: result.insertId, name: name.trim(), email: email.trim().toLowerCase(), role: "user" };
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      res.status(201).json({ ...user, token });
    } catch (error) {
      res.status(400).json({ error: "Email đã tồn tại" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [email]) as any;
    const user = rows[0];
    if (user && await bcrypt.compare(password, user.password)) {
      const { password: _, ...userWithoutPassword } = user;
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ ...userWithoutPassword, token });
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

  app.post("/api/orders", authenticateToken, async (req, res) => {
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
        // Kiểm tra stock đủ hàng
        const [stockRows] = await conn.execute(
          "SELECT stock FROM products WHERE id = ? FOR UPDATE",
          [item.id]
        ) as any;
        if (!stockRows[0] || stockRows[0].stock < item.quantity) {
          await conn.rollback();
          conn.release();
          return res.status(400).json({ error: `Sản phẩm "${item.name || item.id}" không đủ hàng trong kho` });
        }
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

  // Admin API (protected)
  app.get("/api/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
    const [orderRows] = await db.execute("SELECT COUNT(*) as count FROM orders") as any;
    const [revenueRows] = await db.execute("SELECT SUM(total_amount) as total FROM orders") as any;
    const [productRows] = await db.execute("SELECT COUNT(*) as count FROM products") as any;

    res.json({
      totalOrders: orderRows[0].count,
      totalRevenue: revenueRows[0].total || 0,
      totalProducts: productRows[0].count,
    });
  });

  app.get("/api/admin/orders", authenticateToken, requireAdmin, async (req, res) => {
    const [orders] = await db.execute("SELECT * FROM orders ORDER BY created_at DESC");
    res.json(orders);
  });

  // Admin: Xác nhận đơn hàng → tự động tạo vận đơn & giao hàng
  app.post("/api/admin/orders/:id/confirm", authenticateToken, requireAdmin, async (req, res) => {
    const orderId = req.params.id;
    const [rows] = await db.execute("SELECT * FROM orders WHERE id = ?", [orderId]) as any;
    if (!rows[0]) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
    if (rows[0].status !== "pending") {
      return res.status(400).json({ error: "Chỉ có thể xác nhận đơn hàng đang chờ xử lý" });
    }

    let trackingCode: string;
    let provider: string;

    if (SHIPPING_MODE === "ghn") {
      try {
        const ghnRes = await fetch("https://dev-online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Token": GHN_TOKEN,
            "ShopId": GHN_SHOP_ID,
          },
          body: JSON.stringify({
            to_name: rows[0].customer_name,
            to_phone: "0900000000",
            to_address: "Demo address",
            to_ward_code: "20308",
            to_district_id: 1444,
            weight: 500,
            length: 20,
            width: 20,
            height: 10,
            service_type_id: 2,
            payment_type_id: 2,
            required_note: "KHONGCHOXEMHANG",
            items: [{ name: "PC Parts", quantity: 1, weight: 500 }],
          }),
        });
        const ghnData = await ghnRes.json();
        trackingCode = ghnData.data?.order_code || `GHN${Date.now()}`;
        provider = "GHN";
      } catch {
        return res.status(500).json({ error: "Lỗi kết nối GHN API" });
      }
    } else {
      trackingCode = `DEMO${Date.now().toString(36).toUpperCase()}`;
      provider = "DEMO";
    }

    await db.execute(
      "UPDATE orders SET status = 'processing', tracking_code = ?, shipping_provider = ?, shipped_at = NOW() WHERE id = ?",
      [trackingCode, provider, orderId]
    );

    res.json({ tracking_code: trackingCode, provider, message: "Đã xác nhận & tạo vận đơn thành công" });
  });

  // Admin: Hủy đơn hàng
  app.post("/api/admin/orders/:id/cancel", authenticateToken, requireAdmin, async (req, res) => {
    const orderId = req.params.id;
    const [rows] = await db.execute("SELECT * FROM orders WHERE id = ?", [orderId]) as any;
    if (!rows[0]) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
    if (rows[0].status !== "pending") {
      return res.status(400).json({ error: "Chỉ có thể hủy đơn hàng đang chờ xử lý" });
    }

    // Hoàn trả stock
    const [items] = await db.execute("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [orderId]) as any;
    for (const item of items) {
      await db.execute("UPDATE products SET stock = stock + ? WHERE id = ?", [item.quantity, item.product_id]);
    }

    await db.execute("UPDATE orders SET status = 'cancelled' WHERE id = ?", [orderId]);
    res.json({ message: "Đã hủy đơn hàng & hoàn trả kho" });
  });

  app.post("/api/admin/products", authenticateToken, requireAdmin, async (req, res) => {
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

  app.delete("/api/admin/products/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      // Kiểm tra sản phẩm có trong đơn hàng không
      const [orderItems] = await db.execute(
        "SELECT COUNT(*) as count FROM order_items WHERE product_id = ?",
        [req.params.id]
      ) as any;
      if (orderItems[0].count > 0) {
        return res.status(400).json({ error: "Không thể xóa sản phẩm đã có trong đơn hàng" });
      }
      await db.execute("DELETE FROM products WHERE id = ?", [req.params.id]);
      res.json({ message: "Đã xóa sản phẩm" });
    } catch (error) {
      res.status(500).json({ error: "Xóa sản phẩm thất bại" });
    }
  });

  app.put("/api/admin/products/:id", authenticateToken, requireAdmin, async (req, res) => {
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

  app.get("/api/admin/users", authenticateToken, requireAdmin, async (req, res) => {
    const [users] = await db.execute("SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC");
    res.json(users);
  });

  app.delete("/api/admin/users/:id", authenticateToken, requireAdmin, async (req, res) => {
    const [rows] = await db.execute("SELECT role FROM users WHERE id = ?", [req.params.id]) as any;
    if (rows[0] && rows[0].role === "admin") {
      return res.status(403).json({ error: "Không thể xóa tài khoản admin" });
    }
    try {
      // Set user_id = NULL cho đơn hàng liên quan trước khi xóa
      await db.execute("UPDATE orders SET user_id = NULL WHERE user_id = ?", [req.params.id]);
      await db.execute("DELETE FROM users WHERE id = ?", [req.params.id]);
      res.json({ message: "Đã xóa người dùng" });
    } catch (error) {
      res.status(500).json({ error: "Xóa người dùng thất bại" });
    }
  });

  // ============ SHIPPING / TRACKING APIS ============

  // User: xem đơn hàng của mình
  app.get("/api/orders/my", authenticateToken, async (req, res) => {
    const [orders] = await db.execute(
      "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(orders);
  });

  // User: xem chi tiết tracking
  app.get("/api/orders/:id/tracking", authenticateToken, async (req, res) => {
    const [rows] = await db.execute(
      "SELECT id, status, tracking_code, shipping_provider, shipped_at, created_at FROM orders WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    ) as any;
    if (!rows[0]) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });

    const order = rows[0];
    // Tạo timeline dựa trên trạng thái hiện tại
    const timeline = [];
    const statusOrder = ["pending", "processing", "shipped", "delivered"];
    const statusIdx = statusOrder.indexOf(order.status);

    timeline.push({ status: "pending", label: "Đơn hàng đã đặt", time: order.created_at, done: true });
    if (statusIdx >= 1) timeline.push({ status: "processing", label: "Đang xử lý & đóng gói", time: order.shipped_at, done: true });
    if (statusIdx >= 2) timeline.push({ status: "shipped", label: "Đang vận chuyển", time: null, done: true });
    if (statusIdx >= 3) timeline.push({ status: "delivered", label: "Đã giao hàng", time: null, done: true });

    // Thêm các bước chưa hoàn thành
    for (let i = statusIdx + 1; i < statusOrder.length; i++) {
      const labels: Record<string, string> = { processing: "Đang xử lý & đóng gói", shipped: "Đang vận chuyển", delivered: "Đã giao hàng" };
      timeline.push({ status: statusOrder[i], label: labels[statusOrder[i]], time: null, done: false });
    }

    let trackingUrl = null;
    if (order.tracking_code) {
      if (order.shipping_provider === "GHN") {
        trackingUrl = `https://tracking.ghn.dev/?order_code=${order.tracking_code}`;
      } else {
        trackingUrl = null; // Demo mode: tracking trên trang nội bộ
      }
    }

    res.json({ ...order, timeline, tracking_url: trackingUrl });
  });

  // User: xem items của đơn hàng
  app.get("/api/orders/:id/items", authenticateToken, async (req, res) => {
    const [orderCheck] = await db.execute("SELECT id FROM orders WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]) as any;
    if (!orderCheck[0]) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
    const [items] = await db.execute(
      `SELECT oi.*, p.name as product_name, p.image_url 
       FROM order_items oi 
       JOIN products p ON oi.product_id = p.id 
       WHERE oi.order_id = ?`,
      [req.params.id]
    );
    res.json(items);
  });

  // ============ DEMO: Tự động chuyển trạng thái ============
  if (SHIPPING_MODE === "demo") {
    const DEMO_TRANSITIONS: Record<string, { next: string; delayMs: number }> = {
      processing: { next: "shipped", delayMs: 30_000 },   // 30s → đang giao
      shipped:    { next: "delivered", delayMs: 60_000 },  // 60s → đã giao
    };

    const syncDemoOrders = async () => {
      try {
        for (const [fromStatus, { next, delayMs }] of Object.entries(DEMO_TRANSITIONS)) {
          const [rows] = await db.execute(
            `SELECT id, shipped_at, status FROM orders 
             WHERE status = ? AND shipping_provider = 'DEMO' AND shipped_at IS NOT NULL 
             AND TIMESTAMPDIFF(SECOND, shipped_at, NOW()) > ?`,
            [fromStatus, delayMs / 1000]
          ) as any;

          for (const order of rows) {
            await db.execute("UPDATE orders SET status = ? WHERE id = ?", [next, order.id]);
            console.log(`📦 Demo: Đơn #${order.id}: ${fromStatus} → ${next}`);
          }
        }
      } catch (e) {
        // Bỏ qua lỗi cron
      }
    };

    // Chạy mỗi 10 giây
    setInterval(syncDemoOrders, 10_000);
    console.log(`🚀 Chế độ DEMO: trạng thái đơn hàng sẽ tự chuyển (processing→30s→shipped→60s→delivered)`);
  } else {
    // ============ GHN: Polling trạng thái thật ============
    // Map trạng thái GHN → trạng thái đơn hàng nội bộ
    const GHN_STATUS_MAP: Record<string, string> = {
      "ready_to_pick":  "processing",   // Chờ lấy hàng
      "picking":        "processing",   // Đang lấy hàng
      "picked":         "processing",   // Đã lấy hàng
      "storing":        "processing",   // Đã nhập kho
      "transporting":   "shipped",      // Đang vận chuyển
      "delivering":     "shipped",      // Đang giao hàng
      "delivered":      "delivered",    // Đã giao
      "delivery_fail":  "shipped",      // Giao thất bại (vẫn đang giao)
      "return":         "cancelled",    // Hoàn trả
      "returned":       "cancelled",    // Đã hoàn trả
      "cancel":         "cancelled",    // Hủy đơn
    };

    const syncGhnOrders = async () => {
      try {
        // Lấy tất cả đơn GHN đang chờ cập nhật (chưa delivered/cancelled)
        const [rows] = await db.execute(
          `SELECT id, tracking_code, status FROM orders 
           WHERE shipping_provider = 'GHN' 
           AND tracking_code IS NOT NULL 
           AND status NOT IN ('delivered', 'cancelled')`
        ) as any;

        for (const order of rows) {
          try {
            const ghnRes = await fetch(
              "https://dev-online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/detail",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Token": GHN_TOKEN,
                },
                body: JSON.stringify({ order_code: order.tracking_code }),
              }
            );
            const ghnData = await ghnRes.json();
            const ghnStatus = ghnData.data?.status;

            if (ghnStatus && GHN_STATUS_MAP[ghnStatus]) {
              const newStatus = GHN_STATUS_MAP[ghnStatus];
              if (newStatus !== order.status) {
                await db.execute(
                  "UPDATE orders SET status = ? WHERE id = ?",
                  [newStatus, order.id]
                );
                console.log(`🚚 GHN: Đơn #${order.id} (${order.tracking_code}): ${order.status} → ${newStatus} (GHN: ${ghnStatus})`);
              }
            }
          } catch {
            // Bỏ qua lỗi từng đơn, tiếp tục đơn khác
          }
        }
      } catch (e) {
        console.error("Lỗi polling GHN:", e);
      }
    };

    // Polling mỗi 5 phút
    setInterval(syncGhnOrders, 5 * 60_000);
    // Chạy lần đầu sau 10s
    setTimeout(syncGhnOrders, 10_000);
    console.log(`🚚 Chế độ GHN: polling trạng thái mỗi 5 phút`);
  }

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
