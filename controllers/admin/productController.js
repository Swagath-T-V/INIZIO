const Product = require("../../models/productSchema")


const getProductPage = async(req,res)=>{
    try {
        res.render("product",{
            activePage:"product"
        })
    } catch (error) {
        
    }
}

const addProduct = async(req,res)=>{
    try {
        res.render("addProduct",{
            activePage:"product"
        })
    } catch (error) {
        
    }
}




module.exports = {
    getProductPage,
    addProduct,
}