import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:call_log/call_log.dart';
import '../core/api_client.dart';
import '../models/call_log_model.dart';

class CallLogProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();
  
  List<CallLogModel> _localCallLogs = [];
  bool _isSyncing = false;

  List<CallLogModel> get localCallLogs => _localCallLogs;
  bool get isSyncing => _isSyncing;

  CallLogProvider() {
    // Background service handles periodic sync automatically
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<bool> requestPermission() async {
    if (kIsWeb) return false;
    final status = await Permission.phone.request();
    return status.isGranted;
  }

  Future<void> fetchLocalCallLogs() async {
    if (kIsWeb) return;
    final hasPermission = await Permission.phone.isGranted;
    if (!hasPermission) return;

    try {
      final Iterable<CallLogEntry> entries = await CallLog.get();
      _localCallLogs = entries.map((entry) {
        String callType = 'unknown';
        switch (entry.callType) {
          case CallType.incoming:
            callType = 'incoming';
            break;
          case CallType.outgoing:
            callType = 'outgoing';
            break;
          case CallType.missed:
            callType = 'missed';
            break;
          case CallType.rejected:
            callType = 'rejected';
            break;
          default:
            callType = 'unknown';
        }

        return CallLogModel(
          phone: entry.number ?? '',
          name: entry.name ?? '',
          duration: entry.duration ?? 0,
          timestamp: DateTime.fromMillisecondsSinceEpoch(entry.timestamp ?? DateTime.now().millisecondsSinceEpoch),
          callType: callType,
        );
      }).toList();
      notifyListeners();
    } catch (err) {
      debugPrint('Failed to read local call logs: $err');
    }
  }

  Future<String?> syncCallLogsToServer() async {
    if (kIsWeb) {
      return 'Call logs sync is only supported on mobile devices';
    }
    _isSyncing = true;
    notifyListeners();

    try {
      await fetchLocalCallLogs();
      if (_localCallLogs.isEmpty) {
        _isSyncing = false;
        notifyListeners();
        return 'No call logs found on device';
      }

      final payload = {
        'logs': _localCallLogs.map((log) => log.toJson()).toList(),
      };

      final resp = await _apiClient.post('/telephony/call-logs', payload);
      _isSyncing = false;
      notifyListeners();

      if (resp.statusCode == 200) {
        return null; // Success
      } else {
        return 'Failed to sync call logs: status ${resp.statusCode}';
      }
    } catch (err) {
      _isSyncing = false;
      notifyListeners();
      return 'Network error: Call log sync failed';
    }
  }
}
