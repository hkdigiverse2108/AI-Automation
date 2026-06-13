import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../providers/contact_provider.dart';
import '../../core/theme.dart';

class ContactsScreen extends StatefulWidget {
  const ContactsScreen({super.key});

  @override
  State<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends State<ContactsScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ContactProvider>().fetchContacts();
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ContactProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Contacts'),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.userPlus),
            onPressed: () => _showCreateContactDialog(context),
            tooltip: 'Add Contact',
          ),
          IconButton(
            icon: const Icon(LucideIcons.refreshCw),
            onPressed: () => provider.fetchContacts(search: _searchQuery),
          )
        ],
      ),
      body: Column(
        children: [
          // Search box
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              onChanged: (value) {
                setState(() {
                  _searchQuery = value;
                });
                provider.fetchContacts(search: value);
              },
              decoration: InputDecoration(
                hintText: 'Search contacts...',
                prefixIcon: const Icon(LucideIcons.search, size: 20),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
              ),
            ),
          ),

          // Contacts list
          Expanded(
            child: provider.isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.waGreen))
                : provider.contacts.isEmpty
                    ? const Center(child: Text('No contacts found', style: TextStyle(color: Colors.grey)))
                    : ListView.separated(
                        itemCount: provider.contacts.length,
                        separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
                        itemBuilder: (context, index) {
                          final contact = provider.contacts[index];
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: AppColors.waGreen.withOpacity(0.15),
                              child: Text(
                                (contact.name.isNotEmpty ? contact.name.substring(0, 1) : 'C').toUpperCase(),
                                style: const TextStyle(color: AppColors.waGreen, fontWeight: FontWeight.bold),
                              ),
                            ),
                            title: Text(contact.name.isNotEmpty ? contact.name : contact.phone, style: const TextStyle(fontWeight: FontWeight.bold)),
                            subtitle: Text(contact.phone),
                            trailing: contact.optedOut
                                ? const Chip(
                                    label: Text('Opted Out', style: TextStyle(color: Colors.red, fontSize: 10)),
                                    padding: EdgeInsets.zero,
                                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  )
                                : null,
                          );
                        },
                      ),
          )
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.waGreen,
        foregroundColor: Colors.white,
        onPressed: provider.isSyncing ? null : () => _handleSyncDevice(context),
        label: provider.isSyncing
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
              )
            : const Text('Sync Address Book'),
        icon: const Icon(LucideIcons.refreshCw),
      ),
    );
  }

  void _showCreateContactDialog(BuildContext context) {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Create New Contact'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Name'),
                  validator: (val) => val == null || val.isEmpty ? 'Name required' : null,
                ),
                TextFormField(
                  controller: phoneCtrl,
                  decoration: const InputDecoration(labelText: 'Phone (with country code)'),
                  keyboardType: TextInputType.phone,
                  validator: (val) => val == null || val.isEmpty ? 'Phone required' : null,
                ),
                TextFormField(
                  controller: emailCtrl,
                  decoration: const InputDecoration(labelText: 'Email'),
                  keyboardType: TextInputType.emailAddress,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (formKey.currentState!.validate()) {
                  final err = await context.read<ContactProvider>().createContact(
                        nameCtrl.text.trim(),
                        phoneCtrl.text.trim(),
                        emailCtrl.text.trim(),
                      );
                  if (context.mounted) {
                    if (err == null) {
                      Navigator.pop(context);
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err), backgroundColor: Colors.red));
                    }
                  }
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.waGreen, foregroundColor: Colors.white),
              child: const Text('Create'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _handleSyncDevice(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final provider = context.read<ContactProvider>();
    final granted = await provider.requestPermission();
    if (!granted) {
      if (mounted) {
        messenger.showSnackBar(const SnackBar(content: Text('Contacts permission denied')));
      }
      return;
    }

    final err = await provider.syncDeviceContacts();
    if (mounted) {
      if (err == null) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text('Phonebook synced successfully!'),
            backgroundColor: AppColors.waGreen,
            behavior: SnackBarBehavior.floating,
          ),
        );
      } else {
        messenger.showSnackBar(SnackBar(content: Text(err), backgroundColor: Colors.red));
      }
    }
  }
}
