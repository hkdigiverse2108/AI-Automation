import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'core/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/chat_provider.dart';
import 'providers/call_log_provider.dart';
import 'providers/contact_provider.dart';
import 'providers/analytics_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/main_navigation.dart';
import 'socket/socket_manager.dart';
import 'services/push_notification_service.dart';
import 'services/background_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize persistent background sync service
  try {
    await initializeBackgroundService();
  } catch (e) {
    debugPrint('Failed to initialize background service: $e');
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ChatProvider()),
        ChangeNotifierProvider(create: (_) => CallLogProvider()),
        ChangeNotifierProvider(create: (_) => ContactProvider()),
        ChangeNotifierProvider(create: (_) => AnalyticsProvider()),
      ],
      child: const WhatsAppCRMApp(),
    ),
  );
}

class WhatsAppCRMApp extends StatefulWidget {
  const WhatsAppCRMApp({super.key});

  @override
  State<WhatsAppCRMApp> createState() => _WhatsAppCRMAppState();
}

class _WhatsAppCRMAppState extends State<WhatsAppCRMApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      context.read<AuthProvider>().checkAuth();
      // Request notification permission for foreground service notification
      await Permission.notification.request();
    });
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final authProvider = context.watch<AuthProvider>();

    return MaterialApp(
      title: 'WhatsApp CRM Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeProvider.isDarkMode ? ThemeMode.dark : ThemeMode.light,
      home: _getHomeRoute(authProvider),
    );
  }

  Widget _getHomeRoute(AuthProvider authProvider) {
    if (authProvider.isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: AppColors.waGreen),
        ),
      );
    }

    if (authProvider.isAuthenticated) {
      final currentUser = authProvider.currentUser;
      final chatProvider = context.read<ChatProvider>();
      if (currentUser != null) {
        SocketManager().connect(currentUser.id, chatProvider);
        PushNotificationService().initialize();
      }
      return const MainNavigation();
    }

    // Otherwise, disconnect socket and show login screen
    SocketManager().disconnect();
    return const LoginScreen();
  }
}
