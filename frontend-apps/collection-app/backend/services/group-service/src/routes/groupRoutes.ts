import { Router } from 'express';
import { GroupPurchaseService } from '../groups/groupPurchase';

const router = Router();
const groupService = new GroupPurchaseService();

// Create a new group
router.post('/', async (req, res) => {
  try {
    const { name, description, maxMembers, createdBy } = req.body;
    
    if (!name || !createdBy) {
      return res.status(400).json({ error: 'Name and createdBy are required' });
    }

    const group = await groupService.createGroup({
      name,
      description: description || '',
      maxMembers: maxMembers || 10,
      createdBy,
      isActive: true
    });

    res.status(201).json(group);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Get all groups
router.get('/', async (req, res) => {
  try {
    const groups = await groupService.getAllGroups();
    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get specific group
router.get('/:id', async (req, res) => {
  try {
    const group = await groupService.getGroup(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json(group);
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Join a group
router.post('/:id/join', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const success = await groupService.joinGroup(req.params.id, userId);
    
    if (!success) {
      return res.status(400).json({ error: 'Cannot join group - may be full' });
    }

    res.json({ success: true, message: 'Successfully joined group' });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// Create a group purchase
router.post('/:id/purchase', async (req, res) => {
  try {
    const { ticketId, quantity, pricePerTicket } = req.body;
    const groupId = req.params.id;

    if (!ticketId || !quantity || !pricePerTicket) {
      return res.status(400).json({ error: 'ticketId, quantity, and pricePerTicket are required' });
    }

    const purchase = await groupService.createPurchase({
      groupId,
      ticketId,
      quantity,
      pricePerTicket,
      status: 'pending'
    });

    res.status(201).json(purchase);
  } catch (error) {
    console.error('Error creating purchase:', error);
    res.status(500).json({ error: 'Failed to create purchase' });
  }
});

// Get purchases for a group
router.get('/:id/purchases', async (req, res) => {
  try {
    const purchases = await groupService.getGroupPurchases(req.params.id);
    res.json(purchases);
  } catch (error) {
    console.error('Error fetching group purchases:', error);
    res.status(500).json({ error: 'Failed to fetch group purchases' });
  }
});

export { router as groupRoutes };
