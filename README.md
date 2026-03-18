# PC Master - Website Bán Linh Kiện PC

## Yêu cầu

- **Node.js** >= 18
- **MySQL** >= 8.0

## Cài đặt

### 1. Clone dự án

```bash
git clone https://github.com/PhuocNguyen2206/PCshop.git
cd PCshop
```

### 2. Cài dependencies

```bash
npm install
```

### 3. Tạo file cấu hình

Copy file `.env.example` thành `.env.local` và sửa lại thông tin MySQL của bạn:

```bash
cp .env.example .env.local
```

Nội dung file `.env.local`:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=mat_khau_mysql_cua_ban
DB_NAME=pcmaster
```

### 4. Chạy dự án

```bash
npm run dev
```

Server sẽ chạy tại: **http://localhost:3000**

> Database và dữ liệu mẫu sẽ được tự động tạo khi chạy lần đầu.

## Tài khoản Admin mặc định

- **Email:** admin@pcmaster.com  
- **Mật khẩu:** admin123

## Công nghệ sử dụng

- React 19 + TypeScript
- Tailwind CSS 4
- Motion (Framer Motion)
- Vite 6
- Express.js
- MySQL

## API Endpoints

Dự án có sử dụng REST API được xây dựng với Express.js, chạy tại `http://localhost:3000`.

### Xác thực (Auth)

| Phương thức | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/auth/register` | Đăng ký tài khoản mới |
| `POST` | `/api/auth/login` | Đăng nhập |

**POST `/api/auth/register`**
```json
// Request body
{ "name": "Nguyễn Văn A", "email": "user@example.com", "password": "123456" }

// Response 201
{ "id": 1, "name": "Nguyễn Văn A", "email": "user@example.com", "role": "user" }
```

**POST `/api/auth/login`**
```json
// Request body
{ "email": "user@example.com", "password": "123456" }

// Response 200
{ "id": 1, "name": "Nguyễn Văn A", "email": "user@example.com", "role": "user" }
```

---

### Danh mục & Sản phẩm

| Phương thức | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/categories` | Lấy tất cả danh mục |
| `GET` | `/api/products` | Lấy tất cả sản phẩm (có thể lọc theo danh mục) |
| `GET` | `/api/products/:slug` | Lấy chi tiết một sản phẩm |

**GET `/api/products?category=cpu`** — lọc theo slug danh mục (tùy chọn)

---

### Đơn hàng

| Phương thức | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/orders` | Tạo đơn hàng mới |

**POST `/api/orders`**
```json
// Request body
{
  "user_id": 1,
  "customer_name": "Nguyễn Văn A",
  "customer_email": "user@example.com",
  "total_amount": 15500000,
  "items": [
    { "id": 1, "quantity": 1, "price": 15500000 }
  ]
}

// Response 201
{ "id": 5, "message": "Đặt hàng thành công" }
```

---

### Admin (yêu cầu role `admin`)

| Phương thức | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/admin/stats` | Thống kê tổng quan (đơn hàng, doanh thu, sản phẩm) |
| `GET` | `/api/admin/orders` | Danh sách tất cả đơn hàng |
| `PUT` | `/api/admin/orders/:id` | Cập nhật trạng thái đơn hàng |
| `GET` | `/api/admin/products` | Danh sách tất cả sản phẩm |
| `POST` | `/api/admin/products` | Thêm sản phẩm mới |
| `PUT` | `/api/admin/products/:id` | Cập nhật thông tin sản phẩm |
| `DELETE` | `/api/admin/products/:id` | Xóa sản phẩm |
| `GET` | `/api/admin/users` | Danh sách tất cả người dùng |
| `DELETE` | `/api/admin/users/:id` | Xóa người dùng (không thể xóa admin) |

**Trạng thái đơn hàng hợp lệ:** `pending` · `processing` · `shipped` · `delivered` · `cancelled`
