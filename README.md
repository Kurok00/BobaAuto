# 🧋 Auto Tiệm Trà (BobaAuto)

Userscript tự động hoá quán trà trên trình duyệt: **ưu tiên nhập đủ ly**, quy hoạch trà/topping theo nhu cầu, tự phục vụ và tự điều chỉnh giá menu theo giá vốn.

Chạy trên **Edge điện thoại**, **Edge máy tính** và các trình duyệt khác, thông qua extension **Tampermonkey**.

---

## 📱 Cài trên điện thoại (Edge Mobile)

1. Mở **Edge** trên điện thoại.
2. Vào **Settings** (⚙️) → **Extensions** → bật **Developer mode**.
3. Bấm **Get extensions** → tìm **Tampermonkey** → **Get**.
   - Nếu không thấy mục *Developer mode*, hãy dùng Chrome/Edge phiên bản mới hơn hoặc cài Tampermonkey từ trang extension.
4. Mở Tampermonkey → vào tab **Dashboard** (biểu tượng tam giác ▸ **Dashboard**) → chọn **Get new scripts** / **Utility → Import from URL**.
5. Dán link này vào và bấm **Install**:

   ```
   https://raw.githubusercontent.com/Kurok00/BobaAuto/9134acc/boba-auto.user.js
   ```

6. Trình duyệt hỏi *"Cài đặt Auto Tiệm Trà?"* → bấm **Install / Cài đặt**.
7. Mở game, kéo lại trang (hoặc F5), thấy icon 🧋 là được.

> **Lưu ý:** nếu không thấy Tampermonkey trong mục *Extensions* của Edge iOS, hãy dùng Safari + **Userscripts** app thay thế (Cài đặt → chọn bản `boba-auto.user.js`).

---

## 💻 Cài trên máy tính (Edge PC)

1. Mở **Edge** → gõ `edge://extensions` vào thanh địa chỉ → Enter.
2. Bật **Developer mode** (góc dưới bên trái).
3. Bấm **Get** → tìm **Tampermonkey** → **Get**, hoặc tải từ
   [tampermonkey.net](https://www.tampermonkey.net) → **Download**.
4. Sau khi cài xong, mở menu **Extensions** trên thanh công cụ → **Tampermonkey** → **Dashboard**.
5. **Get new scripts** → dán link → **Install**:

   ```
   https://raw.githubusercontent.com/Kurok00/BobaAuto/9134acc/boba-auto.user.js
   ```

6. Bấm **Cài đặt / Install**. Xong.

**Chrome / Firefox / Opera / Brave:** cài hệt, chỉ khác bước mở trang cài đặt extension:
- Chrome: `chrome://extensions`
- Firefox: `about:addons`
- Brave: `brave://extensions`
- Opera: `opera://extensions`

---

## ✨ Cách dùng

1. Mở game → nhấn nút **⏸ Tạm dừng** để quy hoạch trước (khuyến nghị ở ngày đầu).
2. Bấm icon **🧋** trên góc phải màn hình để mở bảng điều khiển (kéo thả được).
3. Trước mỗi ngày bấm **⚡ Auto Nhập Hàng Thông Minh** — script ưu tiên mua ly trước theo tối đa 2 ly/khách và dự phòng theo ngày, sau đó mới phân bổ tiền cho trà/topping rồi tự bấm **NẤU**.
4. Mở cửa quán (nút **Mở cửa ngày N**) và chơi — phần phục vụ tự chạy theo các công tắc:

   | # | Công tắc | Mặc định |
   |---|----------|----------|
   | 1 | 🥤 Lấy ly đúng size (M/L) | Bật |
   | 2 | 🫗 Rót đúng trà (≥ 83% mới sang bước sau) | Bật |
   | 3 | 🧋 Thêm topping khách gọi (làm **trước** khi rót) | Bật |
   | 4 | 🔒 Dán nắp & giao ly | Bật |
   | 5 | 🐞 Trace log (tắt khi ổn) | Bật |

5. Muốn xem thông tin kỹ thuật → bấm **🔍 Chẩn Đoán DOM** (in ra Console).

### Tối ưu giá menu

Bấm **⚡ Tự động đặt giá hôm nay** trong menu BobaAuto. Script kết hợp số bán hôm qua, giá vốn và tín hiệu của game:

- Món được đánh dấu **rẻ**: tăng theo 12,5% hoặc 25% giá vốn tùy sức bán.
- Món được đánh dấu **đắt**: giảm 25% giá vốn.
- Món không có dữ liệu bán hôm qua: giữ nguyên, không tự hạ giá.
- Mức thay đổi được làm tròn theo bước 0,5k và vẫn nằm trong giới hạn an toàn của game.

Mở tab **Tổng kết** để xem doanh thu/số bán, hoặc tab **Giá bán** để xem giá vốn và trạng thái rẻ/đắt trước khi tối ưu.

### Tắt báo động
Khi mọi thứ chạy ổn, **tắt Trace log** để Console gọn và nhẹ máy hơn (đặc biệt trên điện thoại).

---

## 🔄 Cập nhật

Sau mỗi release, dùng URL release được ghi trong README này để tránh cache CDN:

1. Vào **Dashboard** của Tampermonkey.
2. Chọn **Install from URL / Import from URL**.
3. Dán URL release mới rồi cài đè bản cũ; sau đó tải lại game.

> Không tự cài file `.js` mới đè lên bản cũ nếu bạn không muốn mất thiết lập.

---

## ❓ Gặp lỗi?

1. Bật **Trace log**.
2. Mở **Console**:
   - **PC:** `F12` → tab **Console**
   - **Điện thoại:** Menu **⋯** → **Công cụ dành cho nhà phát triển** → **Console**
3. Bấm **🔍 Chẩn Đoán DOM** trong bảng điều khiển, copy toàn bộ nội dung.
4. Mở issue: [github.com/Kurok00/BobaAuto/issues](https://github.com/Kurok00/BobaAuto/issues) — dán log kèm ảnh chụp màn hình.

### Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Không thấy icon 🧋 | Tải lại trang; kiểm tra Tampermonkey đã bật script chưa |
| Cảnh báo *"Đang chạy nhiều bản cài đặt"* | Vào Dashboard, gỡ hết bản trùng, chỉ giữ **một** bản |
| Console báo lỗi đỏ | Copy nguyên dòng lỗi, gửi kèm issue |
| Bấm nút không ăn | Bấm **🔍 Chẩn Đoán DOM** rồi gửi log |

---

## 📄 Thông tin

- **Tác giả:** Kurok00
- **Giấy phép:** MIT
- **Trang game:** <https://trongnhi.trongnhi110266.workers.dev/>
- **Mã nguồn:** <https://github.com/Kurok00/BobaAuto>
- **Báo lỗi:** <https://github.com/Kurok00/BobaAuto/issues>

> ⚠️ Script chỉ chạy trên đúng địa chỉ game ở trên. Nếu game đổi tên miền, hãy báo qua issue.
