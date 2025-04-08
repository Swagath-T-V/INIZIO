const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema")
const User = require("../../models/userSchema")
const Wishlist = require("../../models/wishlistSchema")
const Cart = require("../../models/cartSchema")
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")

const crypto = require("crypto")
const env = require("dotenv").config()
const razorpay = require('../../config/razorpay')

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
    const currentQuantity = parseInt(product.quantity)

    if(currentQuantity<1){
      return res.status(400).json({message:"out of stock"})
    }

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

    const user = await User.findById(userId)

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        redirectUrl: "/login", 
        message: "Please log in to add items to your wishlist" 
      });
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
        success: true,
        message: "Product added to wishlist",
        productId,
        added: true,
      })

    } else {

      wishlist.products.splice(itemIndex, 1)

      await wishlist.save()

      return res.status(200).json({
        success:true,
        message: "Product removed from wishlist",
        productId,
        added: false,
      })

    }

  } catch (error) {

    console.log("Error in addWishlist:", error);
    return res.status(500).json({ success: false, message: "Server error" });

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
      return res.status(401).json({ success: false, message: 'Please login first' });
    }

    const wishlist = await Wishlist.findOne({ userId })
    if (!wishlist) {
      return res.status(404).json({ success: false, message: 'Wishlist not found' });
    }

    const result = await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId } } }
    )

    return res.status(200).json({ success: true, message: 'Item removed from wishlist' });

  } catch (error) {

    console.log("Error in deleteWishlist:", error);
    return res.status(500).json({ success: false, message: 'Server error' });

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
    if (!addressDoc) {
      return res.redirect('/pageNotFound');
    }
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

      paymentMethod: paymentMethod === 'cod' ? 'COD' : 'Razorpay' ,
      status: 'Pending',
      paymentStatus: 'Pending'

    });

    if(paymentMethod === 'cod'){
      for(let item of cart.items){
        await Product.findOneAndUpdate(item.productId._id,{
          $inc:{quantity:-item.quantity}
        })
      }

      await newOrder.save()
      await Cart.findOneAndUpdate({ userId }, { items: [] })
  
      return res.redirect("/successPage")

    }else if(paymentMethod === 'Razorpay'){

        for (let item of cart.items) {
          const product = await Product.findById(item.productId._id);
          if (product.quantity < item.quantity) {
              return res.status(400).json({ success: false, message: `${product.name} is out of stock` });
          }
      }
      const razorpayOrder = await razorpay.orders.create({
        amount : finalAmount*100,
        currency :'INR',
        receipt:`order_${newOrder._id}`,
      }) 

      newOrder.razorpayOrderId = razorpayOrder.id
      await newOrder.save()

      return res.json({
        success:true ,
        razorpayOrderId:razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency:razorpayOrder.currency,
        key:process.env.RAZORPAY_KEY_ID,
        orderId:newOrder._id.toString(),
        user:{
          name: user.name,
          email: user.email,
          contact: selectedAddress.phone,
        }
      })

    }else{

      return res.status(400).json({ success: false, message: 'Invalid payment method' });

    }

  } catch (error) {

    console.error('error in checkOutSubmit:', error)
    return res.redirect('/pageNotFound')

  }

}

const verifyPayment = async(req,res)=>{

  try {

    const{orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature}= req.body

    const order = await Order.findById(orderId)
    if(!orderId){
      return res.status(400).json({success:false,message:"order not found"})
    }

    const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + '|' + razorpay_payment_id)
    .digest('hex');

    if (generatedSignature === razorpay_signature) {
      order.paymentStatus = 'Completed';
      order.razorpayPaymentId = razorpay_payment_id;
      order.razorpaySignature = razorpay_signature;
      order.status = 'Pending';    
      
      for (let item of order.orderedItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { quantity: -item.quantity },
        });
      }
      await Cart.findOneAndUpdate({ userId: order.userId }, { items: [] });

      await order.save();
      return res.json({ success: true, message: 'Payment verified successfully' });

    }else {

      order.status = 'Payment Failed'
      order.paymentStatus = 'Failed';
      await order.save();
      return res.json({ success: false, message: 'Invalid payment signature' });

    }
    
  } catch (error) {

    console.error('Error in verifyPayment:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
    
  }
}

const retryPayment = async (req, res) => {

  try {

    const { orderId } = req.body;
    const userId = req.session.user;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const order = await Order.findById(orderId);
    if (!order || order.userId.toString() !== userId) {
      return res.status(400).json({ success: false, message: 'Order not found' });
    }

    if (order.paymentStatus === 'Completed') {
      return res.status(400).json({ success: false, message: 'Payment already completed' });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: order.finalAmount * 100,
      currency: 'INR',
      receipt: `order_${order._id}_retry`,
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID, 
      orderId: order._id,
      user: {
        name: user.name,
        email: user.email,
        contact: user.phone || order.address.phone,
      },
    });
  } catch (error) {

    console.error('Error in retryPayment:', error);
    return res.status(500).json({ success: false, message: 'Server error' });

  }
};

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
      estimatedDelivery: '7-12 Business Days',
    })

  } catch (error) {

    console.log("error in successPage", error)
    return res.redirect("/pageNotFound")

  }
};
 

const paymentFailure = async(req,res)=>{

  try {

    const userId = req.session.user
    const user  = await User.findById(userId)
    if(!user){
      return res.redirect("/login")
    }

    const orderId = req.query.orderId

    const orderData = await Order.findById(orderId)

    const addressString = `${orderData.address.name}, ${orderData.address.addressType}, ${orderData.address.city}, ${orderData.address.state} - ${orderData.address.pincode}, Phone: ${orderData.address.phone}`;

    orderData.status = 'Payment Failed';
    orderData.paymentStatus = 'Failed';
    await orderData.save()
    
    return res.render('paymentFailure', { 
      user,
      orderId: orderData._id, 
      totalAmount: orderData.finalAmount,
      paymentMethod: orderData.paymentMethod,
      address: addressString, 
      estimatedDelivery: '7-12 Business Days',
    });
    
  } catch (error) {

    console.log("error in paymentFailure",error)
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
  checkWishlist,
  deleteWishlist,
  checkOut,
  editCheckoutAddress,
  addCheckoutAddress,
  checkOutSubmit,
  verifyPayment,
  retryPayment,
  paymentFailure,
  successPage

} 