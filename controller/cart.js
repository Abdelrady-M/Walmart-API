const mongoose = require("mongoose");
const cartModel = require("../models/cart");
const productModel = require("../models/product");
const jwt = require("jsonwebtoken");
const { jwtDecode } = require('jwt-decode');

var userIdFromHeaders = (req) => {
    var res;
    const { token, token2 } = req.headers;
    if (token) {
        try {
            userId = jwtDecode(token).id;
            res = { userId };
            console.log(userId);
        } catch (err) {
            console.error('JWT decoding error:', err);
        }
    } else if (token2) {
        let { userId, cartId } = JSON.parse(token2);
        res = { userId, cartId };
    }
    return res;
};
// var userIdFromHeaders = (req) => {
//     var res;
//     const { token, token2 } = req.headers;
//     if (token) {
//         try {
//             userId = jwtDecode(token).id;
//             res = { userId };
//             console.log(userId);
//         } catch (err) {
//             console.log(err);
//         }
//     } else if (token2) {
//         let { userId, cartId } = JSON.parse(token2);
//         res = { userId, cartId };
//     }
//     return res;
// };





var getAllCartProducts = async (req, res) => {
    var temp = userIdFromHeaders(req);
    var userId = temp ? temp.userId : undefined;
    // console.log(1);
    if (userId) {
        try {
            var data = await cartModel
                .findOne({ userId })
                .populate(
                    "items._id",
                    "title quantity price discountPercentage priceAfterDescount description thumbnail "
                );
            res.status(200).json({ data });
        } catch (err) {
            res.status(404).json({ message: err });
        }
    } else {
        // case a guest tries to get his empty cart before signing up or adding any products
        res.status(404).json({ message: "you don't have a cart" });
    }
};

var addUserCart = async (req, res) => {
    var { userId, cartId } = userIdFromHeaders(req);
    // console.log(2);
    if (!userId) res.status(401).json({ message: "Unknown User" });

    if (cartId) {
        // transferring the guest cart to the registered user
        try {
            var data = await cartModel.updateOne(
                { _id: cartId },
                { userId, guest: false }
            );
            res.status(201).json({ data });
        } catch (err) {
            res.status(403).json({ message: err.message });
        }
    } else {
        try {
            var data = await cartModel.create({ userId, items: [] });
            res.status(201).json({ data });
        } catch (err) {
            if (err.message.includes("duplicate key")) {
                // ERROR Handler: case if it accidentally created a userId that is used for a guest:=>
                // delete it and create a new one for the user
                if (Object.keys(err.keyValue).includes("userId")) {
                    // Get the Duplicated cart
                    var check = await cartModel.findOne({ userId });
                    // check if it is for another guest to replace it
                    if (check.guest) {
                        // case a guest signed up change it to not guest
                        try {
                            var data = await cartModel.replaceOne(
                                { userId },
                                { userId, items: [] }
                            );
                            res.status(201).json({
                                data,
                                To_Whom_It_May_Concern: "I just replaced a guest cart",
                            });
                        } catch (err) {
                            res.status(403).json({ message: err.message });
                        }
                    } else {
                        res.status(403).json({ message: err });
                    }
                } else {
                    // send a message about the Duplicated key
                    let message = {
                        cause: `Duplicate ${Object.keys(err.keyValue)[0]}`,
                    };
                    res.status(403).json({ message });
                }
            } else {
                res.status(400).json({ message: err });
            }
        }
    }
};

var addOneProductToCart = async (req, res) => {
    try {
        var temp = userIdFromHeaders(req);
        var { userId, token } = temp || {};
        var { quantity } = req.body;
        var { productId } = req.params;

        // Check if userId is present and retrieve or create cart accordingly
        var cart = await cartModel.findOne({ userId });
        if (!cart) {
            // If cart doesn't exist, create a new one with the provided userId or generated ObjectId
            cart = await cartModel.create({ userId, guest: !userId, items: [] });
        }

        // Adding the product to the cart
        var selectedProduct = await productModel.findOne({ _id: productId });
        var newItem = {
            _id: productId,
            priceWhenAdded: selectedProduct.price,
            quantity,
        };

        // Check if the item already exists in the cart
        var existingItemIndex = cart.items.findIndex(item => item._id.equals(productId));
        if (existingItemIndex !== -1) {
            cart.items[existingItemIndex].quantity += quantity; // Increment quantity if item already exists
        } else {
            cart.items.push(newItem); // Add new item to the cart
        }

        // Save the updated cart
        await cart.save();

        // Respond with success message and updated cart data
        res.status(200).json({ message: "Product added to cart successfully", cart });
    } catch (err) {
        if (err.message.includes("duplicate key")) {
            let message = {
                cause: `Duplicate ${Object.keys(err.keyValue)[0]}`,
                message: "Try it one more time",
            };
            res.status(403).json({ message });
        } else {
            res.status(400).json({ message: err.message });
        }
    }
};





// var addOneProductToCart = async (req, res) => {
//     var temp = userIdFromHeaders(req);
//     var userId = temp ? temp.userId : undefined;
//     // console.log(userId);
//     // console.log(3);
//     var { quantity } = req.body;
//     var { productId } = req.params;
//     var data = { guest: false };
//     // case a guest added to cart===============>
//     // create a guest cart then add to it
//     if (userId) {
//         data = await cartModel.create(
//             { userId },
//             { $setOnInsert: { userId, guest: false, items: [] } }, // SetOnInsert ensures cart creation only if userId doesn't exist
//             { upsert: true, new: true }
//         );
//     } else {
//         // If userId is not present, create a guest cart
//         userId = mongoose.Types.ObjectId();
//         data = await cartModel.create({ userId, guest: true, items: [] });
//     }


//     if (userId) {
//         try {
//             // userId = mongoose.Types.ObjectId();
//             data = await cartModel.create({ userId, guest: false, items: [] });
//         } catch (err) {
//             if (err.message.includes("duplicate key")) {
//                 let message = {
//                     cause: `Duplicate ${Object.keys(err.keyValue)[0]}`,
//                     message: "try it one more time",
//                 };
//                 res.status(403).json({ message });
//             } else {
//                 res.status(400).json({ message: err });
//             }
//         }
//     }
//     else if (!userId) {
//         try {
//             userId = mongoose.Types.ObjectId();
//             data = await cartModel.create({ userId, guest: true, items: [] });
//         } catch (err) {
//             if (err.message.includes("duplicate key")) {
//                 let message = {
//                     cause: `Duplicate ${Object.keys(err.keyValue)[0]}`,
//                     message: "try it one more time",
//                 };
//                 res.status(403).json({ message });
//             } else {
//                 res.status(400).json({ message: err });
//             }
//         }
//     }
//     // adding the product to the users cart
//     try {
//         var selectedProduct = await productModel.findOne({ _id: productId });
//         var newItem = {
//             _id: productId,
//             priceWhenAdded: selectedProduct.price,
//             quantity,
//         };
//         var check = await cartModel.findOne({
//             userId,
//             "items._id": { $eq: productId },
//         });
//         if (check === null) {
//             var updateNotification = await cartModel.updateOne(
//                 { userId },
//                 { $addToSet: { items: newItem } }
//             );
//             if (updateNotification.modifiedCount != 0) {
//                 // if the product has been added successfully just respond with the update notification
//                 res.status(202).json({
//                     data: updateNotification,
//                     // userId,
//                     // guest: data.guest,
//                     data,
//                 });
//             } else if (updateNotification.matchedCount === 0) {
//                 res.status(404).json({
//                     message: "Could'n find user with this id",
//                 });
//             }
//         } else {
//             var updateNotification = await cartModel.updateOne(
//                 { userId, "items._id": productId },
//                 { $inc: { "items.$.quantity": 1 } }
//             );
//             res.status(203).json({
//                 message: "We added another item of this Product to your cart",
//                 userId,
//             });
//         }
//     } catch (err) {
//         res.status(401).json({ message: err.message });
//     }
// };

var modifyOneProductFromCart = async (req, res) => {
    var temp = userIdFromHeaders(req);
    var userId = temp ? temp.userId : undefined;
    // console.log(4);
    var { productId, quantity, priceWhenAdded } = req.body;
    if (!productId) {
        res.status(401).json({ message: "Must provide the product id" });
    } else {
        try {
            var { items } = await cartModel.findOne(
                { userId, "items._id": { $eq: productId } },
                { items: 1, _id: 0 }
            );
            for (var product of items) {
                if (product._id === productId) {
                    if (!quantity) {
                        quantity = product.quantity;
                    }
                    if (!priceWhenAdded) {
                        priceWhenAdded = product.priceWhenAdded;
                    }
                    console.log("for items");
                }
            }
        } catch (error) {
            console.log("findOne , 4", error);
        }
    }
    try {
        var updateNotification = await cartModel.updateOne(
            { userId, "items._id": productId },
            {
                $set: {
                    "items.$.quantity": quantity,
                    "items.$.priceWhenAdded": priceWhenAdded,
                },
            }
        );
        res.status(202).json({ data: updateNotification });
    } catch (err) {
        // console.log("err 4", err);
        res.status(401).json({ message: err.message });
    }
};

var removeOneProductFromCart = async (req, res) => {
    var temp = userIdFromHeaders(req);
    var userId = temp ? temp.userId : undefined
    // console.log(5);
    var { productId } = req.params;
    try {
        var deleteNotification = await cartModel.updateOne(
            { userId },
            { $pull: { items: { _id: productId } } }
        );
        res.status(202).json({ data: deleteNotification });
    } catch (err) {
        res.status(401).json({ message: err.message });
    }
};

var deleteUserCart = async (req, res) => {
    var { userId } = userIdFromBody(req);

    try {
        var deleteNotification = await cartModel.deleteOne({ userId });
        res.status(202).json({ data: deleteNotification });
    } catch (err) {
        res.status(401).json({ message: err.message });
    }
};

module.exports = {
    getAllCartProducts,
    addOneProductToCart,
    modifyOneProductFromCart,
    removeOneProductFromCart,
    addUserCart,
    deleteUserCart,
};
