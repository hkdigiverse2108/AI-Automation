const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Product = require('../models/Product');
const Category = require('../models/Category');
const ProductImage = require('../models/ProductImage');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');
const cloudinaryService = require('../services/cloudinaryService');
const { createNotification } = require('../services/notificationService');

router.use(verifyToken);

// Configure multer storage for local file uploads fallback
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: cloudinaryService.isConfigured() ? multer.memoryStorage() : storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper to determine if user has Admin or Manager privileges
function getUserPrivilege(user) {
  const privilege = user.role;
  const isManager = 
    (user.designation && /manager/i.test(user.designation)) || 
    (user.department && /manager/i.test(user.department));
  const isAdminOrManager = ['superadmin', 'owner', 'admin'].includes(privilege) || isManager;
  return { isAdminOrManager, isManager };
}

function requireAdminOrManager(req, res, next) {
  const { isAdminOrManager } = getUserPrivilege(req.user);
  if (!isAdminOrManager) {
    return res.status(403).json({ success: false, error: 'Unauthorized. Only admins and managers can perform this action.' });
  }
  next();
}

// Notify all Admins/Managers in organization about stock events
async function dispatchStockNotification(req, product, eventType) {
  try {
    const orgUsers = await User.find({ organizationId: req.organizationId, isDeleted: false });
    const title = eventType === 'out_of_stock' ? 'Out of Stock Alert 🚨' : 'Low Stock Alert ⚠️';
    const message = eventType === 'out_of_stock'
      ? `Product "${product.name}" has run out of stock.`
      : `Product "${product.name}" is low in stock (${product.quantity} left).`;

    for (const u of orgUsers) {
      const { isAdminOrManager } = getUserPrivilege(u);
      if (isAdminOrManager) {
        await createNotification({
          userId: u._id,
          organizationId: req.organizationId,
          type: 'system',
          title,
          message,
          link: '/dashboard/catalog',
          metadata: { productId: product._id, sku: product.sku }
        });
      }
    }
  } catch (err) {
    console.error('Failed to dispatch stock notification:', err.message);
  }
}

// GET /api/products — list products (paginated, filtered, sorted)
router.get('/', async (req, res) => {
  try {
    const { category, minPrice, maxPrice, status, isFeatured, search, sort, page = 1, limit = 10, includeArchived = 'false' } = req.query;

    const query = { organizationId: req.organizationId };

    // Filtering
    if (includeArchived !== 'true') {
      query.isArchived = false;
    }
    if (category) {
      query.categoryId = category;
    }
    if (status) {
      query.status = status;
    }
    if (isFeatured === 'true') {
      query.isFeatured = true;
    }
    
    // Price boundary filters
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Keyword text search
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { sku: regex }, { description: regex }];
    }

    // Sorting
    let sortQuery = { createdAt: -1 }; // default: newest
    if (sort === 'oldest') {
      sortQuery = { createdAt: 1 };
    } else if (sort === 'price_asc') {
      sortQuery = { price: 1 };
    } else if (sort === 'price_desc') {
      sortQuery = { price: -1 };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('categoryId', 'name')
      .sort(sortQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Map images to products
    const productIds = products.map(p => p._id);
    const allImages = await ProductImage.find({ productId: { $in: productIds } }).lean();

    const formattedProducts = products.map(product => {
      const images = allImages
        .filter(img => img.productId.toString() === product._id.toString())
        .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)); // Primary image first
      
      return {
        ...product,
        images
      };
    });

    res.json({
      success: true,
      data: {
        products: formattedProducts,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch products', details: error.message });
  }
});

// GET /api/products/:id — fetch single product details
router.get('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    }).populate('categoryId', 'name').lean();

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const images = await ProductImage.find({ productId: product._id })
      .sort({ isPrimary: -1, createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: {
        product: {
          ...product,
          images
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch product details', details: error.message });
  }
});

// POST /api/products — add product (RBAC: Admin or Manager only)
router.post('/', requireAdminOrManager, async (req, res) => {
  try {
    const { name, description, categoryId, price, discountPrice, sku, barcode, quantity, lowStockThreshold, isFeatured, tags } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Product name is required' });
    if (!categoryId) return res.status(400).json({ success: false, error: 'Category ID is required' });
    if (price === undefined || parseFloat(price) < 0) return res.status(400).json({ success: false, error: 'Valid price is required' });

    // Validate category exists in this organization
    const category = await Category.findOne({ _id: categoryId, organizationId: req.organizationId });
    if (!category) return res.status(400).json({ success: false, error: 'Invalid category' });

    // Prevent duplicate name inside the same organization
    const duplicate = await Product.findOne({
      organizationId: req.organizationId,
      name: { $regex: new RegExp(`^${name.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
    });
    if (duplicate) return res.status(400).json({ success: false, error: 'Product name already exists' });

    const product = new Product({
      organizationId: req.organizationId,
      userId: req.userId,
      categoryId,
      name: name.trim(),
      description: (description || '').trim(),
      price: parseFloat(price),
      discountPrice: discountPrice !== undefined && discountPrice !== null ? parseFloat(discountPrice) : null,
      sku: (sku || '').trim(),
      barcode: (barcode || '').trim(),
      quantity: quantity !== undefined ? parseInt(quantity) : 0,
      lowStockThreshold: lowStockThreshold !== undefined ? parseInt(lowStockThreshold) : 5,
      isFeatured: !!isFeatured,
      tags: Array.isArray(tags) ? tags : [],
      createdBy: req.user._id
    });

    await product.save();

    // Trigger stock notifications if added with low stock
    if (product.quantity === 0) {
      await dispatchStockNotification(req, product, 'out_of_stock');
    } else if (product.quantity <= product.lowStockThreshold) {
      await dispatchStockNotification(req, product, 'low_stock');
    }

    // Trigger audit notification
    await createNotification({
      userId: req.user._id,
      organizationId: req.organizationId,
      type: 'system',
      title: 'Product Added 📦',
      message: `Product "${product.name}" was added by ${req.user.name}.`,
      link: '/dashboard/catalog',
      metadata: { productId: product._id }
    });

    res.status(201).json({ success: true, data: { product }, message: 'Product created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create product', details: error.message });
  }
});

// PUT /api/products/:id — update product details (RBAC: Admin or Manager only)
router.put('/:id', ...validateObjectId('id'), requireAdminOrManager, async (req, res) => {
  try {
    const updates = req.body;
    const product = await Product.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    // Validate category if updating
    if (updates.categoryId) {
      const category = await Category.findOne({ _id: updates.categoryId, organizationId: req.organizationId });
      if (!category) return res.status(400).json({ success: false, error: 'Invalid category' });
      product.categoryId = updates.categoryId;
    }

    if (updates.name !== undefined) {
      const cleanName = updates.name.trim();
      if (!cleanName) return res.status(400).json({ success: false, error: 'Product name cannot be empty' });
      if (cleanName.toLowerCase() !== product.name.toLowerCase()) {
        const duplicate = await Product.findOne({
          organizationId: req.organizationId,
          name: { $regex: new RegExp(`^${cleanName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        });
        if (duplicate) return res.status(400).json({ success: false, error: 'Product name already exists' });
      }
      product.name = cleanName;
    }

    if (updates.price !== undefined) product.price = parseFloat(updates.price);
    if (updates.discountPrice !== undefined) product.discountPrice = updates.discountPrice !== null ? parseFloat(updates.discountPrice) : null;
    if (updates.description !== undefined) product.description = (updates.description || '').trim();
    if (updates.sku !== undefined) product.sku = (updates.sku || '').trim();
    if (updates.barcode !== undefined) product.barcode = (updates.barcode || '').trim();
    if (updates.isFeatured !== undefined) product.isFeatured = !!updates.isFeatured;
    if (updates.tags !== undefined) product.tags = Array.isArray(updates.tags) ? updates.tags : [];
    if (updates.lowStockThreshold !== undefined) product.lowStockThreshold = parseInt(updates.lowStockThreshold);

    // Track stock level transitions to trigger alerts without duplication
    const oldQty = product.quantity;
    const oldThreshold = product.lowStockThreshold;

    if (updates.quantity !== undefined) {
      product.quantity = parseInt(updates.quantity);
    }

    const qtyChanged = product.quantity !== oldQty;
    const thresholdChanged = product.lowStockThreshold !== oldThreshold;

    await product.save();

    // Trigger stock notification only on transitions
    if (qtyChanged || thresholdChanged) {
      const isNowOut = product.quantity === 0;
      const wasOut = oldQty === 0;
      const isNowLow = product.quantity <= product.lowStockThreshold;
      const wasLow = oldQty <= oldThreshold;

      if (isNowOut && !wasOut) {
        await dispatchStockNotification(req, product, 'out_of_stock');
      } else if (isNowLow && !wasLow && !isNowOut) {
        await dispatchStockNotification(req, product, 'low_stock');
      }
    }

    // Trigger audit notification
    await createNotification({
      userId: req.user._id,
      organizationId: req.organizationId,
      type: 'system',
      title: 'Product Updated 📦',
      message: `Product "${product.name}" details updated by ${req.user.name}.`,
      link: '/dashboard/catalog',
      metadata: { productId: product._id }
    });

    res.json({ success: true, data: { product }, message: 'Product updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update product', details: error.message });
  }
});

// DELETE /api/products/:id — delete product (RBAC: Admin or Manager only)
router.delete('/:id', ...validateObjectId('id'), requireAdminOrManager, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    // Delete product images
    await ProductImage.deleteMany({ productId: product._id });
    
    // Delete product document
    await Product.deleteOne({ _id: product._id });

    // Trigger audit notification
    await createNotification({
      userId: req.user._id,
      organizationId: req.organizationId,
      type: 'system',
      title: 'Product Deleted 🗑️',
      message: `Product "${product.name}" was deleted by ${req.user.name}.`,
      link: '/dashboard/catalog',
      metadata: { sku: product.sku }
    });

    res.json({ success: true, message: 'Product and images deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete product', details: error.message });
  }
});

// POST /api/products/:id/duplicate — duplicate a product (RBAC: Admin or Manager only)
router.post('/:id/duplicate', ...validateObjectId('id'), requireAdminOrManager, async (req, res) => {
  try {
    const original = await Product.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!original) return res.status(404).json({ success: false, error: 'Product not found' });

    // Find unique name
    let suffix = 1;
    let newName = `${original.name} (Copy)`;
    let nameUnique = false;

    while (!nameUnique) {
      const dup = await Product.findOne({ organizationId: req.organizationId, name: newName });
      if (!dup) {
        nameUnique = true;
      } else {
        suffix++;
        newName = `${original.name} (Copy ${suffix})`;
      }
    }

    const duplicated = new Product({
      organizationId: req.organizationId,
      userId: req.userId,
      categoryId: original.categoryId,
      name: newName,
      description: original.description,
      price: original.price,
      discountPrice: original.discountPrice,
      sku: original.sku ? `${original.sku}-copy-${suffix}` : '',
      barcode: original.barcode,
      quantity: original.quantity,
      lowStockThreshold: original.lowStockThreshold,
      isFeatured: original.isFeatured,
      tags: original.tags,
      createdBy: req.user._id
    });

    await duplicated.save();

    // Duplicate images
    const originalImages = await ProductImage.find({ productId: original._id });
    for (const img of originalImages) {
      await ProductImage.create({
        productId: duplicated._id,
        imageUrl: img.imageUrl,
        isPrimary: img.isPrimary
      });
    }

    res.status(201).json({ success: true, data: { product: duplicated }, message: 'Product duplicated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to duplicate product', details: error.message });
  }
});

// POST /api/products/:id/archive — toggle archive status (RBAC: Admin or Manager only)
router.post('/:id/archive', ...validateObjectId('id'), requireAdminOrManager, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    product.isArchived = !product.isArchived;
    await product.save();

    res.json({
      success: true,
      data: { product },
      message: product.isArchived ? 'Product archived' : 'Product unarchived'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to archive product', details: error.message });
  }
});

// POST /api/products/:id/images — upload and attach an image to product (RBAC: Admin or Manager only)
router.post('/:id/images', ...validateObjectId('id'), requireAdminOrManager, upload.single('image'), async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (!req.file) return res.status(400).json({ success: false, error: 'No image file uploaded' });

    let imageUrl = '';
    if (cloudinaryService.isConfigured()) {
      imageUrl = await cloudinaryService.uploadStream(req.file.buffer, 'product_images', 'image', req.file.originalname);
    } else {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    // Check if it is the first image, if so set as primary
    const existingCount = await ProductImage.countDocuments({ productId: product._id });
    const isPrimary = existingCount === 0;

    const productImage = await ProductImage.create({
      productId: product._id,
      imageUrl,
      isPrimary
    });

    res.status(201).json({ success: true, data: { image: productImage }, message: 'Image uploaded successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Image upload failed', details: error.message });
  }
});

// DELETE /api/products/:id/images/:imageId — remove an image from product (RBAC: Admin or Manager only)
router.delete('/:id/images/:imageId', ...validateObjectId('id', 'imageId'), requireAdminOrManager, async (req, res) => {
  try {
    const { id, imageId } = req.params;

    const product = await Product.findOne({ _id: id, organizationId: req.organizationId });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    const img = await ProductImage.findOne({ _id: imageId, productId: product._id });
    if (!img) return res.status(404).json({ success: false, error: 'Image not found' });

    const wasPrimary = img.isPrimary;
    await ProductImage.deleteOne({ _id: img._id });

    // If we deleted the primary image, make the oldest remaining image primary
    if (wasPrimary) {
      const nextPrimary = await ProductImage.findOne({ productId: product._id }).sort('createdAt');
      if (nextPrimary) {
        nextPrimary.isPrimary = true;
        await nextPrimary.save();
      }
    }

    res.json({ success: true, message: 'Image removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove image', details: error.message });
  }
});

// POST /api/products/:id/images/:imageId/primary — set an image as primary (RBAC: Admin or Manager only)
router.post('/:id/images/:imageId/primary', ...validateObjectId('id', 'imageId'), requireAdminOrManager, async (req, res) => {
  try {
    const { id, imageId } = req.params;

    const product = await Product.findOne({ _id: id, organizationId: req.organizationId });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    const targetImg = await ProductImage.findOne({ _id: imageId, productId: product._id });
    if (!targetImg) return res.status(404).json({ success: false, error: 'Image not found' });

    // Unmark all other images as primary
    await ProductImage.updateMany({ productId: product._id }, { $set: { isPrimary: false } });

    targetImg.isPrimary = true;
    await targetImg.save();

    res.json({ success: true, message: 'Primary image set successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to set primary image', details: error.message });
  }
});

module.exports = router;
