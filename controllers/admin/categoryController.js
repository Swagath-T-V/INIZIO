const Category = require("../../models/categorySchema")


const categoryInfo =async(req,res)=>{

    try {
        
        let search =req.query.search || ""
        const page = parseInt(req.query.page) || 1
        const limit =3
        const skip =(page-1)*limit

        const categoryData = await Category.find({
            name: { $regex: search, $options: "i" },
            isDelete:false
        })
        .sort({createdAt:-1})   
        .skip(skip)
        .limit(limit)

        const totalCategory = await Category.countDocuments({ isDelete: false})
        const totalPages = Math.ceil(totalCategory/limit)

        res.render("category",{
            cat:categoryData,
            currentPage:page,
            totalPages:totalPages,
            totalCategory:totalCategory,
            search:search,
            activePage:"category"
        })

    } catch (error) {
        
        console.log("Error in categoryInfo",error)
        res.redirect("/admin/pageerror")
    }

}

const addCategory = async (req, res) => {

    try {
        if (req.method === 'POST') {
            const { name, description } = req.body;

            const existingCategory = await Category.findOne({ name });

            if (existingCategory && existingCategory.isDelete === true) {

                existingCategory.isDelete = false; 
                existingCategory.description = description; 
                existingCategory.isListed = true; 
                await existingCategory.save();
                
                return res.json({ success: true, message: 'Category restored successfully' });

            }
            else if (existingCategory && existingCategory.isDelete === false) {

                return res.status(400).json({ success: false, message: 'Category name already exists' });

            }

            const newCategory = new Category({

                name,
                description,

            });

            await newCategory.save();

            return res.status(200).json({

                success: true,
                message: "Category added successfully",

            });
        }

        res.render("addCategory", {

            activePage: 'category'

        });

    } catch (error) {
        
        console.log("Error in addCategory", error);
        res.status(500).json({ error: "Server error occurred" });

    }
};


const getListCategory = async (req, res) => {

    try {

        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.json({ success: true, message: 'Category has been unlisted.' });

    } catch (error) {

        res.status(500).json({ success: false, message: 'Failed to unlist the category.' });

    }
};

const getUnlistCategory = async (req, res) => {

    try {

        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.json({ success: true, message: 'Category has been listed.' });

    } catch (error) {

        res.status(500).json({ success: false, message: 'Failed to list the category.' });

    }
};



const getEditCategory = async(req,res)=>{

    try {

        const id = req.query.id
        const category = await Category.findOne({_id:id})
        res.render("edit-category",{
            category:category,
            activePage: 'category'
        })
        

    } catch (error) {

        console.log("error in getEditCategory",error)
        res.redirect("/admin/pageerror")
        
    }

}

const editCategory = async (req, res) => {

    try {

        const id = req.params.id;
        const { categoryName, description } = req.body;
        
        const existingCategory = await Category.findOne({ name: categoryName });
        
        if (existingCategory) {

            return res.status(200).json({
                success: true,
                message: "Category updated successfully",
                redirectUrl:"/admin/category"
            });
        }

        const updateCategory = await Category.findByIdAndUpdate(id, {
            name: categoryName,
            description: description
        }, { new: true });

        if (updateCategory) {
            return res.status(200).json({
                success: true,
                message: "Category updated successfully",
                redirectUrl: "/admin/category" 
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Category not found"
            });
        }

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });

    }
};

const deleteCategory = async(req,res)=> {

    try {

        const { categoryId } = req.params;
        
        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            { $set: { isDelete: true } },
            { new: true }
        );

        if (updatedCategory) {
            res.status(200).json({ success: true, message: "Category soft deleted successfully" });
        } else {
            res.status(404).json({ success: false, message: "Category not found" });
        }

    } catch (error) {

        console.error("Error in softDeleteCategory", error);
        res.status(500).json({ success: false, message: "Internal server error" });

    }
}


module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
    deleteCategory
    
}