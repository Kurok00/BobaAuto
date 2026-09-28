# Lịch sử thay đổi

## [40.1] - 2026-09-28

- Thêm nút copy toàn bộ HTML hiện tại của webpage.
- Loại UI debug của BobaAuto khỏi bản HTML copy để dễ soi DOM game.
- Giữ snapshot v2 có trọng tâm cho việc phân tích giá, kho và tổng kết.

## [40.0] - 2026-09-28

- Tách tài liệu thành README cho user và README_DEV cho developer.
- Giữ flow nhập ly trước để bảo vệ điều kiện tối thiểu khi bán hàng.
- Cải tiến auto set giá theo tín hiệu `rẻ / đắt`, nhu cầu và phần trăm giá vốn.
- Bổ sung hướng dẫn kiểm tra, scanner DOM và quy trình release.

## [35.9] - 2026-09-28

- Ưu tiên nhập đủ ly trước khi phân bổ ngân sách cho trà và topping.
- Chỉnh giá theo phần trăm giá vốn, làm tròn theo bước 0,5k của game.
- Kết hợp số lượng bán hôm qua với tín hiệu `rẻ / đắt` của game.
- Bỏ qua món không có dữ liệu bán thay vì mặc định bán 0 rồi hạ giá.

## [35.8] - 2026-09-28

- Mở rộng bộ quét màn Chuẩn bị để lấy input giá menu hiện tại.
- Ghi các dòng kho gồm tồn, giá vốn, số dùng hôm qua, hạn sử dụng và kế hoạch nhập.
- Tìm các element có khả năng chứa tổng kết ngày, tuần, tháng, doanh thu và lợi nhuận.
- Bổ sung trạng thái giờ, tên quán, đánh giá và tiền vào phần `KEY STATE`.

## [35.7] - 2026-09-28

- Nâng cấp `Quét & Copy Element` thành bộ quét DOM có trọng tâm.
- Ưu tiên các vùng đang phục vụ: `#q3`, đơn hàng, hint đường/đá, ly, kho, giá và toast.
- Ghi thêm trạng thái `hidden`, `disabled`, `display`, tọa độ, kích thước, `data-*`, `aria-*` và HTML rút gọn.
- Thêm phần `KEY STATE` để xem nhanh ngày, tiền, đơn, hint và trạng thái ly.
- Cải thiện fallback copy clipboard trên mobile.

## [35.6] - 2026-09-28

- Tăng dự phòng nhập hàng lên tối đa 2 ly mỗi khách, áp dụng đồng bộ cho trà, topping và ly.
- Giảm thời gian chờ giữa các lần click đường/đá từ 900ms xuống 500ms.
- Tối ưu menu nổi cho màn hình hẹp, desktop và Oppo Find N3 khi đổi tư thế gập.
- Panel tóm tắt giá tự chuyển vị trí khi không đủ chiều ngang.

## [35.5] - 2026-09-28

- Gộp điều khiển đặt giá menu thành một nút `Tự động đặt giá hôm nay`.
- Hiện panel tóm tắt số món tăng/giảm giá trong 5 giây.
- Tắt cơ chế tự chỉnh giá trong mỗi vòng phục vụ để tránh thay đổi giá ngoài ý muốn.

## [35.4] - 2026-09-28

- Thêm tối ưu giá menu theo số lượng nguyên liệu đã dùng hôm qua.
- Tăng giá 1k cho món có nhu cầu cao và giảm 1k cho món có nhu cầu thấp.
- Giới hạn giá tối thiểu, giá trần và giới hạn theo size/nguyên liệu.
