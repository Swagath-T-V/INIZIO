const User = require("../models/userSchema")


const userAuth = (req, res, next) => {
    if (req.session.user) {
        User.findById(req.session.user)
            .then(data => {
                if (data && !data.isBlocked) {
                    next()
                } else {
                    res.redirect("/login")
                }
            })
            .catch(error => {
                console.log("Error in user middleware",error)
                res.status(500).send("internal Server error")
            })
    } else {
        res.redirect("/login")
    }
}


const adminAuth = (req, res, next) => {

    if (req.session.admin) {
        User.findById(req.session.admin)
            .then(data => {
                if (data && data.isAdmin) {
                    return next()
                } else {
                    return res.redirect("/admin/login")
                }
            })
            .catch(error => {
                console.log("Error in admin middleware ", error)
                res.status(500).send("internal error")
            })
    } else {
        return res.redirect("/admin/login")
    }
}

module.exports = {
    adminAuth,
    userAuth
}

