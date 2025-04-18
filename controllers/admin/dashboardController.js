const Order = require("../../models/orderSchema");
const Coupons = require("../../models/couponSchema"); 



const loadDashboard = async (req, res) => {

    try {

      const totalOrders = await Order.countDocuments();
      const pendingOrders = await Order.countDocuments({ status: "Pending" });
      const deliveredOrders = await Order.countDocuments({ status: "Delivered" });
      const returned = await Order.countDocuments({status: "Returned" });
  
      const page = parseInt(req.query.page) || 1;
      const limit = 4;
      const skip = (page - 1) * limit;
  
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
  
      const salesTotals = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            status: { $ne: "Cancelled" },
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalAmount: { $sum: "$finalAmount" },
            totalDiscount: { $sum: "$discount" },
          },
        },
      ]);
  
      const orders = await Order.find({
        createdAt: { $gte: startDate },
        status: { $ne: "Cancelled" },
      })
        .select("orderId createdAt finalAmount discount couponApplied")
        .sort({ createdAt: -1 }) 
        .skip(skip)
        .limit(limit);
  
      const totalOrdersCount = await Order.countDocuments({
        createdAt: { $gte: startDate },
        status: { $ne: "Cancelled" },
      });

      const totalPages = Math.ceil(totalOrdersCount / limit);
  
      res.render("dashboard", {
        activePage: "dashboard",
        stats: {
          totalOrders,
          pendingOrders,
          deliveredOrders,
          returned,
        },
        salesData: salesTotals[0] || { totalOrders: 0, totalAmount: 0, totalDiscount: 0 },
        orders,
        currentPage: page,
        totalPages: totalPages,
        totalOrdersCount: totalOrdersCount,
      });

    } catch (error) {

      console.error("Error in loadDashboard:", error);
      res.redirect("/admin/pageerror");

    }
  };


const getSalesReport = async (req, res) => {

    try {

      const { period, startDate, endDate, page = 1 } = req.query;
  
      const limit = 4;
      const skip = (parseInt(page) - 1) * limit;
  
      let dateFilter = {};
      const now = new Date();
  
      if (period === "daily") {
        dateFilter = {
          $gte: new Date(now.setHours(0, 0, 0, 0)),
          $lte: new Date(now.setHours(23, 59, 59, 999)),
        };

      } else if (period === "weekly") {

        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        dateFilter = { $gte: startOfWeek };

      } else if (period === "yearly") {

        dateFilter = { $gte: new Date(now.getFullYear(), 0, 1) };

      } else if (period === "custom" && startDate && endDate) {

        dateFilter = {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        };

      }
  
      const salesTotals = await Order.aggregate([
        {
          $match: {
            createdAt: dateFilter,
            status: { $ne: "Cancelled" },
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalAmount: { $sum: "$finalAmount" },
            totalDiscount: { $sum: "$discount" },
          },
        },
      ]);
  
      const orders = await Order.find({
        createdAt: dateFilter,
        status: { $ne: "Cancelled" },
      })
        .select("orderId createdAt finalAmount discount couponApplied")
        .sort({ createdAt: -1 }) 
        .skip(skip)
        .limit(limit);
  
      const totalOrdersCount = await Order.countDocuments({
        createdAt: dateFilter,
        status: { $ne: "Cancelled" },
      });

      const totalPages = Math.ceil(totalOrdersCount / limit);
  
      const totals = salesTotals[0] || { totalOrders: 0, totalAmount: 0, totalDiscount: 0 };
  
      res.json({
        orders,
        totalSalesCount: totals.totalOrders,
        totalOrderAmount: totals.totalAmount.toFixed(2),
        totalDiscount: totals.totalDiscount.toFixed(2),
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalOrdersCount: totalOrdersCount,
      });

    } catch (error) {

      console.error("Error in getSalesReport:", error);
      res.status(500).json({ error: "Internal server error" });
      
    }
  };
 
module.exports = {
  loadDashboard,
  getSalesReport,
};