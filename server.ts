import express from "express";
import { createServer as createViteServer } from "vite";
import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import sharp from "sharp";
import { randomBytes } from "crypto";

dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface JwtUserPayload {
  id: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

interface AuthenticatedRequest extends express.Request {
  user: JwtUserPayload;
}

// ============ CẤU HÌNH MySQL ============
// Cấu hình trong file .env.local:
//   DB_HOST=localhost
//   DB_USER=root
//   DB_PASSWORD=matkhau
//   DB_NAME=pcmaster
const JWT_SECRET = process.env.JWT_SECRET?.trim() || randomBytes(32).toString("hex");
if (!process.env.JWT_SECRET) {
  console.warn("⚠️  CẢNH BÁO: JWT_SECRET chưa được cấu hình trong .env.local — đang tạo key tạm thời cho phiên chạy hiện tại.");
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase() || "admin@pcmaster.local";
const rawAdminPassword = process.env.ADMIN_PASSWORD;
if (!rawAdminPassword) {
  console.error("❌ ADMIN_PASSWORD chưa được cấu hình trong .env.local. Vui lòng thêm ADMIN_PASSWORD rồi khởi động lại server.");
  process.exit(1);
}
const ADMIN_PASSWORD = rawAdminPassword.trim();

// ============ SHIPPING CONFIG ============
// Manual status management - no auto shipping integration

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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      phone VARCHAR(20) DEFAULT NULL,
      avatar VARCHAR(500) DEFAULT NULL,
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
      customer_phone VARCHAR(20) DEFAULT NULL,
      shipping_address TEXT DEFAULT NULL,
      total_amount INT NOT NULL,
      payment_status VARCHAR(50) DEFAULT 'unpaid',
      status VARCHAR(50) DEFAULT 'pending',
      tracking_code VARCHAR(255) DEFAULT NULL,
      shipped_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      price INT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS order_status_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      status VARCHAR(50) NOT NULL,
      note TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  // Add indexes for performance
  const createIndexIfNotExists = async (_indexName: string, sql: string) => {
    try { await pool.execute(sql); } catch (e) { /* Index already exists */ }
  };
  await createIndexIfNotExists('idx_orders_user_id', 'CREATE INDEX idx_orders_user_id ON orders(user_id)');
  await createIndexIfNotExists('idx_orders_status', 'CREATE INDEX idx_orders_status ON orders(status)');
  await createIndexIfNotExists('idx_orders_created_at', 'CREATE INDEX idx_orders_created_at ON orders(created_at)');
  await createIndexIfNotExists('idx_orders_payment_status', 'CREATE INDEX idx_orders_payment_status ON orders(payment_status)');
  await createIndexIfNotExists('idx_order_items_order_id', 'CREATE INDEX idx_order_items_order_id ON order_items(order_id)');
  await createIndexIfNotExists('idx_order_items_product_id', 'CREATE INDEX idx_order_items_product_id ON order_items(product_id)');
  await createIndexIfNotExists('idx_products_category_id', 'CREATE INDEX idx_products_category_id ON products(category_id)');
  await createIndexIfNotExists('idx_order_status_history_order_id', 'CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id)');

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
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await pool.execute(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      ["Admin", ADMIN_EMAIL, hashedPassword, "admin"]
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

  // ============ CHAT TABLES ============
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      status VARCHAR(20) DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      conversation_id INT NOT NULL,
      sender_id INT NOT NULL,
      content TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await createIndexIfNotExists('idx_conversations_user_id', 'CREATE INDEX idx_conversations_user_id ON conversations(user_id)');
  await createIndexIfNotExists('idx_conversations_status', 'CREATE INDEX idx_conversations_status ON conversations(status)');
  await createIndexIfNotExists('idx_messages_conversation_id', 'CREATE INDEX idx_messages_conversation_id ON messages(conversation_id)');
  await createIndexIfNotExists('idx_messages_sender_id', 'CREATE INDEX idx_messages_sender_id ON messages(sender_id)');

  // ============ CART TABLE ============
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_product (user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);
  await createIndexIfNotExists('idx_cart_items_user_id', 'CREATE INDEX idx_cart_items_user_id ON cart_items(user_id)');

  console.log("Kết nối MySQL thành công & khởi tạo database xong!");
  return pool;
}

async function startServer() {
  const db = await initDatabase();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simple SSE clients list for admin real-time events (orders, alerts)
  const sseClients: Array<express.Response> = [];
  const sendSSE = (event: string, data: any) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients.slice()) {
      try {
        client.write(payload);
      } catch (e) {
        // ignore write errors
      }
    }
  };

  // ============ UPLOAD FILE CONFIG (Multer) ============
  const UPLOAD_DIR = path.join(__dirname, "uploads");
  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  // Tạo thư mục uploads nếu chưa tồn tại
  const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  };
  ensureDir(path.join(UPLOAD_DIR, "avatars"));
  ensureDir(path.join(UPLOAD_DIR, "products"));

  // Cấu hình storage cho avatar
  const avatarStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(UPLOAD_DIR, "avatars")),
    filename: (req: any, _file, cb) => {
      const ext = path.extname(_file.originalname).toLowerCase();
      cb(null, `user_${req.user.id}_${Date.now()}${ext}`);
    },
  });

  // Cấu hình storage cho sản phẩm
  const productStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(UPLOAD_DIR, "products")),
    filename: (_req, _file, cb) => {
      const uniqueName = Date.now() + "-" + Math.random().toString(36).substring(2, 11);
      const ext = path.extname(_file.originalname).toLowerCase();
      cb(null, uniqueName + ext);
    },
  });

  // Bộ lọc file: chỉ cho phép ảnh
  const imageFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh (JPG, PNG, GIF, WEBP)"));
    }
  };

  const uploadAvatar = multer({ storage: avatarStorage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
  const uploadProductImage = multer({ storage: productStorage, fileFilter: imageFilter, limits: { fileSize: MAX_FILE_SIZE, files: 5 } });

  // Serve file tĩnh từ thư mục uploads
  app.use("/uploads", express.static(UPLOAD_DIR));

  // JWT Middleware
  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers["authorization"];
    const headerToken = authHeader && authHeader.split(" ")[1];
    const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
    const token = headerToken || queryToken;
    if (!token) return res.status(401).json({ error: "Chưa đăng nhập" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtUserPayload;
      (req as AuthenticatedRequest).user = decoded;
      next();
    } catch {
      return res.status(403).json({ error: "Token không hợp lệ hoặc hết hạn" });
    }
  };

  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if ((req as AuthenticatedRequest).user?.role !== "admin") {
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
    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Mật khẩu phải có ít nhất 8 ký tự" });
    }
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const [result] = await db.execute(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name.trim(), email.trim().toLowerCase(), hashedPassword]
      ) as any;
      const user = { id: result.insertId, name: name.trim(), email: email.trim().toLowerCase(), phone: null, role: "user", avatar: null };
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      res.status(201).json({ ...user, token });
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: "Email này đã được đăng ký. Vui lòng dùng email khác." });
      }
      res.status(400).json({ error: "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Thông tin đăng nhập không hợp lệ" });
    }
    try {
      const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]) as any;
      const user = rows[0];
      if (user && await bcrypt.compare(password, user.password)) {
        const { password: _, ...userWithoutPassword } = user;
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
        res.json({ ...userWithoutPassword, token });
      } else {
        res.status(401).json({ error: "Sai email hoặc mật khẩu" });
      }
    } catch (error) {
      res.status(500).json({ error: "Lỗi server" });
    }
  });

  // Lấy thông tin user hiện tại từ token
  app.get("/api/auth/me", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const [rows] = await db.execute("SELECT id, name, email, phone, role, avatar, created_at FROM users WHERE id = ?", [userId]) as any;
      if (!rows[0]) return res.status(404).json({ error: "Tài khoản không tồn tại" });
      res.json(rows[0]);
    } catch (e) {
      res.status(500).json({ error: "Lỗi server" });
    }
  });

  // Cập nhật thông tin cá nhân
  app.put("/api/auth/profile", authenticateToken, async (req: express.Request, res: express.Response) => {
    const { phone, name } = req.body;
    const userId = (req as AuthenticatedRequest).user.id;
    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      return res.status(400).json({ error: "Số điện thoại không hợp lệ" });
    }
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "Họ tên phải có ít nhất 2 ký tự" });
      }
    }
    try {
      const normalizedPhone = typeof phone === "string" ? phone.trim() : undefined;
      const normalizedName = typeof name === "string" ? name.trim() : undefined;
      if (normalizedName !== undefined) {
        await db.execute("UPDATE users SET name = ? WHERE id = ?", [normalizedName, userId]);
      }
      if (normalizedPhone !== undefined) {
        await db.execute("UPDATE users SET phone = ? WHERE id = ?", [normalizedPhone || null, userId]);
      }
      res.json({ success: true, message: "Cập nhật thông tin thành công", name: normalizedName, phone: normalizedPhone !== undefined ? (normalizedPhone || null) : undefined });
    } catch (error) {
      res.status(500).json({ error: "Cập nhật thất bại" });
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const [categories] = await db.execute("SELECT * FROM categories");
      res.json(categories);
    } catch (e) {
      res.status(500).json({ error: 'Không lấy được danh mục' });
    }
  });

  // Public: sản phẩm bán chạy
  app.get("/api/products/best-sellers", async (req, res) => {
    try {
      const limit = Math.min(20, parseInt((req.query.limit as string) || '8')) || 8;
      const [rows] = await db.execute(
        `SELECT p.*, c.name as category_name, COALESCE(SUM(oi.quantity), 0) as total_sold
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN (order_items oi INNER JOIN orders o ON oi.order_id = o.id AND o.status != 'cancelled') ON oi.product_id = p.id
         GROUP BY p.id
         ORDER BY total_sold DESC, p.created_at DESC
         LIMIT ${limit}`
      ) as any;
      res.json(rows);
    } catch (e) {
      console.error('Best sellers error:', e);
      res.status(500).json({ error: 'Không lấy được sản phẩm bán chạy' });
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
    const { category, search, minPrice, maxPrice, sort, order, page, limit } = req.query;

    // Xây dựng query động
    let whereClauses: string[] = [];
    let params: any[] = [];

    // Lọc theo danh mục
    if (category && typeof category === 'string') {
      whereClauses.push("c.slug = ?");
      params.push(category);
    }

    // Tìm kiếm theo tên hoặc mô tả
    if (search && typeof search === 'string' && search.trim()) {
      whereClauses.push("(p.name LIKE ? OR p.description LIKE ?)");
      const keyword = `%${search.trim()}%`;
      params.push(keyword, keyword);
    }

    // Lọc theo khoảng giá
    if (minPrice && !isNaN(Number(minPrice))) {
      whereClauses.push("p.price >= ?");
      params.push(Number(minPrice));
    }
    if (maxPrice && !isNaN(Number(maxPrice))) {
      whereClauses.push("p.price <= ?");
      params.push(Number(maxPrice));
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Sắp xếp
    const allowedSortFields: Record<string, string> = {
      'price': 'p.price', 'name': 'p.name', 'created_at': 'p.created_at'
    };
    const sortField = allowedSortFields[sort as string] || 'p.created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    // Phân trang
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 12));
    const offset = (pageNum - 1) * limitNum;

    const countSQL = `SELECT COUNT(*) as total FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereSQL}`;
    const dataSQL = `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereSQL} ORDER BY ${sortField} ${sortOrder} LIMIT ${limitNum} OFFSET ${offset}`;

    const [countResult] = await db.execute(countSQL, params) as any;
    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limitNum);

    const [products] = await db.execute(dataSQL, params);

    res.json({
      data: products,
      pagination: {
        currentPage: pageNum,
        itemsPerPage: limitNum,
        totalPages,
        totalItems,
        hasPrev: pageNum > 1,
        hasNext: pageNum < totalPages
      }
    });
    } catch (e) {
      console.error('Products error:', e);
      res.status(500).json({ error: 'Không lấy được sản phẩm' });
    }
  });

  app.get("/api/products/:slug", async (req, res) => {
    try {
      const [rows] = await db.execute("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = ?", [req.params.slug]) as any;
      if (rows[0]) {
        res.json(rows[0]);
      } else {
        res.status(404).json({ error: "Không tìm thấy sản phẩm" });
      }
    } catch (e) {
      res.status(500).json({ error: 'Lỗi khi lấy sản phẩm' });
    }
  });

  app.post("/api/orders", authenticateToken, async (req: express.Request, res: express.Response) => {
    const { customer_name, customer_email, customer_phone, shipping_address, items, payment_status } = req.body;
    const authenticatedUser = (req as AuthenticatedRequest).user;

    if (!customer_name || typeof customer_name !== "string" || customer_name.trim().length < 2) {
      return res.status(400).json({ error: "Họ tên phải có ít nhất 2 ký tự" });
    }
    if (!customer_email || typeof customer_email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email.trim())) {
      return res.status(400).json({ error: "Email nhận hàng không hợp lệ" });
    }
    if (!customer_phone || typeof customer_phone !== "string" || customer_phone.trim().length < 8) {
      return res.status(400).json({ error: "Số điện thoại không hợp lệ" });
    }
    if (!shipping_address || typeof shipping_address !== "string" || shipping_address.trim().length < 5) {
      return res.status(400).json({ error: "Địa chỉ giao hàng không hợp lệ" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Giỏ hàng đang trống" });
    }
    if (!payment_status || (payment_status !== 'paid' && payment_status !== 'unpaid')) {
      return res.status(400).json({ error: "Trạng thái thanh toán không hợp lệ" });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      let computedTotal = 0;
      const normalizedItems: Array<{ id: number; quantity: number; price: number; name: string }> = [];

      for (const item of items) {
        if (!item || !Number.isInteger(item.id) || !Number.isInteger(item.quantity) || item.quantity <= 0) {
          await conn.rollback();
          return res.status(400).json({ error: "Dữ liệu sản phẩm trong đơn hàng không hợp lệ" });
        }

        const [productRows] = await conn.execute(
          "SELECT id, name, price, stock FROM products WHERE id = ? FOR UPDATE",
          [item.id]
        ) as any;

        const product = productRows[0];
        if (!product) {
          await conn.rollback();
          return res.status(400).json({ error: `Sản phẩm #${item.id} không tồn tại` });
        }
        if (product.stock < item.quantity) {
          await conn.rollback();
          return res.status(400).json({ error: `Sản phẩm "${product.name}" không đủ hàng trong kho` });
        }

        normalizedItems.push({
          id: product.id,
          quantity: item.quantity,
          price: product.price,
          name: product.name,
        });
        computedTotal += product.price * item.quantity;
      }

      // Revenue is now based on payment_status, no need for prepaid_amount tracking
      // Auto-generate tracking code for new orders
      const trackingCode = `ORD${Date.now().toString(36).toUpperCase()}`;
      
      const [orderResult] = await conn.execute(
        "INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, shipping_address, total_amount, payment_status, tracking_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          authenticatedUser.id,
          customer_name.trim(),
          customer_email.trim().toLowerCase(),
          customer_phone.trim(),
          shipping_address.trim(),
          computedTotal,
          payment_status,
          trackingCode,
        ]
      ) as any;

      const orderId = orderResult.insertId;

      for (const item of normalizedItems) {
        await conn.execute(
          "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
          [orderId, item.id, item.quantity, item.price]
        );
        await conn.execute(
          "UPDATE products SET stock = stock - ? WHERE id = ?",
          [item.quantity, item.id]
        );
      }

      // Xóa giỏ hàng của user sau khi đặt hàng thành công
      await conn.execute("DELETE FROM cart_items WHERE user_id = ?", [authenticatedUser.id]);

      await conn.commit();
      // Ghi lịch sử trạng thái đơn hàng
      try { await db.execute("INSERT INTO order_status_history (order_id, status, note) VALUES (?, 'pending', ?)", [orderId, `Đơn hàng mới tạo - Mã vận đơn: ${trackingCode}`]); } catch {}
      // Broadcast to SSE admin listeners about new order
      try {
        sendSSE('new_order', { id: orderId, total_amount: computedTotal, customer_name: customer_name.trim(), tracking_code: trackingCode, created_at: new Date().toISOString() });
      } catch {}
      res.status(201).json({ id: orderId, total_amount: computedTotal, tracking_code: trackingCode, message: "Đặt hàng thành công" });
    } catch (error) {
      await conn.rollback();
      console.error("Order creation failed:", error);
      res.status(500).json({ error: "Đặt hàng thất bại" });
    } finally {
      conn.release();
    }
  });

  // SSE endpoint for admin real-time events (requires admin)
  app.get('/api/admin/orders/stream', authenticateToken, requireAdmin, (req: express.Request, res: express.Response) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders?.();
    // initial retry and keep-alive
    res.write('retry: 10000\n\n');
    sseClients.push(res);
    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // Admin API (protected)
  app.get("/api/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
    const [orderRows] = await db.execute("SELECT COUNT(*) as count FROM orders") as any;
    const [revenueRows] = await db.execute(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status != 'cancelled' AND (payment_status = 'paid' OR status = 'delivered')"
    ) as any;
    const [productRows] = await db.execute("SELECT COUNT(*) as count FROM products") as any;

    res.json({
      totalOrders: orderRows[0].count,
      totalRevenue: revenueRows[0].total || 0,
      totalProducts: productRows[0].count,
    });
  });

  // Revenue timeseries for a date range (group by day)
  app.get('/api/admin/revenue', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const start = req.query.start_date || req.query.start;
      const end = req.query.end_date || req.query.end;
      const group = req.query.group_by || req.query.group;
      
      const startDate = start ? new Date(start as string) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const endDate = end ? new Date(end as string) : new Date();
      // normalize to YYYY-MM-DD
      const startStr = startDate.toISOString().slice(0, 10) + ' 00:00:00';
      const endStr = new Date(endDate.getTime() + 24*3600*1000).toISOString().slice(0, 10) + ' 00:00:00';

      const groupBy = group === 'month' ? "DATE_FORMAT(created_at, '%Y-%m-01')" : 'DATE(created_at)';
      const [rows] = await db.execute(
        `SELECT ${groupBy} as period, 
                COALESCE(SUM(total_amount), 0) as revenue, 
                COUNT(*) as orders_count 
         FROM orders 
         WHERE created_at >= ? AND created_at < ? AND status != 'cancelled' AND (payment_status = 'paid' OR status = 'delivered')
         GROUP BY ${groupBy} 
         ORDER BY ${groupBy} ASC`,
        [startStr, endStr]
      ) as any;
      res.json(rows.map((r: any) => ({ period: r.period, revenue: r.revenue || 0, orders: r.orders_count || 0 })));
    } catch (e) {
      console.error('Revenue error:', e);
      res.status(500).json({ error: 'Không lấy được dữ liệu doanh thu' });
    }
  });

  // Orders funnel counts
  app.get('/api/admin/orders/funnel', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const [rows] = await db.execute("SELECT status, COUNT(*) as count FROM orders GROUP BY status") as any;
      const map: Record<string, number> = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
      for (const r of rows) map[r.status] = r.count;
      res.json(map);
    } catch (e) { res.status(500).json({ error: 'Không lấy được funnel' }); }
  });

  // Top products by units sold / revenue
  app.get('/api/admin/top-products', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(50, parseInt((req.query.limit as string) || '10')) || 10;
      const [rows] = await db.execute(
        `SELECT p.id, p.name, p.image_url, SUM(oi.quantity) as units_sold, SUM(oi.quantity * oi.price) as revenue
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id AND o.status != 'cancelled'
         JOIN products p ON oi.product_id = p.id
         GROUP BY p.id ORDER BY units_sold DESC LIMIT ${limit}`
      ) as any;
      res.json(rows.map((r: any) => ({ id: r.id, name: r.name, image_url: r.image_url, units_sold: r.units_sold || 0, revenue: r.revenue || 0 })));
    } catch (e) { console.error('Top products error:', e); res.status(500).json({ error: 'Không lấy được top products' }); }
  });

  // Top categories by revenue/units
  app.get('/api/admin/top-categories', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(50, parseInt((req.query.limit as string) || '10')) || 10;
      const [rows] = await db.execute(
        `SELECT c.id, c.name, SUM(oi.quantity) as units_sold, SUM(oi.quantity * oi.price) as revenue
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id AND o.status != 'cancelled'
         JOIN products p ON oi.product_id = p.id
         JOIN categories c ON p.category_id = c.id
         GROUP BY c.id ORDER BY revenue DESC LIMIT ${limit}`
      ) as any;
      res.json(rows.map((r: any) => ({ id: r.id, name: r.name, units_sold: r.units_sold || 0, revenue: r.revenue || 0 })));
    } catch (e) { console.error('Top categories error:', e); res.status(500).json({ error: 'Không lấy được top categories' }); }
  });

  // Low-stock products
  app.get('/api/admin/low-stock', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const threshold = Math.max(0, parseInt((req.query.threshold as string) || '5'));
      const [rows] = await db.execute("SELECT id, name, stock, image_url FROM products WHERE stock <= ? ORDER BY stock ASC", [threshold]) as any;
      res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Không lấy được low-stock' }); }
  });

  // User metrics: new users + AOV
  app.get('/api/admin/users/metrics', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const start = req.query.start_date || req.query.start;
      const end = req.query.end_date || req.query.end;
      const startDate = start ? new Date(start as string) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const endDate = end ? new Date(end as string) : new Date();
      const startStr = startDate.toISOString().slice(0,10) + ' 00:00:00';
      const endStr = new Date(endDate.getTime() + 24*3600*1000).toISOString().slice(0,10) + ' 00:00:00';

      const [newUsersRows] = await db.execute("SELECT DATE(created_at) as date, COUNT(*) as count FROM users WHERE created_at >= ? AND created_at < ? GROUP BY DATE(created_at) ORDER BY DATE(created_at) ASC", [startStr, endStr]) as any;
      const [aovRows] = await db.execute("SELECT AVG(total_amount) as aov FROM orders WHERE created_at >= ? AND created_at < ? AND status != 'cancelled'", [startStr, endStr]) as any;
      res.json({ newUsers: newUsersRows.map((r: any) => ({ date: r.date, count: r.count })), aov: Math.round(aovRows[0].aov || 0) });
    } catch (e) { console.error('User metrics error:', e); res.status(500).json({ error: 'Không lấy được user metrics' }); }
  });

  app.get("/api/admin/orders", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const [orders] = await db.execute("SELECT * FROM orders ORDER BY created_at DESC");
      res.json(orders);
    } catch (e) {
      res.status(500).json({ error: 'Không lấy được đơn hàng' });
    }
  });

  // Admin: Cập nhật trạng thái đơn hàng thủ công
  // Allowed order status transitions
  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: [],
  };

  app.put("/api/admin/orders/:id", authenticateToken, requireAdmin, async (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;
    const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ" });
    }
    
    const [rows] = await db.execute("SELECT * FROM orders WHERE id = ?", [orderId]) as any;
    if (!rows[0]) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
    
    const currentStatus = rows[0].status;
    if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(status)) {
      return res.status(400).json({ error: `Không thể chuyển từ "${currentStatus}" sang "${status}"` });
    }
    
    // Nếu chuyển sang cancelled, hoàn trả stock (trong transaction)
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      if (status === "cancelled") {
        const [items] = await conn.execute("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [orderId]) as any;
        for (const item of items) {
          await conn.execute("UPDATE products SET stock = stock + ? WHERE id = ?", [item.quantity, item.product_id]);
        }
      }
    
      let extraSQL = '';
      if (status === 'shipped') extraSQL = ', shipped_at = NOW()';
      await conn.execute(`UPDATE orders SET status = ?${extraSQL} WHERE id = ?`, [status, orderId]);
      await conn.execute("INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)", [orderId, status, `Cập nhật trạng thái thành ${status}`]);
      await conn.commit();
      res.json({ message: "Cập nhật trạng thái thành công" });
    } catch (error) {
      await conn.rollback();
      res.status(500).json({ error: "Cập nhật thất bại" });
    } finally {
      conn.release();
    }
  });

  // Seed dữ liệu mẫu (chỉ admin)
  app.post("/api/admin/seed-data", authenticateToken, requireAdmin, async (req, res) => {
    try {
      // Xóa dữ liệu cũ
      await db.execute("DELETE FROM order_status_history");
      await db.execute("DELETE FROM order_items");
      await db.execute("DELETE FROM orders");
      await db.execute("DELETE FROM users WHERE role = 'user'");
      
      // Tạo ~45 user khách hàng mẫu (đăng ký rải rác, tăng dần trong 90 ngày)
      const firstNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Vũ", "Hoàng", "Đặng", "Bùi", "Ngô", "Lý", "Mai", "Trịnh", "Đỗ", "Phan", "Dương", "Tô", "Hồ", "Đinh", "Lương", "Tạ"];
      const middleNames = ["Văn", "Thị", "Minh", "Đức", "Hồng", "Quốc", "Thanh", "Bảo", "Ngọc", "Anh"];
      const lastNames = ["An", "Bình", "Cường", "Dung", "Em", "Phúc", "Giang", "Hà", "Khoa", "Linh", "Minh", "Nam", "Oanh", "Phong", "Quân", "Sơn", "Tâm", "Uyên", "Việt", "Xuân"];
      
      const customers: { name: string; email: string; phone: string; daysAgo: number }[] = [];
      let custIdx = 0;
      for (let d = 89; d >= 0; d--) {
        // Growth curve: ngày xa ít khách, gần đây nhiều khách (0-3 khách/ngày)
        const growthFactor = (90 - d) / 90;
        const base = growthFactor * 2.2;
        const count = Math.random() < (base - Math.floor(base)) ? Math.ceil(base) : Math.floor(base);
        for (let i = 0; i < count; i++) {
          custIdx++;
          const fn = firstNames[custIdx % firstNames.length];
          const mn = middleNames[custIdx % middleNames.length];
          const ln = lastNames[custIdx % lastNames.length];
          customers.push({
            name: `${fn} ${mn} ${ln}`,
            email: `customer${custIdx}@example.com`,
            phone: `09${String(custIdx).padStart(8, '0')}`,
            daysAgo: d,
          });
        }
      }

      const customerIds: number[] = [];
      const hashedPassword = await bcrypt.hash("password123", 10);
      
      for (const c of customers) {
        const regDate = new Date();
        regDate.setDate(regDate.getDate() - c.daysAgo);
        regDate.setHours(Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60), 0, 0);
        const mysqlRegDate = regDate.toISOString().slice(0, 19).replace('T', ' ');
        const [result] = await db.execute(
          "INSERT INTO users (name, email, password, phone, role, created_at) VALUES (?, ?, ?, ?, 'user', ?)",
          [c.name, c.email, hashedPassword, c.phone, mysqlRegDate]
        ) as any;
        customerIds.push(result.insertId);
      }

      // Lấy danh sách sản phẩm
      const [products] = await db.execute("SELECT id, price, name FROM products") as any;
      if (products.length === 0) {
        return res.status(400).json({ error: "Không có sản phẩm nào để tạo đơn hàng" });
      }

      const addresses = [
        "123 Đường Lê Lợi, Q.1, TP.HCM",
        "456 Nguyễn Huệ, Q.1, TP.HCM",
        "789 Trần Hưng Đạo, Q.5, TP.HCM",
        "12 Phạm Văn Đồng, Thủ Đức, TP.HCM",
        "34 Cầu Giấy, Hà Nội",
        "56 Hai Bà Trưng, Hoàn Kiếm, Hà Nội",
        "78 Nguyễn Trãi, Thanh Xuân, Hà Nội",
        "90 Bạch Đằng, Hải Châu, Đà Nẵng",
      ];

      // Tạo ~60 đơn hàng rải đều 90 ngày, mật độ tăng dần (mô phỏng growth)
      let orderCount = 0;
      
      // Ngày xa → ít đơn, gần → nhiều đơn. Mỗi "chunk" 10 ngày tăng dần
      const dayPlan: { day: number, count: number }[] = [];
      for (let d = 89; d >= 0; d--) {
        // Growth curve: đơn hàng tăng dần từ 0-1 đơn/ngày → 1-3 đơn/ngày
        const growthFactor = (90 - d) / 90; // 0 → 1
        const base = growthFactor * 2.5;
        const count = Math.random() < (base - Math.floor(base)) ? Math.ceil(base) : Math.floor(base);
        if (count > 0) dayPlan.push({ day: d, count });
      }

      for (const { day, count } of dayPlan) {
        for (let i = 0; i < count; i++) {
          const orderDate = new Date();
          orderDate.setDate(orderDate.getDate() - day);
          orderDate.setHours(Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
          const mysqlDate = orderDate.toISOString().slice(0, 19).replace('T', ' ');

          // Chọn customer (ưu tiên customer đã đăng ký trước ngày đặt hàng)
          const eligibleCustomers = customers
            .map((c, idx) => ({ ...c, id: customerIds[idx] }))
            .filter(c => c.daysAgo >= day);
          if (eligibleCustomers.length === 0) continue;
          const customer = eligibleCustomers[Math.floor(Math.random() * eligibleCustomers.length)];

          // Chọn 1-4 sản phẩm
          const productCount = Math.floor(Math.random() * 4) + 1;
          const shuffled = [...products].sort(() => Math.random() - 0.5);
          const selectedProducts = shuffled.slice(0, Math.min(productCount, products.length));
          
          const itemQuantities = selectedProducts.map((p: any) => ({
            product: p,
            quantity: Math.floor(Math.random() * 3) + 1
          }));
          
          let totalAmount = 0;
          for (const { product, quantity } of itemQuantities) {
            totalAmount += product.price * quantity;
          }

          // Trạng thái phụ thuộc vào "tuổi" đơn hàng
          let status: string;
          let paymentStatus: string;
          let shippedAt: string | null = null;
          
          if (day > 14) {
            // Đơn cũ (>2 tuần): 75% delivered+paid, 10% cancelled, 15% delivered+unpaid(COD)
            const r = Math.random();
            if (r < 0.75) { status = 'delivered'; paymentStatus = 'paid'; }
            else if (r < 0.85) { status = 'cancelled'; paymentStatus = 'unpaid'; }
            else { status = 'delivered'; paymentStatus = 'unpaid'; }
          } else if (day > 5) {
            // Đơn trung bình (5-14 ngày): 50% delivered, 20% shipped, 15% processing, 10% cancelled, 5% pending
            const r = Math.random();
            if (r < 0.50) { status = 'delivered'; paymentStatus = 'paid'; }
            else if (r < 0.70) { status = 'shipped'; paymentStatus = 'paid'; }
            else if (r < 0.85) { status = 'processing'; paymentStatus = 'paid'; }
            else if (r < 0.95) { status = 'cancelled'; paymentStatus = 'unpaid'; }
            else { status = 'pending'; paymentStatus = 'unpaid'; }
          } else {
            // Đơn mới (<5 ngày): 30% pending, 30% processing, 20% shipped, 15% paid, 5% cancelled
            const r = Math.random();
            if (r < 0.30) { status = 'pending'; paymentStatus = 'unpaid'; }
            else if (r < 0.60) { status = 'processing'; paymentStatus = 'paid'; }
            else if (r < 0.80) { status = 'shipped'; paymentStatus = 'paid'; }
            else if (r < 0.95) { status = 'delivered'; paymentStatus = 'paid'; }
            else { status = 'cancelled'; paymentStatus = 'unpaid'; }
          }

          // Set shipped_at cho đơn đã ship/delivered
          if (status === 'shipped' || status === 'delivered') {
            const shipDate = new Date(orderDate);
            shipDate.setDate(shipDate.getDate() + Math.floor(Math.random() * 2) + 1);
            if (shipDate <= new Date()) {
              shippedAt = shipDate.toISOString().slice(0, 19).replace('T', ' ');
            }
          }

          const trackingCode = `VN${Date.now().toString(36).toUpperCase()}${orderCount}`;

          const [orderResult] = await db.execute(
            "INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, shipping_address, total_amount, payment_status, status, tracking_code, shipped_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              customer.id, customer.name, customer.email, customer.phone,
              addresses[Math.floor(Math.random() * addresses.length)],
              totalAmount, paymentStatus, status, trackingCode, shippedAt, mysqlDate,
            ]
          ) as any;

          // Order items
          for (const { product, quantity } of itemQuantities) {
            await db.execute(
              "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
              [orderResult.insertId, product.id, quantity, product.price]
            );
            if (status !== 'cancelled') {
              await db.execute("UPDATE products SET stock = stock - ? WHERE id = ?", [quantity, product.id]);
            }
          }

          // Order status history
          const historyDate = new Date(orderDate);
          await db.execute(
            "INSERT INTO order_status_history (order_id, status, note, created_at) VALUES (?, 'pending', 'Đơn hàng mới', ?)",
            [orderResult.insertId, mysqlDate]
          );
          if (['processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
            historyDate.setHours(historyDate.getHours() + Math.floor(Math.random() * 12) + 1);
            const note = status === 'cancelled' ? 'Khách hủy đơn' : `Chuyển sang ${status}`;
            if (status === 'cancelled') {
              await db.execute("INSERT INTO order_status_history (order_id, status, note, created_at) VALUES (?, 'cancelled', ?, ?)",
                [orderResult.insertId, note, historyDate.toISOString().slice(0, 19).replace('T', ' ')]);
            } else {
              await db.execute("INSERT INTO order_status_history (order_id, status, note, created_at) VALUES (?, 'processing', 'Xác nhận & đóng gói', ?)",
                [orderResult.insertId, historyDate.toISOString().slice(0, 19).replace('T', ' ')]);
            }
          }
          if (['shipped', 'delivered'].includes(status)) {
            historyDate.setHours(historyDate.getHours() + Math.floor(Math.random() * 24) + 2);
            await db.execute("INSERT INTO order_status_history (order_id, status, note, created_at) VALUES (?, 'shipped', 'Đã giao cho vận chuyển', ?)",
              [orderResult.insertId, historyDate.toISOString().slice(0, 19).replace('T', ' ')]);
          }
          if (status === 'delivered') {
            historyDate.setDate(historyDate.getDate() + Math.floor(Math.random() * 3) + 1);
            await db.execute("INSERT INTO order_status_history (order_id, status, note, created_at) VALUES (?, 'delivered', 'Giao hàng thành công', ?)",
              [orderResult.insertId, historyDate.toISOString().slice(0, 19).replace('T', ' ')]);
          }

          orderCount++;
        }
      }

      // Reset stock về mức hợp lý
      await db.execute("UPDATE products SET stock = GREATEST(stock, 3)");

      res.json({ 
        message: "Seed dữ liệu thành công",
        created_customers: customerIds.length,
        created_orders: orderCount
      });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ error: "Lỗi seed dữ liệu: " + (error as any).message });
    }
  });

  app.get("/api/admin/products", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const [rows] = await db.execute(
        "SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.created_at DESC"
      );
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: 'Không lấy được sản phẩm' });
    }
  });

  app.post("/api/admin/products", authenticateToken, requireAdmin, async (req, res) => {
    const { name, slug, description, price, stock, image_url, category_id } = req.body;
    if (!name || !slug) return res.status(400).json({ error: "Tên và slug là bắt buộc" });
    try {
      const [result] = await db.execute(
        "INSERT INTO products (name, slug, description, price, stock, image_url, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [name.trim(), slug.trim(), description || '', parseInt(price) || 0, parseInt(stock) || 0, image_url || '', category_id]
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
    if (!name || !slug) return res.status(400).json({ error: "Tên và slug là bắt buộc" });
    try {
      await db.execute(
        `UPDATE products 
         SET name = ?, slug = ?, description = ?, price = ?, stock = ?, image_url = ?, category_id = ?
         WHERE id = ?`,
        [name.trim(), slug.trim(), description || '', parseInt(price) || 0, parseInt(stock) || 0, image_url || '', category_id, req.params.id]
      );
      res.json({ message: "Cập nhật sản phẩm thành công" });
    } catch (error) {
      res.status(400).json({ error: "Cập nhật sản phẩm thất bại" });
    }
  });

  app.get("/api/admin/users", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const [users] = await db.execute("SELECT id, name, email, role, avatar, created_at FROM users ORDER BY created_at DESC");
      res.json(users);
    } catch (e) {
      res.status(500).json({ error: 'Không lấy được người dùng' });
    }
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

  // ============ ADMIN CATEGORIES ============
  app.post("/api/admin/categories", authenticateToken, requireAdmin, async (req, res) => {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: "Tên và slug là bắt buộc" });
    try {
      const [result] = await db.execute(
        "INSERT INTO categories (name, slug) VALUES (?, ?)",
        [name.trim(), slug.trim().toLowerCase()]
      ) as any;
      res.status(201).json({ id: result.insertId, name: name.trim(), slug: slug.trim().toLowerCase() });
    } catch (error) {
      res.status(400).json({ error: "Slug đã tồn tại" });
    }
  });

  app.put("/api/admin/categories/:id", authenticateToken, requireAdmin, async (req, res) => {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: "Tên và slug là bắt buộc" });
    try {
      await db.execute(
        "UPDATE categories SET name = ?, slug = ? WHERE id = ?",
        [name.trim(), slug.trim().toLowerCase(), req.params.id]
      );
      res.json({ message: "Cập nhật danh mục thành công" });
    } catch (error) {
      res.status(400).json({ error: "Slug đã tồn tại" });
    }
  });

  app.delete("/api/admin/categories/:id", authenticateToken, requireAdmin, async (req, res) => {
    const [products] = await db.execute("SELECT COUNT(*) as count FROM products WHERE category_id = ?", [req.params.id]) as any;
    if (products[0].count > 0) {
      return res.status(400).json({ error: `Không thể xóa: danh mục đang chứa ${products[0].count} sản phẩm` });
    }
    try {
      await db.execute("DELETE FROM categories WHERE id = ?", [req.params.id]);
      res.json({ message: "Đã xóa danh mục" });
    } catch (error) {
      res.status(500).json({ error: "Xóa danh mục thất bại" });
    }
  });

  // ============ UPLOAD APIs (Tuần 8) ============

  // Upload avatar (yêu cầu đăng nhập)
  app.post("/api/upload/avatar", authenticateToken, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    uploadAvatar.single("avatar")(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "Kích thước file không được vượt quá 5MB" });
        return res.status(400).json({ error: err.message });
      }
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  }, async (req: express.Request, res: express.Response) => {
    try {
      const uploadRequest = req as express.Request & { file?: Express.Multer.File };
      if (!uploadRequest.file) return res.status(400).json({ error: "Vui lòng chọn file ảnh để upload" });

      const userId = (req as AuthenticatedRequest).user.id;

      // Xóa avatar cũ nếu có (không xóa file mặc định)
      const [userRows] = await db.execute("SELECT avatar FROM users WHERE id = ?", [userId]) as any;
      if (userRows[0]?.avatar) {
        const oldPath = path.resolve(__dirname, userRows[0].avatar);
        const avatarsDir = path.resolve(UPLOAD_DIR, 'avatars');
        if (oldPath.startsWith(avatarsDir) && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      // Nén ảnh bằng Sharp
      const origPath = uploadRequest.file.path;
      const optimizedName = `opt_${uploadRequest.file.filename.replace(path.extname(uploadRequest.file.filename), '.jpg')}`;
      const optimizedPath = path.join(UPLOAD_DIR, 'avatars', optimizedName);
      await sharp(origPath)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(optimizedPath);
      fs.unlinkSync(origPath);

      const avatarPath = `/uploads/avatars/${optimizedName}`;
      await db.execute("UPDATE users SET avatar = ? WHERE id = ?", [avatarPath, userId]);

      res.json({ success: true, message: "Cập nhật ảnh đại diện thành công", avatar: avatarPath });
    } catch (error) {
      const uploadRequest = req as express.Request & { file?: Express.Multer.File };
      if (uploadRequest.file && fs.existsSync(uploadRequest.file.path)) fs.unlinkSync(uploadRequest.file.path);
      res.status(500).json({ error: "Lỗi server khi upload avatar" });
    }
  });

  // Upload ảnh sản phẩm (admin only)
  app.post("/api/upload/product", authenticateToken, requireAdmin, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    uploadProductImage.single("image")(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "Kích thước file không được vượt quá 5MB" });
        return res.status(400).json({ error: err.message });
      }
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  }, async (req: express.Request, res: express.Response) => {
    try {
      const uploadRequest = req as express.Request & { file?: Express.Multer.File };
      if (!uploadRequest.file) return res.status(400).json({ error: "Vui lòng chọn file ảnh" });
      // Nén ảnh sản phẩm bằng Sharp
      const origPath = uploadRequest.file.path;
      const optimizedName = `opt_${uploadRequest.file.filename.replace(path.extname(uploadRequest.file.filename), '.jpg')}`;
      const optimizedPath = path.join(UPLOAD_DIR, 'products', optimizedName);
      await sharp(origPath)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(optimizedPath);
      fs.unlinkSync(origPath);
      const imagePath = `/uploads/products/${optimizedName}`;
      res.json({ success: true, message: "Upload ảnh sản phẩm thành công", image_url: imagePath });
    } catch (error) {
      const uploadRequest = req as express.Request & { file?: Express.Multer.File };
      if (uploadRequest.file && fs.existsSync(uploadRequest.file.path)) fs.unlinkSync(uploadRequest.file.path);
      res.status(500).json({ error: "Lỗi server khi upload ảnh sản phẩm" });
    }
  });

  // ============ SHIPPING / TRACKING APIS ============

  // User: xem đơn hàng của mình
  app.get("/api/orders/my", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const [orders] = await db.execute(
        "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
        [(req as AuthenticatedRequest).user.id]
      );
      res.json(orders);
    } catch (e) {
      res.status(500).json({ error: 'Không lấy được đơn hàng' });
    }
  });

  // User: xem chi tiết tracking
  app.get("/api/orders/:id/tracking", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
    const [rows] = await db.execute(
      "SELECT id, status, tracking_code, shipped_at, created_at FROM orders WHERE id = ? AND user_id = ?",
      [req.params.id, (req as AuthenticatedRequest).user.id]
    ) as any;
    if (!rows[0]) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });

    const order = rows[0];
    // Tạo timeline dựa trên trạng thái hiện tại
    const timeline = [];
    const statusOrder = ["pending", "processing", "shipped", "delivered"];
    const statusIdx = statusOrder.indexOf(order.status);

    timeline.push({ status: "pending", label: "Đơn hàng đã đặt", time: order.created_at, done: true });
    if (statusIdx >= 1) timeline.push({ status: "processing", label: "Đang xử lý & đóng gói", time: null, done: true });
    if (statusIdx >= 2) timeline.push({ status: "shipped", label: "Đang vận chuyển", time: order.shipped_at, done: true });
    if (statusIdx >= 3) timeline.push({ status: "delivered", label: "Đã giao hàng", time: null, done: true });
    if (order.status === "cancelled") timeline.push({ status: "cancelled", label: "Đơn hàng đã hủy", time: null, done: true });

    // Thêm các bước chưa hoàn thành
    for (let i = statusIdx + 1; i < statusOrder.length; i++) {
      const labels: Record<string, string> = { processing: "Đang xử lý & đóng gói", shipped: "Đang vận chuyển", delivered: "Đã giao hàng" };
      timeline.push({ status: statusOrder[i], label: labels[statusOrder[i]], time: null, done: false });
    }

    // External tracking providers removed; tracking handled manually by admin
    const trackingUrl = null;

    res.json({ ...order, timeline, tracking_url: trackingUrl });
    } catch (e) {
      res.status(500).json({ error: 'Lỗi khi lấy tracking' });
    }
  });

  // User: xem items của đơn hàng
  app.get("/api/orders/:id/items", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
    const [orderCheck] = await db.execute("SELECT id FROM orders WHERE id = ? AND user_id = ?", [req.params.id, (req as AuthenticatedRequest).user.id]) as any;
    if (!orderCheck[0]) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
    const [items] = await db.execute(
      `SELECT oi.*, p.name as product_name, p.image_url 
       FROM order_items oi 
       JOIN products p ON oi.product_id = p.id 
       WHERE oi.order_id = ?`,
      [req.params.id]
    );
    res.json(items);
    } catch (e) {
      res.status(500).json({ error: 'Lỗi khi lấy items' });
    }
  });

  // Manual status management: Admin updates order statuses via dashboard
  console.log("✅ Chế độ quản lý thủ công: Admin cập nhật trạng thái qua dropdown");

  // ============ CART API ============

  // Lấy giỏ hàng
  app.get("/api/cart", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const [items] = await db.execute(
        `SELECT ci.product_id as id, ci.quantity, p.name, p.slug, p.description, p.price, p.stock, p.image_url, p.category_id, c.name as category_name
         FROM cart_items ci
         JOIN products p ON ci.product_id = p.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE ci.user_id = ?
         ORDER BY ci.created_at DESC`,
        [userId]
      );
      res.json(items);
    } catch (e) {
      res.status(500).json({ error: "Lỗi khi lấy giỏ hàng" });
    }
  });

  // Thêm / cập nhật sản phẩm trong giỏ
  app.post("/api/cart", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const { product_id, quantity } = req.body;
      if (!product_id || !quantity || quantity < 1) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
      // Check stock
      const [prod] = await db.execute("SELECT stock FROM products WHERE id = ?", [product_id]) as any;
      if (!prod[0]) return res.status(404).json({ error: "Sản phẩm không tồn tại" });
      const finalQty = Math.min(quantity, prod[0].stock);
      await db.execute(
        `INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = ?`,
        [userId, product_id, finalQty, finalQty]
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Lỗi khi thêm vào giỏ hàng" });
    }
  });

  // Xoá 1 sản phẩm khỏi giỏ
  app.delete("/api/cart/:productId", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      await db.execute("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?", [userId, req.params.productId]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Lỗi khi xoá sản phẩm" });
    }
  });

  // Xoá toàn bộ giỏ hàng
  app.delete("/api/cart", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      await db.execute("DELETE FROM cart_items WHERE user_id = ?", [userId]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Lỗi khi xoá giỏ hàng" });
    }
  });

  // ============ CHAT API ============

  // Tạo hoặc lấy conversation hiện tại (cho user)
  app.post("/api/chat/conversations", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      // Verify user exists in DB (token may be stale after re-seed)
      const [userCheck] = await db.execute("SELECT id FROM users WHERE id = ?", [userId]) as any;
      if (userCheck.length === 0) return res.status(401).json({ error: "Tài khoản không tồn tại. Vui lòng đăng nhập lại." });
      // Check for existing open conversation
      const [existing] = await db.execute(
        "SELECT * FROM conversations WHERE user_id = ? AND status = 'open' ORDER BY updated_at DESC LIMIT 1",
        [userId]
      ) as any;
      if (existing[0]) return res.json(existing[0]);
      const [result] = await db.execute(
        "INSERT INTO conversations (user_id) VALUES (?)",
        [userId]
      ) as any;
      const [conv] = await db.execute("SELECT * FROM conversations WHERE id = ?", [result.insertId]) as any;
      res.json(conv[0]);
    } catch (e) {
      res.status(500).json({ error: "Lỗi khi tạo hội thoại" });
    }
  });

  // Lấy danh sách conversations (admin: tất cả, user: của mình)
  app.get("/api/chat/conversations", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      let query: string;
      let params: any[];
      if (user.role === 'admin') {
        query = `SELECT c.*, u.name as user_name, u.email as user_email, u.avatar as user_avatar,
                 (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.is_read = FALSE AND m.sender_id != ?) as unread_count,
                 (SELECT content FROM messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.created_at DESC LIMIT 1) as last_message,
                 (SELECT created_at FROM messages m3 WHERE m3.conversation_id = c.id ORDER BY m3.created_at DESC LIMIT 1) as last_message_at
                 FROM conversations c JOIN users u ON c.user_id = u.id ORDER BY c.updated_at DESC`;
        params = [user.id];
      } else {
        query = `SELECT c.*,
                 (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.is_read = FALSE AND m.sender_id != ?) as unread_count
                 FROM conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC`;
        params = [user.id, user.id];
      }
      const [convs] = await db.execute(query, params);
      res.json(convs);
    } catch (e) {
      res.status(500).json({ error: "Lỗi khi lấy danh sách hội thoại" });
    }
  });

  // Lấy tin nhắn + đánh dấu đã đọc
  app.get("/api/chat/conversations/:id/messages", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const userReq = (req as AuthenticatedRequest).user;
      const convId = req.params.id;
      const [convCheck] = await db.execute(
        "SELECT id FROM conversations WHERE id = ? AND (user_id = ? OR ? = 'admin')",
        [convId, userReq.id, userReq.role]
      ) as any;
      if (!convCheck[0]) return res.status(403).json({ error: "Không có quyền truy cập hội thoại này" });
      const userId = userReq.id;
      const [messages] = await db.execute(
        `SELECT m.*, u.name as sender_name, u.role as sender_role, u.avatar as sender_avatar
         FROM messages m JOIN users u ON m.sender_id = u.id
         WHERE m.conversation_id = ? ORDER BY m.created_at ASC`,
        [convId]
      );
      // Mark messages from others as read
      await db.execute(
        "UPDATE messages SET is_read = TRUE WHERE conversation_id = ? AND sender_id != ? AND is_read = FALSE",
        [convId, userId]
      );
      res.json(messages);
    } catch (e) {
      res.status(500).json({ error: "Lỗi khi lấy tin nhắn" });
    }
  });

  // Gửi tin nhắn
  app.post("/api/chat/conversations/:id/messages", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const userReq = (req as AuthenticatedRequest).user;
      const convId = req.params.id;
      const { content } = req.body;
      if (!content || content.trim().length === 0) return res.status(400).json({ error: "Nội dung không được rỗng" });
      if (content.length > 2000) return res.status(400).json({ error: "Tin nhắn quá dài (tối đa 2000 ký tự)" });
      const [convCheck] = await db.execute(
        "SELECT id FROM conversations WHERE id = ? AND (user_id = ? OR ? = 'admin')",
        [convId, userReq.id, userReq.role]
      ) as any;
      if (!convCheck[0]) return res.status(403).json({ error: "Không có quyền truy cập hội thoại này" });
      const userId = userReq.id;
      // Reopen conversation if closed
      await db.execute("UPDATE conversations SET status = 'open' WHERE id = ?", [convId]);
      const [result] = await db.execute(
        "INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)",
        [convId, userId, content.trim()]
      ) as any;
      const [msg] = await db.execute(
        `SELECT m.*, u.name as sender_name, u.role as sender_role, u.avatar as sender_avatar
         FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?`,
        [result.insertId]
      ) as any;
      res.json(msg[0]);
    } catch (e) {
      res.status(500).json({ error: "Lỗi khi gửi tin nhắn" });
    }
  });

  // Admin đóng conversation
  app.put("/api/chat/conversations/:id/close", authenticateToken, requireAdmin, async (req: express.Request, res: express.Response) => {
    try {
      await db.execute("UPDATE conversations SET status = 'closed' WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Lỗi khi đóng hội thoại" });
    }
  });

  // Đếm tin nhắn chưa đọc
  app.get("/api/chat/unread", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const [rows] = await db.execute(
        `SELECT COUNT(*) as count FROM messages m
         JOIN conversations c ON m.conversation_id = c.id
         WHERE c.user_id = ? AND m.sender_id != ? AND m.is_read = FALSE`,
        [userId, userId]
      ) as any;
      res.json({ count: rows[0].count });
    } catch (e) {
      res.status(500).json({ error: "Lỗi khi đếm tin nhắn" });
    }
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
