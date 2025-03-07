const Category = require("../../models/categorySchema")


const categoryInfo =async(req,res)=>{
    // try {
    //     const page = parseInt(req.query.page) || 1
    //     const limit = 1
    //     const skip = (page-1)*limit

    //     const categorydata = await Category.find({})
    //     .sort({createdAt:-1})
    //     .skip(skip)
    //     .limit(limit)

    //     const totalCategory = await Category.countDocuments()
    //     const totalPages = Math.ceil(totalCategory/limit)
    //     res.render("Category",{
    //         cat:categorydata,
    //         currentPage:page,
    //         totalPages:totalPages,
    //         totalCategory:totalCategory,
    //         activePage:"category",
    //         search:search,
            
    //     })

    // } catch (error) {

    //     console.log("Error in catrgoryInfo",error)
    //     res.redirect("/admin/pageerror")
        
    // }
}       

const addCategory = async(req,res)=>{
    // try {
        
    // } catch (error) {
        
    // }
}


module.exports = {
    categoryInfo,
    addCategory
}