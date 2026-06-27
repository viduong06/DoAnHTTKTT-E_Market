package vn.emarket;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Locale;
import java.util.HashMap;
import java.util.Map;
import java.net.URLDecoder;

public class App {
  private static final String DB_NAME = env("DB_NAME", "Emarket");
  private static final String DB_ADMIN_URL = env("DB_ADMIN_URL",
      "jdbc:sqlserver://localhost:1433;databaseName=master;encrypt=true;trustServerCertificate=true");
  private static final String DB_URL = env("DB_URL",
      "jdbc:sqlserver://localhost:1433;databaseName=" + DB_NAME + ";encrypt=true;trustServerCertificate=true");
  private static final String DB_USER = env("DB_USER", "sa");
  private static final String DB_PASSWORD = env("DB_PASSWORD", "123456");
  private static Path WEB_ROOT;
  private static Path ADMIN_ROOT;

  public static void main(String[] args) throws Exception {
    // Resolve đường dẫn từ working directory (java-backend/)
    WEB_ROOT   = Path.of(env("WEB_ROOT",   "../webpttkhttt")).toAbsolutePath().normalize();
    ADMIN_ROOT = Path.of(env("ADMIN_ROOT", "../admin")).toAbsolutePath().normalize();

    System.out.println("WEB_ROOT   = " + WEB_ROOT);
    System.out.println("ADMIN_ROOT = " + ADMIN_ROOT);

    Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
    ensureDatabase();
    migrateAndSeed();

    int port = Integer.parseInt(env("PORT", "8080"));
    HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
    server.createContext("/api/bootstrap", exchange -> handleJson(exchange, App::bootstrapJson));
    server.createContext("/api/products", exchange -> handleJson(exchange, () -> tableJson("SanPham")));
    server.createContext("/api/categories", exchange -> handleJson(exchange, () -> tableJson("DanhMuc")));
    server.createContext("/api/orders", App::handleOrders);
    server.createContext("/api/checkout", App::handleCheckout);
    server.createContext("/api/member/update-points", App::handleUpdatePoints);
    server.createContext("/", App::serveStatic);
    server.setExecutor(null);
    server.start();

    System.out.println("Emarket backend running at http://localhost:" + port + "/index.html");
    System.out.println("Serving static files from " + WEB_ROOT);
  }

  private static void handleJson(HttpExchange exchange, JsonSupplier supplier) throws IOException {
    if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
      send(exchange, 405, "{\"error\":\"Method not allowed\"}", "application/json; charset=utf-8");
      return;
    }

    try {
      send(exchange, 200, supplier.get(), "application/json; charset=utf-8");
    } catch (Exception ex) {
      ex.printStackTrace();
      send(exchange, 500, "{\"error\":\"" + escapeJson(ex.getMessage()) + "\"}", "application/json; charset=utf-8");
    }
  }

  private static String bootstrapJson() throws SQLException {
    return "{"
        + "\"DanhMuc\":" + tableJson("DanhMuc") + ","
        + "\"NhanVien\":" + tableJson("NhanVien") + ","
        + "\"SanPham\":" + tableJson("SanPham") + ","
        + "\"KhachHang\":" + firstRowJson("KhachHang", "{}") + ","
        + "\"TheThanhVien\":" + firstRowJson("TheThanhVien", "null") + ","
        + "\"LichSuDiem\":" + tableJson("LichSuDiem")
        + "}";
  }

  private static String tableJson(String tableName) throws SQLException {
    StringBuilder json = new StringBuilder("[");
    try (Connection conn = getConnection();
        Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery("SELECT * FROM " + tableName)) {
      int row = 0;
      while (rs.next()) {
        if (row++ > 0)
          json.append(',');
        json.append(rowToJson(rs));
      }
    }
    return json.append(']').toString();
  }

  private static String firstRowJson(String tableName, String emptyJson) throws SQLException {
    try (Connection conn = getConnection();
        Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery("SELECT TOP 1 * FROM " + tableName)) {
      return rs.next() ? rowToJson(rs) : emptyJson;
    }
  }

  private static String rowToJson(ResultSet rs) throws SQLException {
    StringBuilder json = new StringBuilder("{");
    int count = rs.getMetaData().getColumnCount();
    for (int i = 1; i <= count; i++) {
      if (i > 1)
        json.append(',');
      String name = rs.getMetaData().getColumnLabel(i);
      Object value = rs.getObject(i);
      json.append('"').append(escapeJson(name)).append("\":");
      if (value == null) {
        json.append("null");
      } else if (value instanceof Number || value instanceof Boolean) {
        json.append(value);
      } else {
        json.append('"').append(escapeJson(String.valueOf(value))).append('"');
      }
    }
    return json.append('}').toString();
  }

  private static void serveStatic(HttpExchange exchange) throws IOException {
    String rawPath = exchange.getRequestURI().getPath();

    // Route /admin/... → ADMIN_ROOT
    if (rawPath.startsWith("/admin/") || rawPath.equals("/admin")) {
      String relative = rawPath.replaceFirst("^/admin/?", "");
      if (relative.isEmpty()) relative = "admin.html";
      Path target = ADMIN_ROOT.resolve(relative).normalize();
      System.out.println("[admin] " + rawPath + " -> " + target + " | exists=" + Files.exists(target));
      if (target.startsWith(ADMIN_ROOT) && Files.exists(target) && !Files.isDirectory(target)) {
        serveFile(exchange, target);
      } else {
        send(exchange, 404, "Admin file not found: " + target, "text/plain; charset=utf-8");
      }
      return;
    }

    // Route mặc định → WEB_ROOT
    String relative = rawPath.equals("/") ? "index.html" : rawPath.substring(1);
    Path target = WEB_ROOT.resolve(relative).normalize();
    if (!target.startsWith(WEB_ROOT) || Files.isDirectory(target) || !Files.exists(target)) {
      send(exchange, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    serveFile(exchange, target);
  }

  private static void serveFile(HttpExchange exchange, Path target) throws IOException {
    byte[] bytes = Files.readAllBytes(target);
    exchange.getResponseHeaders().set("Content-Type", contentType(target));
    exchange.sendResponseHeaders(200, bytes.length);
    try (OutputStream os = exchange.getResponseBody()) {
      os.write(bytes);
    }
  }

  private static void migrateAndSeed() throws SQLException {
    try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {
      for (String sql : schemaStatements()) {
        stmt.execute(sql);
      }
    }

    // Cập nhật imageUrl cho sản phẩm cũ chưa có ảnh
    // (đã chuyển sang product-images.html)

    if (tableCount("SanPham") > 0) {
      return;
    }

    try (Connection conn = getConnection()) {
      conn.setAutoCommit(false);
      seedCategories(conn);
      seedStaff(conn);
      seedCustomer(conn);
      seedMember(conn);
      seedPointHistory(conn);
      seedProducts(conn);
      conn.commit();
    }
  }

  private static List<String> schemaStatements() {
    return List.of(
        "IF OBJECT_ID('DanhMuc', 'U') IS NULL CREATE TABLE DanhMuc (categoryID VARCHAR(20) PRIMARY KEY, categoryName NVARCHAR(255) NOT NULL)",
        "IF OBJECT_ID('NhanVien', 'U') IS NULL CREATE TABLE NhanVien (staffId VARCHAR(20) PRIMARY KEY, staffName NVARCHAR(255), roleName NVARCHAR(100))",
        "IF OBJECT_ID('KhachHang', 'U') IS NULL CREATE TABLE KhachHang (customerID INT PRIMARY KEY, name NVARCHAR(255), email VARCHAR(255), phone VARCHAR(50), address NVARCHAR(MAX))",
        "IF OBJECT_ID('TheThanhVien', 'U') IS NULL CREATE TABLE TheThanhVien (cardID VARCHAR(30) PRIMARY KEY, customerID INT, point INT, rank NVARCHAR(50), discountRate DECIMAL(4,2), FOREIGN KEY (customerID) REFERENCES KhachHang(customerID))",
        "IF OBJECT_ID('LichSuDiem', 'U') IS NULL CREATE TABLE LichSuDiem (historyID INT IDENTITY(1,1) PRIMARY KEY, date VARCHAR(20), orderId VARCHAR(30), points INT, type NVARCHAR(20), reason NVARCHAR(MAX))",
        "IF OBJECT_ID('SanPham', 'U') IS NULL CREATE TABLE SanPham (productID VARCHAR(30) PRIMARY KEY, productName NVARCHAR(255) NOT NULL, categoryID VARCHAR(20), brand NVARCHAR(100), priceProduct INT NOT NULL, originalPrice INT NOT NULL, quantityProduct INT DEFAULT 0, capacity NVARCHAR(100), energySaving NVARCHAR(50), smartFeature NVARCHAR(50), descriptionProduct NVARCHAR(MAX), rating DECIMAL(3,1), reviewsCount INT DEFAULT 0, soldCount INT DEFAULT 0, isFlashSale BIT DEFAULT 0, soldFlash INT DEFAULT 0, limitFlash INT DEFAULT 0, FOREIGN KEY (categoryID) REFERENCES DanhMuc(categoryID))",
        "IF OBJECT_ID('DonHang', 'U') IS NULL CREATE TABLE DonHang (orderId VARCHAR(30) PRIMARY KEY, orderDate VARCHAR(50), totalAmount INT, shippingAddress NVARCHAR(MAX), status NVARCHAR(50), paymentMethod NVARCHAR(100), customerID INT, staffId VARCHAR(20), FOREIGN KEY (customerID) REFERENCES KhachHang(customerID), FOREIGN KEY (staffId) REFERENCES NhanVien(staffId))",
        "IF OBJECT_ID('ChiTietDonHang', 'U') IS NULL CREATE TABLE ChiTietDonHang (orderId VARCHAR(30), productID VARCHAR(30), quantity INT, unitPrice INT, PRIMARY KEY (orderId, productID), FOREIGN KEY (orderId) REFERENCES DonHang(orderId), FOREIGN KEY (productID) REFERENCES SanPham(productID))");
  }

  private static void seedCategories(Connection conn) throws SQLException {
    String sql = "INSERT INTO DanhMuc (categoryID, categoryName) VALUES (?, ?)";
    insertRows(conn, sql, List.of(
        List.of("DM_MG", "Máy giặt"),
        List.of("DM_TL", "Tủ lạnh"),
        List.of("DM_TV", "Tivi"),
        List.of("DM_ML", "Máy lạnh")));
  }

  private static void seedStaff(Connection conn) throws SQLException {
    String sql = "INSERT INTO NhanVien (staffId, staffName, roleName) VALUES (?, ?, ?)";
    insertRows(conn, sql, List.of(List.of("NV001", "Quản trị viên", "Admin")));
  }

  private static void seedCustomer(Connection conn) throws SQLException {
    String sql = "INSERT INTO KhachHang (customerID, name, email, phone, address) VALUES (?, ?, ?, ?, ?)";
    insertRows(conn, sql, List.of(List.of(1, "Nguyễn Văn An", "an@example.com", "0909000001", "TP.HCM")));
  }

  private static void seedMember(Connection conn) throws SQLException {
    String sql = "INSERT INTO TheThanhVien (cardID, customerID, point, rank, discountRate) VALUES (?, ?, ?, ?, ?)";
    insertRows(conn, sql, List.of(List.of("TV-0001", 1, 420, "Đồng", 0.00)));
  }

  private static void seedPointHistory(Connection conn) throws SQLException {
    String sql = "INSERT INTO LichSuDiem (date, orderId, points, type, reason) VALUES (?, ?, ?, ?, ?)";
    insertRows(conn, sql, List.of(
        List.of("2026-06-01", "DH-100001", 180, "cộng", "Tích lũy đơn hàng DH-100001"),
        List.of("2026-06-10", "DH-100248", 240, "cộng", "Tích lũy đơn hàng DH-100248")));
  }

  private static void seedProducts(Connection conn) throws SQLException {
    String sql = "INSERT INTO SanPham (productID, productName, categoryID, brand, priceProduct, originalPrice, quantityProduct, capacity, energySaving, smartFeature, descriptionProduct, rating, reviewsCount, soldCount, isFlashSale, soldFlash, limitFlash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    insertRows(conn, sql, List.of(
        List.of("SP_MG_01", "Máy giặt Samsung Inverter 10kg", "DM_MG", "Samsung", 8490000, 10990000, 25, "10kg", "5 sao", "Có", "Máy giặt inverter tiết kiệm điện, vận hành êm.", 4.8, 128, 86, true, 35, 80),
        List.of("SP_MG_02", "Máy giặt LG AI DD 9kg", "DM_MG", "LG", 7690000, 9490000, 18, "9kg", "5 sao", "Có", "Công nghệ AI DD bảo vệ sợi vải.", 4.7, 96, 64, false, 0, 0),
        List.of("SP_MG_03", "Máy giặt Panasonic Inverter 10kg", "DM_MG", "Panasonic", 7290000, 9290000, 20, "10kg", "5 sao", "Không", "Giặt sạch mạnh mẽ, tiết kiệm điện nước.", 4.6, 74, 45, false, 0, 0),
        List.of("SP_MG_04", "Máy giặt Toshiba Inverter 9kg", "DM_MG", "Toshiba", 6490000, 8490000, 15, "9kg", "4 sao", "Không", "Công nghệ Dual Spray làm sạch hiệu quả.", 4.5, 52, 31, false, 0, 0),
        List.of("SP_MG_05", "Máy giặt Samsung EcoBubble 12kg", "DM_MG", "Samsung", 9990000, 12490000, 10, "12kg", "5 sao", "Có", "Công nghệ EcoBubble giặt sạch ngay cả nước lạnh.", 4.8, 61, 40, false, 0, 0),
        List.of("SP_TL_01", "Tủ lạnh Panasonic Inverter 326L", "DM_TL", "Panasonic", 9990000, 12490000, 16, "326L", "5 sao", "Không", "Ngăn đông mềm và làm lạnh nhanh.", 4.9, 142, 73, true, 42, 90),
        List.of("SP_TL_02", "Tủ lạnh Samsung Bespoke 352L", "DM_TL", "Samsung", 12990000, 15990000, 12, "352L", "5 sao", "Có", "Thiết kế hiện đại, quản lý thông minh.", 4.8, 88, 51, false, 0, 0),
        List.of("SP_TL_03", "Tủ lạnh LG InstaView 506L", "DM_TL", "LG", 19990000, 24990000, 8, "506L", "5 sao", "Có", "Gõ nhẹ để xem bên trong không cần mở cửa.", 4.9, 63, 29, false, 0, 0),
        List.of("SP_TL_04", "Tủ lạnh Toshiba Inverter 233L", "DM_TL", "Toshiba", 6990000, 8990000, 20, "233L", "4 sao", "Không", "Làm lạnh nhanh, khử mùi hiệu quả.", 4.5, 47, 28, false, 0, 0),
        List.of("SP_TL_05", "Tủ lạnh Xiaomi Side By Side 536L", "DM_TL", "Xiaomi", 14990000, 18990000, 9, "536L", "5 sao", "Có", "Điều khiển qua app, màn hình cảm ứng.", 4.7, 55, 22, false, 0, 0),
        List.of("SP_TV_01", "Smart TV Sony 4K 55 inch", "DM_TV", "Sony", 13990000, 17990000, 20, "55 inch", "4 sao", "Có", "Hình ảnh 4K sắc nét, âm thanh sống động.", 4.9, 210, 120, true, 58, 100),
        List.of("SP_TV_02", "Smart TV LG OLED 48 inch", "DM_TV", "LG", 18990000, 22990000, 10, "48 inch", "4 sao", "Có", "Màn hình OLED, màu đen sâu.", 4.8, 76, 38, false, 0, 0),
        List.of("SP_TV_03", "Smart TV Samsung QLED 65 inch", "DM_TV", "Samsung", 22990000, 28990000, 7, "65 inch", "4 sao", "Có", "Công nghệ QLED rực rỡ, độ sáng cao.", 4.8, 93, 44, false, 0, 0),
        List.of("SP_TV_04", "Smart TV Xiaomi 43 inch", "DM_TV", "Xiaomi", 5990000, 7990000, 25, "43 inch", "3 sao", "Có", "Giá tốt, tích hợp Android TV đầy đủ.", 4.5, 134, 89, false, 0, 0),
        List.of("SP_TV_05", "Smart TV Sony Bravia 75 inch", "DM_TV", "Sony", 34990000, 42990000, 5, "75 inch", "4 sao", "Có", "Màn hình siêu lớn, trải nghiệm rạp phim tại nhà.", 4.9, 48, 17, false, 0, 0),
        List.of("SP_ML_01", "Máy lạnh Daikin Inverter 1.5HP", "DM_ML", "Daikin", 10990000, 13490000, 14, "1.5HP", "5 sao", "Không", "Làm lạnh nhanh, tiết kiệm điện.", 4.7, 115, 69, false, 0, 0),
        List.of("SP_ML_02", "Máy lạnh Panasonic Nanoe X 1HP", "DM_ML", "Panasonic", 9490000, 11990000, 15, "1HP", "5 sao", "Có", "Lọc khí Nanoe X, vận hành bền bỉ.", 4.8, 101, 57, false, 0, 0),
        List.of("SP_ML_03", "Máy lạnh LG Dual Cool 2HP", "DM_ML", "LG", 14990000, 18490000, 11, "2HP", "5 sao", "Có", "Công nghệ Dual Cool làm lạnh 2 chiều.", 4.7, 82, 48, false, 0, 0),
        List.of("SP_ML_04", "Máy lạnh Samsung WindFree 1HP", "DM_ML", "Samsung", 9990000, 12490000, 13, "1HP", "5 sao", "Có", "Công nghệ WindFree không gió lạnh trực tiếp.", 4.8, 97, 58, false, 0, 0),
        List.of("SP_ML_05", "Máy lạnh Toshiba Inverter 1.5HP", "DM_ML", "Toshiba", 8490000, 10990000, 16, "1.5HP", "5 sao", "Không", "Bền bỉ, tiết kiệm điện vượt trội.", 4.6, 68, 41, false, 0, 0)));
  }

  private static void insertRows(Connection conn, String sql, List<List<Object>> rows) throws SQLException {
    try (PreparedStatement ps = conn.prepareStatement(sql)) {
      for (List<Object> row : rows) {
        for (int i = 0; i < row.size(); i++) {
          ps.setObject(i + 1, row.get(i));
        }
        ps.addBatch();
      }
      ps.executeBatch();
    }
  }

  private static int tableCount(String tableName) throws SQLException {
    try (Connection conn = getConnection();
        Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM " + tableName)) {
      rs.next();
      return rs.getInt(1);
    }
  }

  private static Connection getConnection() throws SQLException {
    return DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
  }

  private static void ensureDatabase() throws SQLException {
    String escapedName = DB_NAME.replace("]", "]]");
    try (Connection conn = DriverManager.getConnection(DB_ADMIN_URL, DB_USER, DB_PASSWORD);
        Statement stmt = conn.createStatement()) {
      stmt.execute("IF DB_ID(N'" + DB_NAME.replace("'", "''") + "') IS NULL CREATE DATABASE [" + escapedName + "]");
    }
  }

  private static void send(HttpExchange exchange, int status, String body, String contentType) throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", contentType);
    exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
    exchange.sendResponseHeaders(status, bytes.length);
    try (OutputStream os = exchange.getResponseBody()) {
      os.write(bytes);
    }
  }

  private static Map<String, String> parseFormData(String body) {
    Map<String, String> map = new HashMap<>();
    String[] pairs = body.split("&");
    for (String pair : pairs) {
      int idx = pair.indexOf("=");
      if (idx > 0) {
        String key = URLDecoder.decode(pair.substring(0, idx), StandardCharsets.UTF_8);
        String value = URLDecoder.decode(pair.substring(idx + 1), StandardCharsets.UTF_8);
        map.put(key, value);
      }
    }
    return map;
  }

  private static void handleOrders(HttpExchange exchange) throws IOException {
    String method = exchange.getRequestMethod().toUpperCase();

    // GET /api/orders — lấy danh sách đơn hàng
    if ("GET".equals(method)) {
      try {
        StringBuilder json = new StringBuilder("[");
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
               "SELECT orderId, orderDate, totalAmount, shippingAddress, status, paymentMethod, customerID " +
               "FROM DonHang ORDER BY orderDate DESC")) {
          int row = 0;
          while (rs.next()) {
            if (row++ > 0) json.append(',');
            json.append(rowToJson(rs));
          }
        }
        json.append(']');
        send(exchange, 200, json.toString(), "application/json; charset=utf-8");
      } catch (Exception ex) {
        ex.printStackTrace();
        send(exchange, 500, "{\"error\":\"" + escapeJson(ex.getMessage()) + "\"}", "application/json; charset=utf-8");
      }
      return;
    }

    // POST /api/orders/update-status — cập nhật trạng thái đơn
    if ("POST".equals(method)) {
      try {
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        Map<String, String> data = parseFormData(body);
        String orderId = data.get("orderId");
        String status  = data.get("status");

        if (orderId == null || status == null) {
          send(exchange, 400, "{\"error\":\"Missing orderId or status\"}", "application/json; charset=utf-8");
          return;
        }

        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(
               "UPDATE DonHang SET status = ? WHERE orderId = ?")) {
          ps.setString(1, status);
          ps.setString(2, orderId);
          int rows = ps.executeUpdate();
          send(exchange, 200, "{\"success\":true,\"updated\":" + rows + "}", "application/json; charset=utf-8");
        }
      } catch (Exception ex) {
        ex.printStackTrace();
        send(exchange, 500, "{\"error\":\"" + escapeJson(ex.getMessage()) + "\"}", "application/json; charset=utf-8");
      }
      return;
    }

    send(exchange, 405, "{\"error\":\"Method not allowed\"}", "application/json; charset=utf-8");
  }

  private static void handleCheckout(HttpExchange exchange) throws IOException {
    if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
      send(exchange, 405, "{\"error\":\"Method not allowed\"}", "application/json; charset=utf-8");
      return;
    }
    try {
      String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
      Map<String, String> data = parseFormData(body);

      String orderId = data.get("orderId");
      String orderDate = data.get("orderDate");
      int totalAmount = Integer.parseInt(data.get("totalAmount"));
      String shippingAddress = data.get("shippingAddress");
      String status = data.get("status");
      String paymentMethod = data.get("paymentMethod");
      int customerID = Integer.parseInt(data.get("customerID"));
      String staffId = data.get("staffId");
      
      int itemCount = Integer.parseInt(data.get("itemCount"));

      try (Connection conn = getConnection()) {
        conn.setAutoCommit(false);
        try {
          try (PreparedStatement ps = conn.prepareStatement("INSERT INTO DonHang (orderId, orderDate, totalAmount, shippingAddress, status, paymentMethod, customerID, staffId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
            ps.setString(1, orderId);
            ps.setString(2, orderDate);
            ps.setInt(3, totalAmount);
            ps.setString(4, shippingAddress);
            ps.setString(5, status);
            ps.setString(6, paymentMethod);
            ps.setInt(7, customerID);
            ps.setString(8, staffId);
            ps.executeUpdate();
          }

          try (PreparedStatement ps = conn.prepareStatement("INSERT INTO ChiTietDonHang (orderId, productID, quantity, unitPrice) VALUES (?, ?, ?, ?)")) {
            for (int i = 0; i < itemCount; i++) {
              ps.setString(1, orderId);
              ps.setString(2, data.get("item_" + i + "_id"));
              ps.setInt(3, Integer.parseInt(data.get("item_" + i + "_qty")));
              ps.setInt(4, Integer.parseInt(data.get("item_" + i + "_price")));
              ps.addBatch();
            }
            ps.executeBatch();
          }

          // Cập nhật điểm tích lũy và lịch sử điểm trong DB khi mua hàng
          int earnedPoints = totalAmount / 20000;
          if (earnedPoints > 0) {
            String dateOnly = "2026-06-26";
            if (orderDate != null && orderDate.contains("T")) {
              dateOnly = orderDate.split("T")[0];
            } else if (orderDate != null) {
              dateOnly = orderDate;
            }
            updateMemberPointsAndHistory(conn, customerID, earnedPoints, "add", orderId, "cộng", "Tích lũy đơn hàng " + orderId, dateOnly);
          }

          conn.commit();
          send(exchange, 200, "{\"success\":true}", "application/json; charset=utf-8");
        } catch (SQLException e) {
          conn.rollback();
          throw e;
        }
      }
    } catch (Exception ex) {
      ex.printStackTrace();
      send(exchange, 500, "{\"error\":\"" + escapeJson(ex.getMessage()) + "\"}", "application/json; charset=utf-8");
    }
  }

  private static void handleUpdatePoints(HttpExchange exchange) throws IOException {
    if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
      send(exchange, 405, "{\"error\":\"Method not allowed\"}", "application/json; charset=utf-8");
      return;
    }
    try {
      String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
      Map<String, String> data = parseFormData(body);

      int customerID = Integer.parseInt(data.getOrDefault("customerID", "1"));
      int pointsChange = Integer.parseInt(data.getOrDefault("pointsChange", "0"));
      String action = data.getOrDefault("action", "add");
      String orderId = data.getOrDefault("orderId", "VOUCHER");
      String type = data.getOrDefault("type", "trừ");
      String reason = data.getOrDefault("reason", "");
      String date = data.getOrDefault("date", new java.text.SimpleDateFormat("yyyy-MM-dd").format(new java.util.Date()));

      try (Connection conn = getConnection()) {
        conn.setAutoCommit(false);
        try {
          updateMemberPointsAndHistory(conn, customerID, pointsChange, action, orderId, type, reason, date);
          conn.commit();
          send(exchange, 200, "{\"success\":true}", "application/json; charset=utf-8");
        } catch (SQLException e) {
          conn.rollback();
          throw e;
        }
      }
    } catch (Exception ex) {
      ex.printStackTrace();
      send(exchange, 500, "{\"error\":\"" + escapeJson(ex.getMessage()) + "\"}", "application/json; charset=utf-8");
    }
  }

  private static void updateMemberPointsAndHistory(Connection conn, int customerID, int pointsChange, String action, String orderId, String type, String reason, String date) throws SQLException {
    int currentPoints = 0;
    String currentRank = "Đồng";
    double discountRate = 0.00;
    boolean hasMember = false;
    
    try (PreparedStatement ps = conn.prepareStatement("SELECT point, rank, discountRate FROM TheThanhVien WHERE customerID = ?")) {
      ps.setInt(1, customerID);
      try (ResultSet rs = ps.executeQuery()) {
        if (rs.next()) {
          currentPoints = rs.getInt("point");
          currentRank = rs.getString("rank");
          discountRate = rs.getDouble("discountRate");
          hasMember = true;
        }
      }
    }
    
    if (!hasMember) {
      return;
    }
    
    int newPoints = currentPoints;
    String newRank = currentRank;
    double newDiscountRate = discountRate;
    
    if ("cancel".equalsIgnoreCase(action)) {
      newPoints = 0;
      newRank = "Đồng";
      newDiscountRate = 0.00;
    } else {
      newPoints = currentPoints + pointsChange;
      if (newPoints < 0) newPoints = 0;
      
      if (pointsChange > 0) {
        int targetVal = 1;
        String targetRank = "Đồng";
        double targetRate = 0.00;
        
        if (newPoints >= 2000) {
          targetVal = 3;
          targetRank = "Vàng";
          targetRate = 0.10;
        } else if (newPoints >= 1000) {
          targetVal = 2;
          targetRank = "Bạc";
          targetRate = 0.05;
        }
        
        int currentVal = 1;
        if ("Vàng".equals(currentRank)) currentVal = 3;
        else if ("Bạc".equals(currentRank)) currentVal = 2;
        
        if (targetVal > currentVal) {
          newRank = targetRank;
          newDiscountRate = targetRate;
        }
      }
    }
    
    try (PreparedStatement ps = conn.prepareStatement("UPDATE TheThanhVien SET point = ?, rank = ?, discountRate = ? WHERE customerID = ?")) {
      ps.setInt(1, newPoints);
      ps.setString(2, newRank);
      ps.setDouble(3, newDiscountRate);
      ps.setInt(4, customerID);
      ps.executeUpdate();
    }
    
    try (PreparedStatement ps = conn.prepareStatement("INSERT INTO LichSuDiem (date, orderId, points, type, reason) VALUES (?, ?, ?, ?, ?)")) {
      ps.setString(1, date);
      ps.setString(2, orderId);
      ps.setInt(3, pointsChange);
      ps.setString(4, type);
      ps.setString(5, reason);
      ps.executeUpdate();
    }
  }

  private static String contentType(Path path) {
    String file = path.getFileName().toString().toLowerCase(Locale.ROOT);
    if (file.endsWith(".html"))
      return "text/html; charset=utf-8";
    if (file.endsWith(".css"))
      return "text/css; charset=utf-8";
    if (file.endsWith(".js"))
      return "application/javascript; charset=utf-8";
    if (file.endsWith(".png"))
      return "image/png";
    if (file.endsWith(".jpg") || file.endsWith(".jpeg"))
      return "image/jpeg";
    if (file.endsWith(".svg"))
      return "image/svg+xml";
    return "application/octet-stream";
  }

  private static String escapeJson(String value) {
    if (value == null)
      return "";
    return value.replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t");
  }

  private static String env(String key, String fallback) {
    String value = System.getenv(key);
    return value == null || value.isBlank() ? fallback : value;
  }

  @FunctionalInterface
  private interface JsonSupplier {
    String get() throws Exception;
  }
}
