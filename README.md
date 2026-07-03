# ElectroMax E-Market (DoAnHTTKTT-E\_Market)

!\[Java](https://img.shields.io/badge/Java-17-blue)
!\[SQL Server](https://img.shields.io/badge/SQL\_Server-2019-red)
!\[HTML5](https://img.shields.io/badge/HTML5-orange)
!\[CSS3](https://img.shields.io/badge/CSS3-blue)
!\[JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow)

Hệ thống bán lẻ thiết bị điện máy trực tuyến tích hợp cơ sở dữ liệu và hệ thống quản lý thẻ thành viên thông minh (Loyalty Membership Program). Đây là dự án phục vụ môn học **Phân tích và Thiết kế Hệ thống Thông tin**.

\---

## Table of Contents

* Giới thiệu
* Công nghệ
* Yêu cầu hệ thống
* Cài đặt
* Database
* Chạy chương trình
* Cấu trúc thư mục
* Chức năng
* Hình ảnh
* Thành viên
* License

## Kiến trúc hệ thống

```text
Browser
   │ HTTP
   ▼
Java Backend
   │ JDBC
   ▼
Microsoft SQL Server
```

## 1\. Tên dự án

* **Tên chính thức:** ElectroMax E-Market
* **Mã dự án:** DoAnHTTKTT-E\_Market
* **Chủ đề:** Hệ thống bán lẻ điện máy \& Quản lý chương trình thành viên thân thiết

\---

## 2\. Giới thiệu dự án

**ElectroMax E-Market** là giải pháp thương mại điện tử chuyên cung cấp các sản phẩm thiết bị gia dụng, điện lạnh và thiết bị nhà thông minh. Hệ thống không chỉ cung cấp giao diện mua sắm hiện đại, bộ lọc sản phẩm đa chiều thông minh mà còn tích hợp chặt chẽ với cơ sở dữ liệu quan hệ nhằm xử lý các nghiệp vụ nâng cao như:

* **Hệ thống thẻ thành viên:** Đăng ký, thăng hạng (Đồng, Bạc, Vàng) dựa trên mức chi tiêu thực tế, đổi điểm tích lũy lấy mã giảm giá (voucher).
* **Quản lý kho hàng \& đơn hàng:** Tự động cập nhật số lượng tồn kho sản phẩm khi đặt hàng, và khôi phục hàng tồn kho khi hủy đơn.
* **Xử lý hủy đơn thông minh:** Tự động hoàn tác (trừ) điểm tích lũy của khách hàng và hoàn lại số lượng tồn kho của sản phẩm khi quản trị viên cập nhật trạng thái đơn hàng thành "Đã hủy".

\---

## 3\. Công nghệ sử dụng

### Frontend (Giao diện người dùng)

* **HTML5 \& CSS3:** Thiết kế giao diện phẳng hiện đại, phong cách Dark Mode tinh tế, hiệu ứng chuyển động mượt mà (smooth transitions) và tương thích tốt trên các thiết bị di động (Responsive Web Design).
* **Vanilla JavaScript (ES6+):** Xử lý logic giỏ hàng, tìm kiếm, lọc động và gọi API tương tác trực tiếp với Backend.

### Backend (Xử lý dịch vụ)

* **Java SE (JDK 11+):** Sử dụng máy chủ HTTP tích hợp sẵn (`com.sun.net.httpserver`) giúp hệ thống gọn nhẹ, không phụ thuộc vào các framework nặng nề như Spring Boot.
* **JDBC (Java Database Connectivity):** Kết nối và thực thi các câu lệnh SQL đến hệ quản trị cơ sở dữ liệu.
* **Microsoft SQL Server JDBC Driver:** Hỗ trợ kết nối và giao tiếp dữ liệu tốc độ cao giữa Java và MS SQL Server.

### Cơ sở dữ liệu (DBMS)

* **Microsoft SQL Server (phiên bản 2012 trở lên):** Lưu trữ toàn bộ dữ liệu về sản phẩm, danh mục, khách hàng, nhân viên, thẻ thành viên, đơn hàng, chi tiết đơn hàng và lịch sử điểm tích lũy.

\---

## 4\. Yêu cầu hệ thống

* **Hệ điều hành:** Windows 10/11 (khuyên dùng để sử dụng file chạy tự động `.bat`), macOS hoặc Linux.
* **Java Development Kit (JDK):** Phiên bản **11** hoặc **17** trở lên (Đã cấu hình biến môi trường `JAVA\_HOME`).
* **Hệ quản trị CSDL:** Microsoft SQL Server (cho phép kết nối qua TCP/IP trên cổng mặc định `1433` và sử dụng phương thức xác thực bằng tài khoản SQL Server).
* **Trình duyệt Web:** Google Chrome, Microsoft Edge, Mozilla Firefox hoặc Safari bản mới nhất.

\---

## 5\. Cài đặt

### Bước 1: Tải mã nguồn dự án

Tải hoặc clone thư mục dự án về máy tính của bạn:

```bash
git clone https://github.com/viduong06/DoAnHTTKTT-E_Market.git
cd DoAnHTTKTT-E_Market
```

### Bước 2: Cấu hình kết nối TCP/IP cho SQL Server

Để Backend Java có thể kết nối được với SQL Server trên cổng `1433`, bạn cần kích hoạt TCP/IP:

1. Mở **SQL Server Configuration Manager**.
2. Chọn **SQL Server Network Configuration** -> **Protocols for MSSQLSERVER** (hoặc tên Instance của bạn).
3. Click chuột phải vào **TCP/IP** và chọn **Enable**.
4. Double-click vào **TCP/IP**, chuyển qua tab **IP Addresses**, kéo xuống mục **IPAll** và thiết lập **TCP Port** là `1433`.
5. Restart lại service **SQL Server** trong Windows Services.

### Bước 3: Đảm bảo thư viện Driver JDBC

Thư mục `java-backend/lib/` cần phải chứa tệp tin thư viện kết nối SQL Server:

* `mssql-jdbc.jar` (Đã được tích hợp sẵn trong thư mục `lib/` của dự án).

\---

## 6\. Cấu hình Database

Dự án hỗ trợ 2 cách cấu hình Cơ sở dữ liệu:

### Cách 1: Sử dụng cơ chế Auto-DDL và Auto-Seeding (Mặc định - Khuyên dùng)

Khi bạn khởi chạy ứng dụng lần đầu tiên, Backend Java sẽ tự động thực hiện các tác vụ sau:

1. Kết nối với SQL Server master để kiểm tra và tự động khởi tạo cơ sở dữ liệu tên là `Emarket` nếu chưa tồn tại.
2. Tự động tạo toàn bộ cấu trúc bảng cần thiết (`DanhMuc`, `NhanVien`, `KhachHang`, `TheThanhVien`, `LichSuDiem`, `SanPham`, `DonHang`, `ChiTietDonHang`).
3. Tự động chèn dữ liệu mẫu ban đầu (Seeding) bao gồm danh mục sản phẩm, nhân viên quản trị và các sản phẩm điện máy thuộc các thương hiệu Samsung, LG, Panasonic, Sony, Daikin, Xiaomi,...

Do đó, bạn **không cần chạy bất kỳ file SQL script thủ công nào bằng tay**.

### Cách 2: Khởi tạo thủ công bằng file SQL (Dành cho việc kiểm thử/backup)

Nếu bạn muốn tự tay khởi tạo cơ sở dữ liệu hoặc import cấu trúc dữ liệu bằng công cụ quản trị (SSMS):

1. File SQL script nằm tại: `database/DatabaseEmarket.sql`.
2. Mở **SQL Server Management Studio (SSMS)**.
3. Kéo thả file `DatabaseEmarket.sql` vào SSMS.
4. Nhấn **Execute** (hoặc phím `F5`) để thực thi toàn bộ kịch bản tạo database và nhập dữ liệu mẫu.

### Tham số kết nối mặc định (trong file `App.java`):

* **Host/Port:** `localhost:1433`
* **Tên Database:** `Emarket`
* **Tài khoản SQL:** `sa`
* **Mật khẩu SQL:** `123456`

> \[!NOTE]
> Bạn có thể thay đổi các tham số này trực tiếp trong các biến ở đầu file `App.java` (dòng 25 - 31) hoặc cấu hình thông qua các biến môi trường hệ thống: `DB\_NAME`, `DB\_USER`, `DB\_PASSWORD`.

\---

## 7\. Chạy chương trình

### Cách 1: Chạy tự động bằng file Script (Khuyên dùng trên Windows)

Tại thư mục gốc của dự án, nhấp đúp chuột vào file **`run.bat`**.
Script tự động này sẽ thực hiện toàn bộ quy trình:

1. Kiểm tra môi trường Java trên máy của bạn. Nếu chưa cài đặt, script sẽ tự động tải phiên bản **Portable JDK 17** về dự án để chạy mà không cần cài đặt thủ công.
2. Thực hiện biên dịch mã nguồn Java từ thư mục `src/` sang thư mục `bin/`.
3. Khởi động server HTTP backend Java tại cổng `8080`.
4. Tự động mở trình duyệt web hiển thị hai trang chính:

   * **Trang khách hàng:** `http://localhost:8080/index.html`
   * **Trang quản trị viên:** `http://localhost:8080/admin.html`

### Cách 2: Chạy thủ công qua Command Prompt/PowerShell

Nếu chạy trên macOS/Linux hoặc muốn chạy thủ công, hãy mở Terminal tại thư mục `java-backend/` và gõ các lệnh sau:

**1. Biên dịch dự án:**

```bash
javac -d bin -cp "lib\\mssql-jdbc.jar" src\\main\\java\\vn\\emarket\\App.java
```

**2. Chạy ứng dụng:**

```bash
java -cp "bin;lib\\mssql-jdbc.jar" vn.emarket.App
```

Sau khi ứng dụng khởi động thành công, mở trình duyệt truy cập: `http://localhost:8080/index.html`.

\---

## 8\. Cấu trúc thư mục

Dưới đây là sơ đồ cấu trúc các thư mục và tệp tin chính của dự án:

```text
DoAnHTTKTT-E\_Market/
│
├── database/                       # Thư mục chứa mã nguồn cơ sở dữ liệu
│   └── DatabaseEmarket.sql         # Script SQL tạo cấu trúc bảng và dữ liệu mẫu
│
├── java-backend/                   # Máy chủ Backend viết bằng Java
│   ├── bin/                        # Thư mục chứa các file .class sau khi biên dịch
│   ├── lib/                        # Thư mục chứa thư viện JDBC (mssql-jdbc.jar)
│   ├── src/
│   │   └── main/
│   │       └── java/
│   │           └── vn/
│   │               └── emarket/
│   │                   └── App.java # Tệp tin logic chính điều khiển backend \& kết nối DB
│   ├── run-tests.bat               # Kịch bản chạy kiểm thử backend
│   └── run.bat                     # Script biên dịch và chạy backend cục bộ
│
├── webpttkhttt/                    # Mã nguồn Frontend (Giao diện web tĩnh)
│   ├── index.html                  # Trang chủ mua sắm (Flash Sale \& gợi ý)
│   ├── product-list.html           # Trang danh sách sản phẩm với bộ lọc nâng cao
│   ├── product-detail.html         # Trang xem chi tiết thông số kỹ thuật sản phẩm
│   ├── product-images.html         # Tệp tin cấu hình bản đồ ánh xạ hình ảnh sản phẩm
│   ├── cart.html                   # Giao diện giỏ hàng của khách hàng
│   ├── checkout.html               # Giao diện nhập thông tin thanh toán \& đặt hàng
│   ├── profile.html                # Giao diện quản lý thẻ thành viên, đổi điểm lấy voucher
│   ├── admin.html                  # Giao diện quản trị đơn hàng \& lịch sử hệ thống
│   ├── about.html                  # Trang giới thiệu về cửa hàng
│   ├── contact.html                # Trang thông tin liên hệ hỗ trợ
│   ├── news.html                   # Trang tin tức khuyến mãi điện máy
│   ├── stores.html                 # Trang danh sách hệ thống siêu thị
│   ├── terms.html                  # Trang điều khoản dịch vụ \& chính sách bảo mật
│   ├── style.css                   # Định kiểu giao diện CSS chính (Modern \& Responsive)
│   └── script.js                   # Logic JavaScript điều phối Frontend \& kết nối API
│
├── README.md                       # Tài liệu hướng dẫn sử dụng dự án (File này)
└── run.bat                         # Phím tắt chạy nhanh hệ thống từ thư mục gốc
```

\---

## 9\. Chức năng hệ thống

### Phân hệ khách hàng (Frontend \& API)

* **Mua sắm thông minh:**

  * Xem danh sách các mặt hàng điện máy đa dạng phân chia theo danh mục (Tủ lạnh, Máy giặt, Tivi, Máy lạnh,...).
  * Khu vực **Flash Sale** có đồng hồ đếm ngược thời gian thực, hiển thị thanh tiến trình số lượng sản phẩm giới hạn đã bán.
  * Lọc sản phẩm nâng cao: Lọc theo thương hiệu, mức giá, số sao đánh giá, dung tích (lít, kg, inch, HP), nhãn năng lượng (tiết kiệm điện) và tính năng thông minh.
  * Sắp xếp sản phẩm linh hoạt theo giá tăng/giảm dần hoặc đánh giá cao nhất.
* **Chi tiết sản phẩm chuyên sâu:**

  * Trình chiếu thư viện ảnh sản phẩm độ phân giải cao.
  * Bảng thông số kỹ thuật chi tiết truy vấn trực tiếp từ cơ sở dữ liệu.
  * Đề xuất các sản phẩm liên quan cùng danh mục ở phía dưới.
* **Quản lý giỏ hàng \& Đặt hàng:**

  * Thêm nhanh sản phẩm vào giỏ hàng, tăng/giảm số lượng trực tiếp trong giỏ hàng.
  * Tự động kiểm tra tính hợp lệ của thông tin giao hàng (Họ tên phải có từ 2 từ trở lên và không chứa ký số, Số điện thoại phải đúng định dạng Việt Nam `0xxxxxxxxx` hoặc `+84xxxxxxxxx`).
  * Tích hợp mã giảm giá đổi từ điểm thẻ thành viên (`GIAM50`, `GIAM100`, `GIAM250`).
* **Hệ thống thẻ thành viên thân thiết (Loyalty Program):**

  * Đăng ký thẻ thành viên nhanh chóng bằng số điện thoại khách hàng.
  * Tích lũy điểm tự động: Mỗi **20.000 VNĐ** giá trị đơn hàng được quy đổi thành **1 điểm** tích lũy lưu vào Database.
  * Tự động thăng hạng thẻ thành viên dựa trên điểm số hiện tại:

    * **Hạng Đồng (Bronze):** Dưới 1000 điểm (Ưu đãi giảm giá đơn hàng: 0%).
    * **Hạng Bạc (Silver):** Từ 1000 đến 1999 điểm (Ưu đãi giảm giá đơn hàng: 5%).
    * **Hạng Vàng (Gold):** Từ 2000 điểm trở lên (Ưu đãi giảm giá đơn hàng: 10%).
  * Đổi điểm tích lũy lấy Voucher: Khách hàng có thể quy đổi điểm để lấy các mã giảm giá và áp dụng trực tiếp tại trang giỏ hàng.
  * Quản lý lịch sử điểm: Lưu trữ chi tiết tất cả giao dịch cộng/trừ điểm (lý do giao dịch, mã đơn hàng liên kết, ngày giao dịch).
  * Hủy thẻ và đăng ký lại: Hỗ trợ đặt lại (reset) điểm tích lũy và thứ hạng thẻ về ban đầu.

### Phân hệ quản trị (Admin Portal)

* **Quản lý đơn đặt hàng:**

  * Hiển thị danh sách toàn bộ đơn hàng trong hệ thống được sắp xếp theo thời gian đặt mới nhất.
  * Cập nhật trạng thái đơn hàng: Chuyển đổi trạng thái từ *Đang xử lý* sang *Đang giao*, *Đã giao* hoặc *Đã hủy*.
* **Xử lý hủy đơn hàng thông minh (Critical Workflow):**
Khi Quản trị viên cập nhật trạng thái đơn hàng thành **"Đã hủy"**, hệ thống sẽ tự động thực thi các giao thức an toàn dữ liệu trong một Transaction duy nhất:

  1. **Hoàn kho:** Cộng trả lại số lượng sản phẩm khách hàng đã mua về kho tồn kho tương ứng trong bảng `SanPham`.
  2. **Hoàn tác điểm tích lũy:** Khấu trừ (thu hồi) số điểm thưởng đã cộng cho khách hàng từ đơn hàng bị hủy đó trong bảng `TheThanhVien`, đồng thời lưu vết bản ghi giao dịch trừ điểm vào bảng `LichSuDiem`.

\---

## 10\. Thành viên thực hiện dự án

Dưới đây là danh sách các thành viên tham gia phát triển dự án này:

|STT|Họ và Tên|Mã số sinh viên (MSSV)|
|1|Đặng Trung Kiên|0394369|Nhóm trưởng|
|2|Nguyễn Thế Tâm|0402569|
|3|Dương Tuệ Vĩ|0406769|
|4|Nguyễn Công Tuấn Anh|0381169|
|5|Trần Quang Thắng|0403269|

\---

*Chúc các bạn có trải nghiệm tốt khi cài đặt và phát triển tiếp hệ thống ElectroMax E-Market! Mọi thắc mắc hoặc báo lỗi vui lòng liên hệ nhóm phát triển.*

\---

## License

This project was developed for educational purposes as part of the Information Systems Analysis and Design course.

