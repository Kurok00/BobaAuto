# 🧋 Auto Tiệm Trà (BobaAuto)

Userscript tự động hoá quán trà trên trình duyệt: **tự quy hoạch kho theo nhu cầu khách** và **tự phục vụ** — lấy ly đúng size, bỏ topping, rót đúng trà, dán nắp giao ly.

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
   https://raw.githubusercontent.com/Kurok00/BobaAuto/main/boba-auto.user.js
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
   https://raw.githubusercontent.com/Kurok00/BobaAuto/main/boba-auto.user.js
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
3. Trước mỗi ngày bấm **⚡ Auto Nhập Hàng Thông Minh** — script tự tính số lượng theo số khách và số tiền trong ví, rồi tự bấm **NẤU**.
4. Mở cửa quán (nút **Mở cửa ngày N**) và chơi — phần phục vụ tự chạy theo các công tắc:

   | # | Công tắc | Mặc định |
   |---|----------|----------|
   | 1 | 🥤 Lấy ly đúng size (M/L) | Bật |
   | 2 | 🫗 Rót đúng trà (≥ 83% mới sang bước sau) | Bật |
   | 3 | 🧋 Thêm topping khách gọi (làm **trước** khi rót) | Bật |
   | 4 | 🔒 Dán nắp & giao ly | Bật |
   | 5 | 🐞 Trace log (tắt khi ổn) | Bật |

5. Muốn xem thông tin kỹ thuật → bấm **🔍 Chẩn Đoán DOM** (in ra Console).

### Tắt báo động
Khi mọi thứ chạy ổn, **tắt Trace log** để Console gọn và nhẹ máy hơn (đặc biệt trên điện thoại).

---

## 🔄 Cập nhật

Script tự lấy bản mới. Nhưng nếu bạn vừa chỉ sửa xong:

1. Vào **Dashboard** của Tampermonkey.
2. Bấm **Check for user script updates** (hoặc **Fetch** trên bản dùng chung).
3. Hoặc tải lại trang game (F5 / tải lại).

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
