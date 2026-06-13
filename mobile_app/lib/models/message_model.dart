class MessageContent {
  final String text;
  final String? mediaUrl;
  final String? caption;
  final String? filename;
  final String? contactName;
  final String? contactPhone;

  MessageContent({
    this.text = '',
    this.mediaUrl,
    this.caption,
    this.filename,
    this.contactName,
    this.contactPhone,
  });

  factory MessageContent.fromJson(Map<String, dynamic> json) {
    return MessageContent(
      text: json['text'] ?? '',
      mediaUrl: json['mediaUrl'] ?? json['url'],
      caption: json['caption'],
      filename: json['filename'],
      contactName: json['contactName'],
      contactPhone: json['contactPhone'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'text': text,
      'mediaUrl': mediaUrl,
      'caption': caption,
      'filename': filename,
      'contactName': contactName,
      'contactPhone': contactPhone,
    };
  }
}

class MessageModel {
  final String id;
  final String conversationId;
  final String contactId;
  final String direction; // 'inbound' | 'outbound'
  final String type; // 'text' | 'image' | 'video' | 'audio' | 'document' | 'contact'
  final MessageContent content;
  final String status; // 'sent' | 'delivered' | 'read' | 'failed'
  final DateTime timestamp;
  final String sentBy; // 'human' | 'bot'

  MessageModel({
    required this.id,
    required this.conversationId,
    required this.contactId,
    required this.direction,
    required this.type,
    required this.content,
    required this.status,
    required this.timestamp,
    required this.sentBy,
  });

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    return MessageModel(
      id: json['_id'] ?? json['id'] ?? '',
      conversationId: json['conversationId'] ?? '',
      contactId: json['contactId'] ?? '',
      direction: json['direction'] ?? 'inbound',
      type: json['type'] ?? 'text',
      content: MessageContent.fromJson(json['content'] ?? {}),
      status: json['status'] ?? 'sent',
      timestamp: DateTime.parse(json['timestamp'] ?? json['createdAt'] ?? DateTime.now().toIso8601String()),
      sentBy: json['sentBy'] ?? 'bot',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'conversationId': conversationId,
      'contactId': contactId,
      'direction': direction,
      'type': type,
      'content': content.toJson(),
      'status': status,
      'timestamp': timestamp.toIso8601String(),
      'sentBy': sentBy,
    };
  }

  bool get isOutbound => direction == 'outbound';
}
