const router = require('express').Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');

router.use(verifyToken);

// Middleware to restrict category modifications to Admins and Managers
function requireAdminOrManager(req, res, next) {
  const privilege = req.user.role;
  const isManager = 
    (req.user.designation && /manager/i.test(req.user.designation)) || 
    (req.user.department && /manager/i.test(req.user.department));
  const isAdminOrManager = ['superadmin', 'owner', 'admin'].includes(privilege) || isManager;
  if (!isAdminOrManager) {
    return res.status(403).json({ success: false, error: 'Unauthorized. Only admins and managers can perform this action.' });
  }
  next();
}

// GET /api/categories — list all categories for the organization
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ organizationId: req.organizationId }).sort('name').lean();
    res.json({ success: true, data: { categories } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch categories', details: error.message });
  }
});

// POST /api/categories — create a category (RBAC: Admin or Manager only)
router.post('/', requireAdminOrManager, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    const normalizedName = name.trim();

    // Check duplicate name inside the same organization
    const existing = await Category.findOne({
      organizationId: req.organizationId,
      name: { $regex: new RegExp(`^${normalizedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
    });

    if (existing) {
      return res.status(400).json({ success: false, error: 'Category already exists' });
    }

    const category = await Category.create({
      organizationId: req.organizationId,
      userId: req.userId,
      name: normalizedName,
      description: (description || '').trim(),
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, data: { category }, message: 'Category created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create category', details: error.message });
  }
});

// PUT /api/categories/:id — update a category (RBAC: Admin or Manager only)
router.put('/:id', ...validateObjectId('id'), requireAdminOrManager, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const category = await Category.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    if (name !== undefined) {
      const normalizedName = name.trim();
      if (!normalizedName) {
        return res.status(400).json({ success: false, error: 'Category name cannot be empty' });
      }

      if (normalizedName.toLowerCase() !== category.name.toLowerCase()) {
        // Prevent duplicate name
        const duplicate = await Category.findOne({
          organizationId: req.organizationId,
          name: { $regex: new RegExp(`^${normalizedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        });
        if (duplicate) {
          return res.status(400).json({ success: false, error: 'Category name already exists' });
        }
      }
      category.name = normalizedName;
    }

    if (description !== undefined) {
      category.description = description.trim();
    }

    await category.save();
    res.json({ success: true, data: { category }, message: 'Category updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update category', details: error.message });
  }
});

// DELETE /api/categories/:id — delete a category (RBAC: Admin or Manager only)
router.delete('/:id', ...validateObjectId('id'), requireAdminOrManager, async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    // Prevent deletion if products exist under this category
    const productsCount = await Product.countDocuments({
      categoryId: category._id,
      organizationId: req.organizationId
    });

    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category. It contains ${productsCount} active product(s).`
      });
    }

    await Category.deleteOne({ _id: category._id });
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete category', details: error.message });
  }
});

module.exports = router;
