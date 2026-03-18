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
