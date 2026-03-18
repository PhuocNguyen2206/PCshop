# PC MASTER – Cửa hàng linh kiện máy tính

Ứng dụng thương mại điện tử bán linh kiện PC được xây dựng bằng **React + TypeScript** (frontend) và **Express + MySQL** (backend).

---

## Công nghệ sử dụng

| Tầng | Công nghệ |
|------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Backend | Express.js, Node.js (TSX) |
| Cơ sở dữ liệu | MySQL 2 |
| Hoạt ảnh | Motion (Framer Motion) |
| Icon | Lucide React |

---

## Cài đặt & Chạy

### Yêu cầu

- Node.js ≥ 18
- MySQL đang chạy cục bộ

### Cài đặt

```bash
npm install
```

### Cấu hình môi trường

Tạo file `.env.local` ở thư mục gốc:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=<mật_khẩu_mysql>
DB_NAME=pcmaster
```

### Chạy ứng dụng (development)

```bash
npm run dev
```

Truy cập tại: [http://localhost:3000](http://localhost:3000)

### Build cho production

```bash
npm run build
```

### Kiểm tra TypeScript

```bash
npm run lint
```

---

## Tài khoản demo

| Role | Email | Mật khẩu |
|------|-------|----------|
| Admin | admin@pcmaster.vn | admin123 |

> ⚠️ **Lưu ý**: Dự án đang dùng DEMO MODE — mật khẩu được lưu dạng plain text. Cần dùng `bcrypt` khi đưa lên production.

---

## Cấu trúc dự án

```
PCshop/
├── src/
│   ├── App.tsx              # Component gốc, điều hướng giữa store / product / admin
│   ├── AuthContext.tsx      # Quản lý trạng thái xác thực (đăng nhập / đăng ký)
│   ├── CartContext.tsx      # Quản lý giỏ hàng (lưu vào localStorage)
│   ├── types.ts             # Các interface TypeScript (User, Product, Order…)
│   ├── main.tsx             # Điểm vào React
│   ├── index.css            # Style toàn cục + hoạt ảnh CSS
│   └── components/
│       ├── Navbar.tsx       # Thanh điều hướng (logo, giỏ hàng, đăng nhập)
│       ├── UserStore.tsx    # Trang cửa hàng (hero + bộ lọc danh mục + lưới sản phẩm)
│       ├── ProductDetail.tsx # Trang chi tiết sản phẩm
│       ├── CartDrawer.tsx   # Ngăn kéo giỏ hàng + form thanh toán
│       ├── AuthModal.tsx    # Modal đăng nhập / đăng ký
│       └── AdminDashboard.tsx # Bảng điều khiển quản trị (4 tab)
├── server.ts                # Express server + kết nối MySQL + API routes
├── vite.config.ts           # Cấu hình Vite
├── tsconfig.json            # Cấu hình TypeScript
├── package.json
└── index.html
```

---

## Cơ sở dữ liệu

Database `pcmaster` và tất cả bảng được tự động tạo khi khởi động lần đầu.

```
categories   → Danh mục sản phẩm (CPU, VGA, RAM, Mainboard, SSD)
products     → Sản phẩm (tên, slug, mô tả, giá VND, tồn kho, ảnh, danh mục)
users        → Tài khoản người dùng (role: 'user' | 'admin')
orders       → Đơn hàng (tên, email khách, tổng tiền, trạng thái)
order_items  → Chi tiết đơn hàng (sản phẩm, số lượng, giá tại thời điểm mua)
```

---

## API

### Xác thực

```
POST /api/auth/register   Đăng ký tài khoản
POST /api/auth/login      Đăng nhập
```

### Catalog

```
GET /api/categories             Danh sách danh mục
GET /api/products               Tất cả sản phẩm
GET /api/products?category=cpu  Lọc theo danh mục
GET /api/products/:slug         Chi tiết sản phẩm
```

### Đơn hàng

```
POST /api/orders                Tạo đơn hàng (có transaction, trừ tồn kho)
```

### Quản trị

```
GET    /api/admin/stats           Thống kê tổng quan
GET    /api/admin/orders          Danh sách đơn hàng
PUT    /api/admin/orders/:id      Cập nhật trạng thái đơn hàng
POST   /api/admin/products        Thêm sản phẩm
PUT    /api/admin/products/:id    Sửa sản phẩm
DELETE /api/admin/products/:id    Xóa sản phẩm
GET    /api/admin/users           Danh sách người dùng
DELETE /api/admin/users/:id       Xóa người dùng
```

---

## Tính năng chính

- **Duyệt sản phẩm**: Lưới sản phẩm 4 cột, lọc theo danh mục, xem chi tiết
- **Giỏ hàng**: Ngăn kéo slide-out, điều chỉnh số lượng, lưu theo từng tài khoản
- **Thanh toán**: Yêu cầu đăng nhập, nhập tên & email, tạo đơn hàng
- **Xác thực**: Modal đăng ký / đăng nhập, phân quyền theo role
- **Bảng quản trị**: Tổng quan (thống kê), Sản phẩm (CRUD), Đơn hàng (cập nhật trạng thái), Người dùng (quản lý)
- **Responsive**: Mobile-first với Tailwind CSS
- **Hoạt ảnh**: Framer Motion cho chuyển trang, hover effect, modal

---

## Lưu ý bảo mật (production)

- [ ] Dùng `bcrypt` để hash mật khẩu
- [ ] Thêm middleware xác thực cho các route `/api/admin/*`
- [ ] Cấu hình CORS
- [ ] Validate dữ liệu đầu vào phía server
- [ ] Không hardcode thông tin kết nối DB trong source code
- [ ] Thêm rate limiting chống brute force
