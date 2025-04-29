const Brand = require("../../models/brandSchema");

const brandInfo = async (req, res) => {

    try {

        let search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        const brandData = await Brand.find({
            name: { $regex: search, $options: "i" },
            isDelete: false
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const totalBrands = await Brand.countDocuments({
            name: { $regex: search, $options: "i" },
            isDelete: false
        });

        const totalPages = Math.ceil(totalBrands / limit);

        res.render("brand", {
            brands: brandData,
            currentPage: page,
            totalPages: totalPages,
            totalBrands: totalBrands,
            search: search,
            activePage: "brand"
        });
    } catch (error) {
        console.log("Error in brandInfo", error);
        res.redirect("/admin/pageerror");
    }
};

const getAddBrand = async (req, res) => {
    try {
        return res.render("addBrand", {
            activePage: "brand"
        });
    } catch (error) {
        console.log("error in getAddBrand", error);
        return res.redirect("/admin/pageerror");
    }
};

const addBrand = async (req, res) => {
    try {
        const { name, description } = req.body;

        const existingBrand = await Brand.findOne({
            name: { $regex: new RegExp('^' + name + '$', 'i') }
        });

        if (existingBrand && existingBrand.isDelete === true) {
            existingBrand.isDelete = false;
            existingBrand.description = description;
            existingBrand.isListed = true;
            await existingBrand.save();
            return res.json({ success: true, message: 'Brand restored successfully' });
        } else if (existingBrand && existingBrand.isDelete === false) {
            return res.status(400).json({ success: false, message: 'Brand name already exists' });
        }

        const newBrand = new Brand({
            name,
            description,
        });

        await newBrand.save();
        return res.status(200).json({ success: true, message: "Brand added successfully" });
    } catch (error) {
        console.log("Error in addBrand", error);
        res.status(500).json({ error: "Server error occurred" });
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

const getEditBrand = async (req, res) => {
    try {
        const id = req.query.id;
        const brand = await Brand.findOne({ _id: id });
        res.render("edit-brand", {
            brand: brand,
            activePage: 'brand'
        });
    } catch (error) {
        console.log("error in getEditBrand", error);
        res.redirect("/admin/pageerror");
    }
};

const editBrand = async (req, res) => {
    try {
        const id = req.params.id;
        const { brandName, description } = req.body;

        const existingBrand = await Brand.findOne({
            name: { $regex: new RegExp('^' + brandName + '$', 'i') },
            _id: { $ne: id }
        });

        if (existingBrand && existingBrand.isDelete === false) {
            return res.status(400).json({ success: false, message: "Brand name already exists" });
        }

        const updateBrand = await Brand.findByIdAndUpdate(id, {
            name: brandName,
            description: description
        }, { new: true });

        if (updateBrand) {
            return res.status(200).json({ success: true, message: "Brand updated successfully", redirectUrl: "/admin/brand" });
        } else {
            return res.status(400).json({ success: false, message: "Brand not found" });
        }
    } catch (error) {
        console.log("Error in editBrand", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const deleteBrand = async (req, res) => {
    try {
        const { brandId } = req.params;
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
        console.error("Error in softDeleteBrand", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    brandInfo,
    getAddBrand,
    addBrand,
    getListBrand,
    getUnlistBrand,
    getEditBrand,
    editBrand,
    deleteBrand
};