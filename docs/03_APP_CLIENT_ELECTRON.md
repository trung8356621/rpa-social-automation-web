# 03 — RPA App Client (Electron)

**Ngày:** 28/10/2026  
**Repo:** `trung8356621/rpa-sosial-automation-client`  
**Trạng thái:** Quyết định hiện hành, chưa xác nhận E2E đầy đủ.

## Đã chốt

- App Client Electron là **execution agent** trên máy người dùng, chủ yếu dành cho developer và vận hành kỹ thuật. Không chứa Campaign/Task/Workflow business UI.
- Kết nối đến SEO-OPS bằng **Endpoint + Client API Key**, không đăng nhập tài khoản SEO-OPS trên Client.
- **API Key là Client identity**. Không sinh/duy trì Device UUID riêng làm identity. Một API Key chỉ một Client đang kết nối, có `connection_token`/lease và 409 nếu key đang được dùng ở kết nối khác.
- Sau khi API Key/lease được xác thực, Client có thể mở **outbound WebSocket** tới Realtime Server Node.js trên VPS. Không mở cổng inbound trên máy Client, không tạo identity khác cho socket.
- Client giữ local Chromium partitions, Browser sessions, tự mở/đóng Browser và báo trạng thái. Browser ID là ID session kỹ thuật; Browser được tạo/gắn từ **Account ID bắt buộc** của SEO-OPS.
- **Không có Browser Name nghiệp vụ riêng.** Tiêu đề hiển thị là **Username**; Account Name ở dòng phụ. Platform/site và tín hiệu session là metadata. Browser ID/partition nằm trong Technical Details.
- Cùng design language với React Web theo `RPA_UI_THEME_MANIFEST.md`; không cần một Shared UI repository ngay.

## Kênh giao tiếp

- **REST Laravel API:** validate/register, key/lease, Account metadata, Script/config theo contract và các thao tác nghiệp vụ cần phản hồi có xác thực.
- **WebSocket Node.js:** Client presence, Browser start/stop, session signal, event/notification, ACK/progress; khi socket mất phải reconnect và đồng bộ snapshot, không mặc định tiếp tục nhận Job.
- Không gửi cookie, password, raw Chromium storage hoặc partition path lên server. Không đưa Client API Key vào URL/log. Credentials phải lưu an toàn trên máy.
- Client offline/Browser stopped/session signal missing là các trạng thái khác nhau; không báo Browser online chỉ vì Client còn heartbeat.

## Phạm vi cần kiểm chứng trước khi mở rộng

- Đảm bảo migration/lease tương thích runtime thật và lỗi `422 account_browser_duplicate_on_device` đã được chẩn đoán; không tự reset/xóa local partition/DB.
- Test kết nối Client, dual-connect 409, restart/reconnect, Browser sync, signal, shutdown/mất mạng, lease expiry và WebSocket authentication bằng dữ liệu test.
- Báo riêng code/test pass và runtime/E2E; không khẳng định thành công từ mock/unit.

## Chưa chốt

- Công nghệ socket cuối cùng, timing heartbeat/reconnect, Job execution protocol, Campaign/Task/Workflow, lựa chọn Browser nhiều lần trong campaign.
- Không tự thêm chức năng điều phối trên Electron vì chưa được chốt nghiệp vụ.

**Nguyên tắc:** Electron chỉ quản lý và chạy Browser; Laravel sở hữu nghiệp vụ/identity; Node.js là đường realtime chung.
