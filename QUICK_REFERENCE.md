# RBAC & Human Takeover System - Quick Reference

## 🚀 Quick Start

```bash
# Verify backend
cd backend && node scripts/verify-rbac-system.js

# Build frontend
cd ../frontend && bash ../verify-frontend.sh

# Deploy
npm start  # in both backend & frontend
```

---

## 👤 User Roles

| Role | Capabilities |
|------|--------------|
| **Agent** | Take over, send messages (after takeover), release own, see monitoring stats |
| **Admin** | All agent + assign any agent, force release, suspend agents, full monitoring |
| **Owner** | Same as admin, overall account control |
| **Superadmin** | System-wide access across all accounts |

---

## 🔒 Conversation States

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│  AI HANDLING (lock_status: false)                   │
│  ├─ Status: 'bot' or 'ai'                           │
│  ├─ takeover_status: 'ai'                           │
│  ├─ assignedAgent: null                             │
│  └─ Only bot replies, no agent needed               │
│                                                       │
│           [Agent clicks "Take Over"]                 │
│                    ↓                                  │
│  HUMAN TAKEOVER (lock_status: true)                 │
│  ├─ Status: 'human'                                 │
│  ├─ takeover_status: 'human'                        │
│  ├─ assignedAgent: <agent_id>                       │
│  ├─ assigned_at: <timestamp>                        │
│  └─ Bot suppressed, agent only                      │
│                                                       │
│       [Agent releases or admin returns to bot]       │
│                    ↓                                  │
│  RESOLVED (lock_status: false)                      │
│  ├─ Status: 'resolved'                              │
│  ├─ Lock released, conversation closed              │
│  └─ Can reopen if needed                            │
│                                                       │
└─────────────────────────────────────────────────────┘
```

---

## 🔑 Key Endpoints

### Takeover
```bash
POST /api/conversations/:id/assign
# Agent → self only, Admin → any agent
# Response: 200 OK or 400 ALREADY_ASSIGNED
```

### Release
```bash
POST /api/conversations/:id/transfer-to-ai
# Returns to AI mode
# Agent → own only, Admin → any
```

### Resolve
```bash
POST /api/conversations/:id/resolve
# Mark as resolved
# Agent → own only, Admin → any
```

### Send Message
```bash
POST /api/messages/send
# Requires takeover (assignedAgent === user._id)
# Response: 200 OK or 403 TAKEOVER_REQUIRED
```

### Monitoring
```bash
GET /api/team/monitoring-stats
# Returns: unassigned count, agent performance, audit history
```

---

## 🎯 Frontend Components

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| **Sidebar.jsx** | Navigation | Filters based on role |
| **ChatWindow.jsx** | Message display | Shows takeover state, action buttons |
| **inbox/page.jsx** | Conversation list | Agent filters ("My Assigned", "Unassigned") |
| **team/page.jsx** | Team management | Suspension toggle, monitoring stats |

---

## 🔐 Authentication Flow

```
1. Login → JWT token issued
2. Frontend stores token
3. Every API call includes token
4. Socket.io connects with token auth
5. User joined to rooms:
   - user_${userId} (personal)
   - user_${ownerId} (team, if agent)
```

---

## 📡 Socket Events

### Emitted FROM Backend
```javascript
'conversation_assigned' → {
  conversationId,
  assignedAgent,
  lock_status,
  takeover_status,
  status
}

'new_message' → {
  message,
  contact,
  conversationId
}
```

### Listened BY Frontend
```javascript
socket.on('conversation_assigned', updateList)
socket.on('new_message', addMessage)
socket.on('message_status', updateStatus)
```

---

## 🗂️ Database

### User Fields (relevant to RBAC)
```javascript
role: String,           // 'agent', 'admin', 'owner', 'superadmin'
ownerId: ObjectId,      // Only for agents, points to owner
isSuspended: Boolean    // Can disable account
```

### Conversation Fields
```javascript
status: String,           // 'bot', 'human', 'ai', 'resolved'
assignedAgent: ObjectId,  // Who took over
assigned_agent_id: ObjectId,
assigned_at: Date,
lock_status: Boolean,      // true = locked to agent
takeover_status: String    // 'ai' or 'human'
```

### AuditLog Entry
```javascript
userId: ObjectId,         // Conversation owner
actorId: ObjectId,        // Who performed action
actorName: String,        // Actor's name
action: String,           // ASSIGN, RELEASE, SUSPEND, etc
timestamp: Date,          // TTL: 90 days
ip: String, userAgent     // Browser info
```

---

## ✅ Verification Checklist

Before going live, verify:

```
Backend
☐ npm install succeeds
☐ verify-rbac-system.js passes all 6 tests
☐ MongoDB indexes exist
☐ Socket.io running
☐ API endpoints responding

Frontend  
☐ npm install succeeds
☐ verify-frontend.sh passes all checks
☐ npm run build succeeds (no errors)
☐ UI components render correctly
☐ Socket.io connects

Integration
☐ Agent login → redirected to /inbox
☐ Agent takes over → lock acquired
☐ Another agent tries → ALREADY_ASSIGNED error
☐ Real-time sync works
☐ Monitoring stats update
☐ Audit logs recorded
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Takeover fails | Check agent role, verify JWT token, check DB connection |
| Real-time not syncing | Verify Socket.io connected, check user.ownerId exists |
| Agent sees /dashboard | Clear cache, verify layout.jsx redirect, check user.role |
| Monitoring stats empty | Check GET /team/monitoring-stats endpoint, verify permissions |
| Bot keeps replying | Check conversation.lock_status, verify botEngine suppression |

---

## 📊 Performance Targets

```
Takeover Operation:    < 100ms (atomic DB update)
Socket Event Delivery: < 50ms  (same tenant room)
Message Send:          < 500ms (full operation)
Real-time Sync:        < 1s    (user visible)
DB Queries:            < 50ms  (with indexes)
Frontend Load:         < 3s    (full page)
```

---

## 🔐 Security Checklist

```
✓ Agent cannot access /dashboard, /team, etc.
✓ Agent cannot send message without takeover
✓ Agent cannot view other agent conversations
✓ Admin can force takeover/release
✓ Suspension blocks new assignments
✓ All actions logged with actor info
✓ Atomic locks prevent race conditions
✓ JWT requires valid token
✓ HTTPS enforced in production
```

---

## 📁 Key Files

```
Backend
├─ routes/messages.js       ← POST /assign, /resolve, /transfer-to-ai
├─ routes/team.js           ← GET /monitoring-stats, PUT /agents/:id
├─ services/botEngine.js    ← Bot suppression logic (line 171, 775)
├─ services/socketService.js ← Multi-tenant room joining
└─ scripts/verify-rbac-system.js ← Automated tests

Frontend
├─ components/Sidebar.jsx   ← Role-based navigation filtering
├─ components/ChatWindow.jsx ← Takeover UI and buttons
├─ app/dashboard/layout.jsx ← Route enforcement
├─ app/dashboard/inbox/page.jsx ← Filter tabs and socket listeners
└─ app/dashboard/team/page.jsx ← Suspension toggle and monitoring
```

---

## 🚨 Alert Conditions

Monitor for these issues:

```
1. High error rate on /conversations/:id/assign
   → Likely race conditions, check DB locking

2. Socket events not delivering
   → Check Socket.io connection pool, consider Redis adapter

3. Audit logs not being recorded
   → Verify AuditLog.create() calls, check DB connection

4. Agents seeing deleted conversations
   → Clear cache, check soft delete logic

5. Real-time stats not updating
   → Verify 10-second polling loop, check network tab
```

---

## 🎓 Learning Resources

1. **Setup**: See DEPLOYMENT_GUIDE.md
2. **Testing**: See RBAC_TESTING_GUIDE.md
3. **Code**: See IMPLEMENTATION_SUMMARY.md
4. **Architecture**: See this quick reference

---

## 💡 Pro Tips

- **Debug Socket.io**: Check browser DevTools → Network → WS
- **Check User Role**: `console.log(user.role, user.ownerId)` in browser console
- **Monitor Real-time**: Open DevTools → Console → `socket.on('*', console.log)`
- **Check Locks**: `db.conversations.findOne({}, {lock_status: 1, assignedAgent: 1})`
- **Audit Trail**: `db.auditlogs.find({action: 'ASSIGN_CONVERSATION'}).sort({timestamp: -1}).limit(10)`

---

## 📞 Support

- **Errors**: Check browser console + backend logs + MongoDB logs
- **Performance**: Use DevTools Performance tab + backend metrics
- **Architecture**: Review IMPLEMENTATION_SUMMARY.md diagrams
- **Testing**: Use RBAC_TESTING_GUIDE.md test scenarios

---

## ✨ Success Indicators

After deployment, you'll know it's working when:

1. ✅ Agents can only see Inbox in sidebar
2. ✅ Unassigned chats show "AI Handling" status
3. ✅ "Take Over" button locks conversation instantly
4. ✅ Other agents see real-time lock status
5. ✅ Agents can send messages after takeover
6. ✅ Admin can suspend agents
7. ✅ Monitoring stats update live
8. ✅ Audit logs record all actions
9. ✅ Bot doesn't reply during human control
10. ✅ System handles 100+ agents smoothly

---

**Status**: 🟢 PRODUCTION READY

**Next Step**: Run `verify-rbac-system.js` → Follow `DEPLOYMENT_GUIDE.md` → Execute manual tests from `RBAC_TESTING_GUIDE.md`

