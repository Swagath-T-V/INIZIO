const calculateShippingCharge = (pincode, totalAmount) => {

    const fixedShippingCharge = 50
    const freeShippingCharge = 5000

    if (totalAmount >= freeShippingCharge) {
        return 0
    }

    const pincodeZone = {
        '671314': 60,
        '560068': 75
    }

    return pincodeZone[pincode] || fixedShippingCharge
}

module.exports = {
    calculateShippingCharge
}