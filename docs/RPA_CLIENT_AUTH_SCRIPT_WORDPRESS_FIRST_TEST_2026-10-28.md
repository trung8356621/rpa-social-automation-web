RPA Client — Auth Script trước Checkpoint
WordPress-first test | Quyết định nghiệp vụ ngày 28/10/2026

1. Mục tiêu
Kiểm chứng luồng đăng nhập tự động bằng WordPress trước khi thử các mạng xã hội phức tạp như Facebook. Chỉ thêm một bước Auth Script trước Checkpoint đang có; không xây thêm Login Strategy và không refactor Checkpoint.

2. Quyết định đã chốt
• RPA Admin/Script Creator: thêm checkbox “Đây là kịch bản Authentication” cho Script. Script Auth vẫn là Script thông thường chạy trên engine DOM/tọa độ hiện có.
• SEO-OPS Action Tags: thêm selectbox chọn Auth Script tương ứng cho Action Tag.
• RPA Client: khi người dùng bấm Mở Browser, nếu Action Tag liên quan có Auth Script thì Client chạy Script này trong đúng Browser/Account/Chromium partition, sau đó chuyển sang luồng Checkpoint hiện tại.
• Nếu không có Auth Script: giữ nguyên thao tác mở Browser và đăng nhập thủ công như hiện tại.
• Không thêm cờ/flag mới vào Checkpoint. Không biến Auth Script thành hệ thống xác thực người dùng SEO-OPS hoặc Client API Key.
• Nếu Auth Script lỗi: báo lỗi, giữ Browser để người dùng thao tác thủ công; Checkpoint không được coi là PASS chỉ vì đã cố chạy Auth Script.

3. Luồng tối thiểu
User chọn/mở Browser → kiểm tra Action Tag có Auth Script hay không → có thì tải và chạy Script Auth → tiếp tục Checkpoint hiện hành → Browser sẵn sàng hoặc cần can thiệp theo kết quả Checkpoint.

4. Test ưu tiên: WordPress
• Dùng một Account WordPress thử nghiệm và Browser partition riêng; không dùng tài khoản quan trọng hoặc dữ liệu production để thử đăng bài hàng loạt.
• Tạo Script WordPress Login trong RPA Admin; đánh dấu Authentication.
• Gắn Script vào Action Tag WordPress trong SEO-OPS.
• Mở Browser từ Electron, quan sát Script nhập thông tin và gửi login; kiểm tra Checkpoint hiện tại phản ánh đúng trạng thái.
• Thử lại khi phiên đã đăng nhập; thử sai mật khẩu hoặc trang đăng nhập thay đổi; thử trường hợp Action Tag không có Auth Script.
• Kiểm tra không lộ mật khẩu trong Script definition, WebSocket payload, log hoặc screenshot. Credential đi qua cơ chế an toàn hiện có; chi tiết mapping biến credential cần agent audit trước khi triển khai.
• Khi WordPress chạy ổn và có bằng chứng runtime, mới dùng cùng cơ chế để khảo sát Facebook. Không coi WordPress PASS là bằng chứng Facebook sẽ PASS.

5. Ranh giới và những gì chưa chốt
• Không xây module Login Strategy riêng, không thay đổi Browser identity, Client API Key, connection lease hoặc DB chỉ vì bước Auth.
• Chưa chốt schema checkbox, field selectbox, cách resolve Auth Script khi một Account có nhiều Action Tags, thời điểm có nên tự chạy lại khi session hết hạn. Agent phải audit source và báo các xung đột trước khi code.
• Không xây Campaign, Task, Workflow, Scheduler cho thử nghiệm này.
• Không commit/push/deploy/migrate production theo tài liệu này nếu chưa được người dùng cho phép.

6. Tiêu chí nghiệm thu
• Script Auth được đánh dấu và chọn đúng trên Action Tags.
• Mở Browser có Auth Script chạy đúng một bước chuẩn bị trước Checkpoint, trong đúng Account/partition.
• Không có Auth Script vẫn mở Browser như cũ.
• Lỗi Auth không làm mất Browser hay tự xác nhận đăng nhập thành công.
• Có bằng chứng test WordPress thực tế; báo riêng unit, integration và runtime.

Tài liệu này ghi quyết định và phạm vi thử nghiệm, không phải lời khẳng định tính năng đã được implement.

