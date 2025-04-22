const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const SubCategory = require("../../models/subCategorySchema")
const ExcelJS = require("exceljs");


const loadDashboard = async (req, res) => {

  try {

    const totalOrders = await Order.countDocuments({
      status: { $nin: ["Cancelled", "Payment Failed", "Returned"] },
      $nor: [{ $and: [{ paymentStatus: "Pending" }, { paymentMethod: "Razorpay" }] }],
    });

    const pendingOrders = await Order.countDocuments({
      status: "Pending",
      $nor: [{ $and: [{ paymentStatus: "Pending" }, { paymentMethod: "Razorpay" }] }],
    });

    const deliveredOrders = await Order.countDocuments({ status: "Delivered" });
    const returnedOrders = await Order.countDocuments({ status: "Returned" });
    const cancelledOrders = await Order.countDocuments({ status: "Cancelled" });

    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const salesTotals = await Order.aggregate([
      {
        $match: {
          status: { $nin: ["Cancelled", "Payment Failed", "Returned"] },
          $nor: [{ $and: [{ paymentStatus: "Pending" },{ paymentMethod: "Razorpay" }]}],
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: "$finalAmount" },
          totalDiscount: { $sum: "$discount" },
          couponDiscount: { $sum: "$couponDiscount" },
          offerDiscount: { $sum: "$offerDiscount" },
        },
      },
    ]);

    const orders = await Order.find({
      status: { $nin: ["Cancelled", "Payment Failed", "Returned"] },
      $nor: [{ $and: [{ paymentStatus: "Pending" }, { paymentMethod: "Razorpay" }]}],
    })
    .select("orderId createdAt finalAmount discount couponApplied")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const totalOrdersCount = await Order.countDocuments({
      status: { $nin: ["Cancelled", "Payment Failed", "Returned"] },
      $nor: [{ $and: [{ paymentStatus: "Pending" }, { paymentMethod: "Razorpay" }]}],
    });

    const totalPages = Math.ceil(totalOrdersCount / limit);

    const allOrders = await Order.find({
      status: { $nin: ["Cancelled", "Payment Failed", "Returned"] },
      $nor: [{ $and: [{ paymentStatus: "Pending" }, { paymentMethod: "Razorpay" }]}],
    })
    .populate({
      path:"orderedItems.product",
      populate:[
        {path: "category", select: "name description"},
        {path: "subCategory", select: "name description"},
      ],
      select: "name quantity",
    }).lean()

    const productSales = {}
    allOrders.forEach((order) => {
      order.orderedItems.forEach((item) => {
        if(item.product){
          const productId = item.product._id.toString()
          if(!productSales[productId]){
            productSales[productId] = {
              productId,
              name: item.product.name,
              quantityInStock: item.product.quantity,
              totalSold: 0,
            };
          }
          productSales[productId].totalSold += item.quantity;
        }
      })
    })

    const topProducts = Object.values(productSales)
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, 7);

    const categorySales = {};
    allOrders.forEach((order) => {
      order.orderedItems.forEach((item) => {
        if (item.product && item.product.category) {
          const categoryId = item.product.category._id.toString();
          if (!categorySales[categoryId]) {
            categorySales[categoryId] = {
              categoryId,
              name: item.product.category.name,
              description: item.product.category.description,
              totalSold: 0,
            };
          }
          categorySales[categoryId].totalSold += item.quantity;
        }
      });
    });

    const topCategories = Object.values(categorySales)
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, 3);

    const subCategorySales = {};
    allOrders.forEach((order) => {
      order.orderedItems.forEach((item) => {
        if (item.product && item.product.subCategory) {
          const subCategoryId = item.product.subCategory._id.toString();
          if (!subCategorySales[subCategoryId]) {
            subCategorySales[subCategoryId] = {
              subCategoryId,
              name: item.product.subCategory.name,
              description: item.product.subCategory.description,
              totalSold: 0,
            };
          }
          subCategorySales[subCategoryId].totalSold += item.quantity;
        }
      });
    });

    const topSubcategories = Object.values(subCategorySales)
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, 3);

    res.render("dashboard", {
      activePage: "dashboard",
      stats: {
        totalOrders,
        pendingOrders,
        deliveredOrders,
        returnedOrders,
        cancelledOrders,
      },
      salesData: salesTotals[0] || {
        totalOrders: 0,
        totalAmount: 0,
        totalDiscount: 0,
        offerDiscount: 0,
        couponDiscount: 0,
      },
      orders,
      currentPage: page,
      totalPages: totalPages,
      totalOrdersCount: totalOrdersCount,
      topProducts,
      topCategories,
      topSubcategories,
    });

  } catch (error) {

    console.error("Error in loadDashboard:", error);
    return res.redirect("/admin/pageerror");

  }
};


const getSalesReport = async (req, res) => {

  try {

    const { period, startDate, endDate, page = 1, forPDF } = req.query;

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
          status: { $nin: ["Cancelled", "Payment Failed", "Returned"] },
          $nor: [{ $and: [{ paymentStatus: "Pending" }, { paymentMethod: "Razorpay" }] }],
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: "$finalAmount" },
          totalDiscount: { $sum: "$discount" },
          couponDiscount: { $sum: "$couponDiscount" },
          offerDiscount: { $sum: "$offerDiscount" },
        },
      },
    ]);

    let ordersQuery = Order.find({
      createdAt: dateFilter,
      status: { $nin: ["Cancelled", "Payment Failed", "Returned"] },
      $nor: [{ $and: [{ paymentStatus: "Pending" }, { paymentMethod: "Razorpay" }] }],
    })
    .select("orderId createdAt finalAmount discount couponApplied")
    .sort({ createdAt: -1 });

    if (!forPDF) {
      ordersQuery = ordersQuery.skip(skip).limit(limit);
    }

    const orders = await ordersQuery;

    const totalOrdersCount = await Order.countDocuments({
      createdAt: dateFilter,
      status: { $nin: ["Cancelled", "Payment Failed", "Returned"] },
      $nor: [{ $and: [{ paymentStatus: "Pending" }, { paymentMethod: "Razorpay" }] }],
    });

    const totalPages = forPDF ? 1 : Math.ceil(totalOrdersCount / limit); 

    const totals = salesTotals[0] || {
      totalOrders: 0,
      totalAmount: 0,
      totalDiscount: 0,
      offerDiscount: 0,
      couponDiscount: 0,
    };

    res.json({
      orders,
      totalSalesCount: totals.totalOrders,
      totalOrderAmount: totals.totalAmount.toFixed(2),
      totalDiscount: totals.totalDiscount.toFixed(2),
      offerDiscount: totals.offerDiscount.toFixed(2),
      couponDiscount: totals.couponDiscount.toFixed(2),
      currentPage: parseInt(page),
      totalPages: totalPages,
      totalOrdersCount: totalOrdersCount,
    });

  } catch (error) {
    
    console.error("Error in getSalesReport:", error);
    return res.redirect("/admin/pageerror");

  }
};


const getSalesChart = async (req, res) => {

  try {

    const { period } = req.query;
    const now = new Date();
    let labels = [];
    let sales = [];

    if (period === "daily") {

      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
        labels.push(dayName);

        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(date.setHours(23, 59, 59, 999));

        const totalSales = await Order.aggregate([
          {
            $match: {
              createdAt: { $gte: startOfDay, $lte: endOfDay },
              status: { $nin: ["Cancelled", "Payment Failed", "Returned"] },
              $nor: [{ $and: [{ paymentStatus: "Pending" },{ paymentMethod: "Razorpay" }]}],
            },
          },
          {
            $group: {_id: null, totalAmount: { $sum: "$finalAmount" } },
          },
        ]);

        sales.push(totalSales[0]?.totalAmount || 0);
      }
    } else if (period === "monthly") {
      
      const months = ["January","February","March","April","May", "June","July", "August", "September","October","November", "December"];
      
      for (let i = 0; i < 12; i++) {
        labels.push(months[i]);

        const startOfMonth = new Date(now.getFullYear(), i, 1);
        const endOfMonth = new Date(now.getFullYear(),i + 1, 0,23, 59, 59, 999);

        const totalSales = await Order.aggregate([
          {
            $match: {
              createdAt: { $gte: startOfMonth, $lte: endOfMonth },
              status: { $nin: ["Cancelled", "Payment Failed", "Returned"] },
              $nor: [{ $and: [{ paymentStatus: "Pending" },{ paymentMethod: "Razorpay" }]}],
            },
          },
          {
            $group: {_id: null, totalAmount: { $sum: "$finalAmount" }},
          },
        ]);

        sales.push(totalSales[0]?.totalAmount || 0);
      }

    } else if (period === "yearly") {

      const currentYear = now.getFullYear();
      for (let i = currentYear - 6; i <= currentYear; i++) {
        labels.push(i.toString());

        const startOfYear = new Date(i, 0, 1);
        const endOfYear = new Date(i, 11, 31, 23, 59, 59, 999);

        const totalSales = await Order.aggregate([
          {
            $match: {
              createdAt: { $gte: startOfYear, $lte: endOfYear },
              status: { $nin: ["Cancelled", "Payment Failed", "Returned"] },
              $nor: [{ $and: [{ paymentStatus: "Pending" },{ paymentMethod: "Razorpay" }]}],
            },
          },
          {
            $group: { _id: null, totalAmount: { $sum: "$finalAmount" }},
          },
        ]);

        sales.push(totalSales[0]?.totalAmount || 0);
      }
    }

    res.json({ labels, sales });

  } catch (error) {

    console.error("Error in getSalesChart:", error);
    return res.redirect("/admin/pageerror");

  }
};


const getSalesReportExcel = async (req, res) => {

  try {

    const { period, startDate, endDate } = req.query;

    let dateFilter = {};
    const now = new Date();

    if (period === "daily") {
      dateFilter = {
        $gte: new Date(now.setHours(0, 0, 0, 0)),
        $lte: new Date(now.setHours(23, 59, 59, 999)),
      }

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
          status: { $nin: ["Cancelled", "Payment Failed", "Returned"] },
          $nor: [{ $and: [{ paymentStatus: "Pending" }, { paymentMethod: "Razorpay" }] }],
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: "$finalAmount" },
          totalDiscount: { $sum: "$discount" },
          couponDiscount: { $sum: "$couponDiscount" },
          offerDiscount: { $sum: "$offerDiscount" },
        },
      },

    ]);

    const orders = await Order.find({
      createdAt: dateFilter,
      status: { $nin: ["Cancelled", "Payment Failed", "Returned"] },
      $nor: [{ $and: [{ paymentStatus: "Pending" }, { paymentMethod: "Razorpay" }] }],
    })
    .select("orderId createdAt finalAmount discount couponApplied")
    .sort({ createdAt: -1 });

    const totals = salesTotals[0] || {
      totalOrders: 0,
      totalAmount: 0,
      totalDiscount: 0,
      offerDiscount: 0,
      couponDiscount: 0,
    };

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    worksheet.columns = [
      { header: "Date", key: "date", width: 20 }, 
      { header: "Order ID", key: "orderId", width: 36 }, 
      { header: "Amount", key: "amount", width: 15 },
      { header: "Discount", key: "discount", width: 15 },
      { header: "Coupon Applied", key: "couponApplied", width: 15 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF6A1B9A" }, 
    };

    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    orders.forEach((order) => {
      worksheet.addRow({
        date: new Date(order.createdAt).toLocaleDateString(),
        orderId: order.orderId,
        amount: order.finalAmount.toFixed(2),
        discount: order.discount.toFixed(2),
        couponApplied: order.couponApplied ? "True" : "False",
      });
    });

    // Add summary section
    worksheet.addRow([]); 
    worksheet.addRow(["Summary", "", "", "", ""]);
    worksheet.mergeCells(worksheet.lastRow.number, 1, worksheet.lastRow.number, 5);
    worksheet.getRow(worksheet.lastRow.number).font = { bold: true };
    worksheet.getRow(worksheet.lastRow.number).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF5F5F5" },
    };

    worksheet.addRow(["Overall Sales Count", totals.totalOrders, "", "", ""]);
    worksheet.addRow(["Offer Discount", `₹${totals.offerDiscount.toFixed(2)}`, "", "", ""]);
    worksheet.addRow(["Coupon Discount", `₹${totals.couponDiscount.toFixed(2)}`, "", "", ""]);
    worksheet.addRow(["Overall Discount", `₹${totals.totalDiscount.toFixed(2)}`, "", "", ""]);
    worksheet.addRow(["Overall Order Amount", `₹${totals.totalAmount.toFixed(2)}`, "", "", ""]);

    for (let i = worksheet.lastRow.number - 4; i <= worksheet.lastRow.number; i++) {
      worksheet.getRow(i).font = { bold: true };
      worksheet.getRow(i).alignment = { vertical: "middle", horizontal: "left" };
    }

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=sales_report_${new Date().toISOString().split('T')[0]}.xlsx`);

    // Send the Excel file
    res.send(buffer);

  } catch (error) {

    console.error("Error in getSalesReportExcel:", error);
    return res.redirect("/admin/pageerror");
    
  }
};


module.exports = {

  loadDashboard,
  getSalesReport,
  getSalesChart,
  getSalesReportExcel

};