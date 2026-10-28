# RPA Social Automation — Architecture Reset

> **LƯU TRỮ / KHÔNG CÒN LÀ TÀI LIỆU CHỈ ĐẠO TRIỂN KHAI (28/10/2026).** Kiến trúc hiện hành đã tách thành `01_API_WEB_REALTIME.md`, `02_ADDON_BACKEND.md`, `03_APP_CLIENT_ELECTRON.md` trong cùng folder. Đặc biệt, quyết định cũ **nhúng React ngược vào Laravel** đã bị thay thế: **Web + Realtime cùng một source Node.js độc lập, giao tiếp Laravel bằng API**. Khi có mâu thuẫn, ưu tiên ba file mới. File này giữ lại như lịch sử quyết định.

## CẬP NHẬT TÁCH WEB / REALTIME — 28/10/2026 (DESIGN APPROVED)

Quyết định này **thay thế phương án gộp Web + Realtime trong cùng source Node.js** ở các mục cũ của file trí nhớ này; chưa phải bằng chứng code/deploy. Không sửa `01_API_WEB_REALTIME.md` khi agent đang làm.

1. **`rpa-social-automation-web`:** source React + Vite + TypeScript **CSR**, chỉ dùng để phát triển trên máy bàn. Không cần server Node.js chạy lâu dài cho phần Web ở production. Khi sản phẩm ổn định, build static HTML/CSS/JS rồi tích hợp **chỉ artifacts đã build** vào SEO-OPS Addon (hoặc static-serving layer của SEO-OPS); không nhập source React vào Laravel, không đưa build chain frontend làm phụ thuộc runtime PHP. Phải giữ auth/authorization Laravel, asset paths và SPA fallback an toàn.
2. **`rpa-social-automation-realtime`:** source Node.js **độc lập** chỉ phục vụ WebSocket Gateway, triển khai Docker trên VPS qua Nginx HTTPS/WSS. Không có database nghiệp vụ, không phát hành Client identity, không tự quyết định dispatch. Laravel xác thực/ủy quyền qua API; Web/Client reconnect sau restart và đồng bộ snapshot. Docker topology/protocol cụ thể phải audit trước khi triển khai.
3. **`seo-ops-addons-rpa`:** Laravel API là nguồn chân lý nghiệp vụ, giữ dữ liệu/bảo mật, đồng thời về sau có thể phục vụ static build của Web. Không triển khai React SSR hay backend Node cho CRUD.
4. **`rpa-sosial-automation-client` và `rpa-social-automation-v2`:** hai Electron app riêng; Client thực thi Browser, Creator/Admin thiết kế và publish Script. Không đổi hai boundary này.
5. **Vận hành:** Có thể có **5 repo** nhưng không đồng nghĩa 5 server. Laravel sẵn có + một Docker realtime; React static, hai Electron chạy trên máy. Web DEV gọi Laravel REST và Node WSS. Web production cũng dùng các contract đó.

**Handoff:** Khi 01 đang triển khai, không tự động refactor code Node hiện có theo quyết định mới. Trước khi phân công tiếp, audit tình trạng agent/branch, lập migration plan và cập nhật các spec liên quan sau khi công việc đang chạy kết thúc.

---

## CẬP NHẬT QUYẾT ĐỊNH 28/10/2026 — API-FIRST / PRODUCTION-FIRST

**Trạng thái: DESIGN APPROVED; chưa xác nhận code/test/deploy.** Đây là tóm tắt handoff mới nhất. Nếu chi tiết xung đột, đối chiếu ba file chuyên trách `01_API_WEB_REALTIME.md`, `02_ADDON_BACKEND.md`, `03_APP_CLIENT_ELECTRON.md` và source thực tế.

- **Thứ tự triển khai:** (1) tái cấu trúc RPA Addon thành API-first trên VPS đang có + OpenAPI 3.x/Swagger được bảo vệ; (2) kiểm chứng bằng RPA Admin; (3) khi Admin ổn mới triển khai Web + Electron trên máy bàn. Không dựng staging/DEV Laravel riêng; VPS là điểm tích hợp chung. Vẫn kiểm tra local/CI, backup/migration, auth, smoke test và rollback trước/sau deploy. Chưa có bằng chứng deploy thành công.
- **RPA Addon (`seo-ops-addons-rpa`):** giữ backend, models/services/business logic và dữ liệu; loại bỏ UI cũ khỏi hướng triển khai mới, đưa UI quản trị về RPA Admin. Code cũ đã được chủ dự án đẩy lên Git; audit phụ thuộc trước khi xóa phần liên quan. Không tự động xóa DB hay legacy data.
- **Auth và conventions:** RPA Addon là module SEO-OPS Laravel, **không phải app Laravel độc lập**. Khảo sát, tuân thủ cấu trúc tương tự OPS-Client Addon: reuse authentication/session/guards, roles/permissions, middleware, routing, Service Layer và addon lifecycle hiện có; **không tạo RPA login/register, users table, JWT hay hệ quyền riêng**. Client API Key + connection lease là xác thực riêng cho Electron, không thay User Login. Không chốt đường `/api/rpa/v1` trước khi khảo sát convention thực tế.
- **RPA Admin:** Laravel/Filament quản trị và test backend; nếu chạy cùng Laravel thì gọi chung Service Layer, tránh HTTP loopback. Các đường REST mà Web/Electron sẽ dùng phải được test HTTP riêng. Admin sở hữu UI Scenario/Script/Widget/Action Tags theo phạm vi thực tế, không tự dựng Task/Workflow/Campaign chưa chốt.
- **Web + realtime (đã thay thế):** Quyết định gộp cũ được lưu như lịch sử; xem cập nhật tách Web/Realtime ở trên.
- **Electron:** source chạy máy bàn, thực thi Browser/Chromium local, gọi HTTPS REST Laravel và WSS Node trên VPS. VPS không thực thi Browser runtime. Identity một API Key = một Client logic, lease chống kết nối trùng; Node không tự tạo identity.
- **API docs bắt buộc:** OpenAPI/Swagger có thể truy cập từ máy bàn, nhưng được kiểm soát xác thực/quyền và thử request không được mở công khai. Contract là chuẩn handoff chung của ba agent; thay đổi endpoint phải cập nhật docs cùng lúc. Cần danh mục auth/lease, realtime events, error schema và deploy hướng dẫn. API Agent khảo sát endpoint thực tế trước khi định nghĩa contract.
- **Phân công:** API Agent trước trên laptop/VPS, RPA Admin xác minh; Web Agent + Electron Agent sau trên máy bàn. Drive lưu quyết định/handoff, Git/source và test runtime là bằng chứng implementation; không đồng nhất DESIGN APPROVED với CODE COMPLETE / TEST PASSED / DEPLOYED.

**Vẫn chưa chốt:** Task/Workflow/Campaign, thuật toán dispatch/job, heartbeat timeout, topology/hostname/port chính xác, công nghệ cuối cho realtime, chi tiết SSO/session BFF và menu tổng thể. Không tự xây các phần này.

---

**Ngày ghi nhận:** 28/10/2026  
**Trạng thái:** Living decisions — chỉ ghi quyết định đã chốt, không phải đặc tả triển khai toàn hệ thống.  
**Phạm vi:** RPA Admin/Creator, SEO-OPS Social Automation Addon, RPA Client Electron.

## 0. Nguyên tắc bắt đầu lại

- Xây từng phần theo nhu cầu được xác nhận từ thực tế. Không triển khai tiếp toàn bộ menu/module theo bản vẽ kiến trúc cũ.
- Không tự suy diễn rằng Task, Workflow, Campaign, Scheduler hoặc cách chia Job đã được chốt.
- Không xóa hay thay đổi dữ liệu/module cũ chỉ vì thay đổi hướng thiết kế. Mọi migration, cleanup và tương thích ngược cần được kiểm tra riêng.
- Phân biệt **đã quyết định về nghiệp vụ**, **đã có code**, và **đã kiểm chứng runtime**; ba trạng thái này không tương đương.
- Không tự thêm module, menu, contract hay quy tắc nghiệp vụ chưa được chủ dự án chốt.

## 1. Ranh giới các thành phần — ĐÃ CHỐT

1. **RPA Admin/Creator:** nơi developer tạo, kiểm thử và phát hành Script. Không chịu trách nhiệm điều phối Campaign/Task hay quản lý Browser người dùng.
2. **SEO-OPS Social Automation:** trung tâm quản lý Account, Action Tags, Script registry, Client API Key và về sau là lựa chọn tài nguyên/điều phối khi nghiệp vụ được chốt. Laravel vẫn sở hữu dữ liệu nghiệp vụ và quyền truy cập.
3. **RPA Client (Electron):** ứng dụng thực thi trên máy, kết nối bằng Endpoint + Client API Key, quản lý Browser session/partition, gửi trạng thái và thực hiện công việc được giao. Không cần đăng nhập tài khoản SEO-OPS trên Client. UI Client chủ yếu phục vụ developer/vận hành kỹ thuật; end user quan tâm số Browser khả dụng hơn.
4. Hai repo hiện có: `trung8356621/seo-ops-addons-rpa` và `trung8356621/rpa-sosial-automation-client`. Creator là dự án riêng `trung8356621/rpa-social-automation-v2`; không tách thêm Shared Core repo chỉ vì có nhiều ứng dụng.

## 2. Phạm vi chức năng hiện tại — ĐÃ CHỐT

- **Action Tags:** là phần đã được chốt để tiếp tục giữ và hoàn thiện theo source/contract hiện hữu. Tài liệu này không tự định nghĩa thêm hành vi hoặc menu mới cho Action Tags.
- **Script:** Script kỹ thuật được tạo và kiểm thử ở RPA Admin/Creator, phát hành lên SEO-OPS theo ID/version. SEO-OPS quản lý registry, còn Client thực thi; không biến Script thành Task/Workflow mặc định.
- **Client:** có kết nối với SEO-OPS, Browser profile/session và Account binding; không phải hệ thống máy tính (Device) độc lập với API Key.
- **Client API Key:** là danh tính Client. Một API Key tương ứng một Client logic; chỉ một kết nối hoạt động đồng thời, kết nối khác bị từ chối qua lease/409 `CLIENT_KEY_IN_USE`. Không phát sinh Device UUID riêng làm identity cho Client.

## 3. Identity và Browser — ĐÃ CHỐT

| Đối tượng | Identity | Ghi chú |
| --- | --- | --- |
| Client | `client_api_key_id` | Không dùng hostname/Device UUID làm business identity |
| Kết nối hoạt động | `connection_token` + lease | Bảo vệ một key/một kết nối đang hoạt động |
| Browser | `browser_id` | ID session và Chromium partition nội bộ; không có Browser Name nghiệp vụ riêng |
| Account | `account_id` / `account_uuid` từ SEO-OPS | Định danh nghiệp vụ; Account ID bắt buộc khi tạo/gắn Browser |

- Browser được tạo từ Account có sẵn trên SEO-OPS. Không lấy Account Name hoặc Username làm khóa identity.
- Không trộn cookie/session/partition giữa các Account khi chuyển đổi.
- Các cột/trường `device_id` còn lại trong DB/nhánh Runner có thể là tương thích legacy; UI Client không được trình bày chúng như một định danh Client độc lập. Không tự xóa chúng trước khi audit phụ thuộc.

## 4. UI Browser trên SEO-OPS — ĐÃ CHỐT VỀ NGHIỆP VỤ

- **Browser-first:** Browser/Account là đối tượng hiển thị chính; không có card lớn của PC/Client bao quanh các Browser.
- Mỗi Browser có một tag máy nhỏ như `DESKTOP-HJ2LKRD`, ngang vai trò metadata với badge `Có tín hiệu`; không dùng tên máy làm tiêu đề nhóm.
- Tiêu đề chính của Browser là **Username** (ưu tiên developer dễ debug). **Account Name** vẫn hiển thị phụ cho end user; platform/site là metadata. Account ID và Browser ID nằm trong phần kỹ thuật.
- **Chỉ hiển thị Browser thực sự online** trong danh sách vận hành. Browser offline/legacy không tạo card; vẫn được tính trong con số tổng/ngoại tuyến.
- Phân biệt rõ: Client online, Browser runtime online, session có tín hiệu, đủ điều kiện nhận Job là các trạng thái khác nhau. Client online không tự biến mọi Browser thành online.
- Giao diện cần **tự cập nhật realtime** và **nút Refresh thủ công**. Không dựa hoàn toàn vào người dùng reload trang.
- Không dùng kiến trúc/menu cũ làm mặc định cho màn hình mới.

## 5. Frontend React độc lập khi DEV, tích hợp lại sau — ĐÃ CHỐT

- Tạo **repo frontend riêng** dự kiến tên `rpa-social-automation-web`, dùng React + TypeScript + Vite. Đây là **ranh giới phát triển source**, không phải quyết định tách một website/backend độc lập vĩnh viễn.
- Frontend được phát triển trên **máy bàn** để Cursor chỉ tập trung mã giao diện; không đặt mã React chung trong Laravel addon trong giai đoạn xây dựng. Không dùng menu/bố cục Laravel/Filament cũ làm blueprint.
- Frontend DEV có thể mở giao diện **không cần đăng nhập SEO-OPS** (mock/local UI). Điều này **không cho phép API thật bỏ xác thực** hoặc đưa credential bí mật vào JavaScript browser.
- Khi cần dữ liệu thật, React DEV kết nối đến **Social Automation API trên VPS**, ưu tiên môi trường test và credential DEV có phạm vi giới hạn. Không dùng dữ liệu production để thử mutation tùy tiện.
- Khi frontend đủ hoàn thiện: **build React thành static assets, nhúng ngược vào SEO-OPS** theo route phù hợp, dùng chung **Laravel Auth/Session**, CSRF và phân quyền API hiện hữu. Không tạo hệ thống user login/session độc lập cho frontend chính thức.
- Web UI và Electron Client có thể dùng chung **design language/tokens/component specification**; không bắt buộc tạo Shared UI repo riêng ngay.
- Backend Laravel vẫn sở hữu identity, Account, Client API Key, Script, Action Tags, data và business rules; React chỉ tiêu thụ API và trình bày/truyền yêu cầu. **Client API Key thuộc Electron, không đưa vào React Web.**
- Ranh giới bảo vệ ở lúc tích hợp: **(1) session xác thực người dùng, (2) authorization từng hành động API**. Không nhầm điều này với đăng nhập hai lần.
- Hướng design system đã bàn và ưu tiên: `shadcn/ui` + Tailwind + Lucide, phong cách **compact desktop control center** nhất quán giữa app/server; màu nền cụ thể, bộ token cuối cùng và implementation chưa chốt.

## 6. Realtime và hiệu suất — ĐÃ CHỐT MỤC TIÊU; CÔNG NGHỆ CHƯA KHÓA

- Có **WebSocket từ giai đoạn đầu** vì cần phát hiện nhanh Client/Browser rời kết nối, giúp điều phối giảm chọn nhầm tài nguyên.
- WebSocket không thể bảo đảm phát hiện mất điện ngay tức thì; cần heartbeat/timeout, lease, xác nhận nhận Job và trạng thái dự phòng khi mất mạng.
- Chỉ số Browser khả dụng mang tính thời điểm, chấp nhận sai số nhỏ; backend phải xử lý kết quả Job và khôi phục an toàn.
- Ưu tiên **hiệu suất**. Có thể sử dụng React/TypeScript cho khu vực Social Automation kết nối Laravel API; không mặc định chuyển toàn bộ SEO-OPS/H1/SEO/Seeding sang React.
- **Chưa chốt** Reverb hay gateway riêng, Redis/presence schema, heartbeat/timeout cụ thể, topology deploy hoặc chuyển trang nào trước. Cần khảo sát source/hạ tầng trước khi quyết định.

- Có thể mở Addon API trên **VPS hiện hữu** cho frontend máy bàn truy cập; cần xác thực, TLS, giới hạn quyền và kiểm soát truy cập. Ưu tiên đường DEV riêng/an toàn, không mặc định public mọi endpoint. Máy bàn không cần giữ toàn bộ Laravel source chỉ để phát triển React.
- Mục tiêu cách ly: lỗi React không kéo sập SEO-OPS; lỗi API/worker của Social Automation cần được giới hạn bằng timeout, queue/concurrency, error handling và giới hạn tài nguyên. API-first giúp tách ranh giới nhưng **không tự bảo đảm cách ly tài nguyên** khi cùng VPS.
- Trước mắt tận dụng VPS hiện tại cho quy mô nhỏ; chưa có kiểm chứng tải nên không cam kết số Client/WebSocket và không dựng microservice/cluster quá sớm.

## 7. Ý tưởng điều phối đã bàn — CHƯA CHỐT THÀNH CONTRACT

Ví dụ nghiên cứu: 5 bài, 2 Browser, chạy từng đợt nhỏ, dùng kết quả thật để chọn Browser tiếp theo; thiếu tài nguyên thì hẹn xử lý phần còn lại sau.

Hai chính sách đang cân nhắc:

1. **Một Browser/Account chỉ dùng một lần trong một lượt nghiệp vụ/Campaign**; hết tài nguyên thì còn việc chờ đợt sau.
2. **Cho phép tái sử dụng Browser/Account cho nhiều Job tuần tự**, với khóa chống chạy đồng thời.

Đây là các ví dụ để thiết kế sau, **không phải quyết định cuối** về Campaign, Task, Workflow, Batch, Scheduler, Job schema, hạn mức hay menu. Chưa xác nhận có cần Task/Workflow riêng hay chỉ các Job nhỏ.

Nguyên tắc an toàn đã giữ từ kiến trúc trước: chỉ retry tự động khi xác định hành động chưa thành công; trường hợp mất kết nối và **không biết** đã đăng bài hay chưa phải giữ trạng thái cần xác minh, tránh đăng trùng. Offline không tự catch-up vô điều kiện.

Lưu ý thuật ngữ: repo addon hiện có `Package` cho gói Script/Release. Không dùng lại tên đó cho một đợt chia Job nếu chưa chốt lại domain model.

## 8. Tình trạng source/runtime cần xác minh — KHÔNG PHẢI QUYẾT ĐỊNH THIẾT KẾ

- Báo cáo Cursor: thay đổi identity/lease đã có unit/contract tests; migration `2026_10_28_120000_client_api_key_identity_and_connection_lease.php` chưa được xác nhận đã chạy trên DB mục tiêu; live E2E A–M chưa hoàn tất.
- Ảnh log Client ngày 28/10 báo `422 account_browser_duplicate_on_device` khi browser-sync; SEO-OPS hiển thị nhiều Browser cũ hơn Client local. Nghi có dữ liệu session cũ/Account binding xung đột, **chưa chứng minh bằng truy vấn DB**. Phải chẩn đoán read-only trước khi dọn.
- Source GitHub `main` có thể khác working tree Cursor chưa commit. Không dùng báo cáo tests thay chứng cứ runtime.
- Không tự migrate, xóa session, reset partition, commit, push, deploy hay mở production allowlist chỉ vì tài liệu này.

## 9. Quy tắc làm việc cho agent tiếp theo

1. Đọc tài liệu này và source **hiện tại** trước khi thiết kế hay code.
2. Làm từng phần nhỏ; mỗi phần phải được chủ dự án chốt phạm vi trước.
3. Với mục chưa chốt, trình bày lựa chọn và trade-off, không mặc định dựng module/menu.
4. Bảo toàn identity, account/session isolation, khả năng chống trùng Job và lịch sử dữ liệu.
5. Nêu rõ `CODE COMPLETE`, `UNIT VERIFIED`, `RUNTIME VERIFIED`, `E2E PENDING` một cách độc lập.
6. Không can thiệp addon hoặc production ngoài phạm vi được giao.

## 10. Các điểm mở để bàn sau

- Cấu trúc Task/Job/Workflow/Campaign có thực sự cần hay không.
- Chính sách giới hạn một Account/Browser được dùng bao nhiêu lần và trong phạm vi nào.
- Cơ chế kết nối WebSocket, presence, timeout, dispatch ACK và hạ tầng deploy.
- Ranh giới cụ thể giữa trang React realtime và trang Laravel/Filament còn giữ.
- API authentication DEV, CORS hoặc private network, và kế hoạch nhúng build React vào Laravel session.
- Design tokens và cách chia component frontend giữa Web và Electron mà không tạo coupling mới.
- Quy tắc xử lý session legacy khi chuyển identity và browser-sync 422.

**Tài liệu này thay thế định hướng menu triển khai cũ cho công việc tiếp theo, nhưng không tự động hủy bỏ hay sửa source/database hiện có.**


