# 01 — API / Web / Realtime (Node.js)

**Ngày:** 28/10/2026  
**Trạng thái:** Quyết định hiện hành; chưa phải spec endpoint đầy đủ.

## Đã chốt

- **Một source Node.js độc lập** dự kiến tên `rpa-social-automation-web`, chứa **React Web UI + Realtime Server**. Không tạo repo realtime riêng.
- Phát triển trên máy bàn, không cần tải toàn bộ Laravel vào project UI. Khi hoàn thiện vẫn **deploy độc lập, gọi thẳng API Laravel**; **bỏ kế hoạch build rồi nhúng React ngược vào Laravel**.
- Chọn TypeScript để coding agent kiểm soát contract. Hướng công nghệ: React + Vite, Node.js server; Fastify và Socket.IO là **đề xuất kỹ thuật**, chưa thử tải/chốt implementation. **Chưa cần Next.js/SSR** vì đây là control center, không phải website SEO.
- Phong cách UI chung Electron/Web theo `RPA_UI_THEME_MANIFEST.md`: compact control center, Browser-first, Username là tiêu đề; Account Name vẫn hiển thị cho end user.
- UI SEO-OPS Social Automation chỉ hiển thị **Browser thực sự online**; Browser offline tính tổng, không tạo card; mỗi card chứa tag Client/PC nhỏ. Có realtime và Refresh thủ công.
- **Một WebSocket endpoint chung** trên VPS, không mở port trên từng Client. Client sau khi xác thực API Key và có connection lease hợp lệ sẽ được quyền kết nối WSS. WebSocket không tạo ra Client identity mới.
- WebSocket phục vụ presence, Browser runtime status, session signal, notification/ACK/progress. REST API vẫn dùng cho Account, Script, Action Tags, configuration và thao tác nghiệp vụ; upload artifact lớn qua HTTP.
- VPS chạy một service Node.js dài hạn do process manager quản lý, reverse proxy HTTPS/WSS; tận dụng VPS hiện hữu ở giai đoạn quy mô nhỏ. Không cần cluster/microservice thêm.

## Ranh giới trách nhiệm

- **Node.js**: Web frontend, WebSocket connections, realtime event delivery, UI-facing API gateway/session handling khi cần.
- **Laravel Addon**: authoritative identity, Client API Key, Account, Action Tags, Script, quyền truy cập, dữ liệu bền vững và business rules. **Node không sở hữu database nghiệp vụ hay phát hành identity mới.**
- **Electron**: local Browser/Chromium execution, session partition và gửi trạng thái; không đưa browser automation runtime lên VPS.

## Bảo mật tối thiểu

- Mở UI DEV không cần login chỉ khi dùng mock/local UI; API thật không được bỏ authentication.
- Web production cần đăng nhập qua luồng xác thực SEO-OPS được tích hợp an toàn, session cookie HttpOnly, authorization ở backend. **Không xây user identity độc lập.** Cách thực hiện SSO/session/BFF **chưa chốt**.
- Client API Key không xuất hiện trong React Web; WebSocket cần handshake được cấp quyền từ backend, không đưa raw key vào URL/log.
- Kiểm soát TLS, origin, rate-limit, timeout, reconnect, stale state và phân quyền channel. Không mặc định public mọi API DEV.
- Sự kiện socket chỉ là tín hiệu nhanh; quyết định dispatch phải kiểm tra lease/presence/quyền hiện tại ở backend.

## Chưa chốt / không được tự xây

- Next.js, lựa chọn cuối giữa Fastify/Socket.IO và phương án khác, topology port/hostname, Redis, cụ thể heartbeat/timeout, UI menu, hệ thống Campaign/Task/Workflow.
- Chưa có API schema/version chuẩn được phê duyệt cho Node ↔ Laravel hay Electron ↔ Node. Coding agent phải khảo sát route thực tế và đề xuất contract trước khi thay đổi.
- Không cam kết hiệu suất/số kết nối trên VPS nếu chưa đo tải.

**Nguyên tắc:** Web + Realtime cùng một source Node.js, Laravel API tách riêng; không nhập source React vào Laravel.
