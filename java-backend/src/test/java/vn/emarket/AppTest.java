package vn.emarket;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.nio.file.Path;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.util.Map;

public class AppTest {
  public static void main(String[] args) throws Exception {
    int failures = 0;
    failures += run("testParseFormData", AppTest::testParseFormData);
    failures += run("testEscapeJson", AppTest::testEscapeJson);
    failures += run("testContentType", AppTest::testContentType);
    failures += run("testRowToJson", AppTest::testRowToJson);
    failures += run("testCalculateRemainingStock", AppTest::testCalculateRemainingStock);
    failures += run("testValidateNameAndPhone", AppTest::testValidateNameAndPhone);

    System.out.println();
    if (failures == 0) {
      System.out.println("ALL TESTS PASSED");
      System.exit(0);
    }

    System.out.println(failures + " TEST(S) FAILED");
    System.exit(1);
  }

  private static int run(String name, TestAction action) {
    try {
      action.run();
      System.out.println("[PASS] " + name);
      return 0;
    } catch (Throwable ex) {
      System.out.println("[FAIL] " + name + " - " + ex.getMessage());
      ex.printStackTrace(System.out);
      return 1;
    }
  }

  private static void testParseFormData() throws Exception {
    Method parseFormData = App.class.getDeclaredMethod("parseFormData", String.class);
    parseFormData.setAccessible(true);

    @SuppressWarnings("unchecked")
    Map<String, String> result = (Map<String, String>) parseFormData.invoke(null,
        "orderId=DH-1001&status=Shipped&note=Hello+world%21");

    assertEquals("DH-1001", result.get("orderId"));
    assertEquals("Shipped", result.get("status"));
    assertEquals("Hello world!", result.get("note"));
  }

  private static void testEscapeJson() throws Exception {
    Method escapeJson = App.class.getDeclaredMethod("escapeJson", String.class);
    escapeJson.setAccessible(true);

    String value = "He said \"OK\"\\\n\t";
    String encoded = (String) escapeJson.invoke(null, value);
    assertEquals("He said \\\"OK\\\"\\\\\\n\\t", encoded);
  }

  private static void testContentType() throws Exception {
    Method contentType = App.class.getDeclaredMethod("contentType", Path.class);
    contentType.setAccessible(true);

    assertEquals("text/html; charset=utf-8",
        (String) contentType.invoke(null, Path.of("index.html")));
    assertEquals("text/css; charset=utf-8",
        (String) contentType.invoke(null, Path.of("style.css")));
    assertEquals("application/javascript; charset=utf-8",
        (String) contentType.invoke(null, Path.of("script.js")));
    assertEquals("application/octet-stream",
        (String) contentType.invoke(null, Path.of("file.bin")));
  }

  private static void testRowToJson() throws Exception {
    Method rowToJson = App.class.getDeclaredMethod("rowToJson", ResultSet.class);
    rowToJson.setAccessible(true);

    ResultSet rs = createMockResultSet(new String[] { "id", "name", "price", "active" },
        new Object[] { 123, "Máy giặt", 8490000, true });

    String json = (String) rowToJson.invoke(null, rs);
    assertEquals("{\"id\":123,\"name\":\"Máy giặt\",\"price\":8490000,\"active\":true}", json);
  }

  private static void testCalculateRemainingStock() throws Exception {
    Method calculateRemainingStock = App.class.getDeclaredMethod("calculateRemainingStock", int.class, int.class);
    calculateRemainingStock.setAccessible(true);

    assertEquals(9, (int) calculateRemainingStock.invoke(null, 10, 1));
    assertEquals(0, (int) calculateRemainingStock.invoke(null, 2, 3));
  }

  private static void testValidateNameAndPhone() throws Exception {
    Method isValidName = App.class.getDeclaredMethod("isValidName", String.class);
    Method isValidPhone = App.class.getDeclaredMethod("isValidPhone", String.class);
    isValidName.setAccessible(true);
    isValidPhone.setAccessible(true);

    assertEquals(true, (boolean) isValidName.invoke(null, "Nguyễn Văn A"));
    assertEquals(false, (boolean) isValidName.invoke(null, "A"));
    assertEquals(true, (boolean) isValidPhone.invoke(null, "0901234567"));
    assertEquals(false, (boolean) isValidPhone.invoke(null, "123"));
  }

  private static ResultSet createMockResultSet(String[] columns, Object[] values) {
    ResultSetMetaData metaData = (ResultSetMetaData) Proxy.newProxyInstance(
        ResultSetMetaData.class.getClassLoader(),
        new Class<?>[] { ResultSetMetaData.class },
        new ResultSetMetaDataHandler(columns));

    return (ResultSet) Proxy.newProxyInstance(ResultSet.class.getClassLoader(),
        new Class<?>[] { ResultSet.class },
        new ResultSetHandler(metaData, values));
  }

  private static class ResultSetMetaDataHandler implements InvocationHandler {
    private final String[] columns;

    ResultSetMetaDataHandler(String[] columns) {
      this.columns = columns;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
      String methodName = method.getName();
      if (methodName.equals("getColumnCount")) {
        return columns.length;
      }
      if (methodName.equals("getColumnLabel") || methodName.equals("getColumnName")) {
        int index = (Integer) args[0] - 1;
        return columns[index];
      }
      if (methodName.equals("isWrapperFor")) {
        return false;
      }
      if (methodName.equals("unwrap")) {
        return proxy;
      }
      if (method.getDeclaringClass() == Object.class) {
        if (methodName.equals("toString")) {
          return "MockResultSetMetaData";
        }
        if (methodName.equals("hashCode")) {
          return System.identityHashCode(proxy);
        }
        if (methodName.equals("equals")) {
          return proxy == args[0];
        }
      }
      throw new UnsupportedOperationException("Unsupported method: " + methodName);
    }
  }

  private static class ResultSetHandler implements InvocationHandler {
    private final ResultSetMetaData metaData;
    private final Object[] values;

    ResultSetHandler(ResultSetMetaData metaData, Object[] values) {
      this.metaData = metaData;
      this.values = values;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
      String methodName = method.getName();
      if (methodName.equals("getMetaData")) {
        return metaData;
      }
      if (methodName.equals("getObject")) {
        int index = (Integer) args[0] - 1;
        return values[index];
      }
      if (methodName.equals("isWrapperFor")) {
        return false;
      }
      if (methodName.equals("unwrap")) {
        return proxy;
      }
      if (method.getDeclaringClass() == Object.class) {
        if (methodName.equals("toString")) {
          return "MockResultSet";
        }
        if (methodName.equals("hashCode")) {
          return System.identityHashCode(proxy);
        }
        if (methodName.equals("equals")) {
          return proxy == args[0];
        }
      }
      throw new UnsupportedOperationException("Unsupported method: " + methodName);
    }
  }

  private static void assertEquals(String expected, String actual) {
    if (expected == null ? actual != null : !expected.equals(actual)) {
      throw new AssertionError("Expected=[" + expected + "] Actual=[" + actual + "]");
    }
  }

  private static void assertEquals(int expected, int actual) {
    if (expected != actual) {
      throw new AssertionError("Expected=[" + expected + "] Actual=[" + actual + "]");
    }
  }

  private static void assertEquals(boolean expected, boolean actual) {
    if (expected != actual) {
      throw new AssertionError("Expected=[" + expected + "] Actual=[" + actual + "]");
    }
  }

  private interface TestAction {
    void run() throws Exception;
  }
}
