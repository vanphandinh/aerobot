# Aerodrome Position Monitor

Công cụ giám sát các vị thế thanh khoản tập trung (CL) trên Aerodrome và gửi cảnh báo khi position bị out of range.

## Cài đặt nhanh

```bash
# 1. Cài dependencies
npm install

# 2. Cấu hình
# Chỉnh sửa file .env, thay đổi:
#   - WALLET_ADDRESS: địa chỉ ví của bạn
#   - NTFY_TOPIC: tên topic duy nhất

# 3. Thiết lập nhận thông báo
# - Cài app ntfy trên điện thoại (Android/iOS)
# - Subscribe vào topic của bạn

# 4. Test thông báo
npm run test-notify

# 5. Chạy monitor
npm run dev
```

## Cấu hình

Chỉnh sửa file `.env`:

| Biến | Mô tả |
|------|-------|
| `WALLET_ADDRESS` | Địa chỉ ví cần giám sát |
| `BASE_RPC_URL` | RPC endpoint (đã cấu hình Alchemy) |
| `NTFY_TOPIC` | Tên topic nhận thông báo (tạo tên duy nhất) |
| `POLL_INTERVAL_MS` | Khoảng cách giữa các lần kiểm tra (ms) |

## Cách hoạt động

1. **Lấy positions**: Dùng Sugar contract để lấy tất cả CL positions của ví
2. **Kiểm tra range**: So sánh `tick` hiện tại của pool với `tick_lower`/`tick_upper` của position
3. **Gửi cảnh báo**: Nếu position out of range, gửi notification qua ntfy.sh
4. **Theo dõi thay đổi**: Chỉ gửi alert khi trạng thái thay đổi (tránh spam)

## Commands

```bash
npm run dev        # Chạy với ts-node (development)
npm run build      # Build TypeScript
npm run start      # Chạy phiên bản production
npm run test-notify # Test gửi notification
```
