const mongoose = require("mongoose")

const connectDB = async() =>{

    try{

        await mongoose.connect(process.env.MONGODB_URI)
        console.log("DB Connected")

    }catch(error){

        console.log("Error in connecting DB",error)
        process.exit(1)
    }
}

module.exports = connectDB
