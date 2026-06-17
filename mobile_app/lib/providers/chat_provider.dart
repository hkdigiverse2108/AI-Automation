import 'dart:convert';
import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../models/conversation_model.dart';
import '../models/message_model.dart';

class ChatProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  List<ConversationModel> _myConversations = [];
  List<ConversationModel> _unassignedConversations = [];
  List<MessageModel> _activeMessages = [];
  ConversationModel? _activeConversation;

  bool _isLoadingConvs = false;
  bool _isLoadingMsgs = false;
  bool _isSending = false;

  List<ConversationModel> get myConversations => _myConversations;
  List<ConversationModel> get unassignedConversations => _unassignedConversations;
  List<MessageModel> get activeMessages => _activeMessages;
  ConversationModel? get activeConversation => _activeConversation;

  bool get isLoadingConvs => _isLoadingConvs;
  bool get isLoadingMsgs => _isLoadingMsgs;
  bool get isSending => _isSending;

  Future<void> fetchConversations(String currentUserId) async {
    _isLoadingConvs = true;
    notifyListeners();

    try {
      // 1. Fetch My Assigned Conversations
      final myResp = await _apiClient.get('/messages/conversations?assignedAgent=$currentUserId');
      if (myResp.statusCode == 200) {
        final payload = jsonDecode(myResp.body);
        if (payload['success'] == true) {
          final List list = payload['data']['conversations'] ?? [];
          _myConversations = list.map((item) => ConversationModel.fromJson(item)).toList();
        }
      }

      // 2. Fetch Unassigned Conversations Queue
      final unassignedResp = await _apiClient.get('/messages/conversations?assignedAgent=unassigned');
      if (unassignedResp.statusCode == 200) {
        final payload = jsonDecode(unassignedResp.body);
        if (payload['success'] == true) {
          final List list = payload['data']['conversations'] ?? [];
          _unassignedConversations = list.map((item) => ConversationModel.fromJson(item)).toList();
        }
      }
    } catch (_) {
      // Handle network errors
    } finally {
      _isLoadingConvs = false;
      notifyListeners();
    }
  }

  Future<void> fetchMessages(String conversationId) async {
    _isLoadingMsgs = true;
    notifyListeners();

    try {
      final resp = await _apiClient.get('/messages/conversations/$conversationId');
      if (resp.statusCode == 200) {
        final payload = jsonDecode(resp.body);
        if (payload['success'] == true) {
          _activeConversation = ConversationModel.fromJson(payload['data']['conversation']);
          final List list = payload['data']['messages'] ?? [];
          _activeMessages = list.map((item) => MessageModel.fromJson(item)).toList();
        }
      }
    } catch (_) {
      // Handle error
    } finally {
      _isLoadingMsgs = false;
      notifyListeners();
    }
  }

  Future<bool> sendMessage(String text, {String type = 'text', String? mediaUrl}) async {
    if (_activeConversation == null) return false;
    _isSending = true;
    notifyListeners();

    try {
      final contactId = _activeConversation!.contact?.id ?? '';
      final payload = {
        'contactId': contactId,
        'text': text,
        'type': type,
      };
      if (mediaUrl != null) {
        payload['mediaUrl'] = mediaUrl;
      }

      final resp = await _apiClient.post('/messages/send', payload);
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        if (data['success'] == true) {
          final newMsg = MessageModel.fromJson(data['data']['message']);
          final exists = _activeMessages.any((m) => m.id == newMsg.id);
          if (!exists) {
            _activeMessages.add(newMsg);
          }
          _isSending = false;
          notifyListeners();
          return true;
        }
      }
    } catch (_) {
      // Handle error
    }
    _isSending = false;
    notifyListeners();
    return false;
  }

  Future<bool> sendFileMessage(List<int> bytes, String filename, String mimeType) async {
    if (_activeConversation == null) return false;
    _isSending = true;
    notifyListeners();

    try {
      final uploadResp = await _apiClient.uploadFile('/messages/upload', bytes, filename);
      if (uploadResp.statusCode == 200) {
        final uploadData = jsonDecode(uploadResp.body);
        if (uploadData['success'] == true) {
          final fileUrl = uploadData['data']['url'];
          
          String type = 'document';
          if (mimeType.startsWith('image/')) {
            type = 'image';
          } else if (mimeType.startsWith('video/')) {
            type = 'video';
          } else if (mimeType.startsWith('audio/')) {
            type = 'audio';
          }

          final contactId = _activeConversation!.contact?.id ?? '';
          final payload = {
            'contactId': contactId,
            'text': filename,
            'type': type,
            'mediaUrl': fileUrl,
            'filename': filename,
          };

          final resp = await _apiClient.post('/messages/send', payload);
          if (resp.statusCode == 200) {
            final sendData = jsonDecode(resp.body);
            if (sendData['success'] == true) {
              final newMsg = MessageModel.fromJson(sendData['data']['message']);
              final exists = _activeMessages.any((m) => m.id == newMsg.id);
              if (!exists) {
                _activeMessages.add(newMsg);
              }
              _isSending = false;
              notifyListeners();
              return true;
            }
          }
        }
      }
    } catch (e) {
      debugPrint('Error uploading/sending file message: $e');
    }

    _isSending = false;
    notifyListeners();
    return false;
  }

  // Socket triggers callback interfaces
  void handleIncomingSocketMessage(Map<String, dynamic> data, String currentUserId) {
    try {
      final message = MessageModel.fromJson(data['message']);
      final conversationId = data['conversationId'];

      if (_activeConversation != null && _activeConversation!.id == conversationId) {
        final exists = _activeMessages.any((m) => m.id == message.id);
        if (!exists) {
          _activeMessages.add(message);
          notifyListeners();
        }
      }

      // Refresh list in background
      fetchConversations(currentUserId);
    } catch (err) {
      debugPrint('Error binding socket incoming message: $err');
    }
  }

  void handleIncomingSocketAssignment(Map<String, dynamic> data, String currentUserId) {
    try {
      final conversationId = data['conversationId'];

      if (_activeConversation != null && _activeConversation!.id == conversationId) {
        // Reload details
        fetchMessages(conversationId);
      }

      fetchConversations(currentUserId);
    } catch (err) {
      debugPrint('Error binding socket assignment update: $err');
    }
  }

  // Human Takeover Actions
  Future<String?> takeOverChat(String conversationId, String agentId) async {
    try {
      final resp = await _apiClient.post('/messages/conversations/$conversationId/assign', {
        'agentId': agentId,
      });

      final payload = jsonDecode(resp.body);
      if (resp.statusCode == 200 && payload['success'] == true) {
        await fetchMessages(conversationId);
        await fetchConversations(agentId);
        return null; // Success
      } else {
        return payload['error'] ?? 'Take over failed';
      }
    } catch (e) {
      return 'Network error occurred during takeover';
    }
  }

  Future<String?> releaseToBot(String conversationId, String agentId) async {
    try {
      final resp = await _apiClient.post('/messages/conversations/$conversationId/transfer-to-ai', {});

      final payload = jsonDecode(resp.body);
      if (resp.statusCode == 200 && payload['success'] == true) {
        await fetchMessages(conversationId);
        await fetchConversations(agentId);
        return null;
      } else {
        return payload['error'] ?? 'Release failed';
      }
    } catch (e) {
      return 'Network error occurred during release';
    }
  }

  Future<String?> resolveChat(String conversationId, String agentId) async {
    try {
      final resp = await _apiClient.post('/messages/conversations/$conversationId/resolve', {});

      final payload = jsonDecode(resp.body);
      if (resp.statusCode == 200 && payload['success'] == true) {
        _activeConversation = null;
        _activeMessages.clear();
        await fetchConversations(agentId);
        return null;
      } else {
        return payload['error'] ?? 'Resolve failed';
      }
    } catch (e) {
      return 'Network error occurred during resolution';
    }
  }

  Future<String> resolveMediaUrl(String url) async {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Relative path, resolve using API Base URL
    final baseUrl = await _apiClient.getBaseUrl();
    var rootUrl = baseUrl;
    if (rootUrl.endsWith('/api')) {
      rootUrl = rootUrl.substring(0, rootUrl.length - 4);
    }
    if (rootUrl.endsWith('/')) {
      rootUrl = rootUrl.substring(0, rootUrl.length - 1);
    }
    var path = url;
    if (!path.startsWith('/')) {
      path = '/$path';
    }
    return '$rootUrl$path';
  }

  void setActiveConversation(ConversationModel? conversation) {
    _activeConversation = conversation;
    if (conversation == null) {
      _activeMessages.clear();
    }
    notifyListeners();
  }
}
