# 02 — SEO-OPS Addon Backend (Laravel)

**Ngày:** 28/10/2026  
**Repo:** `trung8356621/seo-ops-addons-rpa`  
**Trạng thái:** Ranh giới và chức năng đã chốt; triển khai/runtime cần audit riêng.

## API Documentation — Production (VPS)

- **OpenAPI JSON (machine-readable):** https://seo-ops.duckdns.org/api/v1/social-automation/openapi.json
- **OpenAPI YAML (machine-readable):** https://seo-ops.duckdns.org/api/v1/social-automation/openapi.yaml
- **Swagger UI (xem/test endpoint):** https://seo-ops.duckdns.org/api/v1/social-automation/docs

**Ghi chú bàn giao:** API Docs được báo cáo đã deploy trên VPS (commit `087449e`, OpenAPI 3.0.3, 76 paths). Ba link trên là tài liệu contract, không thay thế live E2E; Script Publish từng báo lỗi `503 package_registry_write_failed` và chưa được xác nhận nghiệm thu hoàn chỉnh.

## Đã chốt

- Social Automation là addon/service nghiệp vụ trong SEO-OPS. Laravel sở hữu **Action Tags, Script Registry, Account Registry, Client API Key, database và API contract**.
- RPA Admin/Creator tạo, kiểm thử và phát hành Script có ID/version; SEO-OPS nhận/quản lý Script; Electron Client thực thi. Không ép Script thành Task/Workflow.
- **Client identity = `sa_client_api_keys.id` / `client_api_key_id`**. Một API Key tương ứng một Client logic, chỉ **một kết nối đang hoạt động** theo lease; kết nối đồng thời khác trả 409 `CLIENT_KEY_IN_USE`.
- Không dùng Device UUID hoặc hostname làm business identity của Client. Cột `device_id` trong DB có thể còn để tương thích Runner/legacy; không được tự xóa trước audit.
- Browser gắn **Account ID** từ SEO-OPS, không dùng Account Name/Username làm khóa. Session/partition cô lập theo Browser/Account.
- Laravel API phục vụ **React Web CSR**, **Node WebSocket Gateway độc lập** và **Electron Client** qua contract. Khi production, addon **có thể phục vụ static build React**; không chứa source React và không tự biên dịch frontend trong runtime PHP.
- API có xác thực, phân quyền theo operation, validation, error contract, giới hạn truy cập và log an toàn. Lỗi Social Automation cần được giới hạn để không kéo theo SEO-OPS Core; tách API chưa tự cách ly CPU/RAM/DB.
- Không tự sửa/đụng H1, SEO, Seeding, OPS-SERVER hoặc production allowlist.

## Giữ phạm vi hiện tại

- **Action Tags:** đã chốt là chức năng cần giữ, tiếp tục theo source/contract hiện hữu; không tự sáng tác lại UI/menu.
- **Script:** Script kỹ thuật có registry và version; không tự thêm quy trình Campaign/Workflow cho Script.
- **Account:** nguồn thông tin Username, Account Name, platform/site và ID. Username phục vụ UI/dev; Account Name phục vụ end user; identity vẫn là ID.
- **Client API Key:** key issuance/revoke, association, lease và API authorization.

## Realtime boundary

- Node.js WebSocket Gateway là **source riêng** (dự kiến `rpa-social-automation-realtime`), đóng Docker trên VPS, không chung source với React CSR. Laravel xác thực/ủy quyền kết nối; Node quản lý socket presence và chuyển các event hợp lệ. React có source DEV riêng, build static vào SEO-OPS sau khi ổn định.
- Không cho Node tự tạo bảng Account, Client identity hoặc logic dispatch độc lập.
- REST API là nguồn dữ liệu nghiệp vụ; trạng thái online là dữ liệu thời điểm, phải có cơ chế timeout/fencing và đồng bộ snapshot.

## Runtime đang chờ xác minh

- Migration `2026_10_28_120000_client_api_key_identity_and_connection_lease.php`: theo báo cáo cũ chưa xác nhận đã apply ở DB chạy thật.
- Log `422 account_browser_duplicate_on_device`: nghi trùng binding/session legacy, **chưa chứng minh từ DB**. Audit read-only trước khi cleanup; không tự xóa session cũ.
- Unit/contract pass không chứng minh live E2E. GitHub `main` có thể khác working tree Cursor chưa commit.

## Chưa chốt

- Có cần Task/Workflow/Campaign hay không; cách chia Job, giới hạn dùng lại Account/Browser, lịch thử lại và menu.
- Chỉ giữ nguyên nguyên tắc an toàn: Job **UNKNOWN** (không rõ đã tác động ngoài hệ thống chưa) không được tự đăng lại; chỉ retry tự động khi chắc chắn chưa thực hiện.
- Redis/queue/realtime topology và schema dispatch cụ thể phải khảo sát trước.

**Nguyên tắc:** Laravel là nguồn chân lý nghiệp vụ; có thể serve React **static artifacts** nhưng không render SSR hoặc sở hữu source/build chain React; không tự đổi identity/contract vì UI.
