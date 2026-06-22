'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  ShoppingBag, ShoppingCart, Plus, Search, Edit3, Trash2, 
  Grid, List, Check, Archive, Copy, Image, X, Loader2, 
  ArrowUpDown, Filter, ChevronLeft, ChevronRight, User, AlertCircle
} from 'lucide-react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../lib/store';

export default function CatalogDashboard() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'cart' | 'manage'
  
  // Contacts/Customers context
  const [contacts, setContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  
  // Categories states
  const [categories, setCategories] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // Products Browse states
  const [products, setProducts] = useState([]);
  const [prodTotal, setProdTotal] = useState(0);
  const [prodPages, setProdPages] = useState(1);
  const [prodPage, setProdPage] = useState(1);
  const [prodLimit] = useState(8);
  const [prodLoading, setProdLoading] = useState(false);
  
  // Browse filter parameters
  const [searchVal, setSearchVal] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedFeatured, setSelectedFeatured] = useState(false);
  const [selectedSort, setSelectedSort] = useState('newest');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  
  // Product Detail Modal
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Manage/Admin tab states
  const [manageProducts, setManageProducts] = useState([]);
  const [managePage, setManagePage] = useState(1);
  const [managePages, setManagePages] = useState(1);
  const [manageTotal, setManageTotal] = useState(0);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Product Form states
  const [prodForm, setProdForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    price: '',
    discountPrice: '',
    sku: '',
    barcode: '',
    quantity: '0',
    lowStockThreshold: '5',
    isFeatured: false,
    tagsInput: ''
  });
  const [prodSaving, setProdSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Cart states
  const [cartItems, setCartItems] = useState([]);
  const [cartTotals, setCartTotals] = useState({ subtotal: 0, discount: 0, taxableAmount: 0, tax: 0, grandTotal: 0 });
  const [cartLoading, setCartLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Role utilities
  const isManagerOrAdmin = user && (
    ['superadmin', 'owner', 'admin'].includes(user.role) || 
    /manager/i.test(user.designation || '') || 
    /manager/i.test(user.department || '')
  );

  // Initial Load
  useEffect(() => {
    fetchCategories();
    fetchContacts();
  }, []);

  // Fetch products on filter/page updates
  useEffect(() => {
    if (activeTab === 'browse') {
      fetchProducts();
    } else if (activeTab === 'manage') {
      fetchManageProducts();
    }
  }, [activeTab, prodPage, selectedCategory, selectedStatus, selectedFeatured, selectedSort, managePage]);

  // Load cart when customer selection changes
  useEffect(() => {
    if (selectedContactId) {
      fetchCart();
    } else {
      setCartItems([]);
      setCartTotals({ subtotal: 0, discount: 0, taxableAmount: 0, tax: 0, grandTotal: 0 });
    }
  }, [selectedContactId]);

  const fetchContacts = async () => {
    try {
      const { data } = await api.get('/contacts?limit=100');
      if (data.success) {
        setContacts(data.data.contacts || []);
      }
    } catch (err) {
      console.error('Failed to load contacts');
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      if (data.success) {
        setCategories(data.data.categories || []);
      }
    } catch (err) {
      toast.error('Failed to load categories');
    }
  };

  const fetchProducts = async () => {
    setProdLoading(true);
    try {
      const params = {
        page: prodPage,
        limit: prodLimit,
        category: selectedCategory,
        status: selectedStatus,
        isFeatured: selectedFeatured ? 'true' : 'false',
        sort: selectedSort,
        search: searchVal
      };
      const { data } = await api.get('/products', { params });
      if (data.success) {
        setProducts(data.data.products);
        setProdTotal(data.data.pagination.total);
        setProdPages(data.data.pagination.pages);
      }
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setProdLoading(false);
    }
  };

  const fetchManageProducts = async () => {
    setProdLoading(true);
    try {
      const params = {
        page: managePage,
        limit: 10,
        includeArchived: 'true'
      };
      const { data } = await api.get('/products', { params });
      if (data.success) {
        setManageProducts(data.data.products);
        setManageTotal(data.data.pagination.total);
        setManagePages(data.data.pagination.pages);
      }
    } catch (err) {
      toast.error('Failed to load management catalog');
    } finally {
      setProdLoading(false);
    }
  };

  const fetchCart = async () => {
    setCartLoading(true);
    try {
      const { data } = await api.get(`/cart?customerId=${selectedContactId}`);
      if (data.success) {
        setCartItems(data.data.items);
        setCartTotals(data.data.totals);
      }
    } catch (err) {
      toast.error('Failed to retrieve cart items');
    } finally {
      setCartLoading(false);
    }
  };

  // Cart operations
  const handleAddToCart = async (productId, quantity = 1) => {
    if (!selectedContactId) {
      toast.error('Please select a customer context first (at the top of the page)');
      return;
    }
    try {
      const { data } = await api.post('/cart/add', {
        customerId: selectedContactId,
        productId,
        quantity
      });
      if (data.success) {
        toast.success('Product added to cart');
        fetchCart();
        if (selectedProduct) {
          // Refresh details stock
          const prodRes = await api.get(`/products/${selectedProduct._id}`);
          if (prodRes.data.success) {
            setSelectedProduct(prodRes.data.data.product);
          }
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add item to cart');
    }
  };

  const handleUpdateCartQty = async (productId, newQty) => {
    try {
      const { data } = await api.post('/cart/update', {
        customerId: selectedContactId,
        productId,
        quantity: newQty
      });
      if (data.success) {
        setCartItems(data.data.items);
        setCartTotals(data.data.totals);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update quantity');
    }
  };

  const handleRemoveCartItem = async (productId) => {
    try {
      const { data } = await api.post('/cart/remove', {
        customerId: selectedContactId,
        productId
      });
      if (data.success) {
        toast.success('Item removed from cart');
        setCartItems(data.data.items);
        setCartTotals(data.data.totals);
      }
    } catch (err) {
      toast.error('Failed to remove item');
    }
  };

  const handleClearCart = async () => {
    if (!window.confirm('Clear all items from this shopping cart?')) return;
    try {
      const { data } = await api.post('/cart/clear', { customerId: selectedContactId });
      if (data.success) {
        toast.success('Cart cleared');
        setCartItems([]);
        setCartTotals({ subtotal: 0, discount: 0, taxableAmount: 0, tax: 0, grandTotal: 0 });
      }
    } catch (err) {
      toast.error('Failed to clear cart');
    }
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    setCheckoutLoading(true);
    try {
      const { data } = await api.post('/cart/checkout', { customerId: selectedContactId });
      if (data.success) {
        toast.success(`Order created successfully! Order #: ${data.data.order.orderNumber}`);
        setCartItems([]);
        setCartTotals({ subtotal: 0, discount: 0, taxableAmount: 0, tax: 0, grandTotal: 0 });
        // Refresh product stock list
        fetchProducts();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Checkout allocation failed');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Category CRUD
  const handleOpenCatModal = (cat = null) => {
    setEditingCategory(cat);
    setCatName(cat ? cat.name : '');
    setCatDesc(cat ? cat.description : '');
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setCatSaving(true);
    try {
      if (editingCategory) {
        const { data } = await api.put(`/categories/${editingCategory._id}`, {
          name: catName,
          description: catDesc
        });
        if (data.success) {
          toast.success('Category updated');
          fetchCategories();
          setShowCategoryModal(false);
        }
      } else {
        const { data } = await api.post('/categories', {
          name: catName,
          description: catDesc
        });
        if (data.success) {
          toast.success('Category created');
          fetchCategories();
          setShowCategoryModal(false);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save category');
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      const { data } = await api.delete(`/categories/${catId}`);
      if (data.success) {
        toast.success('Category deleted');
        fetchCategories();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete category');
    }
  };

  // Product CRUD
  const handleOpenProductModal = (product = null) => {
    setEditingProduct(product);
    if (product) {
      setProdForm({
        name: product.name,
        description: product.description,
        categoryId: product.categoryId?._id || product.categoryId || '',
        price: product.price.toString(),
        discountPrice: product.discountPrice ? product.discountPrice.toString() : '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        quantity: product.quantity.toString(),
        lowStockThreshold: product.lowStockThreshold.toString(),
        isFeatured: !!product.isFeatured,
        tagsInput: product.tags ? product.tags.join(', ') : ''
      });
    } else {
      setProdForm({
        name: '',
        description: '',
        categoryId: categories[0]?._id || '',
        price: '',
        discountPrice: '',
        sku: '',
        barcode: '',
        quantity: '0',
        lowStockThreshold: '5',
        isFeatured: false,
        tagsInput: ''
      });
    }
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!prodForm.name.trim() || !prodForm.categoryId || !prodForm.price) return;
    setProdSaving(true);
    try {
      const payload = {
        ...prodForm,
        price: parseFloat(prodForm.price),
        discountPrice: prodForm.discountPrice ? parseFloat(prodForm.discountPrice) : null,
        quantity: parseInt(prodForm.quantity),
        lowStockThreshold: parseInt(prodForm.lowStockThreshold),
        tags: prodForm.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      };

      if (editingProduct) {
        const { data } = await api.put(`/products/${editingProduct._id}`, payload);
        if (data.success) {
          toast.success('Product updated');
          fetchManageProducts();
          fetchProducts();
          setShowProductModal(false);
        }
      } else {
        const { data } = await api.post('/products', payload);
        if (data.success) {
          toast.success('Product created');
          fetchManageProducts();
          fetchProducts();
          setShowProductModal(false);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save product');
    } finally {
      setProdSaving(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Delete this product and all associated images permanently?')) return;
    try {
      const { data } = await api.delete(`/products/${productId}`);
      if (data.success) {
        toast.success('Product deleted');
        fetchManageProducts();
        fetchProducts();
      }
    } catch (err) {
      toast.error('Failed to delete product');
    }
  };

  const handleDuplicateProduct = async (productId) => {
    try {
      const { data } = await api.post(`/products/${productId}/duplicate`);
      if (data.success) {
        toast.success('Product duplicated');
        fetchManageProducts();
      }
    } catch (err) {
      toast.error('Failed to duplicate product');
    }
  };

  const handleToggleArchiveProduct = async (productId) => {
    try {
      const { data } = await api.post(`/products/${productId}/archive`);
      if (data.success) {
        toast.success(data.data.product.isArchived ? 'Product archived' : 'Product unarchived');
        fetchManageProducts();
        fetchProducts();
      }
    } catch (err) {
      toast.error('Failed to archive product');
    }
  };

  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;
    setUploadingImage(true);
    
    const formData = new FormData();
    formData.append('image', file);

    try {
      const { data } = await api.post(`/products/${editingProduct._id}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        toast.success('Image uploaded successfully');
        // Refresh editing product image view
        const prodDetails = await api.get(`/products/${editingProduct._id}`);
        if (prodDetails.data.success) {
          setEditingProduct(prodDetails.data.data.product);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Image upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteProductImage = async (imageId) => {
    if (!window.confirm('Delete this image?')) return;
    try {
      const { data } = await api.delete(`/products/${editingProduct._id}/images/${imageId}`);
      if (data.success) {
        toast.success('Image removed');
        const prodDetails = await api.get(`/products/${editingProduct._id}`);
        if (prodDetails.data.success) {
          setEditingProduct(prodDetails.data.data.product);
        }
      }
    } catch (err) {
      toast.error('Failed to remove image');
    }
  };

  const handleSetPrimaryImage = async (imageId) => {
    try {
      const { data } = await api.post(`/products/${editingProduct._id}/images/${imageId}/primary`);
      if (data.success) {
        toast.success('Primary image updated');
        const prodDetails = await api.get(`/products/${editingProduct._id}`);
        if (prodDetails.data.success) {
          setEditingProduct(prodDetails.data.data.product);
        }
      }
    } catch (err) {
      toast.error('Failed to update primary image');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Upper header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-wa-border dark:border-wa-dark-border pb-5">
        <div>
          <h2 className="text-xl font-extrabold text-wa-text-primary dark:text-white tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-wa-green animate-pulse-dot" />
            <span>Product Catalog & Cart Panel</span>
          </h2>
          <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">
            Browse corporate catalog items, structure collections, and configure sales baskets for active chat leads.
          </p>
        </div>
        
        {/* Selected Customer Scope */}
        <div className="w-full md:w-80 p-3 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl flex items-center gap-3 shadow-sm hover:border-wa-green/30 transition-all">
          <div className="w-8 h-8 rounded-full bg-wa-green/10 text-wa-green flex items-center justify-center border border-wa-green/20">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-[9px] uppercase tracking-wider font-extrabold text-wa-text-secondary">Active Customer Basket</span>
            <select
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-wa-text-primary dark:text-white focus:outline-none cursor-pointer pr-4"
            >
              <option value="" className="dark:bg-wa-dark-panel">-- Select Customer --</option>
              {contacts.map(c => (
                <option key={c._id} value={c._id} className="dark:bg-wa-dark-panel">
                  {c.name || c.phone} {c.email ? `(${c.email})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-wa-border dark:border-wa-dark-border gap-1 bg-wa-search/30 dark:bg-wa-dark-panel/20 p-1.5 rounded-2xl">
        <button
          onClick={() => setActiveTab('browse')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'browse'
              ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-sm border border-wa-border dark:border-wa-dark-border'
              : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Browse Catalog</span>
        </button>

        <button
          onClick={() => setActiveTab('cart')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all relative ${
            activeTab === 'cart'
              ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-sm border border-wa-border dark:border-wa-dark-border'
              : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Shopping Cart</span>
          {cartItems.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-wa-green text-white text-[9px] font-extrabold flex items-center justify-center shadow animate-bounce">
              {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
            </span>
          )}
        </button>

        {isManagerOrAdmin && (
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'manage'
                ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-sm border border-wa-border dark:border-wa-dark-border'
                : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Manage Catalog & Categories</span>
          </button>
        )}
      </div>

      {/* Tab Contents: Browse Tab */}
      {activeTab === 'browse' && (
        <div className="space-y-5">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border p-4 rounded-2xl flex flex-col xl:flex-row gap-4 justify-between shadow-sm">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-wa-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name, SKU..."
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
                  className="w-full pl-9 pr-4 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-wa-green focus:border-wa-green"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setProdPage(1); }}
                className="px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>

              {/* Availability Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value); setProdPage(1); }}
                className="px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="">All Availability</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>

              {/* Featured Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 border border-wa-border dark:border-wa-dark-border rounded-xl bg-wa-bg dark:bg-wa-dark-header text-xs text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white">
                <input
                  type="checkbox"
                  checked={selectedFeatured}
                  onChange={(e) => { setSelectedFeatured(e.target.checked); setProdPage(1); }}
                  className="rounded text-wa-green focus:ring-wa-green w-3.5 h-3.5"
                />
                <span>Featured Only</span>
              </label>

              {/* Reset filter */}
              {(searchVal || selectedCategory || selectedStatus || selectedFeatured) && (
                <button
                  onClick={() => {
                    setSearchVal('');
                    setSelectedCategory('');
                    setSelectedStatus('');
                    setSelectedFeatured(false);
                    setProdPage(1);
                  }}
                  className="px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Sort & Grid/List View Controls */}
            <div className="flex items-center gap-3">
              <select
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value)}
                className="px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>

              <div className="flex border border-wa-border dark:border-wa-dark-border rounded-xl overflow-hidden shrink-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-wa-green text-white' : 'bg-wa-bg dark:bg-wa-dark-header text-wa-text-secondary hover:text-wa-text-primary'}`}
                  title="Grid View"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-wa-green text-white' : 'bg-wa-bg dark:bg-wa-dark-header text-wa-text-secondary hover:text-wa-text-primary'}`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Catalog grid */}
          {prodLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
              <span className="text-xs font-semibold text-wa-text-secondary">Fetching Catalog...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-16 text-center max-w-md mx-auto space-y-4">
              <ShoppingBag className="w-12 h-12 text-wa-text-light mx-auto opacity-35" />
              <div>
                <h3 className="font-extrabold text-wa-text-primary dark:text-white text-base">No Products Found</h3>
                <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">Try modifying your filter settings or search query keyword.</p>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map(product => {
                const primaryImage = product.images?.find(i => i.isPrimary) || product.images?.[0];
                const finalPrice = product.discountPrice !== null ? product.discountPrice : product.price;
                const hasDiscount = product.discountPrice !== null;
                const percentOff = hasDiscount ? Math.round(((product.price - product.discountPrice) / product.price) * 100) : 0;

                return (
                  <div 
                    key={product._id} 
                    className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl overflow-hidden hover:shadow-md transition-all flex flex-col h-full group"
                  >
                    {/* Image Box */}
                    <div className="relative pt-[75%] bg-wa-bg dark:bg-wa-dark-header border-b border-wa-border dark:border-wa-dark-border overflow-hidden cursor-pointer" onClick={() => { setSelectedProduct(product); setActiveImageIdx(0); }}>
                      {primaryImage ? (
                        <img 
                          src={primaryImage.imageUrl} 
                          alt={product.name} 
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-wa-text-light">
                          <Image className="w-8 h-8 opacity-30" />
                          <span className="text-[10px] uppercase font-bold tracking-wider">No Image</span>
                        </div>
                      )}
                      
                      {/* Featured ribbon */}
                      {product.isFeatured && (
                        <span className="absolute top-2.5 left-2.5 bg-wa-green text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded shadow">
                          Featured
                        </span>
                      )}

                      {/* Savings tag */}
                      {hasDiscount && (
                        <span className="absolute top-2.5 right-2.5 bg-red-500 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded shadow">
                          {percentOff}% OFF
                        </span>
                      )}
                    </div>

                    {/* Content Box */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3.5">
                      <div>
                        <span className="text-[9px] font-extrabold uppercase text-wa-text-secondary tracking-wider block mb-1">
                          {product.categoryId?.name || 'Uncategorized'}
                        </span>
                        <h4 className="font-extrabold text-wa-text-primary dark:text-white text-xs line-clamp-1 cursor-pointer hover:text-wa-green transition-colors" onClick={() => { setSelectedProduct(product); setActiveImageIdx(0); }}>
                          {product.name}
                        </h4>
                        {product.sku && (
                          <span className="text-[9px] text-wa-text-secondary font-mono block mt-0.5">
                            SKU: {product.sku}
                          </span>
                        )}
                        <p className="text-[11px] text-wa-text-secondary dark:text-wa-dark-text-secondary line-clamp-2 mt-2 leading-relaxed font-medium">
                          {product.description || 'No description provided.'}
                        </p>
                      </div>

                      {/* Stock Status Badge */}
                      <div className="flex items-center justify-between border-t border-wa-border dark:border-wa-dark-border pt-3">
                        <div>
                          {hasDiscount ? (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-sm font-extrabold text-wa-green">₹{finalPrice}</span>
                              <span className="text-[10px] text-wa-text-light line-through font-bold">₹{product.price}</span>
                            </div>
                          ) : (
                            <span className="text-sm font-extrabold text-wa-text-primary dark:text-white">₹{product.price}</span>
                          )}
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                          product.status === 'in_stock' 
                            ? 'bg-wa-green/10 text-wa-green border border-wa-green/20'
                            : product.status === 'low_stock'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                          {product.status === 'in_stock' ? 'In Stock' : product.status === 'low_stock' ? `Low (${product.quantity})` : 'Out of stock'}
                        </span>
                      </div>
                      
                      {/* Action */}
                      <button
                        onClick={() => handleAddToCart(product._id, 1)}
                        disabled={product.status === 'out_of_stock' || !selectedContactId}
                        className="w-full py-2 bg-wa-green hover:bg-wa-green-hover disabled:opacity-40 disabled:hover:bg-wa-green text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow shadow-wa-green/15"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Add to Cart</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View Layout */
            <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl overflow-hidden divide-y divide-wa-border dark:divide-wa-dark-border shadow-sm">
              {products.map(product => {
                const primaryImage = product.images?.find(i => i.isPrimary) || product.images?.[0];
                const finalPrice = product.discountPrice !== null ? product.discountPrice : product.price;
                const hasDiscount = product.discountPrice !== null;
                
                return (
                  <div key={product._id} className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 hover:bg-wa-search/10 dark:hover:bg-wa-dark-header/10 transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Image Thumbnail */}
                      <div className="w-14 h-14 rounded-xl bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border overflow-hidden shrink-0 cursor-pointer" onClick={() => { setSelectedProduct(product); setActiveImageIdx(0); }}>
                        {primaryImage ? (
                          <img src={primaryImage.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-wa-text-light">
                            <Image className="w-5 h-5 opacity-30" />
                          </div>
                        )}
                      </div>
                      
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-wa-text-primary dark:text-white text-xs cursor-pointer hover:text-wa-green transition-colors" onClick={() => { setSelectedProduct(product); setActiveImageIdx(0); }}>
                            {product.name}
                          </h4>
                          {product.isFeatured && (
                            <span className="bg-wa-green/10 text-wa-green text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded border border-wa-green/10">Featured</span>
                          )}
                        </div>
                        <span className="text-[10px] text-wa-text-secondary block mt-0.5">
                          {product.categoryId?.name || 'Uncategorized'} {product.sku && `• SKU: ${product.sku}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Price info */}
                      <div className="text-right">
                        {hasDiscount ? (
                          <div className="flex flex-col items-end">
                            <span className="text-xs text-wa-text-light line-through font-bold">₹{product.price}</span>
                            <span className="text-xs font-extrabold text-wa-green">₹{finalPrice}</span>
                          </div>
                        ) : (
                          <span className="text-xs font-extrabold text-wa-text-primary dark:text-white">₹{product.price}</span>
                        )}
                      </div>

                      {/* Stock Level */}
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                        product.status === 'in_stock' 
                          ? 'bg-wa-green/10 text-wa-green border border-wa-green/20'
                          : product.status === 'low_stock'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : 'bg-red-500/10 text-red-500 border border-red-500/20'
                      }`}>
                        {product.status === 'in_stock' ? 'In Stock' : product.status === 'low_stock' ? `Low (${product.quantity})` : 'Out of stock'}
                      </span>

                      {/* Add to Cart button */}
                      <button
                        onClick={() => handleAddToCart(product._id, 1)}
                        disabled={product.status === 'out_of_stock' || !selectedContactId}
                        className="p-2.5 bg-wa-green hover:bg-wa-green-hover disabled:opacity-40 disabled:hover:bg-wa-green text-white rounded-xl transition-colors shadow shadow-wa-green/15"
                        title="Add to Cart"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {prodPages > 1 && (
            <div className="flex items-center justify-between border-t border-wa-border dark:border-wa-dark-border pt-5">
              <span className="text-[11px] text-wa-text-secondary">
                Showing Page <strong>{prodPage}</strong> of <strong>{prodPages}</strong> (Total: {prodTotal} products)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setProdPage(prev => Math.max(prev - 1, 1))}
                  disabled={prodPage === 1}
                  className="p-1.5 border border-wa-border dark:border-wa-dark-border rounded-lg bg-white dark:bg-wa-dark-panel hover:bg-wa-hover disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setProdPage(prev => Math.min(prev + 1, prodPages))}
                  disabled={prodPage === prodPages}
                  className="p-1.5 border border-wa-border dark:border-wa-dark-border rounded-lg bg-white dark:bg-wa-dark-panel hover:bg-wa-hover disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: Shopping Cart Tab */}
      {activeTab === 'cart' && (
        <div className="space-y-6">
          {!selectedContactId ? (
            <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-16 text-center max-w-md mx-auto space-y-4">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto opacity-70" />
              <div>
                <h3 className="font-extrabold text-wa-text-primary dark:text-white text-base">Select Customer Context</h3>
                <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">
                  Use the dropdown at the top right of the page to select a customer and load their shopping cart.
                </p>
              </div>
            </div>
          ) : cartLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
              <span className="text-xs font-semibold text-wa-text-secondary">Loading Cart...</span>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-16 text-center max-w-md mx-auto space-y-4 shadow-sm animate-fade-in">
              <ShoppingCart className="w-12 h-12 text-wa-text-light mx-auto opacity-35" />
              <div>
                <h3 className="font-extrabold text-wa-text-primary dark:text-white text-base">Shopping Cart is Empty</h3>
                <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">
                  Add products to this cart from the **Browse Catalog** tab to prepare a quote or sales transaction.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Items List */}
              <div className="flex-1 w-full bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-panel-header dark:bg-wa-dark-panel-header">
                  <h3 className="font-bold text-xs text-wa-text-primary dark:text-white uppercase tracking-wider">Cart Items</h3>
                  <button 
                    onClick={handleClearCart}
                    className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Cart</span>
                  </button>
                </div>
                
                <div className="divide-y divide-wa-border dark:divide-wa-dark-border">
                  {cartItems.map(item => (
                    <div key={item._id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Product details info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-wa-bg dark:bg-wa-dark-header border border-wa-border overflow-hidden shrink-0">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-wa-text-light">
                              <Image className="w-5 h-5 opacity-30" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-wa-text-primary dark:text-white truncate">{item.name}</h4>
                          <span className="text-[10px] text-wa-text-secondary block mt-0.5">
                            SKU: {item.sku || 'N/A'} • Unit: ₹{item.unitPrice}
                          </span>
                        </div>
                      </div>

                      {/* Quantity controls & Subtotal */}
                      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                        <div className="flex items-center border border-wa-border dark:border-wa-dark-border rounded-xl bg-wa-bg dark:bg-wa-dark-header overflow-hidden">
                          <button
                            onClick={() => handleUpdateCartQty(item.productId, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="px-3 py-1.5 font-bold hover:bg-wa-hover text-wa-text-secondary disabled:opacity-30"
                          >
                            -
                          </button>
                          <span className="px-3 text-xs font-bold text-wa-text-primary dark:text-white">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateCartQty(item.productId, item.quantity + 1)}
                            disabled={item.quantity >= item.availableQuantity}
                            className="px-3 py-1.5 font-bold hover:bg-wa-hover text-wa-text-secondary disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right w-20">
                          <span className="text-xs font-bold text-wa-text-primary dark:text-white block">₹{item.totalPrice}</span>
                        </div>

                        <button
                          onClick={() => handleRemoveCartItem(item.productId)}
                          className="p-2 border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-light hover:text-red-500 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary Billing Side */}
              <div className="w-full lg:w-96 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl overflow-hidden shadow-sm p-5 space-y-4">
                <h3 className="font-extrabold text-xs text-wa-text-primary dark:text-white uppercase tracking-wider pb-2 border-b border-wa-border dark:border-wa-dark-border">
                  Order Summary
                </h3>

                <div className="space-y-2.5 text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary">
                  <div className="flex justify-between">
                    <span>Catalog Subtotal</span>
                    <span className="font-bold text-wa-text-primary dark:text-white">₹{cartTotals.subtotal}</span>
                  </div>

                  {cartTotals.discount > 0 && (
                    <div className="flex justify-between text-wa-green">
                      <span>Discount Reductions</span>
                      <span className="font-bold">-₹{cartTotals.discount}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Taxable Amount</span>
                    <span className="font-bold text-wa-text-primary dark:text-white">₹{cartTotals.taxableAmount}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Estimated Tax (18% GST)</span>
                    <span className="font-bold text-wa-text-primary dark:text-white">₹{cartTotals.tax}</span>
                  </div>

                  <div className="h-px bg-wa-border dark:bg-wa-dark-border my-2"></div>

                  <div className="flex justify-between text-sm font-extrabold text-wa-text-primary dark:text-white">
                    <span>Grand Total</span>
                    <span className="text-wa-green">₹{cartTotals.grandTotal}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading || cartItems.length === 0}
                  className="w-full py-3 bg-wa-green hover:bg-wa-green-hover disabled:opacity-40 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-wa-green/20"
                >
                  {checkoutLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Checkout & Create Order</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: Manage Tab */}
      {activeTab === 'manage' && isManagerOrAdmin && (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            
            {/* Products Table Dashboard */}
            <div className="flex-1 w-full bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-panel-header dark:bg-wa-dark-panel-header">
                <h3 className="font-bold text-xs text-wa-text-primary dark:text-white uppercase tracking-wider">Catalog Directory</h3>
                <button 
                  onClick={() => handleOpenProductModal(null)}
                  className="px-4 py-2 bg-wa-green hover:bg-wa-green-hover text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Product
                </button>
              </div>

              {manageProducts.length === 0 ? (
                <div className="p-16 text-center text-wa-text-secondary italic text-xs">No products logged in database catalog.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-wa-border dark:border-wa-dark-border bg-wa-search/10 dark:bg-wa-dark-header/20 font-extrabold text-wa-text-secondary">
                        <th className="p-3">Product Name</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3">Price</th>
                        <th className="p-3">Quantity</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-wa-border dark:divide-wa-dark-border">
                      {manageProducts.map(p => (
                        <tr key={p._id} className={`hover:bg-wa-hover/30 dark:hover:bg-wa-dark-hover/20 ${p.isArchived ? 'opacity-50 bg-wa-search/5' : ''}`}>
                          <td className="p-3 font-bold text-wa-text-primary dark:text-white">
                            <span className="block">{p.name}</span>
                            {p.isArchived && <span className="inline-block mt-0.5 text-[8px] font-bold bg-amber-500/10 text-amber-500 uppercase px-1 rounded">Archived</span>}
                            {p.isFeatured && <span className="inline-block mt-0.5 ml-1 text-[8px] font-bold bg-wa-green/10 text-wa-green uppercase px-1 rounded">Featured</span>}
                          </td>
                          <td className="p-3 capitalize">{p.categoryId?.name || 'Uncategorized'}</td>
                          <td className="p-3 font-mono">{p.sku || '-'}</td>
                          <td className="p-3 font-semibold text-wa-text-primary dark:text-white">₹{p.price}</td>
                          <td className="p-3 font-mono">{p.quantity}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                              p.status === 'in_stock' 
                                ? 'bg-wa-green/10 text-wa-green border border-wa-green/20'
                                : p.status === 'low_stock'
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                : 'bg-red-500/10 text-red-500 border border-red-500/20'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-1 shrink-0">
                            <button onClick={() => handleOpenProductModal(p)} className="p-1.5 rounded-lg border border-wa-border dark:border-wa-dark-border text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20" title="Edit product"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDuplicateProduct(p._id)} className="p-1.5 rounded-lg border border-wa-border dark:border-wa-dark-border text-wa-green hover:bg-wa-green/5" title="Duplicate product"><Copy className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleToggleArchiveProduct(p._id)} className="p-1.5 rounded-lg border border-wa-border dark:border-wa-dark-border text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20" title={p.isArchived ? 'Unarchive' : 'Archive'}><Archive className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteProduct(p._id)} className="p-1.5 rounded-lg border border-wa-border dark:border-wa-dark-border text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20" title="Delete product"><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Manage Pagination */}
              {managePages > 1 && (
                <div className="p-4 border-t border-wa-border dark:border-wa-dark-border flex justify-between items-center">
                  <span className="text-[10px] text-wa-text-secondary">Total: {manageTotal} products</span>
                  <div className="flex gap-1">
                    <button onClick={() => setManagePage(prev => Math.max(prev - 1, 1))} disabled={managePage === 1} className="p-1 border rounded disabled:opacity-50"><ChevronLeft className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setManagePage(prev => Math.min(prev + 1, managePages))} disabled={managePage === managePages} className="p-1 border rounded disabled:opacity-50"><ChevronRight className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )}
            </div>

            {/* Categories Management Side */}
            <div className="w-full lg:w-96 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-panel-header dark:bg-wa-dark-panel-header">
                <h3 className="font-bold text-xs text-wa-text-primary dark:text-white uppercase tracking-wider">Product Categories</h3>
                <button 
                  onClick={() => handleOpenCatModal(null)}
                  className="p-1 bg-wa-green hover:bg-wa-green-hover text-white rounded"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-wa-border dark:divide-wa-dark-border max-h-[500px] overflow-y-auto scrollbar-thin">
                {categories.length === 0 ? (
                  <div className="p-8 text-center text-wa-text-secondary italic text-xs">No categories created.</div>
                ) : (
                  categories.map(cat => (
                    <div key={cat._id} className="p-3 flex items-center justify-between hover:bg-wa-hover/20 transition-colors">
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-wa-text-primary dark:text-white capitalize">{cat.name}</h4>
                        <p className="text-[10px] text-wa-text-secondary truncate mt-0.5">{cat.description || 'No description'}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => handleOpenCatModal(cat)} className="p-1 hover:text-blue-500"><Edit3 className="w-3 h-3" /></button>
                        <button onClick={() => handleDeleteCategory(cat._id)} className="p-1 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Category CRUD Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveCategory} className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-md overflow-hidden shadow-wa-lg animate-fade-in flex flex-col">
            <div className="px-5 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-panel-header dark:bg-wa-dark-panel-header">
              <h3 className="font-bold text-sm text-wa-text-primary dark:text-white">
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </h3>
              <button type="button" onClick={() => setShowCategoryModal(false)} className="text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-wa-text-secondary uppercase">Category Name</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white"
                  placeholder="Electronics, Apparel, etc."
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-wa-text-secondary uppercase">Description</label>
                <textarea
                  rows="3"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white resize-none"
                  placeholder="Short description of this group..."
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-wa-border dark:border-wa-dark-border flex justify-end gap-2 shrink-0">
              <button type="button" onClick={() => setShowCategoryModal(false)} className="px-4 py-2 border rounded-xl font-bold text-wa-text-secondary">Cancel</button>
              <button type="submit" disabled={catSaving} className="px-4 py-2 bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-1">
                {catSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Save Category</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Product CRUD Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-wa-lg my-8 flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-panel-header dark:bg-wa-dark-panel-header shrink-0">
              <h3 className="font-bold text-sm text-wa-text-primary dark:text-white">
                {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add Catalog Product'}
              </h3>
              <button type="button" onClick={() => setShowProductModal(false)} className="text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Content Split: Form & Image Manager */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col md:flex-row gap-6 min-h-0">
              
              {/* Product Info Form */}
              <form onSubmit={handleSaveProduct} className="flex-1 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <label className="block font-bold text-wa-text-secondary uppercase">Product Name</label>
                    <input
                      type="text" required value={prodForm.name}
                      onChange={(e) => setProdForm({...prodForm, name: e.target.value})}
                      className="w-full px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white font-semibold"
                      placeholder="e.g. iPhone 15 Pro Max"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-wa-text-secondary uppercase">Category</label>
                    <select
                      required value={prodForm.categoryId}
                      onChange={(e) => setProdForm({...prodForm, categoryId: e.target.value})}
                      className="w-full px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white font-semibold cursor-pointer"
                    >
                      {categories.map(c => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-wa-text-secondary uppercase">SKU</label>
                    <input
                      type="text" value={prodForm.sku}
                      onChange={(e) => setProdForm({...prodForm, sku: e.target.value})}
                      className="w-full px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white font-mono"
                      placeholder="e.g. APP-IPH15-PRO"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-wa-text-secondary uppercase">Price (₹)</label>
                    <input
                      type="number" required min="0" step="0.01" value={prodForm.price}
                      onChange={(e) => setProdForm({...prodForm, price: e.target.value})}
                      className="w-full px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white font-bold"
                      placeholder="e.g. 139900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-wa-text-secondary uppercase">Discount Price (₹)</label>
                    <input
                      type="number" min="0" step="0.01" value={prodForm.discountPrice}
                      onChange={(e) => setProdForm({...prodForm, discountPrice: e.target.value})}
                      className="w-full px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white font-bold text-wa-green"
                      placeholder="e.g. 129900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-wa-text-secondary uppercase">Quantity in Stock</label>
                    <input
                      type="number" required min="0" value={prodForm.quantity}
                      onChange={(e) => setProdForm({...prodForm, quantity: e.target.value})}
                      className="w-full px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-wa-text-secondary uppercase">Low Stock Threshold</label>
                    <input
                      type="number" required min="0" value={prodForm.lowStockThreshold}
                      onChange={(e) => setProdForm({...prodForm, lowStockThreshold: e.target.value})}
                      className="w-full px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-wa-text-secondary uppercase">Description</label>
                  <textarea
                    rows="3" value={prodForm.description}
                    onChange={(e) => setProdForm({...prodForm, description: e.target.value})}
                    className="w-full px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white resize-none"
                    placeholder="Enter key details, technical specs, and highlights..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-wa-text-secondary uppercase">Barcode</label>
                    <input
                      type="text" value={prodForm.barcode}
                      onChange={(e) => setProdForm({...prodForm, barcode: e.target.value})}
                      className="w-full px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white font-mono"
                      placeholder="e.g. 190198453255"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="block font-bold text-wa-text-secondary uppercase">Tags (comma-separated)</label>
                    <input
                      type="text" value={prodForm.tagsInput}
                      onChange={(e) => setProdForm({...prodForm, tagsInput: e.target.value})}
                      className="w-full px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white"
                      placeholder="Apple, Premium, iOS"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox" checked={prodForm.isFeatured}
                      onChange={(e) => setProdForm({...prodForm, isFeatured: e.target.checked})}
                      className="rounded text-wa-green focus:ring-wa-green w-4 h-4"
                    />
                    <span className="font-bold text-wa-text-primary dark:text-white">Featured Product</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 border-t border-wa-border dark:border-wa-dark-border pt-4">
                  <button type="button" onClick={() => setShowProductModal(false)} className="px-4 py-2 border rounded-xl font-bold text-wa-text-secondary">Cancel</button>
                  <button type="submit" disabled={prodSaving} className="px-4 py-2 bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-1">
                    {prodSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Product</span>
                  </button>
                </div>
              </form>

              {/* Image Manager */}
              <div className="w-full md:w-72 border-l border-wa-border dark:border-wa-dark-border pl-0 md:pl-6 space-y-4">
                <h4 className="text-[10px] font-extrabold uppercase text-wa-text-secondary tracking-wider">Product Images</h4>
                
                {editingProduct ? (
                  <div className="space-y-4">
                    {/* Upload control */}
                    <div className="relative group border-2 border-dashed border-wa-border dark:border-wa-dark-border rounded-2xl p-4 text-center hover:border-wa-green/45 transition-colors cursor-pointer bg-wa-search/10 dark:bg-wa-dark-header/20">
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        disabled={uploadingImage}
                        onChange={handleUploadImage}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      {uploadingImage ? (
                        <Loader2 className="w-6 h-6 animate-spin text-wa-green mx-auto" />
                      ) : (
                        <Image className="w-6 h-6 text-wa-text-secondary mx-auto group-hover:scale-105 transition-transform" />
                      )}
                      <span className="block text-[10px] font-bold text-wa-text-primary dark:text-white mt-1.5">Click to upload JPG, PNG, WEBP</span>
                    </div>

                    {/* Image list */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin divide-y divide-wa-border/50">
                      {editingProduct.images && editingProduct.images.length > 0 ? (
                        editingProduct.images.map(img => (
                          <div key={img._id} className="pt-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <img src={img.imageUrl} alt="thumbnail" className="w-10 h-10 object-cover rounded border" />
                              {img.isPrimary && (
                                <span className="bg-wa-green/10 text-wa-green text-[7px] font-extrabold uppercase px-1 rounded border border-wa-green/20">Primary</span>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {!img.isPrimary && (
                                <button 
                                  onClick={() => handleSetPrimaryImage(img._id)}
                                  className="p-1 text-[9px] font-bold text-wa-green hover:underline"
                                >
                                  Make Primary
                                </button>
                              )}
                              <button 
                                onClick={() => handleDeleteProductImage(img._id)}
                                className="p-1 text-wa-text-light hover:text-red-500"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-[10px] text-wa-text-light italic text-center py-4">No images uploaded.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-wa-search/5 dark:bg-wa-dark-header/10 p-5 rounded-2xl border text-center text-[10px] text-wa-text-secondary">
                    Create the product details first to enable image uploading and management features.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Details & Image Viewer Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-4xl overflow-hidden shadow-wa-lg animate-fade-in flex flex-col md:flex-row h-[75vh]">
            
            {/* Left: Image gallery */}
            <div className="w-full md:w-1/2 bg-wa-bg dark:bg-wa-dark-header flex flex-col p-6 justify-between border-b md:border-b-0 md:border-r border-wa-border dark:border-wa-dark-border h-1/2 md:h-full">
              <div className="flex-1 relative flex items-center justify-center min-h-0">
                {selectedProduct.images && selectedProduct.images.length > 0 ? (
                  <img
                    src={selectedProduct.images[activeImageIdx]?.imageUrl}
                    alt={selectedProduct.name}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-wa-text-light">
                    <Image className="w-12 h-12 opacity-30" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">No Image Available</span>
                  </div>
                )}
              </div>
              
              {/* Carousel thumbnails */}
              {selectedProduct.images && selectedProduct.images.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto py-2 shrink-0 justify-center">
                  {selectedProduct.images.map((img, idx) => (
                    <button
                      key={img._id}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`w-12 h-12 rounded-lg border overflow-hidden shrink-0 ${activeImageIdx === idx ? 'border-wa-green ring-2 ring-wa-green/20' : 'border-wa-border'}`}
                    >
                      <img src={img.imageUrl} alt="thumb" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Info & Checkout options */}
            <div className="w-full md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto h-1/2 md:h-full">
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase text-wa-text-secondary tracking-wider block mb-1">
                      {selectedProduct.categoryId?.name || 'Uncategorized'}
                    </span>
                    <h3 className="font-extrabold text-wa-text-primary dark:text-white text-base leading-tight">
                      {selectedProduct.name}
                    </h3>
                    {selectedProduct.sku && (
                      <span className="text-[10px] text-wa-text-secondary font-mono block mt-1">
                        SKU: {selectedProduct.sku}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="p-1 rounded-full hover:bg-wa-hover text-wa-text-secondary">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {selectedProduct.discountPrice !== null ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-extrabold text-wa-green">₹{selectedProduct.discountPrice}</span>
                      <span className="text-xs text-wa-text-light line-through font-bold">₹{selectedProduct.price}</span>
                      <span className="bg-red-500/10 text-red-500 text-[9px] font-extrabold px-1.5 py-0.2 rounded border border-red-500/20">
                        {Math.round(((selectedProduct.price - selectedProduct.discountPrice) / selectedProduct.price) * 100)}% OFF
                      </span>
                    </div>
                  ) : (
                    <span className="text-lg font-extrabold text-wa-text-primary dark:text-white">₹{selectedProduct.price}</span>
                  )}
                </div>

                {/* Stock Tag */}
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                    selectedProduct.status === 'in_stock' 
                      ? 'bg-wa-green/10 text-wa-green border border-wa-green/20'
                      : selectedProduct.status === 'low_stock'
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      : 'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}>
                    {selectedProduct.status === 'in_stock' ? 'In Stock' : selectedProduct.status === 'low_stock' ? `Low stock (${selectedProduct.quantity})` : 'Out of Stock'}
                  </span>
                  {selectedProduct.barcode && (
                    <span className="text-[10px] text-wa-text-secondary font-mono">Barcode: {selectedProduct.barcode}</span>
                  )}
                </div>

                <div className="h-px bg-wa-border dark:bg-wa-dark-border"></div>

                <div className="space-y-1 text-xs">
                  <h4 className="font-extrabold text-wa-text-secondary uppercase">Product Details</h4>
                  <p className="text-wa-text-primary dark:text-wa-dark-text-secondary leading-relaxed whitespace-pre-wrap font-medium">
                    {selectedProduct.description || 'No detailed specifications logged.'}
                  </p>
                </div>

                {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                  <div className="space-y-1.5 text-xs">
                    <h4 className="font-extrabold text-wa-text-secondary uppercase">Product Tags</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProduct.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-wa-bg dark:bg-wa-dark-header border rounded-full text-[10px] text-wa-text-secondary font-semibold">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-wa-border dark:border-wa-dark-border pt-4 mt-6">
                <button
                  onClick={() => handleAddToCart(selectedProduct._id, 1)}
                  disabled={selectedProduct.status === 'out_of_stock' || !selectedContactId}
                  className="w-full py-3 bg-wa-green hover:bg-wa-green-hover disabled:opacity-40 disabled:hover:bg-wa-green text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow shadow-wa-green/20"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Add to Customer Basket</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
