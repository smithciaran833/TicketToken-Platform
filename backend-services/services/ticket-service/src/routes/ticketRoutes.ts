import { Router } from 'express';
import { TicketService } from '../services/ticketService';

const router = Router();
const ticketService = new TicketService();

// POST /api/tickets - Create/mint new ticket
router.post('/tickets', async (req, res) => {
  try {
    const ticketData = req.body;
    
    // Validate required fields
    const required = ['ticketId', 'eventId', 'buyerId', 'price', 'buyerWallet'];
    for (const field of required) {
      if (!ticketData[field]) {
        return res.status(400).json({ 
          success: false, 
          error: `Missing required field: ${field}` 
        });
      }
    }

    const result = await ticketService.createTicket(ticketData);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tickets/:id/validate - Validate ticket
router.get('/tickets/:id/validate', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await ticketService.validateTicket(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Validate ticket error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/tickets/:id/transfer - Transfer ticket
router.post('/tickets/:id/transfer', async (req, res) => {
  try {
    const { id } = req.params;
    const { fromWallet, toWallet } = req.body;
    
    if (!fromWallet || !toWallet) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing fromWallet or toWallet' 
      });
    }

    const result = await ticketService.transferTicket(id, fromWallet, toWallet);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Transfer ticket error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as ticketRoutes };
