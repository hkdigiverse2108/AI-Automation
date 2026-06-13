import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _serverUrlController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _loadCurrentServerUrl();
  }

  Future<void> _loadCurrentServerUrl() async {
    final url = await ApiClient().getBaseUrl();
    _serverUrlController.text = url;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Server configuration Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(LucideIcons.globe, color: AppColors.waGreen),
                          SizedBox(width: 8),
                          Text(
                            'API Connection Host',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Change this URL to point to your development environment (e.g. 10.0.2.2:5000 for Android emulator) or a production domain.',
                        style: TextStyle(color: Colors.grey, fontSize: 12),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _serverUrlController,
                        decoration: InputDecoration(
                          labelText: 'Backend base API URL',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          prefixIcon: const Icon(LucideIcons.link, size: 20),
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Base URL cannot be empty';
                          }
                          if (!value.startsWith('http://') && !value.startsWith('https://')) {
                            return 'URL must start with http:// or https://';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: _saveBaseUrl,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.waGreen,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Save Host Address'),
                      )
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

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
      ),
    );
  }

  Future<void> _saveBaseUrl() async {
    if (_formKey.currentState!.validate()) {
      FocusScope.of(context).unfocus();
      final url = _serverUrlController.text.trim();
      await ApiClient().setBaseUrl(url);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Host settings updated successfully!'),
            backgroundColor: AppColors.waGreen,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }
}
