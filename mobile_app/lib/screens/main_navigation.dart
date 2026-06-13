import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import 'dashboard/dashboard_screen.dart';
import 'inbox/inbox_screen.dart';
import 'calls/calls_screen.dart';
import 'analytics/analytics_screen.dart';
import 'profile/profile_screen.dart';
import 'contacts/contacts_screen.dart';
import 'settings/settings_screen.dart';

class MainNavigation extends StatefulWidget {
  const MainNavigation({super.key});

  @override
  State<MainNavigation> createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const DashboardScreen(),
    const InboxScreen(),
    const CallsScreen(),
    const AnalyticsScreen(),
    const ProfileScreen(),
  ];

  void _onTabTapped(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  void _openDrawerOption(VoidCallback action) {
    Navigator.pop(context); // Close drawer
    action();
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final themeProvider = context.watch<ThemeProvider>();
    final isDark = themeProvider.isDarkMode;

    final user = authProvider.currentUser;

    return Scaffold(
      drawer: Drawer(
        child: Column(
          children: [
            // Drawer Header
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(
                color: Colors.teal,
              ),
              currentAccountPicture: CircleAvatar(
                backgroundColor: Colors.white,
                child: Text(
                  user?.name.substring(0, 1).toUpperCase() ?? 'A',
                  style: const TextStyle(fontSize: 24.0, color: Colors.teal, fontWeight: FontWeight.bold),
                ),
              ),
              accountName: Text(user?.name ?? 'Agent'),
              accountEmail: Text(user?.email ?? 'agent@company.com'),
            ),

            // Drawer List Items
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  ListTile(
                    leading: const Icon(LucideIcons.inbox),
                    title: const Text('Assigned Chats'),
                    onTap: () => _openDrawerOption(() {
                      setState(() => _currentIndex = 1); // Select Inbox Tab
                    }),
                  ),
                  ListTile(
                    leading: const Icon(LucideIcons.helpCircle),
                    title: const Text('Unassigned Queue'),
                    onTap: () => _openDrawerOption(() {
                      setState(() => _currentIndex = 1);
                    }),
                  ),
                  ListTile(
                    leading: const Icon(LucideIcons.users),
                    title: const Text('Contacts'),
                    onTap: () => _openDrawerOption(() {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const ContactsScreen()));
                    }),
                  ),
                  ListTile(
                    leading: const Icon(LucideIcons.bot),
                    title: const Text('AI Assistant'),
                    onTap: () => _openDrawerOption(() {
                      // Navigate to AI Assistant screen
                      setState(() => _currentIndex = 0); // Open dashboard or details
                    }),
                  ),
                  const Divider(),
                  const Padding(
                    padding: EdgeInsets.all(16.0),
                    child: Text('Analytics', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                  ),
                  ListTile(
                    leading: const Icon(LucideIcons.barChart2),
                    title: const Text('Dashboard Analytics'),
                    onTap: () => _openDrawerOption(() {
                      setState(() => _currentIndex = 3);
                    }),
                  ),
                  ListTile(
                    leading: const Icon(LucideIcons.trendingUp),
                    title: const Text('Chat Analytics'),
                    onTap: () => _openDrawerOption(() {
                      setState(() => _currentIndex = 3);
                    }),
                  ),
                  const Divider(),
                  // Dark Mode switch tile
                  SwitchListTile(
                    value: isDark,
                    title: const Text('Dark Mode'),
                    secondary: const Icon(LucideIcons.moon),
                    onChanged: (value) {
                      themeProvider.toggleTheme();
                    },
                  ),
                  ListTile(
                    leading: const Icon(LucideIcons.settings),
                    title: const Text('Security Settings'),
                    onTap: () => _openDrawerOption(() {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()));
                    }),
                  ),
                  ListTile(
                    leading: const Icon(LucideIcons.logOut, color: Colors.red),
                    title: const Text('Logout', style: TextStyle(color: Colors.red)),
                    onTap: () => _openDrawerOption(() {
                      authProvider.logout();
                    }),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: _onTabTapped,
        type: BottomNavigationBarType.fixed,
        selectedItemColor: Colors.teal,
        unselectedItemColor: Colors.grey,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(LucideIcons.layoutDashboard),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(
            icon: Icon(LucideIcons.messageSquare),
            label: 'Inbox',
          ),
          BottomNavigationBarItem(
            icon: Icon(LucideIcons.phone),
            label: 'Calls',
          ),
          BottomNavigationBarItem(
            icon: Icon(LucideIcons.barChart),
            label: 'Analytics',
          ),
          BottomNavigationBarItem(
            icon: Icon(LucideIcons.user),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
