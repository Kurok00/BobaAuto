# BobaAuto - Developer Guide

Tài liệu này dành cho developer bảo trì userscript. Hướng dẫn cài và sử dụng cho người chơi nằm trong [README.md](README.md).

## Phạm vi repo

- `boba-auto.user.js`: userscript chính, toàn bộ UI, lập kế hoạch kho, state machine phục vụ và tối ưu giá.
- `dev.loader.user.js`: loader/phục vụ phát triển khi debug local.
- `boba_source.txt`: snapshot DOM/game dùng để đối chiếu selector.
- `CHANGELOG.md`: lịch sử các release.
- `.github/agents/boba-auto-maintainer.agent.md`: custom agent cho công việc bảo trì repo.

## Chạy và kiểm tra

Userscript chạy trên:

```text
https://trongnhi.trongnhi110266.workers.dev/*
```

Kiểm tra cú pháp trước mỗi commit:

```bash
node --check boba-auto.user.js
git diff --check
```

Không có test browser tự động trong repo. Khi thay đổi selector hoặc state machine, cần kiểm tra thủ công trên game và dùng nút **Quét & Copy Element** để lấy snapshot.

## Kiến trúc userscript

### Khởi tạo và UI

`initMod()` tạo icon nổi, menu điều khiển, các checkbox phục vụ, nút nhập hàng, nút tối ưu giá và bộ quét DOM. Menu dùng inline style kèm CSS responsive được chèn động.

Các vùng quan trọng:

- `#mod-menu`: menu BobaAuto.
- `#mod-icon`: icon kéo thả.
- `#price-summary`: tóm tắt kết quả tối ưu giá trong 5 giây.

### Nhập hàng

Flow trong handler `btn-prep`:

1. Đọc tiền từ `#hMoney` và số khách từ `.fore.big2`/`.fore`.
2. Tính nhu cầu `customers * cupsPerCustomer`.
3. Cộng dự phòng cố định và dự phòng theo ngày.
4. Reset kế hoạch cũ.
5. Gọi `planTab('2', ...)` để ưu tiên ly trước.
6. Gọi `planTab('0', ...)` cho trà.
7. Gọi `planTab('1', ...)` cho topping.
8. Kiểm tra chi phí và chỉ bấm `NẤU` khi game không khóa và ngân sách hợp lệ.

Cấu hình chính:

```js
cupsPerCustomer: 2
toppingPerCustomer: 0.5
restockBuffer: 12
restockBufferPerDay: 2
```

Khi đổi thứ tự nhập hàng, phải giữ nguyên nguyên tắc: ly là điều kiện cần để bán; không để bước khử ngân sách cắt ly trước trà/topping nếu chưa có chiến lược thay thế.

### Phục vụ

`serveTick()` chạy theo state machine trong `SERVE`:

```text
idle -> cup -> pour -> topping -> sugar -> seal -> idle
```

Các selector game quan trọng:

- `#q3say`: nội dung đơn.
- `#q3_M`, `#q3_L`: lấy ly.
- `#q3b_*`: nút trà, đường, đá và topping.
- `#q3hint`: tiến độ đường/đá thực tế.
- `#q3cup`: trạng thái ly.
- `#q3seal`: dán nắp.

Không tin rằng click đã thành công chỉ vì `element.click()`. Luôn đọc lại DOM/hint hoặc trạng thái ly sau thao tác.

### Tối ưu giá

Nút `btn-optimize-price` gọi `checkPriceOptimize()`:

1. Chuyển qua tab Kho và đọc `usedYesterday`.
2. Chuyển qua tab Giá bán.
3. Đọc input `input[data-g="sell"][data-k]`.
4. Đọc giá vốn từ dòng `.rowi .sub` có dạng `Vốn ...k`.
5. Đọc tín hiệu `.okline`: `rẻ`, `đắt` hoặc bình thường.
6. Tính delta theo `priceAdjustPct`, làm tròn `priceMinStep`.
7. Inject script vào page context để cập nhật `S.sell`, gọi `save()` và refresh `paneGia()`.

Cấu hình:

```js
priceAdjustPct: 25
priceMinStep: 500
priceMin: 5000
priceCap: 120000
priceCapSafety: 0.8
```

Công thức hiện tại:

```text
rẻ + bán mạnh   -> +25% giá vốn
rẻ + bán vừa    -> +12,5% giá vốn
đắt             -> -25% giá vốn
bình thường     -> fallback theo nhu cầu
không có dữ liệu -> giữ nguyên
```

Đây là heuristic, chưa phải mô hình elasticity hoàn chỉnh. Không được kết luận giá tối ưu tuyệt đối nếu chưa có số khách bỏ về, tồn cuối ngày và doanh thu cùng kỳ.

## Bộ quét DOM

`collectElementScan()` tạo snapshot v2 gồm:

- `KEY STATE`: ngày, tiền, tên quán, đánh giá, đơn và trạng thái ly.
- `TARGETED ELEMENTS`: vùng `#q3`, `#view`, kho, giá, tổng kết và menu.
- `PRICE INPUTS`: key, label, giá hiện tại.
- `WAREHOUSE ROWS`: tồn, giá vốn, dùng hôm qua, hạn và kế hoạch.
- `SUMMARY CANDIDATES`: text có khả năng là tổng kết ngày/tuần/tháng, doanh thu hoặc lợi nhuận.

Khi phân tích giá, mở tab **Giá bán** rồi quét. Khi phân tích doanh thu, mở tab **Tổng kết** rồi quét. Snapshot ở màn Chuẩn bị nhưng đang ở tab khác sẽ không có đủ dữ liệu giá/tổng kết.

## Release

1. Chỉnh code và cập nhật `CHANGELOG.md`.
2. Chạy:

```bash
node --check boba-auto.user.js
git diff --check
```

3. Bump `@version`, `appVersion` và `tampermonkeyVersion`.
4. Commit và push `main`.
5. Vì URL update hiện được pin theo commit để tránh cache, sau khi có commit release mới cần cập nhật `@updateURL`, `@downloadURL`, nút kiểm tra và nút mở cập nhật trỏ tới commit release đó.
6. Cài thử URL commit mới trong Tampermonkey và kiểm tra menu hiển thị đúng version.

Không đổi các metadata sau nếu không có lý do rõ ràng:

```text
@name
@namespace
@match
```

Đổi `@name` hoặc `@namespace` có thể khiến Tampermonkey cài bản sao thay vì cập nhật bản cũ.
