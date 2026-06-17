import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  static const String keyAccessToken = 'accessToken';
  static const String keyRefreshToken = 'refreshToken';
  static const String keyUserEmail = 'userEmail';
  static const String keyBaseUrl = 'baseUrl';

  // Android emulator loopback host default, fallback to standard localhost
  static String get defaultBaseUrl {
    if (kIsWeb ||
        defaultTargetPlatform == TargetPlatform.windows ||
        defaultTargetPlatform == TargetPlatform.macOS ||
        defaultTargetPlatform == TargetPlatform.linux) {
      return 'http://localhost:5005/api';
    }
    return 'http://10.0.2.2:5005/api';
  }

  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  Future<String> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final savedUrl = prefs.getString(keyBaseUrl);
    if (savedUrl != null) {
      if ((kIsWeb ||
           defaultTargetPlatform == TargetPlatform.windows ||
           defaultTargetPlatform == TargetPlatform.macOS ||
           defaultTargetPlatform == TargetPlatform.linux) &&
          savedUrl.contains('10.0.2.2')) {
        return defaultBaseUrl;
      }
      if (defaultTargetPlatform == TargetPlatform.android &&
          (savedUrl.contains('localhost') || savedUrl.contains('127.0.0.1'))) {
        return defaultBaseUrl;
      }
      return savedUrl;
    }
    return defaultBaseUrl;
  }

  Future<void> setBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(keyBaseUrl, url);
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
