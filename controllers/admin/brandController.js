const Brand = require("../../models/brandSchema")
const Product = require("../../models/productSchema")

const getBrandPage = async(req, res) => {
    try {
        let search = req.query.search || ""
        const page = parseInt(req.query.page) || 1
        const limit = 4
        const skip = (page-1) * limit

        const brandData = await Brand.find({
            name: { $regex: search, $options: "i" },
            isDelete: false
        })
        .sort({createdAt: -1})   
        .skip(skip)
        .limit(limit)

        const totalBrands = await Brand.countDocuments({ isDelete: false })
        const totalPages = Math.ceil(totalBrands/limit)
        res.render("brand", {
            data: brandData,
            currentPage: page,
            totalPages: totalPages,
            totalCategory: totalBrands,
            search: search,
            activePage: "brands"
        })

    } catch (error) {
        console.log("Error in getBrandPage", error)
        res.redirect("/admin/pageerror")
    }
}

const addBrand = async (req, res) => {
    try {
        if (req.method === 'POST') {
            const { name } = req.body;

            if (!name || name.trim() === '') {
                return res.status(400).json({ success: false, message: 'Brand name is required' });
            }

            const existingBrand = await Brand.findOne({ name });

            if (existingBrand && existingBrand.isDelete === true) {
                existingBrand.isDelete = false; 
                existingBrand.isListed = true; 
                await existingBrand.save();
                
                return res.json({ success: true, message: 'Brand restored successfully' });
            }
            else if (existingBrand && existingBrand.isDelete === false) {
                return res.status(400).json({ success: false, message: 'Brand name already exists' });
            }

            const newBrand = new Brand({ name });
            await newBrand.save();

            return res.status(200).json({
                success: true,
                message: "Brand added successfully",
            });
        }

        res.render("addBrand", {
            activePage: 'brands'
        });
    } catch (error) {
        console.log("Error in addBrand", error);
        res.status(500).json({ success: false, message: "Server error occurred" });
    }
};

const getListBrand = async (req, res) => {
    try {
        let id = req.query.id;
        await Brand.updateOne({ _id: id }, { $set: { isListed: false } });
        res.json({ success: true, message: 'Brand has been unlisted.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to unlist the brand.' });
    }
};

const getUnlistBrand = async (req, res) => {
    try {
        let id = req.query.id;
        await Brand.updateOne({ _id: id }, { $set: { isListed: true } });
        res.json({ success: true, message: 'Brand has been listed.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to list the brand.' });
    }
};

const getEditBrand = async(req, res) => {
    try {
        const id = req.query.id
        const brand = await Brand.findOne({_id: id})
        res.render("edit-brand", {
            brand: brand,
            activePage: 'brands'
        })
    } catch (error) {
        res.redirect("/admin/pageerror")
    }
}


const editBrand = async (req, res) => {
    try {
        const id = req.params.id;
        const { brandName} = req.body;
        
        const existingBrand = await Brand.findOne({ name: brandName });
        if (existingBrand) {
            return res.status(400).json({
                success: false,
                message: "Brand exists, Please choose another name"
            });
        }

        const updateBrand = await Brand.findByIdAndUpdate(id, {
            name: brandName,
        }, { new: true });

        if (updateBrand) {
            return res.status(200).json({
                success: true,
                message: " updated successfully",
                redirectUrl: "/admin/brand"  
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Brand not found"
            });
        }
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};
const deleteBrand = async(req, res) => {
    try {
        const brandId = req.params.brandId;
        const updatedBrand = await Brand.findByIdAndUpdate(
            brandId,
            { $set: { isDelete: true } },
            { new: true }
        );

        if (updatedBrand) {
            res.status(200).json({ success: true, message: "Brand soft deleted successfully" });
        } else {
            res.status(404).json({ success: false, message: "Brand not found" });
        }
    } catch (error) {
        console.error("Error in deleteBrand", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

module.exports = {
    getBrandPage,
    addBrand,
    getListBrand,
    getUnlistBrand,
    getEditBrand,
    editBrand,
    deleteBrand
}