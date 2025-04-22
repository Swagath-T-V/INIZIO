const SubCategory = require("../../models/subCategorySchema")


const subCategoryInfo =async(req,res)=>{
    
    try {
        
        let search =req.query.search || ""
        const page = parseInt(req.query.page) || 1
        const limit = 6
        const skip =(page-1)*limit

        const subCategoryData = await SubCategory.find({
            name: { $regex: search, $options: "i" },
            isDelete:false
        })
        .sort({createdAt:-1})   
        .skip(skip)
        .limit(limit)
 
        const totalSubCategory = await SubCategory.countDocuments({ isDelete: false})
        const totalPages = Math.ceil(totalSubCategory/limit)

        res.render("subCategory",{
            cat:subCategoryData,
            currentPage:page,
            totalPages:totalPages,
            totalSubCategory:totalSubCategory,
            search:search,
            activePage:"subCategory"
        })

    } catch (error) {
        
        console.log("Error in subCategoryInfo",error)
        res.redirect("/admin/pageerror")
        
    }

}

const addSubCategory = async (req, res) => {

    try {
        
        if (req.method === 'POST') {
            const { name, description } = req.body;

            const existingSubCategory = await SubCategory.findOne({ 
                name: { $regex: new RegExp('^' + name + '$','i')}
            })

            if (existingSubCategory && existingSubCategory.isDelete === true) {

                existingSubCategory.isDelete = false; 
                existingSubCategory.description = description; 
                existingSubCategory.isListed = true; 
                await existingSubCategory.save();
                
                return res.json({ success: true, message: 'SubCategory restored successfully' });

            }else if (existingSubCategory && existingSubCategory.isDelete === false) {

                return res.status(400).json({ success: false, message: 'SubCategory name already exists' });

            }
            
            const newSubCategory = new SubCategory({
                name,
                description,
            });

            await newSubCategory.save();

            return res.status(200).json({success: true, message: "SubCategory added successfully"});
        }

        res.render("addSubCategory", {
            activePage: 'subCategory'
        });

    } catch (error) {
        
        console.log("Error in addSubCategory", error);
        res.status(500).json({ error: "Server error occurred" });
    }
};


const getListSubCategory = async (req, res) => {

    try {

        let id = req.query.id;
        await SubCategory.updateOne({ _id: id }, { $set: { isListed: false } });
        res.json({ success: true, message: 'SubCategory has been unlisted.' });

    } catch (error) {

        console.log("error in getEditSubCategory", error);
        res.status(500).json({ success: false, message: 'Failed to unlist the subCategory.' });

    }
};

const getUnlistSubCategory = async (req, res) => {

    try {

        let id = req.query.id;
        await SubCategory.updateOne({ _id: id }, { $set: { isListed: true } });
        res.json({ success: true, message: 'SubCategory has been listed.' });

    } catch (error) {

        res.status(500).json({ success: false, message: 'Failed to list the subCategory.' });

    }
};



const getEditSubCategory = async(req,res)=>{

    try {

        const id = req.query.id
        const subCategory = await SubCategory.findOne({_id:id})

        res.render("edit-subCategory",{
            subCategory:subCategory,
            activePage: 'subCategory'
        })
        

    } catch (error) {

        console.log("error in getEditSubcategroy",error)
        res.redirect("/admin/pageerror")
        
    }

}

const editSubCategory = async (req, res) => {

    try {

        const id = req.params.id;
        const { subCategoryName, description } = req.body;

        const existingSubCategory = await SubCategory.findOne({
            name: { $regex: new RegExp('^' + subCategoryName + '$', 'i') },
            _id: { $ne: id }
        });

        if (existingSubCategory && existingSubCategory.isDelete === false) {

            return res.status(400).json({success: false,message: "subCategory name already exists"});

        }

        const updateSubCategory = await SubCategory.findByIdAndUpdate(id, {
            name: subCategoryName,
            description: description
        }, { new: true });

        if (updateSubCategory) {

            return res.status(200).json({success: true, message: "SubCategory updated successfully", redirectUrl: "/admin/subCategory" });

        } else {

            return res.status(400).json({success: false,message: "SubCategory not found" });
        }

    } catch (error) {

        console.log("error in editSubCategory",error)
        return res.status(500).json({success: false, message: "Internal server error"});

    }
};

const deleteSubCategory = async(req,res)=> {

    try {

        const { subCategoryId } = req.params;
        const updatedSubCategory = await SubCategory.findByIdAndUpdate(
            subCategoryId,
            { $set: { isDelete: true } },
            { new: true }
        );
 
        if (updatedSubCategory) {

            res.status(200).json({ success: true, message: "SubCategory soft deleted successfully" })
            
        } else {

            res.status(404).json({ success: false, message: "SubCategory not found" })

        }
        
    } catch (error) {

        console.error("Error in softDeleteSubCategory", error);
        res.status(500).json({ success: false, message: "Internal server error" })
        
    }
}
 

module.exports = {

    subCategoryInfo,
    addSubCategory,
    getListSubCategory,
    getUnlistSubCategory,
    getEditSubCategory,
    editSubCategory,
    deleteSubCategory
    
}