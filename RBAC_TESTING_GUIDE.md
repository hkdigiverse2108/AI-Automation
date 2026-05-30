# RBAC & Human Takeover System - Manual Testing Guide

## Overview
This guide provides step-by-step manual testing procedures to verify the RBAC and Human Takeover System implementation.

---

## Test Suite 1: Agent Role Restrictions

### Test 1.1: Agent Route Restriction
**Goal**: Verify agents cannot access non-inbox pages via URL

**Steps**:
1. Log in as an agent (role: 'agent')
2. Try to navigate directly to:
   - `/dashboard` → should redirect to `/dashboard/inbox`
   - `/dashboard/team` → should redirect to `/dashboard/inbox`
   - `/dashboard/campaigns` → should redirect to `/dashboard/inbox`
   - `/dashboard/settings` → should redirect to `/dashboard/inbox`
3. Try to navigate to valid page:
   - `/dashboard/inbox` → should load successfully

**Expected Result**: All attempts to access non-inbox pages redirect to `/dashboard/inbox`

---

### Test 1.2: Agent Sidebar Navigation
**Goal**: Verify agent sidebar only shows Inbox section

**Steps**:
1. Log in as an agent
2. Look at the left sidebar
3. Check visibility of menu items

**Expected Result**: 
- ✓ Inbox is visible
- ✗ Dashboard (main) is hidden
- ✗ Contacts is hidden
- ✗ Leads is hidden
- ✗ Team is hidden
- ✗ Campaigns is hidden
- ✗ Templates is hidden
- ✗ Bot Builder is hidden
- ✗ Chat Logs is hidden
- ✗ Settings is hidden
- ✗ Admin Panel is hidden (for superadmin)

---

## Test Suite 2: Conversation Takeover & Locking

### Test 2.1: Unassigned Conversation Display
**Goal**: Verify unassigned conversations show "AI Handling" status

**Steps**:
1. Log in as an agent
2. Go to Inbox
3. Click on a conversation that is unassigned (no assignedAgent)
4. Look at the conversation header

**Expected Result**:
- Header shows purple badge with "AI Handling" label
- Purple dot is animated (pulsing)
- "Take Over" button is visible in header
- Message input shows banner: "AI is currently handling this chat. Take over to start chatting."
- Banner has a green "Take Over" button
- Text input is disabled/hidden

---

### Test 2.2: Agent Takeover
**Goal**: Verify agent can take over a conversation

**Setup**: Have 2 agents (Agent 1 and Agent 2) logged in on separate browsers/windows

**Steps**:
1. **Agent 1**: Go to Inbox, click unassigned chat
2. **Agent 1**: See "AI Handling" status and "Take Over" button
3. **Agent 1**: Click "Take Over" button
4. **Agent 1**: Wait for response

**Expected Result**:
- Agent 1's screen:
  - Header changes to show blue badge: "Assigned to Agent 1"
  - Blue dot is steady (not pulsing)
  - "Take Over" button disappears
  - "Return to Bot" button appears (if admin/owner)
  - Message input text area is now enabled
  - Can type and send messages
- Agent 2's screen:
  - Conversation moves from "Unassigned Queue" to "My Assigned" filter (if filtering)
  - OR conversation status updates in real-time showing Agent 1 assignment

---

### Test 2.3: Another Agent Cannot Steal Locked Conversation
**Goal**: Verify race condition protection - only first agent can assign

**Setup**: Have Agent 1 and Agent 2 logged in

**Steps**:
1. **Agent 1**: Goes to Inbox, clicks unassigned chat, clicks "Take Over"
2. **Simultaneously Agent 2** (in quick succession): 
   - Goes to same conversation
   - Clicks "Take Over" button
   - Sends API POST request to `/conversations/:id/assign`

**Expected Result**:
- Agent 1 succeeds in taking over (UI updates)
- Agent 2:
  - Gets error message: "Conversation already assigned to another agent"
  - HTTP status: 400 with code ALREADY_ASSIGNED
  - Conversation remains locked by Agent 1
  - Shows "Locked by Agent 1" badge in header (or similar)
  - Message input disabled: "Locked and assigned to Agent 1"

---

### Test 2.4: Agent Cannot Send Message Without Takeover
**Goal**: Verify agents can only send if they have taken over

**Setup**: Have an unassigned conversation

**Steps**:
1. Log in as Agent 1
2. Go to unassigned conversation
3. Use browser dev tools or API client to send POST to `/messages/send`
   ```bash
   POST /messages/send
   {
     "contactId": "<contact-id>",
     "text": "Test message",
     "type": "text"
   }
   ```

**Expected Result**:
- Response: HTTP 403 Forbidden
- Error: "You must take over this conversation before sending messages"
- Code: "TAKEOVER_REQUIRED"
- Message not created in database

---

### Test 2.5: Agent Can Send Message After Takeover
**Goal**: Verify agent can send messages after taking over

**Steps**:
1. Agent clicks "Take Over" on unassigned conversation
2. Waits for lock to be acquired
3. Types message: "Hello, this is a test message"
4. Hits Enter or clicks Send

**Expected Result**:
- Message sends successfully
- Message appears in conversation with "sent" status
- Gets delivery confirmation
- Admin/Owner sees message marked as "sentBy: human"
- Audit log records: AGENT_MESSAGE_SENT action

---

### Test 2.6: Locked Conversation Shows Correct Status to Other Agents
**Goal**: Verify other agents see correct lock status

**Setup**: Agent 1 has taken over conversation A

**Steps**:
1. Agent 2 logs in
2. Goes to Inbox
3. Looks at conversation A in the list
4. Clicks on conversation A

**Expected Result**:
- Conversation shows blue "Assigned to Agent 1" badge
- Header shows: "Locked by Agent 1" or similar
- Message input area shows: "Locked and assigned to Agent 1"
- Message input is disabled
- No "Take Over" button available
- No ability to send messages

---

## Test Suite 3: Release & Resolve

### Test 3.1: Admin Can Return Conversation to AI
**Goal**: Verify admin/owner can release a locked conversation

**Steps**:
1. Log in as Admin/Owner
2. Go to a conversation locked by an agent
3. Click dropdown menu (three dots) or "Return to Bot" button
4. Select "Return to Bot" / "Transfer to AI"

**Expected Result**:
- Lock is released
- Status changes to "AI Handling"
- assignedAgent is cleared
- lock_status becomes false
- takeover_status becomes 'ai'
- Agent who had it sees the change in real-time via socket
- Audit log records: AI_RESUME or RELEASE_CONVERSATION action

---

### Test 3.2: Agent Can Release Own Conversation
**Goal**: Verify agent can release their own taken-over conversation

**Steps**:
1. Log in as Agent 1 who has taken over a conversation
2. Click dropdown menu (three dots)
3. Look for "Transfer to AI" option
4. Click it

**Expected Result**:
- Conversation releases back to AI
- Header changes to "AI Handling"
- Message input is disabled
- Takeover banner reappears
- Audit log records: RELEASE_CONVERSATION or AI_RESUME

---

### Test 3.3: Resolve Conversation
**Goal**: Verify conversation can be marked as resolved

**Steps**:
1. Log in as Agent or Admin with a taken-over conversation
2. Click dropdown menu (three dots)
3. Select "Resolve"

**Expected Result**:
- Conversation status changes to "resolved"
- Lock is released
- Conversation moves out of active view
- Shows "Resolved" badge (if visible in UI)
- Audit log records: RESOLVE_CONVERSATION action
- Agent's resolved count increases in monitoring stats

---

## Test Suite 4: Multi-tenant Real-time Sync

### Test 4.1: Real-time Assignment Sync
**Goal**: Verify all agents under same owner see assignment in real-time

**Setup**: Owner with 3 agents (A, B, C)

**Steps**:
1. Open Inbox for Agent A in Window 1
2. Open Inbox for Agent B in Window 2
3. Open Inbox for Agent C in Window 3
4. In Window 1: Click "Take Over" on unassigned conversation
5. Watch Windows 2 and 3

**Expected Result**:
- Within 1-2 seconds:
  - Window 1: Conversation shows in "My Assigned" (Agent A)
  - Window 2: Conversation removes from "Unassigned Queue" (real-time update)
  - Window 3: Conversation removes from "Unassigned Queue" (real-time update)
  - All windows show "Assigned to Agent A" badge

---

### Test 4.2: Multi-browser Tab Sync
**Goal**: Verify sync works across browser tabs of same agent

**Steps**:
1. Agent opens Inbox in Tab 1
2. Agent opens Inbox in Tab 2
3. In Tab 1: Take over an unassigned conversation
4. Check Tab 2

**Expected Result**:
- Tab 2 conversation list updates in real-time
- Shows conversation as assigned
- Both tabs stay in sync

---

## Test Suite 5: Agent Suspension

### Test 5.1: Admin Suspends Agent
**Goal**: Verify admin can disable agent account

**Steps**:
1. Log in as Admin/Owner
2. Go to Team page
3. Find agent in list
4. Click suspension toggle (should show ToggleRight when enabled)
5. Click toggle to suspend

**Expected Result**:
- Toggle switches to ToggleLeft (disabled state)
- Label shows "Agent login disabled"
- Toast: "Agent login disabled"
- Audit log records: SUSPEND_AGENT action with admin as actor

---

### Test 5.2: Suspended Agent Cannot Assign
**Goal**: Verify suspended agents cannot take over conversations

**Setup**: Suspend an agent and have them try to take over

**Steps**:
1. (Admin suspends Agent 1 - see Test 5.1)
2. Log in as Agent 1 (either already logged in, or try to log in)
3. Try to take over an unassigned conversation

**Expected Result**:
- If not logged in: Login should work (they're suspended for API, not login)
- If logged in: Takeover fails with error
  - Error: "Target agent is suspended" or "AGENT_SUSPENDED"
  - HTTP 400 response
  - Cannot take over conversation

---

### Test 5.3: Admin Re-enables Suspended Agent
**Goal**: Verify admin can re-enable suspended agent

**Steps**:
1. On Team page, find suspended agent
2. Click toggle again to re-enable

**Expected Result**:
- Toggle switches to ToggleRight (enabled state)
- Label shows "Agent login enabled"
- Toast: "Agent login enabled"
- Agent can now take over conversations again

---

## Test Suite 6: Monitoring & Performance Dashboard

### Test 6.1: View Monitoring Stats
**Goal**: Verify monitoring dashboard displays correct stats

**Steps**:
1. Log in as Admin/Owner
2. Go to Team page
3. Click "Monitoring & Performance" tab
4. Wait for stats to load

**Expected Result**:
- Displays 3 stat boxes:
  - Total Unassigned Chats (count)
  - Active Telecallers (count)
  - Assigned Conversations (count)
- Stats show correct numbers matching database state

---

### Test 6.2: Agent Performance Table
**Goal**: Verify agent performance breakdown

**Steps**:
1. On Monitoring & Performance tab
2. Look for "Agent Performance" table

**Expected Result**:
- Shows list of all agents
- Each agent has columns:
  - Name
  - Email
  - Active Chats (current assignments)
  - Resolved Chats (historical resolved count)
- Shows correct counts for each agent

---

### Test 6.3: Takeover History
**Goal**: Verify audit log history displays correctly

**Steps**:
1. On Monitoring & Performance tab
2. Look for "Takeover History" section
3. Perform some takeover actions (assign, release, resolve)
4. Wait for real-time update or refresh

**Expected Result**:
- Shows recent audit log entries
- Displays actions like:
  - ASSIGN_CONVERSATION
  - REASSIGN_CONVERSATION
  - RELEASE_CONVERSATION
  - RESOLVE_CONVERSATION
  - AGENT_MESSAGE_SENT
- Shows actor name (who performed action)
- Shows timestamp
- Shows resource affected (conversation ID or contact)

---

### Test 6.4: Real-time Stats Update
**Goal**: Verify monitoring stats update in real-time

**Steps**:
1. Open monitoring dashboard in Admin window
2. Take over conversation in Agent window
3. Watch stats in Admin window

**Expected Result**:
- Within 10 seconds (polling interval):
  - "Unassigned" count decreases by 1
  - "Assigned" count increases by 1
  - Agent's "Active Chats" count increases by 1

---

## Test Suite 7: Bot Suppression

### Test 7.1: Bot Doesn't Reply During Human Control
**Goal**: Verify bot is suppressed when human is in control

**Setup**: Have a conversation with bot flow and an agent taking over

**Steps**:
1. Take over a conversation as Agent
2. Contact sends inbound message
3. Wait for system response

**Expected Result**:
- Message is saved to database
- Agent is notified via socket (new_message event)
- Bot flow is NOT executed
- No automatic reply from bot
- No reply triggers are processed

---

### Test 7.2: Bot Resumes After Transfer
**Goal**: Verify bot processes messages again after release

**Steps**:
1. Conversation locked by agent
2. Admin clicks "Return to Bot"
3. Contact sends inbound message
4. Wait for bot response

**Expected Result**:
- Lock is released
- Bot processes the message normally
- Bot flow executes (if applicable)
- Keyword triggers are processed
- Auto-reply might send
- Conversation status returns to 'bot'/'ai'

---

## Test Suite 8: Audit Trail

### Test 8.1: Check Audit Logs
**Goal**: Verify all actions are logged with actor info

**Steps**:
1. Perform various actions:
   - Agent A takes over conversation
   - Agent A sends message
   - Admin reassigns to Agent B
   - Agent B releases to AI
   - Admin suspends Agent A
2. Check AuditLog collection in MongoDB

**Expected Result**:
- Each action has:
  - `userId`: conversation owner
  - `actorId`: ID of user who performed action
  - `actorName`: Name of user who performed action
  - `action`: Action type (ASSIGN, RELEASE, etc.)
  - `resource`: What was affected (Conversation, User, etc.)
  - `timestamp`: When action occurred
  - `ip`: Requester's IP address
  - `userAgent`: Browser/client info

---

### Test 8.2: TTL Verification
**Goal**: Verify 90-day TTL is set on audit logs

**Steps**:
1. Check MongoDB `AuditLog` collection indexes
2. Look for TTL index on `timestamp` field

**Expected Result**:
```javascript
db.auditlogs.getIndexes()
// Should show:
{
  "v": 2,
  "key": { "timestamp": 1 },
  "expireAfterSeconds": 7776000  // 90 days in seconds
}
```

---

## Test Suite 9: API Response Codes

### Test 9.1: Verify Status Codes
**Goal**: Verify API returns correct HTTP status codes

**Steps**: Use API client (curl, Postman, etc.)

**Test Cases**:

| Scenario | Endpoint | Method | Expected Status | Code |
|----------|----------|--------|-----------------|------|
| Agent takes over | `/conversations/:id/assign` | POST | 200 | - |
| Race condition | `/conversations/:id/assign` | POST | 400 | ALREADY_ASSIGNED |
| Suspended agent | `/conversations/:id/assign` | POST | 400 | AGENT_SUSPENDED |
| Agent no takeover send | `/messages/send` | POST | 403 | TAKEOVER_REQUIRED |
| Agent can send (after takeover) | `/messages/send` | POST | 200 | - |
| Agent can't access other agent | `/messages/conversations/:id` | GET | 403 | FORBIDDEN |
| Agent releases own | `/conversations/:id/transfer-to-ai` | POST | 200 | - |
| Agent can't release other's | `/conversations/:id/transfer-to-ai` | POST | 403 | FORBIDDEN |

---

## Checklist Summary

Use this checklist to track completion:

### Route Restrictions
- [ ] Agent redirect from /dashboard to /inbox
- [ ] Agent redirect from /team to /inbox
- [ ] Agent redirect from /campaigns to /inbox
- [ ] Sidebar filters navigation correctly

### Takeover & Locking
- [ ] Unassigned shows "AI Handling"
- [ ] Take Over button works
- [ ] Lock prevents second assignment (race condition)
- [ ] Other agents see locked status
- [ ] Agent can't send without takeover
- [ ] Agent can send after takeover

### Release & Resolve
- [ ] Admin can return to bot
- [ ] Agent can release own
- [ ] Resolve changes status

### Multi-tenant Sync
- [ ] Real-time sync across agents
- [ ] Socket events broadcast to tenant room
- [ ] Tab sync works

### Suspension
- [ ] Admin can suspend agent
- [ ] Suspended agent can't take over
- [ ] Admin can re-enable

### Monitoring
- [ ] Stats display correctly
- [ ] Agent performance table works
- [ ] Audit history shows
- [ ] Real-time polling updates stats

### Bot Suppression
- [ ] Bot suppressed during human control
- [ ] Bot resumes after release

### Audit Trail
- [ ] All actions logged
- [ ] Actor info recorded
- [ ] TTL index exists

### API Responses
- [ ] All status codes correct
- [ ] Error messages clear
- [ ] Response codes match spec

---

## Success Criteria

✅ **System is ready for production when**:
1. All tests in this suite pass
2. No console errors in browser DevTools
3. No API error responses
4. Real-time sync works smoothly
5. Audit logs record all actions
6. No race conditions observed
7. Bot suppression works correctly
8. Agent restrictions enforced
9. Performance stats accurate

---

## Troubleshooting

### Issue: Take Over button doesn't work
**Solution**: Check browser console for errors, verify JWT token is valid, check backend logs

### Issue: Real-time sync not working
**Solution**: Check Socket.io connection, verify user has ownerId, check tenant room setup

### Issue: Agent still sees non-inbox pages
**Solution**: Clear browser cache, verify layout.jsx redirect logic, check user role in token

### Issue: Audit logs missing
**Solution**: Verify AuditLog.log() is called, check database connection, verify TTL index

### Issue: Bot not suppressed
**Solution**: Check conversation.status, lock_status, takeover_status values, verify botEngine logic
