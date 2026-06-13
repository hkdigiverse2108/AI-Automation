import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:contacts_service/contacts_service.dart';
import '../core/api_client.dart';
import '../models/contact_model.dart';

class ContactProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  List<ContactModel> _contacts = [];
  bool _isLoading = false;
  bool _isSyncing = false;
  int _total = 0;

  List<ContactModel> get contacts => _contacts;
  bool get isLoading => _isLoading;
  bool get isSyncing => _isSyncing;
  int get total => _total;

  Future<void> fetchContacts({String search = '', int page = 1}) async {
    _isLoading = true;
    notifyListeners();

    try {
      final query = search.isNotEmpty ? '?search=$search&page=$page&limit=30' : '?page=$page&limit=30';
      final resp = await _apiClient.get('/contacts$query');
      if (resp.statusCode == 200) {
        final payload = jsonDecode(resp.body);
        if (payload['success'] == true) {
          final List list = payload['data']['contacts'] ?? [];
          _contacts = list.map((item) => ContactModel.fromJson(item)).toList();
          _total = payload['data']['total'] ?? _contacts.length;
        }
      }
    } catch (_) {
      // ignore network errors
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<String?> createContact(String name, String phone, String email) async {
    try {
      final resp = await _apiClient.post('/contacts', {
        'name': name,
        'phone': phone,
        'email': email,
      });

      final payload = jsonDecode(resp.body);
      if (resp.statusCode == 201 && payload['success'] == true) {
        await fetchContacts();
        return null; // Success
      } else {
        return payload['error'] ?? 'Failed to create contact';
      }
    } catch (e) {
      return 'Network error occurred';
    }
  }

  Future<bool> requestPermission() async {
    if (kIsWeb) return false;
    final status = await Permission.contacts.request();
    return status.isGranted;
  }

  Future<String?> syncDeviceContacts() async {
    if (kIsWeb) {
      return 'Contacts sync is only supported on mobile devices';
    }
    _isSyncing = true;
    notifyListeners();

    try {
      final hasPermission = await Permission.contacts.isGranted;
      if (!hasPermission) {
        _isSyncing = false;
        notifyListeners();
        return 'Contact permission is required';
      }

      final Iterable<Contact> deviceContacts = await ContactsService.getContacts(withThumbnails: false);
      final list = deviceContacts.map((c) {
        final phone = c.phones?.isNotEmpty == true ? c.phones!.first.value : '';
        final email = c.emails?.isNotEmpty == true ? c.emails!.first.value : '';
        return {
          'name': c.displayName ?? '',
          'phone': phone,
          'email': email,
        };
      }).filter((item) => item['phone']!.isNotEmpty).toList();

      if (list.isEmpty) {
        _isSyncing = false;
        notifyListeners();
        return 'No contacts found on device';
      }

      final resp = await _apiClient.post('/telephony/device-contacts', {
        'contacts': list,
      });

      _isSyncing = false;
      notifyListeners();

      if (resp.statusCode == 200) {
        return null; // Success
      } else {
        return 'Synchronization failed: status ${resp.statusCode}';
      }
    } catch (e) {
      _isSyncing = false;
      notifyListeners();
      return 'Network error: Sync failed';
    }
  }
}

extension FilteringExtension<E> on Iterable<E> {
  Iterable<E> filter(bool Function(E element) test) {
    return where(test);
  }
}
