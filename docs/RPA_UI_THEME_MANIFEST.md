# RPA UI Theme Manifest — v0.1

**Ngày:** 28/10/2026  
**Phạm vi:** `rpa-social-automation-web` (React) và `rpa-sosial-automation-client` (Electron React).  
**Mục tiêu:** Một ngôn ngữ UI thống nhất, compact, dễ debug; không phải theme engine hoặc đặc tả toàn bộ màn hình.

## 1. Stack và nguyên tắc

- React + TypeScript; ưu tiên **shadcn/ui + Tailwind CSS + Lucide**.
- Dùng một bộ tên token cho Web và Electron, mỗi repo có thể triển khai token tại chỗ. **Chưa tạo Shared UI repo/package**.
- Phong cách: **compact desktop control center**, data-first, nền yên tĩnh, phân cấp chữ rõ.
- **Browser-first**: Browser/Account là trọng tâm; PC/Client chỉ là tag metadata nhỏ.
- Không lấy mẫu menu Laravel/Filament cũ làm blueprint. Không lồng card trong card chỉ để trang trí; không dùng table CRUD làm bố cục mặc định.
- Một primary action nổi bật mỗi vùng; các thao tác phụ dùng ghost/outline.

## 2. Theme token tối thiểu (giá trị khởi điểm, được tinh chỉnh sau khi xem UI thực)

| Token | Light | Dark |
| --- | --- | --- |
| `background` | `#F8FAFC` | `#0B1220` |
| `surface` | `#FFFFFF` | `#111B2E` |
| `surface-muted` | `#F1F5F9` | `#172338` |
| `text` | `#0F172A` | `#E8EEF8` |
| `text-muted` | `#64748B` | `#94A3B8` |
| `border` | `#E2E8F0` | `#29364B` |
| `primary` | `#2563EB` | `#3B82F6` |
| `success` | `#16A34A` | `#22C55E` |
| `warning` | `#D97706` | `#F59E0B` |
| `danger` | `#DC2626` | `#EF4444` |

- Font: `Inter`, fallback `system-ui, sans-serif`; thông số kỹ thuật/UUID dùng monospace.
- Spacing: nhịp `4 / 8 / 12 / 16 / 24px`; card padding thường `12–16px`.
- Radius: control `6px`, card `10px`, badge bo tròn nhẹ. Không glassmorphism, gradient hoặc shadow nặng.
- Cả hai ứng dụng hỗ trợ light/dark theo cùng token; chưa khóa theme mặc định.

## 3. Component từ vựng chung

- `Button`, `Badge`, `Input`, `Select`, `Dialog`, `Tabs`, `Tooltip`, `EmptyState`, `Skeleton`.
- Domain presentation: `BrowserStatus`, `AccountIdentity`, `ClientTag`, `SessionSignal`, `ConnectionStatus`.
- Tên domain component là định hướng UI, **không phải API/schema mới**.
- Badge màu có nghĩa: success = hoạt động/thành công; warning = cần chú ý; danger = lỗi/cần can thiệp; neutral = metadata. Không dùng màu thay cho nhãn chữ.

## 4. Browser-first layout

- Browser card: **Username** làm tiêu đề; **Account Name** phụ cho end user; platform/site nhỏ hơn.
- Tag PC như `DESKTOP-HJ2LKRD` đặt trong từng Browser cùng các badge trạng thái, không có khung group PC lớn.
- Chỉ Browser thực sự online xuất hiện trong danh sách vận hành; tổng Browser/offline là các con số riêng. Không nhầm Client online với Browser online hoặc session signal.
- Tự cập nhật trạng thái realtime; có nút Refresh thủ công và dấu hiệu dữ liệu stale/mất kết nối.
- Account ID, Browser ID và partition ẩn dưới Technical Details. UI không tự tạo identity nghiệp vụ.
- Responsive desktop trước, sau đó laptop/mobile; tránh overflow với username, host và UUID dài.

## 5. Scope và giới hạn

- **Chưa chốt:** cấu trúc sidebar/menu, bố cục Campaign/Task/Workflow, số cột card, palette cuối cùng, theme mặc định và animation.
- Không tạo theme switcher/preset editor phức tạp. Chỉ cần biến light/dark và lựa chọn theme đơn giản khi thực sự cần.
- Khi tích hợp React Web vào SEO-OPS, giữ nguyên UI tokens, còn authentication/authorization thuộc Laravel.

**Quy tắc cho coding agent:** chỉ áp dụng manifest vào màn hình được giao. Không tự dựng thêm menu/module hoặc refactor các màn hình ngoài phạm vi.
