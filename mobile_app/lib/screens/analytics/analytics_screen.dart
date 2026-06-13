import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../providers/analytics_provider.dart';
import '../../core/theme.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AnalyticsProvider>().fetchDashboardMetrics();
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AnalyticsProvider>();
    final overview = provider.overviewData;
    final monitoring = provider.monitoringStats;
    final List performance = monitoring['performance'] ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('CRM Analytics'),
        leading: IconButton(
          icon: const Icon(LucideIcons.menu),
          onPressed: () {
            Scaffold.of(context).openDrawer();
          },
        ),
      ),
      body: provider.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.waGreen))
          : RefreshIndicator(
              onRefresh: () => provider.fetchDashboardMetrics(),
              color: AppColors.waGreen,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top Analytics cards
                    _buildMetricRow(context, 'Delivery Quality', [
                      _buildMetricBox(context, 'Delivery Rate', '${overview['deliveryRate'] ?? 0}%', LucideIcons.checkCheck, Colors.teal),
                      _buildMetricBox(context, 'Read Rate', '${overview['readRate'] ?? 0}%', LucideIcons.eye, Colors.blue),
                    ]),
                    const SizedBox(height: 16),
                    _buildMetricRow(context, 'Customer Actions', [
                      _buildMetricBox(context, 'Reply Rate', '${overview['replyRate'] ?? 0}%', LucideIcons.reply, Colors.amber),
                      _buildMetricBox(context, 'Contacts Growth', '+${overview['newContacts30d'] ?? 0}', LucideIcons.userPlus, Colors.indigo),
                    ]),
                    const SizedBox(height: 24),

                    // Agent Performance List
                    Text(
                      'Agent Performance',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 12),
                    performance.isEmpty
                        ? const Center(child: Text('No active agents registered', style: TextStyle(color: Colors.grey)))
                        : Card(
                            child: ListView.separated(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: performance.length,
                              separatorBuilder: (_, __) => const Divider(height: 1),
                              itemBuilder: (context, index) {
                                final agent = performance[index];
                                return ListTile(
                                  leading: CircleAvatar(
                                    backgroundColor: AppColors.waGreen.withOpacity(0.15),
                                    child: const Icon(LucideIcons.user, color: AppColors.waGreen, size: 20),
                                  ),
                                  title: Text(agent['name'] ?? 'Agent', style: const TextStyle(fontWeight: FontWeight.bold)),
                                  subtitle: Text(agent['email'] ?? ''),
                                  trailing: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        'Active: ${agent['activeChats'] ?? 0}',
                                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                                      ),
                                      Text(
                                        'Resolved: ${agent['resolvedChats'] ?? 0}',
                                        style: const TextStyle(color: Colors.grey, fontSize: 11),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          )
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildMetricRow(BuildContext context, String header, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(header, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.grey)),
        const SizedBox(height: 8),
        Row(
          children: children.map((child) => Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: child))).toList(),
        )
      ],
    );
  }

  Widget _buildMetricBox(BuildContext context, String label, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
