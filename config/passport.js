const User = require("../models/userSchema");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const env = require("dotenv").config();

// console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);  
// console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_SECRET_ID); 

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_SECRET_ID,
    callbackURL: "/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
    console.log('Profile:', profile);
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
            return done(null, user);
        } else {
            user = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
            });
            await user.save();
            return done(null, user);
        }
    } catch (error) {
        console.error('Error in strategy:', error);
        return done(error, null);
    }
}));

//for assigning to session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

//to fetch the data from session
passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => {
            done(null, user);
        })
        .catch(err => {
            done(err, null);  
        });
});

module.exports = passport;
