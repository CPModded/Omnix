"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_1 = require("../controllers/payment.controller");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.post('/checkout', auth_1.isAuthenticated, payment_controller_1.PaymentController.createCheckoutSession);
router.post('/webhook', payment_controller_1.PaymentController.handleWebhook);
exports.default = router;
