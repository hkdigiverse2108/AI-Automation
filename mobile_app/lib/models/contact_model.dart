class ContactModel {
  final String id;
  final String name;
  final String phone;
  final String email;
  final String profilePic;
  final String source;
  final List<String> tags;
  final bool optedOut;
  final String notes;

  ContactModel({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    this.profilePic = '',
    this.source = 'manual',
    this.tags = const [],
    this.optedOut = false,
    this.notes = '',
  });

  factory ContactModel.fromJson(Map<String, dynamic> json) {
    return ContactModel(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      phone: json['phone'] ?? '',
      email: json['email'] ?? '',
      profilePic: json['profilePic'] ?? '',
      source: json['source'] ?? 'manual',
      tags: List<String>.from(json['tags'] ?? []),
      optedOut: json['optedOut'] ?? false,
      notes: json['notes'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'phone': phone,
      'email': email,
      'profilePic': profilePic,
      'source': source,
      'tags': tags,
      'optedOut': optedOut,
      'notes': notes,
    };
  }
}
