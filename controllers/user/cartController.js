const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Wishlist = require("../../models/wishlistSchema");
const Cart = require("../../models/cartSchema");




const getCartPage = async (req, res) => {

  try {

    const userId = req.session.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.redirect("/login");
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.render("cart", { 
        user, 
        cartItems: [],
        total: 0 });
    }

    const cartItems = cart.items;
    const total = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);

    res.render("cart", {
       user, 
       cartItems, 
       total 
      })

  } catch (error) {

    console.log("Error in getCartPage", error);
    res.redirect("/pageNotFound");

  }
};

const addToCart = async (req, res) => {

  try {

    const userId = req.session.user;
    const { productId, quantity } = req.body;

    const product = await Product.findById(productId);
  
    if (product.quantity < quantity) {

      return res.status(400).json({ message: `Only ${product.quantity} items left in stock` });

    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {

      cart = new Cart({ 
        userId, 
        items: [] 
      });

    }

    const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);

    if (itemIndex > -1) {

      const newQuantity = cart.items[itemIndex].quantity + parseInt(quantity);

      if (newQuantity > product.quantity) {

        return res.status(400).json({ message: `Cannot add more. Only ${product.quantity} items left in stock` });

      }

      cart.items[itemIndex].quantity = newQuantity;
      cart.items[itemIndex].totalPrice = newQuantity * cart.items[itemIndex].price;

    } else {

        cart.items.push({
        productId,
        quantity: parseInt(quantity),
        price: product.salePrice,
        totalPrice: product.salePrice * parseInt(quantity),
      });
    }

    await cart.save();

    const wishlist = await Wishlist.findOne({ userId });

    if (wishlist) {

      wishlist.products = wishlist.products.filter((item) => item.productId.toString() !== productId);
      await wishlist.save();

    }

    res.status(200).json({ message: "Product added to cart" });

  } catch (error) {

    console.log("Error in addToCart", error);
    res.status(500).json({ message: "Server error" });

  }
};


const cartQuantity = async (req, res) => {

  try {

    const userId = req.session.user;
    const { productId, action } = req.body; 

    const cart = await Cart.findOne({ userId });

    if (!cart) {

      return res.status(400).json({ message: "Cart not found" });

    }

    const product = await Product.findById(productId);

    if (!product) {

      return res.status(400).json({ message: "Product not found" });

    }

    const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);
    if (itemIndex === -1) {
      return res.status(400).json({ message: "Product not in cart" });
    }

    let newQuantity = cart.items[itemIndex].quantity;

    if (action === "increment") {

      newQuantity += 1;

      if (newQuantity > product.quantity) {

        return res.status(400).json({ message: `Cannot add more. Only ${product.quantity} items left in stock` });

      }

    } else if (action === "decrement") {

      newQuantity -= 1;

      if (newQuantity < 1) {

        return res.status(400).json({ message: "Quantity cannot be less than 1" });

      }
    }

    cart.items[itemIndex].quantity = newQuantity;
    cart.items[itemIndex].totalPrice = newQuantity * cart.items[itemIndex].price;

    await cart.save();

    const updatedCart = await Cart.findOne({ userId }).populate("items.productId");
    const total = updatedCart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    res.status(200).json({ message: "Quantity updated", cart: updatedCart, total });

  } catch (error) {

    console.log("Error in CartQuantity", error);
    res.status(500).json({ message: "Server error" });

  }
};

const deleteCart = async (req, res) => {

  try {

    const userId = req.session.user;
    const { productId } = req.body;

    const cart = await Cart.findOne({ userId });

    if (!cart) {

      return res.status(400).json({ message: "Cart not found" });

    }

    cart.items = cart.items.filter((item) => item.productId.toString() !== productId);
    await cart.save();

    const updatedCart = await Cart.findOne({ userId }).populate("items.productId");
    const total = updatedCart ? updatedCart.items.reduce((sum, item) => sum + item.totalPrice, 0) : 0;

    res.status(200).json({ message: "Product removed from cart", cart: updatedCart, total });

  } catch (error) {

    console.log("Error in removeFromCart", error);
    res.status(500).json({ message: "Server error" });

  }
};

const cartCheckout = async (req, res) => {

  try {

    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {

      return res.status(400).json({ message: "Cart is empty" });

    }

    let outOfStockItems = [];

    for (let item of cart.items) {

      const product = item.productId;

      if (product.quantity < item.quantity || !product.isListed || product.isDelete) {

        outOfStockItems.push(product.name);

      }
    }

    if (outOfStockItems.length > 0) {

      return res.status(400).json({ message: `Some items are out of stock or unavailable`});

    }

    res.status(200).json({ message: "Cart validated successfully" });

  } catch (error) {

    console.log("Error in validateCartForCheckout", error);
    res.status(500).json({ message: "Server error" });

  }
};


const getWishlist = async (req, res) => {

  try {

    const userId = req.session.user;
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect("/login");
    }

    const wishlist = await Wishlist.findOne({ userId }).populate("products.productId");
    const wishlistItems = wishlist ? wishlist.products : [];

    res.render("wishlist", { user, wishlistItems });

  } catch (error) {

    console.log("Error in getWishlist", error);
    res.redirect("/pageNotFound");

  }
};

const addWishlist = async (req, res) => {
  try {
      const userId = req.session.user;
      const { productId } = req.body;

      if (!userId) {
          return res.status(401).json({ message: "Please log in to add to wishlist" });
      }

      let wishlist = await Wishlist.findOne({ userId });
      if (!wishlist) {
          wishlist = new Wishlist({ userId, products: [] });
      }

      const itemIndex = wishlist.products.findIndex(item => item.productId.toString() === productId);
      if (itemIndex === -1) {
          wishlist.products.push({ productId });
          await wishlist.save();
          return res.status(200).json({ message: "Product added to wishlist" });
      } else {
          return res.status(400).json({ message: "Product already in wishlist" });
      }
  } catch (error) {
      console.log("Error in addToWishlist", error);
      res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  
  getCartPage,
  addToCart,
  cartQuantity,
  deleteCart,
  cartCheckout,
  getWishlist,
  addWishlist,
};