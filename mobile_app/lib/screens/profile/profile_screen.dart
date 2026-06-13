import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../core/theme.dart';
import '../settings/settings_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final themeProvider = context.watch<ThemeProvider>();
    final user = authProvider.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
        leading: IconButton(
          icon: const Icon(LucideIcons.menu),
          onPressed: () {
            Scaffold.of(context).openDrawer();
          },
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            // Avatar card
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 50,
                    backgroundColor: AppColors.waGreen.withOpacity(0.15),
                    child: Text(
                      (user?.name.isNotEmpty == true ? user!.name.substring(0, 1) : 'A').toUpperCase(),
                      style: const TextStyle(fontSize: 36, color: AppColors.waGreen, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    user?.name ?? 'Agent Profile',
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    user?.email ?? 'agent@company.com',
                    style: const TextStyle(color: Colors.grey, fontSize: 14),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Profile info card list
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    _buildInfoRow(context, 'Role', user?.role.toUpperCase() ?? 'AGENT', LucideIcons.shield),
                    const Divider(height: 24),
                    _buildInfoRow(context, 'Employee ID', user?.employeeId ?? 'N/A', LucideIcons.contact),
                    const Divider(height: 24),
                    _buildInfoRow(context, 'Organization ID', user?.organizationId ?? 'N/A', LucideIcons.briefcase),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Quick Actions card list
            Card(
              child: ListView(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  SwitchListTile(
                    value: themeProvider.isDarkMode,
                    secondary: const Icon(LucideIcons.moon),
                    title: const Text('Dark Theme Mode'),
                    onChanged: (val) {
                      themeProvider.setDarkMode(val);
                    },
                  ),
                  ListTile(
                    leading: const Icon(LucideIcons.keyRound),
                    title: const Text('Change Password'),
                    trailing: const Icon(LucideIcons.chevronRight),
                    onTap: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()));
                    },
                  ),
                  ListTile(
                    leading: const Icon(LucideIcons.logOut, color: Colors.red),
                    title: const Text('Log Out', style: TextStyle(color: Colors.red)),
                    onTap: () {
                      authProvider.logout();
                    },
                  ),
                ],
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(BuildContext context, String label, String val, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: Colors.grey, size: 20),
        const SizedBox(width: 12),
        Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            val,
            textAlign: TextAlign.end,
            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.teal),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
