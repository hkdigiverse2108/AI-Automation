import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  static const String keyAccessToken = 'accessToken';
  static const String keyRefreshToken = 'refreshToken';
  static const String keyUserEmail = 'userEmail';
  static const String keyBaseUrl = 'baseUrl';

  // Live Production Backend API URL
  static String get defaultBaseUrl => 'https://api-automation.hkdigiverse.com/api';

  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  Future<String> getBaseUrl() async {
    return defaultBaseUrl;
  }

  Future<void> setBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    var sanitizedUrl = url.trim();
    if (sanitizedUrl.endsWith('/')) {
      sanitizedUrl = sanitizedUrl.substring(0, sanitizedUrl.length - 1);
    }
    if (!sanitizedUrl.endsWith('/api')) {
      sanitizedUrl = '$sanitizedUrl/api';
    }
    await prefs.setString(keyBaseUrl, sanitizedUrl);
  }

  Future<String?> getAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(keyAccessToken);
  }

  Future<String?> getRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(keyRefreshToken);
  }

  Future<void> saveTokens(String access, String refresh) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(keyAccessToken, access);
    await prefs.setString(keyRefreshToken, refresh);
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(keyAccessToken);
    await prefs.remove(keyRefreshToken);
  }

  Future<Map<String, String>> _getHeaders() async {
    final token = await getAccessToken();
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<http.Response> get(String path) async {
    final baseUrl = await getBaseUrl();
    final url = Uri.parse('$baseUrl$path');
    final headers = await _getHeaders();
    
    var response = await http.get(url, headers: headers).timeout(const Duration(seconds: 10));
    if (response.statusCode == 401 && _isTokenExpired(response)) {
      final success = await refreshTokens();
      if (success) {
        final retryHeaders = await _getHeaders();
        response = await http.get(url, headers: retryHeaders).timeout(const Duration(seconds: 10));
      }
    }
    return response;
  }

  Future<http.Response> post(String path, Map<String, dynamic> body) async {
    final baseUrl = await getBaseUrl();
    final url = Uri.parse('$baseUrl$path');
    final headers = await _getHeaders();
    
    var response = await http.post(url, headers: headers, body: jsonEncode(body)).timeout(const Duration(seconds: 10));
    if (response.statusCode == 401 && _isTokenExpired(response)) {
      final success = await refreshTokens();
      if (success) {
        final retryHeaders = await _getHeaders();
        response = await http.post(url, headers: retryHeaders, body: jsonEncode(body)).timeout(const Duration(seconds: 10));
      }
    }
    return response;
  }

  Future<http.Response> put(String path, Map<String, dynamic> body) async {
    final baseUrl = await getBaseUrl();
    final url = Uri.parse('$baseUrl$path');
    final headers = await _getHeaders();
    
    var response = await http.put(url, headers: headers, body: jsonEncode(body)).timeout(const Duration(seconds: 10));
    if (response.statusCode == 401 && _isTokenExpired(response)) {
      final success = await refreshTokens();
      if (success) {
        final retryHeaders = await _getHeaders();
        response = await http.put(url, headers: retryHeaders, body: jsonEncode(body)).timeout(const Duration(seconds: 10));
      }
    }
    return response;
  }

  Future<http.Response> delete(String path) async {
    final baseUrl = await getBaseUrl();
    final url = Uri.parse('$baseUrl$path');
    final headers = await _getHeaders();
    
    var response = await http.delete(url, headers: headers).timeout(const Duration(seconds: 10));
    if (response.statusCode == 401 && _isTokenExpired(response)) {
      final success = await refreshTokens();
      if (success) {
        final retryHeaders = await _getHeaders();
        response = await http.delete(url, headers: retryHeaders).timeout(const Duration(seconds: 10));
      }
    }
    return response;
  }

  bool _isTokenExpired(http.Response response) {
    try {
      final data = jsonDecode(response.body);
      return data['code'] == 'TOKEN_EXPIRED';
    } catch (_) {
      return false;
    }
  }

  Future<http.Response> uploadFile(String path, List<int> bytes, String filename) async {
    final baseUrl = await getBaseUrl();
    final url = Uri.parse('$baseUrl$path');
    final token = await getAccessToken();

    final request = http.MultipartRequest('POST', url);
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    final multipartFile = http.MultipartFile.fromBytes(
      'file',
      bytes,
      filename: filename,
    );
    request.files.add(multipartFile);

    final streamedResponse = await request.send().timeout(const Duration(seconds: 30));
    return http.Response.fromStream(streamedResponse);
  }

  Future<bool> refreshTokens() async {
    try {
      final refreshVal = await getRefreshToken();
      if (refreshVal == null) return false;

      final baseUrl = await getBaseUrl();
      final url = Uri.parse('$baseUrl/auth/refresh');
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refreshVal}),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final payload = jsonDecode(response.body);
        if (payload['success'] == true) {
          final data = payload['data'];
          await saveTokens(data['accessToken'], data['refreshToken']);
          return true;
        }
      }
      // Refresh failed or revoked, log user out
      await clearSession();
      return false;
    } catch (_) {
      return false;
    }
  }
}
