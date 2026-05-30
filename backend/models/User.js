const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    passwordHash: { type: String, required: true, select: false },
    passwordHistory: { type: [String], default: [], select: false },
    passwordChangedAt: { type: Date },
    role: { type: String, enum: ['superadmin', 'owner', 'admin', 'agent'], default: 'owner' },
    plan: { type: String, enum: ['free', 'starter', 'pro', 'enterprise'], default: 'free' },
    isSuspended: { type: Boolean, default: false },
    stripeCustomerId: { type: String },
    isEmailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLogin: { type: Date },
    ipWhitelist: [{ type: String }],
    apiKey: { type: String, select: false },
    apiKeyHash: { type: String, select: false },
    apiKeyScope: { type: String, enum: ['read', 'write', 'admin'], default: 'read' },
    apiKeyExpiresAt: { type: Date },
    avatar: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    employeeId: { type: String, default: '' },
    mobileNumber: { type: String, default: '' },
    username: { type: String, default: '' },
    department: { type: String, default: '' },
    designation: { type: String, default: '' },
    shiftTiming: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, strict: true }
);

userSchema.index({ apiKeyHash: 1 }, { sparse: true });
userSchema.index({ ownerId: 1 });
userSchema.index({ organizationId: 1 });

userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.incLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    let lockDuration = 15 * 60 * 1000; // 15 min
    if (this.loginAttempts + 1 >= 10) lockDuration = 24 * 60 * 60 * 1000; // 24 hours
    updates.$set = { lockUntil: Date.now() + lockDuration };
  }
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.passwordHistory;
  delete obj.twoFactorSecret;
  delete obj.apiKey;
  delete obj.apiKeyHash;
  delete obj.emailVerifyToken;
  delete obj.resetPasswordToken;
  delete obj.__v;
  return obj;
};

userSchema.statics.hashPassword = async function (password) {
  return bcrypt.hash(password, 12);
};

module.exports = mongoose.model('User', userSchema);
