import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';

const router = Router();
const paymentController = new PaymentController();

// Core payment processing
router.post('/payments/process', paymentController.processPayment.bind(paymentController));
router.post('/payments/refund', paymentController.refundPayment.bind(paymentController));
router.get('/payments/:id', paymentController.getPaymentStatus.bind(paymentController));

// Stripe webhooks
router.post('/webhooks/stripe', paymentController.handleStripeWebhook.bind(paymentController));

// Payment validation
router.post('/payments/validate', paymentController.validatePayment.bind(paymentController));

export default router;
