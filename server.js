const express = require("express")
const app = express()
const path = require("path")
const dotenv = require("dotenv")
dotenv.config()
const session = require("express-session")
const db = require("./config/db")
const passort = require("./config/passport")
const userRouter =require("./routes/userRouter")
const adminRouter = require("./routes/adminRouter")
// const ejs = require("ejs")
db()

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized : true ,
    cookie : {
        secure:false,
        httpOnly:true,
        maxAge : 1000*60*60*24
    }
}))

app.use(passort.initialize())
app.use(passort.session())

app.set("view engine","ejs")
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')])
app.use(express.static(path.join(__dirname,"public")))

// app.get("/",(req,res)=>{
//     res.redirect("/signup")
// })

// app.get("/admin",(req,res)=>{
//     res.redirect("/admin/login")
// })
app.use("/",userRouter)
app.use("/admin",adminRouter)



// const PORT=1111 || process.env.PORT 
app.listen(1111, ()=>{
    console.log("Server is Running")
})

module.exports = app ;