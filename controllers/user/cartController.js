const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema")
const User = require("../../models/userSchema")
const Wishlist = require("../../models/wishlistSchema")
const Cart = require("../../models/cartSchema")
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")


const getCartPage = async (req, res) => {

  try {

    const userId = req.session.user;
    const user = await User.findById(userId)

    if (!user) {
      return res.redirect("/login")
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId")

    if (!cart) {
      return res.render("cart", { 
        user, 
        cartItems: [],
        total: 0 })
    }

    const cartItems = cart.items
    const total = cartItems.reduce((sum, item) => sum + item.totalPrice, 0)

    res.render("cart", {
       user, 
       cartItems, 
       total 
      })

  } catch (error) {

    console.log("Error in getCartPage", error)
    res.redirect("/pageNotFound")

  }
};


const addCart = async (req, res) => {

  try {

    const userId = req.session.user;
    const { productId, quantity = 1 } = req.body;
    const MAX_CART_QUANTITY = 10; 

    if (!userId) {
      return res.redirect("/login");
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.redirect("/pageNotFound");
    }

    if (!product.isListed || product.isDelete) {
      return res.status(400).json({ message: "This product is unavailable" });
    }

    const category = await Category.findOne({ name: product.category });
    if (!category || !category.isListed || category.isDelete) {
      return res.status(400).json({ message: "This product's category is unavailable" });
    }

    const requestedQuantity = parseInt(quantity);
    const maxAllowed = Math.min(MAX_CART_QUANTITY, product.quantity)

    if (requestedQuantity > maxAllowed) {
      return res.status(400).json({
        message: `You can only add up to ${maxAllowed} items of this product to the cart`,
      });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);

    if (itemIndex > -1) {
      const currentQuantity = cart.items[itemIndex].quantity;
      const newQuantity = currentQuantity + requestedQuantity;

      if (newQuantity > maxAllowed) {
        return res.status(400).json({
          message: `You can only add up to ${maxAllowed} items of this product to the cart`,
        });
      }

      cart.items[itemIndex].quantity = newQuantity;
      cart.items[itemIndex].totalPrice = newQuantity * cart.items[itemIndex].price

    } else {
      cart.items.push({
        productId,
        quantity: requestedQuantity,
        price: product.salePrice,
        totalPrice: product.salePrice * requestedQuantity,
      })

    }

    await cart.save();

    const wishlist = await Wishlist.findOne({ userId });
    if (wishlist) {
      await Wishlist.updateOne({ userId }, { $pull: { products: { productId } } });
    }

    return res.redirect("/cart")

  } catch (error) {

    console.log("Error in addCart", error);
    return res.redirect("/pageNotFound");

  }
};


const cartQuantity = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, action } = req.body;
    const MAX_CART_QUANTITY = 10; 

    const cart = await Cart.findOne({ userId });
    const product = await Product.findById(productId);

    const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);
    let newQuantity = cart.items[itemIndex].quantity;
    const maxAllowed = Math.min(MAX_CART_QUANTITY, product.quantity)

    if (action === "increment") {
      newQuantity += 1;
      if (newQuantity > maxAllowed) {
        return res.status(400).json({
          message: `You can only add up to ${maxAllowed} items of this product to the cart`,
        });
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
    let originalTotal = 0;
    let totalDiscount = 0;

    updatedCart.items.forEach((item) => {
      const regularPrice = item.productId.regularPrice || item.price;
      originalTotal += regularPrice * item.quantity;
      totalDiscount += (regularPrice - item.price) * item.quantity;
    });

    res.status(200).json({
      success: true,
      quantity: newQuantity,
      price: cart.items[itemIndex].totalPrice,
      total,
      originalTotal,
      totalDiscount,
      cartItems: updatedCart.items,
      message: "Cart updated successfully",
    });
  } catch (error) {
    console.log("Error in cartQuantity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


const deleteCart = async (req, res) => {

  try {

    const userId = req.session.user
    const { productId } = req.query 

    if (!userId) {
      res.redirect("/login")
    }

    const cart = await Cart.findOne({ userId })

    if (!cart) {
      return res.redirect("/pageNotFound")

    }

    const result = await Cart.updateOne(
      { userId },
      { $pull: { items: { productId } } }
    );

    return res.redirect("/cart")

  } catch (error) {

    console.log("Error in deleteCart:", error)
    res.redirect("/pageNotFound")
    
  }
};


const cartCheckout = async (req, res) => {

  try {

    const userId = req.session.user
    const cart = await Cart.findOne({ userId }).populate("items.productId")

    let outOfStock = []

    for (let item of cart.items) {

      const product = item.productId

      if (product.quantity < item.quantity || !product.isListed || product.isDelete) {

        outOfStock.push(product.name)

      }
    }

    if (outOfStock.length > 0) {

      return res.status(400).json({ message: 'Some items are out of stock or unavailable'})

    }

    res.status(200).json({ message: "successfully" })

  } catch (error) {

    console.log("Error in CartCheckout", error)
    res.redirect("/pageNotFound")

  }
};

//////////////////////////////////////////////////WISHLIST//////////////////////////////////////////////////////

const getWishlist = async (req, res) => {

  try {

    const userId = req.session.user
    const user = await User.findById(userId)
    if (!user) {
      return res.redirect("/login")
    }

    const wishlist = await Wishlist.findOne({ userId }).populate("products.productId")
    const wishlistItems = wishlist ? wishlist.products : []

    res.render("wishlist", { user, wishlistItems })

  } catch (error) {

    console.log("Error in getWishlist", error)
    res.redirect("/pageNotFound")

  }
};


const addWishlist = async (req, res) => {

  try {

    const userId = req.session.user
    const { productId } = req.body

    if (!userId) {
      return res.redirect("/login")
    }

    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    let wishlist = await Wishlist.findOne({ userId })
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] })
    }

    const itemIndex = wishlist.products.findIndex((item) => item.productId.toString() === productId)

    if (itemIndex === -1) {

      wishlist.products.push({ productId })

      await wishlist.save()
      
      return res.status(200).json({
        message: "Product added to wishlist",
        productId,
        added: true,
      })

    } else {

      wishlist.products.splice(itemIndex, 1)

      await wishlist.save()

      return res.status(200).json({
        message: "Product removed from wishlist",
        productId,
        added: false,
      })

    }
  } catch (error) {

    console.log("Error in addWishlist:", error)
    return res.redirect("/pageNotFound")

  }
};


const checkWishlist = async (req, res) => {

  try {
    
    const userId = req.session.user
    const { productId } = req.query

    if (!userId) {
      return res.redirect("/login")
    }

    const wishlist = await Wishlist.findOne({ userId })
    const inWishlist = wishlist && wishlist.products.some(item => item.productId.toString() === productId)

    res.status(200).json({ inWishlist })

  } catch (error) {

    console.log("Error in checkWishlist:", error)
    return res.redirect("/pageNotFound")

  }
}


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

//////////////////////////////////////////////////// CHEKOUT //////////////////////////////////////////////////////////////

const checkOut = async (req, res) => {

  try {
    
    const userId = req.session.user
    const user = await User.findById(userId)

    if (!user) {
      return res.redirect("/login")
    }

    const addressDocument = await Address.findOne({ userId })
    const addresses = addressDocument ? addressDocument.address : []
    
    const cart = await Cart.findOne({ userId }).populate('items.productId')
    
    const totalAmount = cart.items.reduce((sum, item) => sum + (item.productId.salePrice * item.quantity), 0)
    const Discount = cart.items.reduce((sum, item) => sum + ((item.productId.regularPrice - item.productId.salePrice) * item.quantity), 0)

    return res.render("checkOut", {
      user,
      cart,
      address: addresses,
      totalAmount:totalAmount,
      Discount:Discount

    })

  } catch (error) {

    console.error("Error in addCheckoutAddress:", error)
    res.redirect("/pageNotFound")

  }
}


const editCheckoutAddress = async (req, res) => {

  try {

    const addressId = req.body.addressId
    const userId = req.session.user
    const { addressType, name, city, landMark, state, pincode, phone, isDefault } = req.body

    const findAddress = await Address.findOne({ "address._id": addressId })
    if (!findAddress) {
      return res.redirect("/pageNotFound")
    }

    if (isDefault === 'on') {
      await Address.updateMany(
        { userId, "address.isDefault": true },
        { $set: { "address.$[].isDefault": false } }
      )
    }

    await Address.updateOne(
      { "address._id": addressId },
      {
        $set: {
          "address.$.addressType": addressType,
          "address.$.name": name,
          "address.$.city": city,
          "address.$.landMark": landMark,
          "address.$.state": state,
          "address.$.pincode": pincode,
          "address.$.phone": phone,
          "address.$.isDefault": isDefault === 'on'
        }
      }
    )

    return res.redirect("/checkOut")

  } catch (error) {

    console.log("error in editCheckoutAddress", error)
    return res.redirect("/pageNotFound")

  }

}


const addCheckoutAddress = async (req, res) => {

  try {

    const userId = req.session.user
    const userData = await User.findOne({ _id: userId })
    const { addressType, name, city, landMark, state, pincode, phone, isDefault } = req.body

    const isDefaultBool = isDefault === 'on'

    let userAddress = await Address.findOne({ userId: userData._id })

    if (!userAddress) {
      const newAddress = new Address({
        userId: userData._id,
        address: [
          {
            addressType,
            name,
            city,
            landMark,
            state,
            pincode,
            phone,
            isDefault: isDefaultBool,
          },
        ],
      })

      await newAddress.save()

    } else {

      if (isDefaultBool) {
        await Address.updateOne(
          { userId: userData._id },
          { $set: { "address.$[].isDefault": false } }
        )
      }

      userAddress.address.push({
        addressType,
        name,
        city,
        landMark,
        state,
        pincode,
        phone,
        isDefault: isDefaultBool,
      })

      await userAddress.save()

    }

    res.redirect("/checkOut")

  } catch (error) {

    console.log("Error in addCheckoutAddress:", error)
    res.redirect("/pageNotFound")
    
  }
}


const checkOutSubmit = async (req, res) => {

  try {

    const userId = req.session.user
    const { addressId, paymentMethod } = req.body

    
    const user = await User.findById(userId)
    if (!user) {
      return res.redirect('/login')
    }

    const addressDoc = await Address.findOne({ userId, 'address._id': addressId })
    const selectedAddress = addressDoc.address.id(addressId)
    const cart = await Cart.findOne({ userId }).populate('items.productId')

    const orderedItems = cart.items.map(item => ({
      product: item.productId._id,
      quantity: item.quantity,
      price: item.productId.regularPrice,

    }))

    const tax = 100
    const shipping = 0
    const totalAmount = cart.items.reduce((sum, item) => sum + (item.productId.salePrice * item.quantity), 0)
    const discount = cart.items.reduce((sum, item) => sum + ((item.productId.regularPrice - item.productId.salePrice) * item.quantity), 0)
    const finalAmount = totalAmount + tax

    const newOrder = new Order({
      userId: user._id,
      orderedItems,
      totalPrice: totalAmount,
      discount,
      tax,
      shipping,
      finalAmount,
      address: {
        addressType: selectedAddress.addressType,
        name: selectedAddress.name,
        city: selectedAddress.city,
        landmark: selectedAddress.landMark,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode.toString(),
        phone: selectedAddress.phone,
        isDefault: selectedAddress.isDefault,
      },

      paymentMethod: paymentMethod === 'cod' ? 'COD' : paymentMethod === 'upi' ? 'UPI' : 'Credit/Debit Card',
      status: 'Pending',

    });

    for (let item of cart.items) {
      await Product.findByIdAndUpdate(item.productId._id, {
        $inc: { quantity: -item.quantity }
      })
    }

    await newOrder.save()
    await Cart.findOneAndUpdate({ userId }, { items: [] })

    return res.redirect("/successPage")

  } catch (error) {

    console.error('error in checkOutSubmit:', error)
    return res.redirect('/pageNotFound')

  }

}

const successPage = async (req, res) => {

  try {

    const userId = req.session.user
    const user = await User.findById(userId)
    if (!user) {
      return res.redirect("/login")
    }

    const order = await Order.findOne({ userId }).sort({ createdAt: -1 })

    if (!order) {
      return res.redirect("/pageNotFound")
    }

    const addressString = `${order.address.name}, ${order.address.addressType}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}, Phone: ${order.address.phone}`;

    return res.render("successPage", {
      user,
      orderId: order._id, 
      totalAmount: order.finalAmount,
      paymentMethod: order.paymentMethod,
      address: addressString, 
      estimatedDelivery: '3-5 Business Days',
    })

  } catch (error) {

    console.log("error in successPage", error)
    return res.redirect("/pageNotFound")

  }
};


module.exports = {
  
  getCartPage,
  addCart,
  cartQuantity,
  deleteCart,
  cartCheckout,
  getWishlist,
  addWishlist,
  checkWishlist,
  deleteWishlist,
  checkOut,
  editCheckoutAddress,
  addCheckoutAddress,
  checkOutSubmit,
  successPage

}