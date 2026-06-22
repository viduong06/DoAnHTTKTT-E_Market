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
  private static final Path WEB_ROOT = Path.of(env("WEB_ROOT", "../webpttkhttt")).toAbsolutePath().normalize();

  public static void main(String[] args) throws Exception {
    Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
    ensureDatabase();
    migrateAndSeed();

    int port = Integer.parseInt(env("PORT", "8080"));
    HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
    server.createContext("/api/bootstrap", exchange -> handleJson(exchange, App::bootstrapJson));
    server.createContext("/api/products", exchange -> handleJson(exchange, () -> tableJson("SanPham")));
    server.createContext("/api/categories", exchange -> handleJson(exchange, () -> tableJson("DanhMuc")));
    server.createContext("/api/checkout", App::handleCheckout);
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
    String relative = rawPath.equals("/") ? "index.html" : rawPath.substring(1);
    Path target = WEB_ROOT.resolve(relative).normalize();

    if (!target.startsWith(WEB_ROOT) || Files.isDirectory(target) || !Files.exists(target)) {
      send(exchange, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }

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
    insertRows(conn, sql, List.of(List.of("TV-0001", 1, 420, "Bạc", 0.00)));
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
        List.of("SP_MG_01", "Máy giặt Samsung Inverter 10kg", "DM_MG", "Samsung", 8490000, 10990000, 25, "10kg",
            "5 sao", "Có", "Máy giặt inverter tiết kiệm điện, vận hành êm.", 4.8, 128, 86, true, 35, 80),
        List.of("SP_MG_02", "Máy giặt LG AI DD 9kg", "DM_MG", "LG", 7690000, 9490000, 18, "9kg", "5 sao", "Có",
            "Công nghệ AI DD bảo vệ sợi vải.", 4.7, 96, 64, false, 0, 0),
        List.of("SP_TL_01", "Tủ lạnh Panasonic Inverter 326L", "DM_TL", "Panasonic", 9990000, 12490000, 16, "326L",
            "5 sao", "Không", "Ngăn đông mềm và làm lạnh nhanh.", 4.9, 142, 73, true, 42, 90),
        List.of("SP_TL_02", "Tủ lạnh Samsung Bespoke 352L", "DM_TL", "Samsung", 12990000, 15990000, 12, "352L", "5 sao",
            "Có", "Thiết kế hiện đại, quản lý thông minh.", 4.8, 88, 51, false, 0, 0),
        List.of("SP_TV_01", "Smart TV Sony 4K 55 inch", "DM_TV", "Sony", 13990000, 17990000, 20, "55 inch", "4 sao",
            "Có", "Hình ảnh 4K sắc nét, âm thanh sống động.", 4.9, 210, 120, true, 58, 100),
        List.of("SP_TV_02", "Smart TV LG OLED 48 inch", "DM_TV", "LG", 18990000, 22990000, 10, "48 inch", "4 sao", "Có",
            "Màn hình OLED, màu đen sâu.", 4.8, 76, 38, false, 0, 0),
        List.of("SP_ML_01", "Máy lạnh Daikin Inverter 1.5HP", "DM_ML", "Daikin", 10990000, 13490000, 14, "1.5HP",
            "5 sao", "Không", "Làm lạnh nhanh, tiết kiệm điện.", 4.7, 115, 69, false, 0, 0),
        List.of("SP_ML_02", "Máy lạnh Panasonic Nanoe X 1HP", "DM_ML", "Panasonic", 9490000, 11990000, 15, "1HP",
            "5 sao", "Có", "Lọc khí Nanoe X, vận hành bền bỉ.", 4.8, 101, 57, false, 0, 0)));
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
