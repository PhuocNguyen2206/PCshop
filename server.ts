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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || randomBytes(9).toString("base64url");
if (!process.env.ADMIN_PASSWORD) {
  console.warn(`⚠️  CẢNH BÁO: ADMIN_PASSWORD chưa được cấu hình. Mật khẩu admin tạm thời cho phiên này: ${ADMIN_PASSWORD}`);
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
      status VARCHAR(50) DEFAULT 'pending',
      tracking_code VARCHAR(255) DEFAULT NULL,
      shipping_provider VARCHAR(100) DEFAULT NULL,
      shipped_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS product_images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      image_url TEXT NOT NULL,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
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

  // Auto-migrate: thêm cột avatar cho users (Tuần 8)
  try {
    const [avatarCols] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'`,
      [DB_CONFIG.database]
    ) as any;
    if (avatarCols.length === 0) {
      await pool.execute(`ALTER TABLE users ADD COLUMN avatar VARCHAR(500) DEFAULT NULL`);
      console.log("✅ Đã migrate: thêm cột avatar cho users");
    }
  } catch (e) {
    // Bỏ qua
  }

  // Auto-migrate: thêm cột phone cho users
  try {
    const [phoneCols] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone'`,
      [DB_CONFIG.database]
    ) as any;
    if (phoneCols.length === 0) {
      await pool.execute(`ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL AFTER password`);
      console.log("✅ Đã migrate: thêm cột phone cho users");
    }
  } catch (e) {}

  // Auto-migrate: thêm cột phone, address, updated_at cho orders
  try {
    const [orderCols] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'customer_phone'`,
      [DB_CONFIG.database]
    ) as any;
    if (orderCols.length === 0) {
      await pool.execute(`ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(20) DEFAULT NULL AFTER customer_email`);
      await pool.execute(`ALTER TABLE orders ADD COLUMN shipping_address TEXT DEFAULT NULL AFTER customer_phone`);
      console.log("✅ Đã migrate: thêm cột phone, address cho orders");
    }
  } catch (e) {}

  // Auto-migrate: thêm updated_at cho products và orders
  try {
    const [prodUpdated] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'updated_at'`,
      [DB_CONFIG.database]
    ) as any;
    if (prodUpdated.length === 0) {
      await pool.execute(`ALTER TABLE products ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
      await pool.execute(`ALTER TABLE products ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
      console.log("✅ Đã migrate: thêm created_at, updated_at cho products");
    }
  } catch (e) {}

  try {
    const [orderUpdated] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'updated_at'`,
      [DB_CONFIG.database]
    ) as any;
    if (orderUpdated.length === 0) {
      await pool.execute(`ALTER TABLE orders ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
      console.log("✅ Đã migrate: thêm updated_at cho orders");
    }
  } catch (e) {}

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

  console.log("Kết nối MySQL thành công & khởi tạo database xong!");
  return pool;
}

async function startServer() {
  const db = await initDatabase();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

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

  const uploadAvatar = multer({ storage: avatarStorage, fileFilter: imageFilter, limits: { fileSize: 10 * 1024 * 1024 } });
  const uploadProductImage = multer({ storage: productStorage, fileFilter: imageFilter, limits: { fileSize: MAX_FILE_SIZE, files: 5 } });

  // Serve file tĩnh từ thư mục uploads
  app.use("/uploads", express.static(UPLOAD_DIR));

  // JWT Middleware
  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
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
    } catch (error) {
      res.status(400).json({ error: "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Thông tin đăng nhập không hợp lệ" });
    }
    const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]) as any;
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

  // Cập nhật thông tin cá nhân
  app.put("/api/auth/profile", authenticateToken, async (req: express.Request, res: express.Response) => {
    const { phone } = req.body;
    const userId = (req as AuthenticatedRequest).user.id;
    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      return res.status(400).json({ error: "Số điện thoại không hợp lệ" });
    }
    try {
      const normalizedPhone = typeof phone === "string" ? phone.trim() : "";
      await db.execute("UPDATE users SET phone = ? WHERE id = ?", [normalizedPhone || null, userId]);
      res.json({ success: true, message: "Cập nhật thông tin thành công", phone: normalizedPhone || null });
    } catch (error) {
      res.status(500).json({ error: "Cập nhật thất bại" });
    }
  });

  app.get("/api/categories", async (req, res) => {
    const [categories] = await db.execute("SELECT * FROM categories");
    res.json(categories);
  });

  app.get("/api/products", async (req, res) => {
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

    // Đếm tổng số sản phẩm (chạy song song với query chính)
    // LIMIT/OFFSET inline vì MySQL prepared statements không hỗ trợ ? cho LIMIT
    const countSQL = `SELECT COUNT(*) as total FROM products p JOIN categories c ON p.category_id = c.id ${whereSQL}`;
    const dataSQL = `SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id ${whereSQL} ORDER BY ${sortField} ${sortOrder} LIMIT ${limitNum} OFFSET ${offset}`;

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
  });

  app.get("/api/products/:slug", async (req, res) => {
    const [rows] = await db.execute("SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.slug = ?", [req.params.slug]) as any;
    if (rows[0]) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ error: "Không tìm thấy sản phẩm" });
    }
  });

  app.post("/api/orders", authenticateToken, async (req: express.Request, res: express.Response) => {
    const { customer_name, customer_email, customer_phone, shipping_address, items } = req.body;
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

      const [orderResult] = await conn.execute(
        "INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, shipping_address, total_amount) VALUES (?, ?, ?, ?, ?, ?)",
        [
          authenticatedUser.id,
          customer_name.trim(),
          customer_email.trim().toLowerCase(),
          customer_phone.trim(),
          shipping_address.trim(),
          computedTotal,
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

      await conn.commit();
      // Ghi lịch sử trạng thái đơn hàng
      try { await db.execute("INSERT INTO order_status_history (order_id, status, note) VALUES (?, 'pending', 'Đơn hàng mới tạo')", [orderId]); } catch {}
      res.status(201).json({ id: orderId, total_amount: computedTotal, message: "Đặt hàng thành công" });
    } catch (error) {
      await conn.rollback();
      console.error("Order creation failed:", error);
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
    try { await db.execute("INSERT INTO order_status_history (order_id, status, note) VALUES (?, 'processing', ?)", [orderId, `Đã xác nhận - Mã vận đơn: ${trackingCode}`]); } catch {}

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
    try { await db.execute("INSERT INTO order_status_history (order_id, status, note) VALUES (?, 'cancelled', 'Đơn hàng đã bị hủy')", [orderId]); } catch {}
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
    const [users] = await db.execute("SELECT id, name, email, role, avatar, created_at FROM users ORDER BY created_at DESC");
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

  // ============ UPLOAD APIs (Tuần 8) ============

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
        if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "Kích thước file không được vượt quá 2MB" });
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
        const oldPath = path.join(__dirname, userRows[0].avatar);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
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
    const [orders] = await db.execute(
      "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
      [(req as AuthenticatedRequest).user.id]
    );
    res.json(orders);
  });

  // User: xem chi tiết tracking
  app.get("/api/orders/:id/tracking", authenticateToken, async (req: express.Request, res: express.Response) => {
    const [rows] = await db.execute(
      "SELECT id, status, tracking_code, shipping_provider, shipped_at, created_at FROM orders WHERE id = ? AND user_id = ?",
      [req.params.id, (req as AuthenticatedRequest).user.id]
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
  app.get("/api/orders/:id/items", authenticateToken, async (req: express.Request, res: express.Response) => {
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
            try { await db.execute("INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)", [order.id, next, `Tự động chuyển: ${fromStatus} → ${next}`]); } catch {}
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
                try { await db.execute("INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)", [order.id, newStatus, `GHN: ${ghnStatus} → ${newStatus}`]); } catch {}
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
