const User = require("../models/userSchema");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const Wallet = require("../models/walletSchema");

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_SECRET_ID,
            callbackURL: "/auth/google/callback",
            passReqToCallback: true, 
        },
        async (req, accessToken, refreshToken, profile, done) => {

            try {

                if (!profile || !profile.id) {
                    console.error("Profile object is invalid or missing id:", profile);
                    return done(new Error("Invalid profile data from Google"), null);
                }

                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    if (!user.isBlocked) {
                        return done(null, user);
                    } else {
                        return done(null, false, { message: "User is blocked by the Admin" });
                    }
                } else {
                    const referralToken = uuidv4().replace(/-/g, "").slice(0, 10);
                    user = new User({
                        name: profile.displayName || "Google User",
                        email: profile.emails && profile.emails[0] ? profile.emails[0].value : "",
                        googleId: profile.id,
                        referralToken: referralToken,
                    });

                    await user.save();

                    const newWallet = new Wallet({
                        userId: user._id,
                        balance: 0,
                        currency: "INR",
                        transactions: [],
                    });

                    await newWallet.save();

                    const referralTokenFromUrl = req.session && req.session.referralToken;

                    if (referralTokenFromUrl) {
                        const referrer = await User.findOne({ referralToken: referralTokenFromUrl });

                        if (referrer && referrer._id.toString() !== user._id.toString()) {
                            await Wallet.findOneAndUpdate(
                                { userId: referrer._id },
                                {
                                    $inc: { balance: 500 },
                                    $push: {
                                        transactions: {
                                            amount: 500,
                                            type: "Credit",
                                            method: "Referral",
                                            status: "Completed",
                                            description: `Referral bonus for inviting ${user.email}`,
                                            date: new Date(),
                                        },
                                    },
                                    $set: { lastUpdated: new Date() },
                                },
                                { new: true }
                            );

                            await Wallet.findOneAndUpdate(
                                { userId: user._id },
                                {
                                    $inc: { balance: 250 },
                                    $push: {
                                        transactions: {
                                            amount: 250,
                                            type: "Credit",
                                            method: "Referral",
                                            status: "Completed",
                                            description: `Welcome bonus for joining via referral`,
                                            date: new Date(),
                                        },
                                    },
                                    $set: { lastUpdated: new Date() },
                                },
                                { new: true }
                            );
                        }
                    }

                    if (req.session && req.session.referralToken) {
                        delete req.session.referralToken;
                    }

                    return done(null, user);
                }

            } catch (error) {

                console.error("Error in GoogleStrategy:", error);
                return done(error, null);

            }
        }
    )
);


// Serialize user to session
passport.serializeUser((user, done) => {
    done(null, user.id);
});


// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;