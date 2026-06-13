class CallLogModel {
  final String phone;
  final String name;
  final int duration;
  final DateTime timestamp;
  final String callType; // 'incoming' | 'outgoing' | 'missed' | 'rejected' | 'unknown'

  CallLogModel({
    required this.phone,
    this.name = '',
    this.duration = 0,
    required this.timestamp,
    this.callType = 'unknown',
  });

  factory CallLogModel.fromJson(Map<String, dynamic> json) {
    return CallLogModel(
      phone: json['phone'] ?? '',
      name: json['name'] ?? '',
      duration: json['duration'] ?? 0,
      timestamp: DateTime.parse(json['timestamp'] ?? DateTime.now().toIso8601String()),
      callType: json['callType'] ?? 'unknown',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'phone': phone,
      'name': name,
      'duration': duration,
      'timestamp': timestamp.toIso8601String(),
      'callType': callType,
    };
  }
}
