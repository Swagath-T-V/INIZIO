const Offer = require("../../models/offerSchema")
const Product = require('../../models/productSchema')
const SubCategory = require("../../models/subCategorySchema")
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")


const getOffer = async(req,res)=>{

    try {
 
        const search = req.query.search || ""
        const page = parseInt(req.query.page || 1)
        const limit = 4
        const skip = (page-1)*limit

        const findOffer = await Offer.find({
            offerName:{ $regex: search, $options: 'i'},
            isDelete:false
        })
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)
        .populate({ path: 'applicableTo', select: 'name' });

        const totalOffer = await Offer.countDocuments({
            offerName: { $regex: search, $options: 'i' }, 
            isDelete: false
        })

        const totalPages = Math.ceil(totalOffer/limit)


        return res.render("offer",{
            offer:findOffer,
            search:search,
            currentPage:page,
            totalPages:totalPages,
            totalCoupons:totalOffer,
            activePage:'offers',
            
        })
        
    } catch (error) {

        console.log('error in getOffer',error)
        return res.redirect("/admin/pageerror")
        
    }

}

const getAddOffer = async(req,res)=>{

    try {

        const product = await Product.find({isDelete:false,isListed:true})
        const category = await Category.find({isDelete:false,isListed:true})
        const subCategory = await SubCategory.find({isDelete:false,isListed:true})
        const brand = await Brand.find({ isDelete: false, isListed: true });

        return res.render("addOffer",{
            activePage:'offers',
            product,
            category,
            subCategory,
            brand 
        })
        
    } catch (error) {

        console.log('error in getAddOffer',error)
        return res.redirect("/admin/pageerror")
        
    }
}

const addOffer = async(req,res)=>{

    try {

        const {offerName,description,discountType,discountAmount,validFrom,validUpto,offerType,applicableTo} = req.body 

        const existingOffer = await Offer.findOne({
            offerName: { $regex: offerName , $options: "i" },
        });
        
        if(existingOffer && existingOffer.isDelete === true){

            existingOffer.isDelete = false;
            existingOffer.description = description;
            existingOffer.discountType = discountType;
            existingOffer.discountAmount = discountAmount ;
            existingOffer.validFrom = validFrom ;
            existingOffer.validUpto = validUpto;
            existingOffer.offerType = offerType ;
            existingOffer.applicableTo = applicableTo ;
            existingOffer.offerTypeRef = offerType ;

            await existingOffer.save()

            return res.status(200).json({ success: true, message: 'Offer created successfully' })
        }

        if(existingOffer && existingOffer.isDelete === false){  

            return res.status(400).json({success:false,message:'Offer name already exists'})

        }

        const newOffer = new Offer({
            offerName,
            description,
            discountType,
            discountAmount,
            validFrom,
            validUpto,
            offerType,
            applicableTo,
            offerTypeRef:offerType
        })

        await newOffer.save()

        return res.status(200).json({success:true,message:'Offer created Successfully'})
        
    } catch (error) {

        console.log("error in the addOffer",error)
        return res.redirect("/admin/pageerror")
        
    }
}

const getEditOffer = async(req,res)=>{

    try {

        const {offerId} = req.query
        const offer = await Offer.findById(offerId)

        const product = await Product.find({isDelete:false,isListed:true})
        const category = await Category.find({isDelete:false,isListed:true})
        const subCategory = await SubCategory.find({isDelete:false,isListed:true})
        const brand = await Brand.find({isDelete:false,isListed:true})

        return res.render("edit-offer",{
            activePage:"offers",
            offer,
            product,
            category,
            subCategory,
            brand
        }) 

    } catch (error) {

        console.log("error in getEditOffer",error)
        return res.status(500).json({success:false,message:'Internal server error'})
        
    }
}

const editOffer = async(req,res)=>{

    try {

        const {offerId} = req.body

        const {offerName,description,discountType,discountAmount,validFrom,validUpto,offerType,applicableTo} = req.body

        const existingOffer = await Offer.findOne({
            offerName: { $regex: offerName , $options: "i" },
            isDelete: false,
            _id: { $ne: offerId }
        })

        if (existingOffer ) {
            return res.status(400).json({
                success: false,
                message: "Offer name already exists"
            })
        }

        const updatedOffer = await Offer.findByIdAndUpdate(
            offerId,
            {
                offerId,
                offerName,
                description,
                discountType,
                discountAmount,
                validFrom,
                validUpto,
                offerType,
                applicableTo,
                offerTypeRef:offerType
            },{new:true}

        )

        if(updatedOffer){

            return res.status(200).json({success:true,message:'Offer Edited Successfully',redirectUrl: "/admin/offer"})

        }else{

            return res.status(400).json({success:false,message:'Offer not found'})

        }

        
        
    } catch (error) {

        console.log("error in edit offer",error)
        return res.status(500).json({success:false,message:'Internal error message'})
        
    }
}

const listOffer = async(req,res)=>{

    try {

        const offerId = req.query.id
        const offer = await Offer.findByIdAndUpdate(
            offerId,
            { $set: { isListed:true }},
            { new: true }
        )

        if(!offer){
            return res.status(404).json({ success: false, message: "Offer not found." });
        }
        
        res.status(200).json({ success: true, message: "offer has been listed." })

    } catch (error) {

        console.error("Error in listOffer :", error);
        res.status(500).json({ success: false, message: "Failed to list the product." })
        
    }
}

const unlistOffer = async (req, res) => {

    try {
        
        const offerId = req.query.id;
        const offer = await Offer.findByIdAndUpdate(
            offerId,
            { $set: { isListed: false } },
            { new: true }
        );

        if (!offer) {
            return res.status(404).json({ success: false, message: "offer not found." });
        }

        res.status(200).json({ success: true, message: "Offer has been unlisted." })

    } catch (error) {

        console.error("Error in unlistoffer:", error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
}
 
const deleteOffer =async(req,res)=>{

    try {

        const offerId = req.query.id
        if(!offerId){
            return res.status(400).json({success:false,message:'offerId not found'})
        }

        const updateOffer = await Offer.findByIdAndUpdate(
            offerId,
            {$set:{isDelete:true}},
            {new:true}
        )

        if(updateOffer){

            return res.status(200).json({success:true,message:"offer deleted successfully"})

        }else{

            return res.status(400).json({success:false,message:'offer not found'})
        }
        
    } catch (error) {

        console.error("Error in deleteoffer:", error)
        res.status(500).json({ success: false, message: "internal server error" })
        
    }

}

module.exports = {
    getOffer,
    getAddOffer,
    addOffer,
    getEditOffer,
    editOffer,
    listOffer,
    unlistOffer,
    deleteOffer

}