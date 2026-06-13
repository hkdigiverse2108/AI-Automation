import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../core/api_client.dart';
import '../providers/chat_provider.dart';

class SocketManager {
  static final SocketManager _instance = SocketManager._internal();
  factory SocketManager() => _instance;
  SocketManager._internal();

  io.Socket? _socket;

  bool get isConnected => _socket?.connected ?? false;

  Future<void> connect(String currentUserId, ChatProvider chatProvider) async {
    if (_socket != null && _socket!.connected) return;

    try {
      final token = await ApiClient().getAccessToken();
      if (token == null) return;

      final baseUrl = await ApiClient().getBaseUrl();
      // Socket.io host is backend domain
      final socketUrl = Uri.parse(baseUrl).origin;

      _socket = io.io(socketUrl, io.OptionBuilder()
        .setTransports(['websocket'])
        .disableAutoConnect()
        .setAuth({'token': token})
        .build()
      );

      _socket!.onConnect((_) {
        debugPrint('Socket.io connected successfully');
      });

      _socket!.onDisconnect((_) {
        debugPrint('Socket.io disconnected');
      });

      // Bind events
      _socket!.on('new_message', (data) {
        debugPrint('Socket incoming new_message event: $data');
        chatProvider.handleIncomingSocketMessage(data, currentUserId);
      });

      _socket!.on('conversation_assigned', (data) {
        debugPrint('Socket incoming conversation_assigned event: $data');
        chatProvider.handleIncomingSocketAssignment(data, currentUserId);
      });

      _socket!.connect();
    } catch (err) {
      debugPrint('Failed to initialize socket connection: $err');
    }
  }

  void disconnect() {
    if (_socket != null) {
      _socket!.disconnect();
      _socket = null;
    }
  }

  void emitTyping(String conversationId) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit('typing', {'conversationId': conversationId});
    }
  }

  void joinConversation(String conversationId) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit('join_conversation', conversationId);
    }
  }

  void leaveConversation(String conversationId) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit('leave_conversation', conversationId);
    }
  }
}
