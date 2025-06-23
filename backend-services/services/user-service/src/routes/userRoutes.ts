import { Router } from 'express';
import { UserService } from '../services/userService';

const router = Router();
const userService = new UserService();

// POST /api/users - Create new user
router.post('/users', async (req, res) => {
  try {
    const userData = req.body;
    
    // Validate required fields
    const required = ['userId', 'email', 'name'];
    for (const field of required) {
      if (!userData[field]) {
        return res.status(400).json({ 
          success: false, 
          error: `Missing required field: ${field}` 
        });
      }
    }

    const result = await userService.createUser(userData);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/users/:id/wallets - Get user wallets
router.get('/users/:id/wallets', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await userService.getUserWallets(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Get wallets error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/users/:id/connect-phantom - Connect Phantom wallet
router.post('/users/:id/connect-phantom', async (req, res) => {
  try {
    const { id } = req.params;
    const { phantomPublicKey } = req.body;
    
    if (!phantomPublicKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing phantomPublicKey' 
      });
    }

    const result = await userService.connectPhantomWallet(id, phantomPublicKey);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Connect Phantom error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as userRoutes };
