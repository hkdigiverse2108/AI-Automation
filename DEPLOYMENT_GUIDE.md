# RBAC & Human Takeover System - Deployment Guide

## Pre-Deployment Checklist

### Database Preparation
- [ ] MongoDB connection string configured in `.env`
- [ ] User model has `role`, `ownerId`, `isSuspended` fields
- [ ] Conversation model has `assignedAgent`, `assigned_agent_id`, `assigned_at`, `lock_status`, `takeover_status` fields
- [ ] AuditLog model has `actorId`, `actorName` fields
- [ ] TTL index created on AuditLog (90 days)

### Backend Configuration
- [ ] `JWT_SECRET` configured in `.env`
- [ ] `MONGODB_URI` configured in `.env`
- [ ] Socket.io configured and running
- [ ] All routes mounted in `server.js`:
  - `/messages` routes
  - `/team` routes
- [ ] Middleware stack: `verifyToken`, role-based middleware

### Frontend Configuration
- [ ] Next.js configured with `next.config.js`
- [ ] API base URL configured in `lib/api.js`
- [ ] Socket.io client configured in `lib/socket.js`
- [ ] Auth store configured in `lib/store.js`
- [ ] Tailwind CSS and styling configured

### Environment Variables

**.env (Backend)**:
```bash
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key-here
PORT=5000
NODE_ENV=production
WHATSAPP_ACCESS_TOKEN=...
```

**.env.local (Frontend)**:
```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.com/api
NEXT_PUBLIC_SOCKET_URL=https://your-api-domain.com
```

---

## Deployment Steps

### Step 1: Backend Verification & Build

```bash
cd backend

# Verify all dependencies installed
npm install

# Run RBAC verification script
node scripts/verify-rbac-system.js

# Expected output:
# ✓ Atomic Conversation Locking
# ✓ Audit Logging with Actor Information
# ✓ Agent Suspension Flag
# ✓ Conversation Schema Fields
# ✓ Multi-tenant Socket Room Setup
# ✓ Bot Suppression Logic
# Tests Passed: 6/6
```

### Step 2: Backend Deployment

```bash
# Optional: Run migrations if needed
# npm run migrate

# Start backend server
NODE_ENV=production npm start

# Expected: Server running on port 5000
# Verify: Socket.io listening
# Verify: MongoDB connected
```

### Step 3: Frontend Verification & Build

```bash
cd frontend

# Run frontend verification script
bash ../verify-frontend.sh

# Expected output:
# ✓ Sidebar filters navigation by agent role
# ✓ Layout enforces agent route restrictions
# ✓ ChatWindow displays takeover state
# ✓ ChatWindow has Take Over action
# ✓ Inbox has agent filter tabs
# ✓ Inbox listens for conversation_assigned events
# ✓ Team page has suspension toggle
# ✓ Team page has monitoring tab
# ✓ Build successful!
```

### Step 4: Frontend Deployment

```bash
# Build for production
npm run build

# Expected output:
# ✓ compiled client and server successfully
# ✓ No TypeScript errors
# ✓ No React errors

# Start production server
npm start

# Expected: Frontend running on port 3000
```

### Step 5: Verify Integration

```bash
# 1. Test backend health
curl http://localhost:5000/api/health

# 2. Test Socket.io connection
# Use Socket.io test client or browser console

# 3. Test login flow
# Navigate to http://localhost:3000/login
# Log in with test account
```

---

## Database Initialization

### Create Test Data (Optional)

```javascript
// scripts/setup-rbac-test-data.js
const mongoose = require('mongoose');
const User = require('../models/User');

const setupTestData = async () => {
  // Create test owner
  const owner = await User.create({
    name: 'Test Owner',
    email: 'owner@test.com',
    passwordHash: await User.hashPassword('password'),
    role: 'owner',
    isEmailVerified: true
  });

  // Create test agents
  const agent1 = await User.create({
    name: 'Agent 1',
    email: 'agent1@test.com',
    passwordHash: await User.hashPassword('password'),
    role: 'agent',
    ownerId: owner._id,
    isEmailVerified: true
  });

  const agent2 = await User.create({
    name: 'Agent 2',
    email: 'agent2@test.com',
    passwordHash: await User.hashPassword('password'),
    role: 'agent',
    ownerId: owner._id,
    isEmailVerified: true
  });

  console.log('Test data created:');
  console.log(`Owner: ${owner.email}`);
  console.log(`Agent 1: ${agent1.email}`);
  console.log(`Agent 2: ${agent2.email}`);
};

setupTestData();
```

---

## Monitoring & Health Checks

### Backend Health Check

```bash
# Check backend is running
curl -s http://localhost:5000/api/health | jq

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-05-29T...",
  "uptime": 1234.567
}
```

### Frontend Health Check

```bash
# Check frontend is running
curl -s http://localhost:3000 | head -20

# Expected: HTML document returned
```

### Socket.io Connection Check

```javascript
// Browser console
const socket = io('http://localhost:5000', {
  auth: { token: 'your-jwt-token' }
});

socket.on('connect', () => console.log('Socket connected!'));
socket.on('user_online', (data) => console.log('User online:', data));
```

### Database Check

```bash
# Check MongoDB connection
mongosh "mongodb+srv://..."

# Check collections exist
db.users.countDocuments()
db.conversations.countDocuments()
db.auditlogs.countDocuments()

# Check indexes
db.auditlogs.getIndexes()
```

---

## Post-Deployment Verification

### Run Full Test Suite

```bash
# 1. Backend tests
cd backend
npm run test  # If you have Jest setup

# 2. Manual verification (see RBAC_TESTING_GUIDE.md)
# - Agent route restrictions
# - Conversation takeover
# - Real-time sync
# - Monitoring stats
```

### Performance Baselines

Monitor these metrics:

```
Backend:
- API response time: < 500ms
- Socket emission latency: < 100ms
- Database query time: < 100ms

Frontend:
- Page load time: < 3s
- React render time: < 100ms
- Socket connection time: < 2s

Database:
- Query execution: < 100ms
- Index efficiency: < 1000 scan/docs ratio
```

### Logging & Monitoring

```bash
# Backend logs
tail -f backend/logs/server.log

# Check for errors
grep -i error backend/logs/server.log

# Monitor socket connections
grep -i socket backend/logs/server.log

# Frontend logs
# Check browser console (F12 → Console)
```

---

## Rollback Procedure

If issues arise after deployment:

### Rollback Steps

1. **Stop current deployment**:
   ```bash
   # Backend
   kill -9 $(lsof -t -i:5000)
   
   # Frontend
   kill -9 $(lsof -t -i:3000)
   ```

2. **Revert to previous code**:
   ```bash
   git checkout previous-stable-commit
   ```

3. **Restart services**:
   ```bash
   # Backend
   cd backend && npm start
   
   # Frontend
   cd frontend && npm start
   ```

4. **Verify services**:
   ```bash
   curl http://localhost:5000/api/health
   curl http://localhost:3000
   ```

### Rollback Data

No data rollback needed as the system is backward compatible. However:

- Clear browser cache if UI issues persist
- Check database TTL indexes are still functioning
- Verify audit logs are still being recorded

---

## Production Checklist

### Security
- [ ] All API endpoints require authentication (`verifyToken`)
- [ ] Role-based access control enforced
- [ ] JWT secrets rotated and strong
- [ ] HTTPS/SSL enabled
- [ ] CORS configured properly
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints

### Performance
- [ ] Database indexes created
- [ ] Socket.io memory adapter (or Redis for scaling)
- [ ] CDN configured for static assets
- [ ] Caching headers set
- [ ] Compression enabled (gzip)
- [ ] Database connection pooling configured

### Monitoring
- [ ] Error tracking (Sentry, DataDog, etc.)
- [ ] Performance monitoring (New Relic, etc.)
- [ ] Uptime monitoring
- [ ] Database backup schedule
- [ ] Log aggregation (ELK, Splunk, etc.)

### Documentation
- [ ] API documentation updated
- [ ] Deployment documentation (this guide)
- [ ] Testing documentation (RBAC_TESTING_GUIDE.md)
- [ ] Runbook for common issues
- [ ] Change log updated

---

## Troubleshooting Deployment Issues

### Issue: Backend won't start

```bash
# Check port is not in use
lsof -i :5000

# Check MongoDB connection
mongosh "your-connection-string"

# Check environment variables
echo $MONGODB_URI
echo $JWT_SECRET
```

### Issue: Frontend build fails

```bash
# Clear dependencies
rm -rf node_modules
npm install

# Clear Next.js cache
rm -rf .next

# Try build again
npm run build
```

### Issue: Socket.io not connecting

```javascript
// Check browser console for errors
// Check backend logs for socket errors
// Verify CORS is configured

// Backend: Enable CORS for socket.io
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  }
});
```

### Issue: Real-time sync not working

```bash
# Check socket rooms are being joined
grep -i "joined tenant" backend/logs/server.log

# Verify user has ownerId
db.users.findOne({ email: 'agent@test.com' }, { ownerId: 1 })

# Check socket is emitting to correct room
grep -i "conversation_assigned" backend/logs/server.log
```

---

## Support & Escalation

### Critical Issues (Page Down)
1. Check backend health: `curl http://localhost:5000/api/health`
2. Check frontend health: `curl http://localhost:3000`
3. Check MongoDB connection
4. Review recent changes in `git log`

### High Priority Issues (Feature broken)
1. Check browser console for JavaScript errors
2. Check backend logs for API errors
3. Check database integrity
4. Verify user roles and permissions

### Medium Priority Issues (Slow response)
1. Check database query performance
2. Check socket.io latency
3. Monitor CPU and memory usage
4. Review recent schema changes

### Low Priority Issues (UI/UX)
1. Clear browser cache
2. Test in incognito/private mode
3. Check responsive design
4. Review CSS/styling code

---

## Maintenance & Updates

### Regular Tasks

**Daily**:
- [ ] Monitor error logs
- [ ] Check database size
- [ ] Verify socket connections

**Weekly**:
- [ ] Review audit logs
- [ ] Check database backup
- [ ] Monitor performance metrics

**Monthly**:
- [ ] Database optimization
- [ ] Security updates
- [ ] Dependency updates
- [ ] Performance review

### Scaling Considerations

As usage grows:

1. **Socket.io scaling**:
   ```bash
   # Add Redis adapter for multi-instance
   npm install socket.io-redis
   ```

2. **Database scaling**:
   - Enable MongoDB replication
   - Configure read replicas
   - Implement database sharding

3. **Frontend scaling**:
   - Deploy to CDN
   - Enable service workers
   - Implement lazy loading

---

## Contact & Support

For issues or questions:

1. **Check documentation**: RBAC_TESTING_GUIDE.md, this guide
2. **Review logs**: Backend logs, browser console, database logs
3. **Test in isolation**: Create test user, test feature manually
4. **Check GitHub issues**: Search for similar problems
5. **Contact maintainer**: Document issue and provide reproduction steps

---

## Success Metrics

After deployment, track these metrics:

- **System Uptime**: > 99.9%
- **API Response Time**: < 500ms average
- **Socket Latency**: < 100ms average
- **Error Rate**: < 0.1%
- **User Adoption**: % of users using takeover feature
- **Feature Engagement**: Conversation assignment rate
- **Audit Trail Coverage**: 100% of actions logged

---

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Version**: _______________  
**Notes**: _______________________________________________________________

---

✅ **Deployment Complete!**

Monitor logs and metrics for the first 24 hours. If all systems are stable, the deployment is successful.
