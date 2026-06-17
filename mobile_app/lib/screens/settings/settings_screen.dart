import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Push Notification Switches Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(LucideIcons.bellRing, color: Colors.indigo),
                        SizedBox(width: 8),
                        Text(
                          'Notifications Settings',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile(
                      value: true,
                      title: const Text('New Assigned Chats'),
                      subtitle: const Text('Alert when a chat is assigned to you'),
                      onChanged: (val) {},
                    ),
                    SwitchListTile(
                      value: true,
                      title: const Text('Incoming Customer Messages'),
                      subtitle: const Text('Notify for customer replies'),
                      onChanged: (val) {},
                    ),
                  ],
                ),
              ),
            )
          ],
        ),
      ),
    );
  }
}
