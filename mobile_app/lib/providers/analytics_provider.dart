import 'dart:convert';
import 'package:flutter/material.dart';
import '../core/api_client.dart';

class AnalyticsProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  Map<String, dynamic> _overviewData = {};
  Map<String, dynamic> _monitoringStats = {};
  bool _isLoading = false;

  Map<String, dynamic> get overviewData => _overviewData;
  Map<String, dynamic> get monitoringStats => _monitoringStats;
  bool get isLoading => _isLoading;

  Future<void> fetchDashboardMetrics() async {
    _isLoading = true;
    notifyListeners();

    try {
      // 1. Fetch overview analytics
      final overviewResp = await _apiClient.get('/analytics/overview');
      if (overviewResp.statusCode == 200) {
        final payload = jsonDecode(overviewResp.body);
        if (payload['success'] == true) {
          _overviewData = payload['data'] ?? {};
        }
      }

      // 2. Fetch monitoring stats (agents performance)
      final monitoringResp = await _apiClient.get('/team/monitoring-stats');
      if (monitoringResp.statusCode == 200) {
        final payload = jsonDecode(monitoringResp.body);
        if (payload['success'] == true) {
          _monitoringStats = payload['data'] ?? {};
        }
      }
    } catch (_) {
      // ignore network errors
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
