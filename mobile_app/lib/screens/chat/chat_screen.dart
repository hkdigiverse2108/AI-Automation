import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';
import '../../providers/auth_provider.dart';
import '../../providers/chat_provider.dart';
import '../../models/conversation_model.dart';
import '../../models/message_model.dart';
import '../../core/theme.dart';
import '../../socket/socket_manager.dart';

class ChatScreen extends StatefulWidget {
  final ConversationModel conversation;
  const ChatScreen({super.key, required this.conversation});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _msgController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ChatProvider>().fetchMessages(widget.conversation.id);
      SocketManager().joinConversation(widget.conversation.id);
    });
  }

  @override
  void dispose() {
    SocketManager().leaveConversation(widget.conversation.id);
    _msgController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final chatProvider = context.watch<ChatProvider>();
    final authProvider = context.watch<AuthProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final conversation = chatProvider.activeConversation ?? widget.conversation;
    final messages = chatProvider.activeMessages;
    final currentUser = authProvider.currentUser;

    // Check ownership
    final isMyAssigned = conversation.assignedAgentId == currentUser?.id;
    final isUnassigned = conversation.assignedAgentId == null;
    final isLockedByOther = !isMyAssigned && !isUnassigned;

    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.waGreen.withOpacity(0.2),
              child: const Icon(LucideIcons.user, color: AppColors.waGreen, size: 20),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    conversation.contact?.name.isNotEmpty == true ? conversation.contact!.name : conversation.contact?.phone ?? 'Chat',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    conversation.takeoverStatus == 'human' ? 'Assigned to ${conversation.assignedAgentName ?? "Agent"}' : 'AI Automating',
                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          if (isMyAssigned) ...[
            TextButton.icon(
              icon: const Icon(LucideIcons.check, size: 16),
              label: const Text('Resolve'),
              onPressed: () => _handleResolve(conversation.id, currentUser!.id),
            ),
            IconButton(
              icon: const Icon(LucideIcons.bot),
              onPressed: () => _handleRelease(conversation.id, currentUser!.id),
              tooltip: 'Release to AI',
            ),
          ]
        ],
      ),
      body: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkChatBg : AppColors.lightChatBg,
        ),
        child: Column(
          children: [
            // Status banner for Takeover
            if (isUnassigned)
              Container(
                color: Colors.amber.withOpacity(0.15),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(
                  children: [
                    const Icon(LucideIcons.bot, color: Colors.orange, size: 20),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'AI is currently handling this chat. Take over to start chatting.',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () => _handleTakeover(conversation.id, currentUser!.id),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.waGreen,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text('Take Over', style: TextStyle(fontSize: 12)),
                    )
                  ],
                ),
              ),

            if (isLockedByOther)
              Container(
                color: Colors.redAccent.withOpacity(0.15),
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    const Icon(LucideIcons.lock, color: Colors.red, size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'This chat is locked by ${conversation.assignedAgentName ?? "another agent"}.',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),

            // Message List
            Expanded(
              child: chatProvider.isLoadingMsgs
                  ? const Center(child: CircularProgressIndicator(color: AppColors.waGreen))
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(16),
                      itemCount: messages.length,
                      itemBuilder: (context, index) {
                        final msg = messages[index];
                        return _buildChatBubble(msg, isDark);
                      },
                    ),
            ),

            // Input Bar
            _buildInputBar(isMyAssigned, isDark, chatProvider),
          ],
        ),
      ),
    );
  }

  Widget _buildChatBubble(MessageModel msg, bool isDark) {
    final isOutbound = msg.isOutbound;
    final alignment = isOutbound ? Alignment.centerRight : Alignment.centerLeft;
    final bubbleColor = isOutbound
        ? (isDark ? AppColors.darkBubbleOut : AppColors.lightBubbleOut)
        : (isDark ? AppColors.darkBubbleIn : AppColors.lightBubbleIn);
    final textStyle = TextStyle(
      color: isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary,
    );

    return Align(
      alignment: alignment,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: bubbleColor,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(12),
            topRight: const Radius.circular(12),
            bottomLeft: isOutbound ? const Radius.circular(12) : Radius.zero,
            bottomRight: isOutbound ? Radius.zero : const Radius.circular(12),
          ),
          boxShadow: const [
            BoxShadow(color: Colors.black12, blurRadius: 1, offset: Offset(0, 1))
          ],
        ),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.7),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(msg.content.text, style: textStyle),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  DateFormat('jm').format(msg.timestamp),
                  style: TextStyle(
                    fontSize: 10,
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                  ),
                ),
                if (isOutbound) ...[
                  const SizedBox(width: 4),
                  Icon(
                    msg.status == 'read' ? LucideIcons.checkCheck : LucideIcons.check,
                    size: 14,
                    color: msg.status == 'read' ? Colors.blue : Colors.grey,
                  )
                ]
              ],
            )
          ],
        ),
      ),
    );
  }

  Widget _buildInputBar(bool canSend, bool isDark, ChatProvider chatProvider) {
    return Container(
      color: isDark ? AppColors.darkPanelHeader : AppColors.lightBgSecondary,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: SafeArea(
        child: Row(
          children: [
            IconButton(
              icon: const Icon(LucideIcons.smile, color: Colors.grey),
              onPressed: canSend ? () {} : null,
            ),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkBgPrimary : Colors.white,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: TextField(
                  controller: _msgController,
                  enabled: canSend,
                  onChanged: (val) {
                    if (val.isNotEmpty) {
                      SocketManager().emitTyping(widget.conversation.id);
                    }
                  },
                  decoration: InputDecoration(
                    hintText: canSend ? 'Type a message' : 'Take over this chat to type',
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  ),
                ),
              ),
            ),
            IconButton(
              icon: Icon(
                LucideIcons.send,
                color: canSend ? AppColors.waGreen : Colors.grey,
              ),
              onPressed: canSend ? _sendMessage : null,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _sendMessage() async {
    final text = _msgController.text.trim();
    if (text.isNotEmpty) {
      _msgController.clear();
      await context.read<ChatProvider>().sendMessage(text);
      _scrollToBottom();
    }
  }

  Future<void> _handleTakeover(String convId, String agentId) async {
    final err = await context.read<ChatProvider>().takeOverChat(convId, agentId);
    if (err != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err), backgroundColor: Colors.red));
    }
  }

  Future<void> _handleRelease(String convId, String agentId) async {
    final err = await context.read<ChatProvider>().releaseToBot(convId, agentId);
    if (err != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err), backgroundColor: Colors.red));
    }
  }

  Future<void> _handleResolve(String convId, String agentId) async {
    final err = await context.read<ChatProvider>().resolveChat(convId, agentId);
    if (err == null && mounted) {
      Navigator.pop(context); // Go back to inbox on resolve
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err!), backgroundColor: Colors.red));
    }
  }
}
