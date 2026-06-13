import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';
import '../../providers/auth_provider.dart';
import '../../providers/chat_provider.dart';
import '../../models/conversation_model.dart';
import '../../core/theme.dart';
import '../chat/chat_screen.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshConversations();
    });
  }

  Future<void> _refreshConversations() async {
    final auth = context.read<AuthProvider>();
    if (auth.currentUser != null) {
      await context.read<ChatProvider>().fetchConversations(auth.currentUser!.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final chatProvider = context.watch<ChatProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final myChats = chatProvider.myConversations.where((c) {
      if (_searchQuery.isEmpty) return true;
      return c.contact?.name.toLowerCase().contains(_searchQuery.toLowerCase()) == true ||
             c.contact?.phone.contains(_searchQuery) == true;
    }).toList();

    final unassignedChats = chatProvider.unassignedConversations.where((c) {
      if (_searchQuery.isEmpty) return true;
      return c.contact?.name.toLowerCase().contains(_searchQuery.toLowerCase()) == true ||
             c.contact?.phone.contains(_searchQuery) == true;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Inbox'),
        leading: IconButton(
          icon: const Icon(LucideIcons.menu),
          onPressed: () {
            Scaffold.of(context).openDrawer();
          },
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.waGreen,
          unselectedLabelColor: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
          indicatorColor: AppColors.waGreen,
          tabs: const [
            Tab(text: 'My Assigned'),
            Tab(text: 'Unassigned Queue'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Search input bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: TextField(
              controller: _searchController,
              onChanged: (value) {
                setState(() {
                  _searchQuery = value;
                });
              },
              decoration: InputDecoration(
                hintText: 'Search chats or numbers...',
                prefixIcon: const Icon(LucideIcons.search, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(LucideIcons.x, size: 16),
                        onPressed: () {
                          _searchController.clear();
                          setState(() {
                            _searchQuery = '';
                          });
                        },
                      )
                    : null,
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
                filled: true,
                fillColor: isDark ? AppColors.darkPanelHeader : AppColors.lightBgSecondary,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),

          // Tab content
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildChatList(myChats, chatProvider.isLoadingConvs, 'No assigned chats'),
                _buildChatList(unassignedChats, chatProvider.isLoadingConvs, 'No unassigned chats in queue'),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildChatList(List<ConversationModel> chats, bool loading, String emptyText) {
    if (loading && chats.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: AppColors.waGreen));
    }
    if (chats.isEmpty) {
      return RefreshIndicator(
        onRefresh: _refreshConversations,
        color: AppColors.waGreen,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Container(
            height: MediaQuery.of(context).size.height * 0.5,
            alignment: CenterItemAlignment.center,
            child: Text(emptyText, style: const TextStyle(color: Colors.grey)),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _refreshConversations,
      color: AppColors.waGreen,
      child: ListView.separated(
        itemCount: chats.length,
        separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
        itemBuilder: (context, index) {
          final chat = chats[index];
          final isDark = Theme.of(context).brightness == Brightness.dark;
          final lastMsgText = chat.lastMessage?.content.text ?? 'No messages yet';
          final formattedTime = DateFormat('jm').format(chat.lastMessageAt);

          return ListTile(
            leading: CircleAvatar(
              backgroundImage: chat.contact?.profilePic.isNotEmpty == true
                  ? NetworkImage(chat.contact!.profilePic)
                  : null,
              backgroundColor: AppColors.waGreen.withOpacity(0.2),
              child: chat.contact?.profilePic.isEmpty != false
                  ? Text(
                      (chat.contact?.name.isNotEmpty == true ? chat.contact!.name.substring(0, 1) : 'C').toUpperCase(),
                      style: const TextStyle(color: AppColors.waGreen, fontWeight: FontWeight.bold),
                    )
                  : null,
            ),
            title: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    chat.contact?.name.isNotEmpty == true ? chat.contact!.name : chat.contact?.phone ?? 'Unknown',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text(
                  formattedTime,
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                  ),
                ),
              ],
            ),
            subtitle: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    lastMsgText,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                    ),
                  ),
                ),
                if (chat.unreadCount > 0)
                  Container(
                    margin: const EdgeInsets.only(left: 8),
                    padding: const EdgeInsets.all(6),
                    decoration: const BoxDecoration(
                      color: AppColors.waGreen,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      '${chat.unreadCount}',
                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  )
              ],
            ),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => ChatScreen(conversation: chat)),
              );
            },
          );
        },
      ),
    );
  }
}

class CenterItemAlignment {
  static const Alignment center = Alignment.center;
}
