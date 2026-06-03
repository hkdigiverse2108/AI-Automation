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

const PRE_BUILT_TEMPLATES = [
  {
    name: "🏠 House Builder / Construction Company Workflow",
    description: "A complete pre-built conversational flow for House Construction, Renovations, and Interior Design in English + Gujarati.",
    trigger: {
      type: "keyword",
      keywords: ["house", "builder", "construction", "interior", "renovation", "ઘર", "બાંધકામ", "રિનોવેશન", "ઇન્ટિરિયર", "home", "expert"]
    },
    nodes: [
      {
        id: "node_hb_welcome",
        type: "question",
        position: { x: 500, y: 50 },
        data: {
          variable: "selected_service",
          message: {
            type: "list",
            body: "Hello 👋 Welcome to {{Company Name}}\n\nWe help customers with:\n\n🏠 House Construction\n🏢 Commercial Construction\n🎨 Interior Design\n🔨 Renovation Work\n\nનમસ્તે 👋 {{Company Name}} માં આપનું સ્વાગત છે.\n\nઅમે નીચેની સેવાઓ પ્રદાન કરીએ છીએ:\n\n🏠 ઘર બાંધકામ\n🏢 કોમર્શિયલ બાંધકામ\n🎨 ઇન્ટિરિયર ડિઝાઇન\n🔨 રિનોવેશન\n\nPlease select an option:\nકૃપા કરીને એક વિકલ્પ પસંદ કરો:",
            sections: [
              {
                title: "Services / સેવાઓ",
                rows: [
                  { id: "service_new_house", title: "New House Construction", description: "નવું ઘર બાંધકામ" },
                  { id: "service_renovation", title: "Renovation Work", description: "રિનોવેશન કામ" },
                  { id: "service_interior", title: "Interior Design", description: "ઇન્ટિરિયર ડિઝાઇન" },
                  { id: "service_expert", title: "Talk to Expert", description: "નિષ્ણાત સાથે વાત કરો" }
                ]
              }
            ]
          }
        },
        edges: [
          { targetNodeId: "node_hb_new_house_plot", label: "service_new_house, 1, 1️⃣, new house construction, નવું ઘર બાંધકામ" },
          { targetNodeId: "node_hb_reno_type", label: "service_renovation, 2, 2️⃣, renovation work, રિનોવેશન કામ" },
          { targetNodeId: "node_hb_interior_service", label: "service_interior, 3, 3️⃣, interior design, ઇન્ટિરિયર ડિઝાઇન" },
          { targetNodeId: "node_hb_expert", label: "service_expert, 4, 4️⃣, talk to expert, નિષ્ણાત સાથે વાત કરો" }
        ]
      },
      // --- New House Construction Branch ---
      {
        id: "node_hb_new_house_plot",
        type: "question",
        position: { x: 100, y: 250 },
        data: {
          variable: "plot_size",
          message: {
            type: "list",
            body: "Great! 🏠\n\nWhat is your plot size?\nતમારા પ્લોટનું કદ શું છે?",
            sections: [
              {
                title: "Plot Size / પ્લોટનું કદ",
                rows: [
                  { id: "plot_under_100", title: "Under 100 Sq Yard" },
                  { id: "plot_100_200", title: "100-200 Sq Yard" },
                  { id: "plot_200_500", title: "200-500 Sq Yard" },
                  { id: "plot_above_500", title: "Above 500 Sq Yard" }
                ]
              }
            ]
          }
        },
        edges: [{ targetNodeId: "node_hb_new_house_budget", label: "" }]
      },
      {
        id: "node_hb_new_house_budget",
        type: "question",
        position: { x: 100, y: 450 },
        data: {
          variable: "budget",
          message: {
            type: "list",
            body: "What is your estimated budget?\nતમારું અંદાજિત બજેટ કેટલું છે?",
            sections: [
              {
                title: "Budget / બજેટ",
                rows: [
                  { id: "budget_under_10", title: "Under ₹10 Lakh" },
                  { id: "budget_10_25", title: "₹10-25 Lakh" },
                  { id: "budget_25_50", title: "₹25-50 Lakh" },
                  { id: "budget_above_50", title: "Above ₹50 Lakh" }
                ]
              }
            ]
          }
        },
        edges: [{ targetNodeId: "node_hb_new_house_type", label: "" }]
      },
      {
        id: "node_hb_new_house_type",
        type: "question",
        position: { x: 100, y: 650 },
        data: {
          variable: "construction_type",
          message: {
            type: "list",
            body: "Which type of construction do you need?\nતમને કયા પ્રકારનું બાંધકામ જોઈએ છે?",
            sections: [
              {
                title: "Type / પ્રકાર",
                rows: [
                  { id: "type_bungalow", title: "Bungalow" },
                  { id: "type_villa", title: "Villa" },
                  { id: "type_duplex", title: "Duplex" },
                  { id: "type_apartment", title: "Apartment" }
                ]
              }
            ]
          }
        },
        edges: [{ targetNodeId: "node_hb_new_house_city", label: "" }]
      },
      {
        id: "node_hb_new_house_city",
        type: "question",
        position: { x: 100, y: 850 },
        data: {
          variable: "city",
          message: {
            type: "list",
            body: "Which city is your project located in?\nતમારો પ્રોજેક્ટ કયા શહેરમાં આવેલો છે?",
            sections: [
              {
                title: "City / શહેર",
                rows: [
                  { id: "city_ahmedabad", title: "Ahmedabad" },
                  { id: "city_surat", title: "Surat" },
                  { id: "city_rajkot", title: "Rajkot" },
                  { id: "city_other", title: "Other City" }
                ]
              }
            ]
          }
        },
        edges: [{ targetNodeId: "node_hb_new_house_visit", label: "" }]
      },
      {
        id: "node_hb_new_house_visit",
        type: "question",
        position: { x: 100, y: 1050 },
        data: {
          variable: "site_visit",
          message: {
            type: "buttons",
            text: "Would you like a FREE site visit?\nશું તમને મફત સાઇટ વિઝિટ જોઈએ છે?",
            buttons: [
              { id: "visit_yes", title: "Yes" },
              { id: "visit_no", title: "No" }
            ]
          }
        },
        edges: [
          { targetNodeId: "node_hb_new_house_visit_time", label: "visit_yes, Yes, yes" },
          { targetNodeId: "node_hb_new_house_action_tag_no", label: "visit_no, No, no" }
        ]
      },
      {
        id: "node_hb_new_house_visit_time",
        type: "question",
        position: { x: -50, y: 1250 },
        data: {
          variable: "visit_time",
          message: {
            type: "list",
            body: "When would you like the visit?",
            sections: [
              {
                title: "Visit Time / મુલાકાત",
                rows: [
                  { id: "time_tomorrow", title: "Tomorrow" },
                  { id: "time_this_week", title: "This Week" },
                  { id: "time_next_week", title: "Next Week" },
                  { id: "time_call_first", title: "Call Me First" }
                ]
              }
            ]
          }
        },
        edges: [{ targetNodeId: "node_hb_new_house_action_tag_yes", label: "" }]
      },
      {
        id: "node_hb_new_house_action_tag_yes",
        type: "action",
        position: { x: -50, y: 1450 },
        data: {
          action: { type: "tag", tag: "New House Construction" }
        },
        edges: [{ targetNodeId: "node_hb_new_house_confirm_yes", label: "" }]
      },
      {
        id: "node_hb_new_house_action_tag_no",
        type: "action",
        position: { x: 250, y: 1250 },
        data: {
          action: { type: "tag", tag: "New House Construction" }
        },
        edges: [{ targetNodeId: "node_hb_new_house_confirm_no", label: "" }]
      },
      {
        id: "node_hb_new_house_confirm_yes",
        type: "message",
        position: { x: -50, y: 1650 },
        data: {
          message: {
            type: "text",
            text: "Thank you 🙏\n\nYour request has been submitted successfully.\n\nઆપની માહિતી સફળતાપૂર્વક નોંધાઈ ગઈ છે.\n\nLead Summary\n\n🏠 Plot Size: {{plot_size}}\n💰 Budget: {{budget}}\n🏗 Construction Type: {{construction_type}}\n📍 City: {{city}}\n📅 Visit Time: {{visit_time}}\n\nOur construction expert will contact you shortly.\n\nઅમારા નિષ્ણાત ટૂંક સમયમાં આપનો સંપર્ક કરશે."
          }
        },
        edges: [{ targetNodeId: "node_hb_handoff", label: "" }]
      },
      {
        id: "node_hb_new_house_confirm_no",
        type: "message",
        position: { x: 250, y: 1450 },
        data: {
          message: {
            type: "text",
            text: "Thank you 🙏\n\nYour request has been submitted successfully.\n\nઆપની માહિતી સફળતાપૂર્વક નોંધાઈ ગઈ છે.\n\nLead Summary\n\n🏠 Plot Size: {{plot_size}}\n💰 Budget: {{budget}}\n🏗 Construction Type: {{construction_type}}\n📍 City: {{city}}\n📅 Visit Time: No Visit Requested / મુલાકાત જરૂરી નથી\n\nOur construction expert will contact you shortly.\n\nઅમારા નિષ્ણાત ટૂંક સમયમાં આપનો સંપર્ક કરશે."
          }
        },
        edges: [{ targetNodeId: "node_hb_handoff", label: "" }]
      },

      // --- Renovation Work Branch ---
      {
        id: "node_hb_reno_type",
        type: "question",
        position: { x: 500, y: 250 },
        data: {
          variable: "renovation_type",
          message: {
            type: "list",
            body: "What kind of renovation service do you need?\nતમારે કયા પ્રકારની રિનોવેશન સેવાની જરૂર છે?",
            sections: [
              {
                title: "Renovation / પ્રકાર",
                rows: [
                  { id: "reno_full", title: "Full Home Renovation" },
                  { id: "reno_kitchen", title: "Kitchen Renovation" },
                  { id: "reno_bathroom", title: "Bathroom Renovation" },
                  { id: "reno_office", title: "Office Renovation" }
                ]
              }
            ]
          }
        },
        edges: [{ targetNodeId: "node_hb_reno_size", label: "" }]
      },
      {
        id: "node_hb_reno_size",
        type: "question",
        position: { x: 500, y: 450 },
        data: {
          variable: "property_size",
          message: {
            type: "list",
            body: "Property Size?\nમિલકતનું કદ?",
            sections: [
              {
                title: "Property Size / કદ",
                rows: [
                  { id: "size_1bhk", title: "1 BHK" },
                  { id: "size_2bhk", title: "2 BHK" },
                  { id: "size_3bhk", title: "3 BHK" },
                  { id: "size_comm", title: "Commercial" }
                ]
              }
            ]
          }
        },
        edges: [{ targetNodeId: "node_hb_reno_budget", label: "" }]
      },
      {
        id: "node_hb_reno_budget",
        type: "question",
        position: { x: 500, y: 650 },
        data: {
          variable: "budget",
          message: {
            type: "list",
            body: "Estimated budget?\nઅંદાજિત બજેટ કેટલું છે?",
            sections: [
              {
                title: "Budget / બજેટ",
                rows: [
                  { id: "budget_under_1", title: "Under ₹1 Lakh" },
                  { id: "budget_1_5", title: "₹1-5 Lakh" },
                  { id: "budget_5_10", title: "₹5-10 Lakh" },
                  { id: "budget_above_10", title: "Above ₹10 Lakh" }
                ]
              }
            ]
          }
        },
        edges: [{ targetNodeId: "node_hb_reno_action_tag", label: "" }]
      },
      {
        id: "node_hb_reno_action_tag",
        type: "action",
        position: { x: 500, y: 850 },
        data: {
          action: { type: "tag", tag: "Renovation Work" }
        },
        edges: [{ targetNodeId: "node_hb_reno_confirm", label: "" }]
      },
      {
        id: "node_hb_reno_confirm",
        type: "message",
        position: { x: 500, y: 1050 },
        data: {
          message: {
            type: "text",
            text: "Thank you 🙏\n\nYour renovation request has been submitted successfully.\n\nઆપની રિનોવેશન માહિતી સફળતાપૂર્વક નોંધાઈ ગઈ છે.\n\nLead Summary\n\n🔨 Renovation Type: {{renovation_type}}\n🏠 Property Size: {{property_size}}\n💰 Budget: {{budget}}\n\nOur construction expert will contact you shortly.\n\nઅમારા નિષ્ણાત ટૂંક સમયમાં આપનો સંપર્ક કરશે."
          }
        },
        edges: [{ targetNodeId: "node_hb_handoff", label: "" }]
      },

      // --- Interior Design Branch ---
      {
        id: "node_hb_interior_service",
        type: "question",
        position: { x: 900, y: 250 },
        data: {
          variable: "interior_service",
          message: {
            type: "list",
            body: "Which service do you need?\nતમને કઈ સેવાની જરૂર છે?",
            sections: [
              {
                title: "Interior Service / સેવા",
                rows: [
                  { id: "int_kitchen", title: "Modular Kitchen" },
                  { id: "int_bedroom", title: "Bedroom Design" },
                  { id: "int_living", title: "Living Room Design" },
                  { id: "int_full", title: "Full Home Interior" }
                ]
              }
            ]
          }
        },
        edges: [{ targetNodeId: "node_hb_interior_size", label: "" }]
      },
      {
        id: "node_hb_interior_size",
        type: "question",
        position: { x: 900, y: 450 },
        data: {
          variable: "property_size",
          message: {
            type: "list",
            body: "Property Size?\nમિલકતનું કદ?",
            sections: [
              {
                title: "Property Size / કદ",
                rows: [
                  { id: "size_1bhk_int", title: "1 BHK" },
                  { id: "size_2bhk_int", title: "2 BHK" },
                  { id: "size_3bhk_int", title: "3 BHK" },
                  { id: "size_villa_int", title: "Villa" }
                ]
              }
            ]
          }
        },
        edges: [{ targetNodeId: "node_hb_interior_budget", label: "" }]
      },
      {
        id: "node_hb_interior_budget",
        type: "question",
        position: { x: 900, y: 650 },
        data: {
          variable: "budget",
          message: {
            type: "list",
            body: "Budget?\nબજેટ?",
            sections: [
              {
                title: "Budget / બજેટ",
                rows: [
                  { id: "budget_under_2_int", title: "Under ₹2 Lakh" },
                  { id: "budget_2_5_int", title: "₹2-5 Lakh" },
                  { id: "budget_5_10_int", title: "₹5-10 Lakh" },
                  { id: "budget_above_10_int", title: "Above ₹10 Lakh" }
                ]
              }
            ]
          }
        },
        edges: [{ targetNodeId: "node_hb_interior_action_tag", label: "" }]
      },
      {
        id: "node_hb_interior_action_tag",
        type: "action",
        position: { x: 900, y: 850 },
        data: {
          action: { type: "tag", tag: "Interior Design" }
        },
        edges: [{ targetNodeId: "node_hb_interior_confirm", label: "" }]
      },
      {
        id: "node_hb_interior_confirm",
        type: "message",
        position: { x: 900, y: 1050 },
        data: {
          message: {
            type: "text",
            text: "Thank you 🙏\n\nYour interior design request has been submitted successfully.\n\nઆપની ઇન્ટિરિયર ડિઝાઇનની માહિતી સફળતાપૂર્વક નોંધાઈ ગઈ છે.\n\nLead Summary\n\n🎨 Interior Service: {{interior_service}}\n🏠 Property Size: {{property_size}}\n💰 Budget: {{budget}}\n\nOur construction expert will contact you shortly.\n\nઅમારા નિષ્ણાત ટૂંક સમયમાં આપનો સંપર્ક કરશે."
          }
        },
        edges: [{ targetNodeId: "node_hb_handoff", label: "" }]
      },

      // --- Talk to Expert Branch ---
      {
        id: "node_hb_expert",
        type: "message",
        position: { x: 1300, y: 250 },
        data: {
          message: {
            type: "text",
            text: "Thank you.\n\nOne of our experts will contact you shortly.\n\nઆભાર.\n\nઅમારા નિષ્ણાત ટૂંક સમયમાં આપનો સંપર્ક કરશે."
          }
        },
        edges: [{ targetNodeId: "node_hb_handoff", label: "" }]
      },

      // --- Shared Handoff / Assign Node ---
      {
        id: "node_hb_handoff",
        type: "handoff",
        position: { x: 700, y: 1900 },
        edges: []
      }
    ]
  }
];

// GET /flows/templates — pre-built workflow templates library
router.get('/templates', async (req, res) => {
  try {
    res.json({ success: true, data: { templates: PRE_BUILT_TEMPLATES } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch templates', code: 'FETCH_TEMPLATES_ERROR' });
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
