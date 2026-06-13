class UserModel {
  final String id;
  final String name;
  final String email;
  final String role;
  final bool isSuspended;
  final String? ownerId;
  final String? organizationId;
  final String? employeeId;
  final String? avatar;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.isSuspended = false,
    this.ownerId,
    this.organizationId,
    this.employeeId,
    this.avatar,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'agent',
      isSuspended: json['isSuspended'] ?? false,
      ownerId: json['ownerId'] ?? json['owner_id'],
      organizationId: json['organizationId'] ?? json['organization_id'],
      employeeId: json['employeeId'],
      avatar: json['avatar'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'email': email,
      'role': role,
      'isSuspended': isSuspended,
      'ownerId': ownerId,
      'organizationId': organizationId,
      'employeeId': employeeId,
      'avatar': avatar,
    };
  }

  bool get isAdminOrOwner => role == 'admin' || role == 'owner' || role == 'superadmin';
}
