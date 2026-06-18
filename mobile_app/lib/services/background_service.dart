import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_background_service_android/flutter_background_service_android.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:call_log/call_log.dart';
import 'package:permission_handler/permission_handler.dart';
import '../core/api_client.dart';

const String notificationChannelId = 'my_foreground';
const int notificationId = 888;

Future<void> initializeBackgroundService() async {
  final service = FlutterBackgroundService();

  const AndroidNotificationChannel channel = AndroidNotificationChannel(
    notificationChannelId,
    'HK CRM Sync Service',
    description: 'This channel is used for persistent call log synchronization.',
    importance: Importance.low,
  );

  final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
      FlutterLocalNotificationsPlugin();

  await flutterLocalNotificationsPlugin
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(channel);

  await service.configure(
    androidConfiguration: AndroidConfiguration(
      onStart: onStart,
      autoStart: true,
      isForegroundMode: true,
      notificationChannelId: notificationChannelId,
      initialNotificationTitle: 'HK CRM Sync',
      initialNotificationContent: 'Initializing background sync service...',
      foregroundServiceNotificationId: notificationId,
    ),
    iosConfiguration: IosConfiguration(
      autoStart: true,
      onForeground: onStart,
      onBackground: onIosBackground,
    ),
  );

  await service.startService();
}

@pragma('vm:entry-point')
Future<bool> onIosBackground(ServiceInstance service) async {
  return true;
}

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();

  if (service is AndroidServiceInstance) {
    service.on('setAsForeground').listen((event) {
      service.setAsForegroundService();
    });

    service.on('setAsBackground').listen((event) {
      service.setAsBackgroundService();
    });
  }

  service.on('stopService').listen((event) {
    service.stopSelf();
  });

  // Run periodic sync task (every 10 seconds)
  Timer.periodic(const Duration(seconds: 10), (timer) async {
    if (service is AndroidServiceInstance) {
      if (!(await service.isForegroundService())) {
        service.setAsForegroundService();
      }
    }
    await _performBackgroundSync(service);
  });
}

Future<void> _performBackgroundSync(ServiceInstance service) async {
  try {
    // Check permission
    final hasPermission = await Permission.phone.isGranted;
    if (!hasPermission) {
      _updateNotification(service, 'Sync Paused: Phone permission required');
      return;
    }

    // Fetch local logs
    final Iterable<CallLogEntry> entries = await CallLog.get();
    if (entries.isEmpty) {
      _updateNotification(service, 'Running: No call logs found on device');
      return;
    }

    final List<Map<String, dynamic>> logsJson = entries.map((entry) {
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

      return {
        'phone': entry.number ?? '',
        'name': entry.name ?? '',
        'duration': entry.duration ?? 0,
        'timestamp': DateTime.fromMillisecondsSinceEpoch(
                entry.timestamp ?? DateTime.now().millisecondsSinceEpoch)
            .toIso8601String(),
        'callType': callType,
      };
    }).where((log) => (log['phone'] as String).isNotEmpty).toList();

    if (logsJson.isEmpty) {
      _updateNotification(service, 'Running: No valid call logs to sync');
      return;
    }

    // Sync to CRM using ApiClient
    final ApiClient apiClient = ApiClient();
    final token = await apiClient.getAccessToken();
    if (token == null) {
      _updateNotification(service, 'Sync Paused: Log in to start syncing');
      return;
    }

    _updateNotification(service, 'Syncing ${logsJson.length} logs to server...');
    final resp = await apiClient.post('/telephony/call-logs', {
      'logs': logsJson,
    });

    if (resp.statusCode == 200) {
      final now = DateTime.now();
      final timeStr = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
      _updateNotification(service, 'Last synced at $timeStr (${logsJson.length} logs)');
      service.invoke('on_sync_completed', {
        'success': true,
        'count': logsJson.length,
        'time': now.toIso8601String(),
      });
    } else {
      _updateNotification(service, 'Sync failed: Server error (${resp.statusCode})');
    }
  } catch (err) {
    _updateNotification(service, 'Sync error: Offline or unreachable');
    debugPrint('Background sync error: $err');
  }
}

void _updateNotification(ServiceInstance service, String content) {
  if (service is AndroidServiceInstance) {
    service.setForegroundNotificationInfo(
      title: 'HK CRM Sync Active',
      content: content,
    );
  }
}
