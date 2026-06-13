import 'contact_model.dart';
import 'message_model.dart';

class ConversationModel {
  final String id;
  final String status; // 'bot' | 'human' | 'ai' | 'resolved' | 'waiting'
  final String? assignedAgentId;
  final String? assignedAgentName;
  final bool lockStatus;
  final String takeoverStatus; // 'ai' | 'human'
  final ContactModel? contact;
  final int unreadCount;
  final MessageModel? lastMessage;
  final DateTime lastMessageAt;

  ConversationModel({
    required this.id,
    required this.status,
    this.assignedAgentId,
    this.assignedAgentName,
    this.lockStatus = false,
    this.takeoverStatus = 'ai',
    this.contact,
    this.unreadCount = 0,
    this.lastMessage,
    required this.lastMessageAt,
  });

  factory ConversationModel.fromJson(Map<String, dynamic> json) {
    // Handle populated contactId
    ContactModel? contactData;
    if (json['contactId'] != null) {
      if (json['contactId'] is Map<String, dynamic>) {
        contactData = ContactModel.fromJson(json['contactId']);
      } else {
        contactData = ContactModel(id: json['contactId'], name: 'Contact', phone: '', email: '');
      }
    }

    // Handle populated assignedAgent
    String? agentId;
    String? agentName;
    if (json['assignedAgent'] != null) {
      if (json['assignedAgent'] is Map<String, dynamic>) {
        agentId = json['assignedAgent']['_id'];
        agentName = json['assignedAgent']['name'];
      } else {
        agentId = json['assignedAgent'].toString();
      }
    }
    agentId ??= json['assigned_agent_id'];

    // Handle nested lastMessage
    MessageModel? lastMsg;
    if (json['lastMessage'] != null) {
      lastMsg = MessageModel.fromJson(json['lastMessage']);
    }

    return ConversationModel(
      id: json['_id'] ?? json['id'] ?? '',
      status: json['status'] ?? 'bot',
      assignedAgentId: agentId,
      assignedAgentName: agentName,
      lockStatus: json['lock_status'] ?? false,
      takeoverStatus: json['takeover_status'] ?? 'ai',
      contact: contactData,
      unreadCount: json['unreadCount'] ?? 0,
      lastMessage: lastMsg,
      lastMessageAt: DateTime.parse(json['lastMessageAt'] ?? json['updatedAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'status': status,
      'assigned_agent_id': assignedAgentId,
      'lock_status': lockStatus,
      'takeover_status': takeoverStatus,
      'contactId': contact?.toJson(),
      'unreadCount': unreadCount,
      'lastMessage': lastMessage?.toJson(),
      'lastMessageAt': lastMessageAt.toIso8601String(),
    };
  }

  bool get isAssignedToHuman => lockStatus || takeoverStatus == 'human';
  bool get isUnassigned => assignedAgentId == null;
}
