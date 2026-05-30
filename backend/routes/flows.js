const router = require('express').Router();
const BotFlow = require('../models/BotFlow');
const Conversation = require('../models/Conversation');
const AuditLog = require('../models/AuditLog');
const { verifyToken } = require('../middleware/auth');
const { flowValidation, validateObjectId } = require('../middleware/validator');

router.use(verifyToken);

// GET /flows
router.get('/', async (req, res) => {
  try {
    const flows = await BotFlow.find({ userId: req.userId }).sort('-updatedAt').lean();
    res.json({ success: true, data: { flows } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch flows', code: 'FETCH_ERROR' });
  }
});

// POST /flows — create
router.post('/', flowValidation, async (req, res) => {
  try {
    const { name, description, trigger, nodes } = req.body;

    // Validate node IDs are unique
    const nodeIds = nodes.map((n) => n.id);
    if (new Set(nodeIds).size !== nodeIds.length) {
      return res.status(400).json({ success: false, error: 'Node IDs must be unique', code: 'DUPLICATE_NODE_ID' });
    }

    // Validate edges reference valid nodes
    for (const node of nodes) {
      for (const edge of node.edges || []) {
        if (!nodeIds.includes(edge.targetNodeId)) {
          return res.status(400).json({
            success: false,
            error: `Edge in node ${node.id} points to invalid target: ${edge.targetNodeId}`,
            code: 'INVALID_EDGE',
          });
        }
      }
    }

    const flow = await BotFlow.create({
      userId: req.userId,
      name,
      description,
      trigger: trigger || { type: 'keyword', keywords: [] },
      nodes,
      entryNodeId: nodes[0]?.id,
      isActive: false,
    });

    res.status(201).json({ success: true, data: { flow }, message: 'Flow created' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create flow', code: 'CREATE_ERROR' });
  }
});

// PUT /flows/:id — update
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const flow = await BotFlow.findOne({ _id: req.params.id, userId: req.userId });
    if (!flow) return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });

    const { name, description, trigger, nodes } = req.body;
    if (name) flow.name = name;
    if (description !== undefined) flow.description = description;
    if (trigger) flow.trigger = trigger;
    if (nodes) {
      flow.nodes = nodes;
      flow.entryNodeId = nodes[0]?.id;
    }
    await flow.save();

    res.json({ success: true, data: { flow }, message: 'Flow updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Update failed', code: 'UPDATE_ERROR' });
  }
});

// POST /flows/:id/activate
router.post('/:id/activate', ...validateObjectId('id'), async (req, res) => {
  try {
    const flow = await BotFlow.findOne({ _id: req.params.id, userId: req.userId });
    if (!flow) return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });

    // Deactivate conflicting triggers
    if (flow.trigger.type === 'any') {
      await BotFlow.updateMany({ userId: req.userId, _id: { $ne: flow._id }, 'trigger.type': 'any' }, { isActive: false });
    } else if (flow.trigger.type === 'keyword' && flow.trigger.keywords?.length) {
      await BotFlow.updateMany({
        userId: req.userId,
        _id: { $ne: flow._id },
        'trigger.type': 'keyword',
        'trigger.keywords': { $in: flow.trigger.keywords },
      }, { isActive: false });
    }

    flow.isActive = true;
    await flow.save();

    await AuditLog.log({ userId: req.userId, action: 'ACTIVATE_FLOW', resource: 'BotFlow', resourceId: req.params.id, ip: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ success: true, message: 'Flow activated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Activation failed', code: 'ACTIVATE_ERROR' });
  }
});

// POST /flows/:id/deactivate
router.post('/:id/deactivate', ...validateObjectId('id'), async (req, res) => {
  try {
    const flow = await BotFlow.findOne({ _id: req.params.id, userId: req.userId });
    if (!flow) return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });

    flow.isActive = false;
    await flow.save();

    await AuditLog.log({ userId: req.userId, action: 'DEACTIVATE_FLOW', resource: 'BotFlow', resourceId: req.params.id, ip: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ success: true, message: 'Flow deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Deactivation failed', code: 'DEACTIVATE_ERROR' });
  }
});

// POST /flows/:id/test — simulate flow
router.post('/:id/test', ...validateObjectId('id'), async (req, res) => {
  try {
    const flow = await BotFlow.findOne({ _id: req.params.id, userId: req.userId });
    if (!flow) return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });

    const { simulatedResponses = [] } = req.body;
    const executionLog = [];
    const variables = {};
    let currentNode = flow.nodes.find((n) => n.id === flow.entryNodeId) || flow.nodes[0];
    let responseIdx = 0;

    while (currentNode && executionLog.length < 50) {
      const step = { nodeId: currentNode.id, type: currentNode.type, action: '' };

      switch (currentNode.type) {
        case 'message':
          step.action = `Send: ${currentNode.data?.message?.text || '[media]'}`;
          executionLog.push(step);
          currentNode = flow.nodes.find((n) => n.id === currentNode.edges?.[0]?.targetNodeId);
          break;

        case 'question':
          step.action = `Ask: ${currentNode.data?.message?.text || ''}`;
          const answer = simulatedResponses[responseIdx++] || 'test_answer';
          step.userResponse = answer;
          if (currentNode.data?.variable) variables[currentNode.data.variable] = answer;
          executionLog.push(step);
          currentNode = flow.nodes.find((n) => n.id === currentNode.edges?.[0]?.targetNodeId);
          break;

        case 'condition':
          const v = variables[currentNode.data?.condition?.variable] || '';
          const passes = v.toLowerCase().includes((currentNode.data?.condition?.value || '').toLowerCase());
          step.action = `Condition: ${currentNode.data?.condition?.variable} → ${passes ? 'true' : 'false'}`;
          executionLog.push(step);
          const edge = passes ? currentNode.edges?.[0] : currentNode.edges?.[1];
          currentNode = edge ? flow.nodes.find((n) => n.id === edge.targetNodeId) : null;
          break;

        case 'delay':
          step.action = `Delay: ${currentNode.data?.delaySeconds || 0}s`;
          executionLog.push(step);
          currentNode = flow.nodes.find((n) => n.id === currentNode.edges?.[0]?.targetNodeId);
          break;

        case 'handoff':
          step.action = 'Handoff to human agent';
          executionLog.push(step);
          currentNode = null;
          break;

        case 'action':
          step.action = `Action: ${JSON.stringify(currentNode.data?.action || {})}`;
          executionLog.push(step);
          currentNode = flow.nodes.find((n) => n.id === currentNode.edges?.[0]?.targetNodeId);
          break;

        case 'ai':
          step.action = `AI Response (prompt: ${currentNode.data?.aiPrompt || 'default'})`;
          executionLog.push(step);
          currentNode = flow.nodes.find((n) => n.id === currentNode.edges?.[0]?.targetNodeId);
          break;

        default:
          executionLog.push({ ...step, action: 'Unknown node type' });
          currentNode = null;
      }
    }

    res.json({ success: true, data: { executionLog, variables }, message: 'Flow test complete' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Test failed', code: 'TEST_ERROR' });
  }
});

// GET /flows/:id
router.get('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const flow = await BotFlow.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!flow) return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
    res.json({ success: true, data: { flow } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Fetch failed', code: 'FETCH_ERROR' });
  }
});

// DELETE /flows/:id
router.delete('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const flow = await BotFlow.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!flow) return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
    res.json({ success: true, message: 'Flow deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Delete failed', code: 'DELETE_ERROR' });
  }
});

module.exports = router;
