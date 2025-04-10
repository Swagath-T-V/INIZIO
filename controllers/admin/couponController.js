const Coupon = require('../../models/couponSchema')

const loadCoupon = async(req,res)=>{

    try {

        const search = req.query.search || ""
        const page = parseInt(req.query.page || 1)
        const limit = 4
        const skip = (page-1)*limit
        const coupons = await Coupon.find({
            couponName:{$regex:search,$options:'i'},
            isDelete:false
        })
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)

        const totalCoupons = await Coupon.countDocuments({isDelete:false})
        const totalPages = Math.ceil(totalCoupons/limit) 

        return res.render('coupon',{
            search:search,
            currentPage:page,
            coupons: coupons,
            totalPages:totalPages,
            totalCoupons:totalCoupons,
            activePage:'coupons'
        })
        
    } catch (error) {

        console.log('Error in loadCoupon',error)
        return res.redirect("/admin/pageerror")
        
    }

}

const getAddCoupon = async(req,res)=>{

    try {

        return res.render('addCoupon',{
            activePage:'coupons',
        })
        
    } catch (error) {

        console.log("Error in addCoupon",error)
        return res.redirect("/admin/pageerror")
        
    }

}

const addCoupon = async(req,res)=>{

    try {

        const {couponName,couponCode,startingDate,expireOn,offerPrice,minimumPurchase,status} =req.body
        
        const existingCouponName = await Coupon.findOne({couponName})

        if(existingCouponName && existingCouponName.isDelete === true){

            existingCouponName.isDelete = false;
            existingCouponName.couponCode = couponCode;
            existingCouponName.startingDate = startingDate;
            existingCouponName.expireOn = expireOn ;
            existingCouponName.offerPrice = offerPrice ;
            existingCouponName.minimumPurchase = minimumPurchase;
            existingCouponName.status = status ;

            await existingCouponName.save()

            return res.status(200).json({ success: true, message: 'Coupon created successfully' })
        }

        if(existingCouponName && existingCouponName.isDelete === false){

            return res.status(400).json({success:false,message:'coupon name already exists'})
            
        }
        
        const existingCouponCode = await Coupon.findOne({couponCode})
        if(existingCouponCode){

            return res.status(400).json({success:false,message:'Coupon code already exists'})

        }

        const newCoupon = new Coupon({
            couponName,
            couponCode,
            startingDate,
            expireOn,
            offerPrice,
            minimumPurchase,
            status
        })

        await newCoupon.save()

        return res.status(200).json({success:true,message:"Coupon created successfully"})
        
    } catch (error) {

        console.log("error in addCoupon",error)
        return res.status(500).json({ success: false, message: "Server error occurred" });
            
    }

}


const getEditCoupon = async(req,res)=>{

    try {

        const {couponId} = req.query

        const coupon = await Coupon.findOne({_id:couponId})
        return res.render("edit-Coupon",{
            coupon:coupon,
            activePage:'coupons'
        })
        
    } catch (error) {

        console.log("error in editCoupon",error)
        return res.redirect("/admin/pageerror")
        
    }
}

const editCoupon = async(req,res)=>{

    try {

        const {couponId} = req.query

        const{couponName,couponCode,startingDate,expireOn,offerPrice,minimumPurchase,status}= req.body

        const existingCouponCode =await Coupon.findOne({couponCode,isDelete:false,_id:{$ne:couponId}})

        if(existingCouponCode ){
            return res.status(400).json({success:false,message:"coupon code already exists"})
        }

        const existingCoupon =await Coupon.findOne({couponName,isDelete: false, _id: { $ne: couponId }})

        if (existingCoupon ) {
            return res.status(400).json({
                success: false,
                message: "Coupon name already exists"
            });
        }

        const updateCoupon = await Coupon.findByIdAndUpdate(couponId,{
            couponName,
            couponCode,
            startingDate,
            expireOn,
            offerPrice,
            minimumPurchase,
            status
        },{new:true})

        if (updateCoupon) {
            return res.status(200).json({
                success: true,
                message: "Coupon updated successfully",
                redirectUrl: "/admin/coupon" 
            });
            
        } else {

            return res.status(400).json({
                success: false,
                message: "Coupon not found"
            });
        }

    } catch (error) {

        console.log("error in editCoupon",error)
        return res.status(500).json({success: false,message: "Internal server error"});
        
    }

}

const deleteCoupon = async(req,res)=>{

    try {

        const couponId =req.params.couponId 
        if (!couponId) {
            return res.status(400).json({ success: false, message: 'Coupon ID is required' });
        }

        const updatedCoupon = await Coupon.findByIdAndUpdate(
            couponId,
            {$set:{isDelete:true}},
            {new:true}
        )

        if(updatedCoupon){

            return res.status(200).json({success:true,message:'coupon deleted successfully'})

        }else{

            return res.status(400).json({success:false,message:'coupon not found'})

        }
        
    } catch (error) {

        console.log("error in deleteCoupon",error)
        return res.status(500).json({success:false,message:'internal server error'})
        
    }
}
        
module.exports = {

    loadCoupon,
    getAddCoupon,
    addCoupon,
    getEditCoupon,
    editCoupon,
    deleteCoupon

}