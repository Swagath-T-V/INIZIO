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


const addCart = async (req, res) => {

  try {

    const userId = req.session.user;
    const { productId, quantity = 1 } = req.body
    
    if (!userId) {
      return res.redirect("/login")
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.redirect("/pageNotFound")
    }

    if (!product.isListed || product.isDelete) {
      return res.status(400).json({ message: "This product is unavailable" });
    }

    const category = await Category.findOne({ name: product.category });

    if (!category || !category.isListed || category.isDelete) {
      return res.status(400).json({ message: "This product's category is unavailable" });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({ message: `Only ${product.quantity} items left in stock` });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
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
      await Wishlist.updateOne(
        { userId },
        { $pull: { products: { productId } } }
      );
    }

    return res.redirect("/cart")

  } catch (error) {

    console.log("Error in addCart", error);
    return res.redirect("/pageNotFound")
    
  }
};


const cartQuantity = async (req, res) => {

  try {

    const userId = req.session.user;
    const { productId, action } = req.body; 

    const cart = await Cart.findOne({ userId });

    const product = await Product.findById(productId);

    const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);
    
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

    res.status(200).json({message:'cartUpdated successfully',cart: updatedCart,total})
      

  } catch (error) {

    console.log("Error in CartQuantity", error);
    res.redirect("/pageNotFound")

  }

};


const deleteCart = async (req, res) => {

  try {
    const userId = req.session.user;
    const { productId } = req.query; 

    if (!userId) {
      res.redirect("/login")
    }

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.redirect("/pageNotFound")

    }

    const result = await Cart.updateOne(
      { userId },
      { $pull: { items: { productId } } }
    );

    return res.redirect("/cart")

  } catch (error) {

    console.log("Error in deleteCart:", error);
    res.redirect("/pageNotFound")
    
  }
};


const cartCheckout = async (req, res) => {

  try {

    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    let outOfStock = [];

    for (let item of cart.items) {

      const product = item.productId;

      if (product.quantity < item.quantity || !product.isListed || product.isDelete) {

        outOfStock.push(product.name);

      }
    }

    if (outOfStock.length > 0) {

      return res.status(400).json({ message: `Some items are out of stock or unavailable`});

    }

    res.status(200).json({ message: "successfully" });

  } catch (error) {

    console.log("Error in CartCheckout", error);
    res.redirect("/pageNotFound")

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
      return res.redirect("/login")
    }

    const product = await Product.findById(productId);

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    const itemIndex = wishlist.products.findIndex((item) => item.productId.toString() === productId)

    if (itemIndex === -1) {

      wishlist.products.push({ productId });
      await wishlist.save();

      return res.status(200).json({
        message: "Product added to wishlist",
        productId,
        added: true,
      }); 

    } else {

      return res.status(200).json({
        message: "Product already in wishlist",
        productId,
        added: true,
      });

    }
  } catch (error) {

    console.error("Error in addWishlist:", error)
    res.redirect("/pageNotFound")

  }
};


const deleteWishlist = async (req, res) => {
  
  try {
    const userId = req.session.user
    const { productId } = req.query

    if (!userId) {
      return res.redirect("/login")
    }

    const wishlist = await Wishlist.findOne({ userId })
    if (!wishlist) {
      return res.redirect("/pageNotFound")
    }

    const result = await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId } } }
    )

    return res.redirect("/wishlist")

  } catch (error) {

    console.log("Error in deleteWishlist:", error)
    return res.redirect("/pageNotFound")

  }
}

module.exports = {
  
  getCartPage,
  addCart,
  cartQuantity,
  deleteCart,
  cartCheckout,
  getWishlist,
  addWishlist,
  deleteWishlist
};