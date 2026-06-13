import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';

// Top-level background message handler
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint("Handling a background message: ${message.messageId}");
}

class PushNotificationService {
  static final PushNotificationService _instance = PushNotificationService._internal();
  factory PushNotificationService() => _instance;
  PushNotificationService._internal();

  final ApiClient _apiClient = ApiClient();
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;

    if (kIsWeb) {
      debugPrint('Push notifications are not supported on web target');
      return;
    }

    try {
      // 1. Initialize Firebase Core
      await Firebase.initializeApp();

      // 2. Set background message handler
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      // 3. Request permissions
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );

      debugPrint('User granted permission: ${settings.authorizationStatus}');

      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        // 4. Get FCM Token
        final token = await messaging.getToken();
        if (token != null) {
          await _uploadToken(token);
        }

        // 5. Listen for token refreshes
        messaging.onTokenRefresh.listen((newToken) {
          _uploadToken(newToken);
        });

        // 6. Handle foreground messages
        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          debugPrint('Got a message whilst in the foreground!');
          debugPrint('Message data: ${message.data}');

          if (message.notification != null) {
            debugPrint('Message also contained a notification: ${message.notification!.title}');
          }
        });

        // 7. Handle when app opened from notification state
        FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
          debugPrint('A new onMessageOpenedApp event was published!');
        });
      }

      _initialized = true;
    } catch (e) {
      debugPrint('Error initializing push notification service: $e');
    }
  }

  Future<void> _uploadToken(String token) async {
    try {
      final payload = {
        'token': token,
        'platform': 'android',
      };
      final response = await _apiClient.post('/telephony/device-tokens', payload);
      if (response.statusCode == 200) {
        debugPrint('FCM Device Token successfully registered on server');
      } else {
        debugPrint('Failed to register FCM Device Token on server: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('Network error uploading FCM Device Token: $e');
    }
  }
}
