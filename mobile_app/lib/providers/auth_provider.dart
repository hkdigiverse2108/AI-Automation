import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/api_client.dart';
import '../models/user_model.dart';

class AuthProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();
  
  bool _isLoading = false;
  bool _isAuthenticated = false;
  UserModel? _currentUser;
  String? _savedEmail;

  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;
  UserModel? get currentUser => _currentUser;
  String? get savedEmail => _savedEmail;

  AuthProvider() {
    _loadSavedEmail();
  }

  Future<void> _loadSavedEmail() async {
    final prefs = await SharedPreferences.getInstance();
    _savedEmail = prefs.getString(ApiClient.keyUserEmail);
    notifyListeners();
  }

  Future<void> checkAuth() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = await _apiClient.getAccessToken();
      if (token != null) {
        final response = await _apiClient.get('/auth/me');
        if (response.statusCode == 200) {
          final payload = jsonDecode(response.body);
          if (payload['success'] == true) {
            _currentUser = UserModel.fromJson(payload['data']['user']);
            _isAuthenticated = true;
          } else {
            await _apiClient.clearSession();
          }
        } else {
          // Retry refreshing
          final refreshed = await _apiClient.refreshTokens();
          if (refreshed) {
            final retryResponse = await _apiClient.get('/auth/me');
            if (retryResponse.statusCode == 200) {
              final retryPayload = jsonDecode(retryResponse.body);
              _currentUser = UserModel.fromJson(retryPayload['data']['user']);
              _isAuthenticated = true;
            }
          }
        }
      }
    } catch (_) {
      // Offline or error
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<String?> login(String email, String password, bool rememberMe) async {
    _isLoading = true;
    notifyListeners();

    try {
      final baseUrl = await _apiClient.getBaseUrl();
      debugPrint('🔑 [AUTH] Attempting login to: $baseUrl/auth/login');
      debugPrint('🔑 [AUTH] Email: $email');
      
      final response = await _apiClient.post('/auth/login', {
        'email': email,
        'password': password,
      });

      debugPrint('🔑 [AUTH] Response status: ${response.statusCode}');
      debugPrint('🔑 [AUTH] Response body: ${response.body}');

      final payload = jsonDecode(response.body);
      if (response.statusCode == 200 && payload['success'] == true) {
        final data = payload['data'];
        await _apiClient.saveTokens(data['accessToken'], data['refreshToken']);
        
        final prefs = await SharedPreferences.getInstance();
        if (rememberMe) {
          await prefs.setString(ApiClient.keyUserEmail, email);
          _savedEmail = email;
        } else {
          await prefs.remove(ApiClient.keyUserEmail);
          _savedEmail = null;
        }

        _currentUser = UserModel.fromJson(data['user']);
        _isAuthenticated = true;
        _isLoading = false;
        notifyListeners();
        debugPrint('🔑 [AUTH] Login successful for: ${_currentUser?.name}');
        return null; // Success
      } else {
        _isLoading = false;
        notifyListeners();
        final errorMsg = payload['error'] ?? 'Login failed';
        debugPrint('🔑 [AUTH] Login failed: $errorMsg');
        return errorMsg;
      }
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      debugPrint('🔑 [AUTH] Login exception: $e');
      return 'Connection error: ${e.toString().length > 100 ? e.toString().substring(0, 100) : e}';
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      final refresh = await _apiClient.getRefreshToken();
      await _apiClient.post('/auth/logout', {
        'refreshToken': refresh,
      });
    } catch (_) {
      // ignore failures during logout endpoint call
    } finally {
      await _apiClient.clearSession();
      _currentUser = null;
      _isAuthenticated = false;
      _isLoading = false;
      notifyListeners();
    }
  }
}
