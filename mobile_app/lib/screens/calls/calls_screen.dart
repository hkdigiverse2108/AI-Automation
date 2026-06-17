import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';
import '../../providers/call_log_provider.dart';
import '../../core/theme.dart';

class CallsScreen extends StatefulWidget {
  const CallsScreen({super.key});

  @override
  State<CallsScreen> createState() => _CallsScreenState();
}

class _CallsScreenState extends State<CallsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAndFetchLogs();
    });
  }

  Future<void> _checkAndFetchLogs() async {
    final provider = context.read<CallLogProvider>();
    final granted = await provider.requestPermission();
    if (granted) {
      await provider.fetchLocalCallLogs();
      // Automatically sync call logs to CRM in the background
      provider.syncCallLogsToServer();
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CallLogProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Call Logs'),
        leading: IconButton(
          icon: const Icon(LucideIcons.menu),
          onPressed: () {
            Scaffold.of(context).openDrawer();
          },
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.refreshCw),
            onPressed: () => provider.fetchLocalCallLogs(),
          )
        ],
      ),
      body: provider.localCallLogs.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(LucideIcons.phoneOff, size: 60, color: Colors.grey),
                  const SizedBox(height: 16),
                  const Text('No call logs available', style: TextStyle(color: Colors.grey)),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _checkAndFetchLogs,
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.waGreen, foregroundColor: Colors.white),
                    child: const Text('Request Permission & Reload'),
                  )
                ],
              ),
            )
          : ListView.separated(
              itemCount: provider.localCallLogs.length,
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
              itemBuilder: (context, index) {
                final log = provider.localCallLogs[index];
                IconData typeIcon = LucideIcons.phoneIncoming;
                Color typeColor = Colors.green;

                if (log.callType == 'outgoing') {
                  typeIcon = LucideIcons.phoneOutgoing;
                  typeColor = Colors.blue;
                } else if (log.callType == 'missed') {
                  typeIcon = LucideIcons.phoneMissed;
                  typeColor = Colors.red;
                } else if (log.callType == 'rejected') {
                  typeIcon = LucideIcons.phoneOff;
                  typeColor = Colors.grey;
                }

                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: typeColor.withOpacity(0.15),
                    child: Icon(typeIcon, color: typeColor, size: 20),
                  ),
                  title: Text(
                    log.name.isNotEmpty ? log.name : log.phone,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  subtitle: Text(
                    '${DateFormat('yMMMd').add_jm().format(log.timestamp)} • Duration: ${log.duration}s',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                    ),
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.waGreen,
        foregroundColor: Colors.white,
        onPressed: provider.isSyncing ? null : () => _handleSync(context),
        label: provider.isSyncing
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
              )
            : const Text('Sync to CRM'),
        icon: const Icon(LucideIcons.cloudLightning),
      ),
    );
  }

  Future<void> _handleSync(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final err = await context.read<CallLogProvider>().syncCallLogsToServer();
    if (mounted) {
      if (err == null) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text('Call logs synchronized with server successfully!'),
            backgroundColor: AppColors.waGreen,
            behavior: SnackBarBehavior.floating,
          ),
        );
      } else {
        messenger.showSnackBar(
          SnackBar(
            content: Text(err),
            backgroundColor: Colors.redAccent,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }
}
