const express = require('express');
const router = express.Router();
const prisma = require('../utils/db');

// Get all workers with search functionality
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    
    let workers;
    
    if (search) {
      // Search by name, address, or phone number
      workers = await prisma.worker.findMany({
        where: {
          OR: [
            { name: { contains: search } },
            { address: { contains: search } },
            { number: { contains: search } }
          ]
        },
        orderBy: {
          name: 'asc'
        }
      });
    } else {
      // Get all workers
      workers = await prisma.worker.findMany({
        orderBy: {
          name: 'asc'
        }
      });
    }
    
    res.render('workers/index', {
      user: req.user,
      workers,
      search: search || '',
      activePage: 'workers',
      successMessage: req.query.success,
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).send('Error fetching workers');
  }
});

// Get worker creation form
router.get('/create', (req, res) => {
  res.render('workers/create', {
    user: req.user,
    activePage: 'workers',
    errorMessage: req.query.error
  });
});

// Create new worker
router.post('/create', async (req, res) => {
  try {
    const { name, address, number } = req.body;
    
    await prisma.worker.create({
      data: {
        name,
        address,
        number
      }
    });
    
    res.redirect('/workers?success=Worker created successfully');
  } catch (error) {
    console.error('Error creating worker:', error);
    res.redirect('/workers/create?error=Failed to create worker');
  }
});

// Get worker details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const worker = await prisma.worker.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        sales: {
          orderBy: {
            date: 'desc'
          },
          include: {
            customer: true
          }
        }
      }
    });
    
    if (!worker) {
      return res.redirect('/workers?error=Worker not found');
    }
    
    // Log the structure of the first sale if available
    if (worker.sales && worker.sales.length > 0) {
      console.log('First worker sale structure:', JSON.stringify(worker.sales[0], null, 2));
    }
    
    res.render('workers/show', {
      user: req.user,
      worker,
      sales: worker.sales,
      activePage: 'workers',
      successMessage: req.query.success,
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching worker details:', error);
    res.redirect('/workers?error=Failed to fetch worker details');
  }
});

// Get worker edit form
router.get('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    
    const worker = await prisma.worker.findUnique({
      where: {
        id: parseInt(id)
      }
    });
    
    if (!worker) {
      return res.redirect('/workers?error=Worker not found');
    }
    
    res.render('workers/edit', {
      user: req.user,
      worker,
      activePage: 'workers',
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching worker for edit:', error);
    res.redirect('/workers?error=Failed to fetch worker for edit');
  }
});

// Update worker
router.post('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, number } = req.body;
    
    await prisma.worker.update({
      where: {
        id: parseInt(id)
      },
      data: {
        name,
        address,
        number
      }
    });
    
    res.redirect(`/workers/${id}?success=Worker updated successfully`);
  } catch (error) {
    console.error('Error updating worker:', error);
    res.redirect(`/workers/${req.params.id}/edit?error=Failed to update worker`);
  }
});

// Delete worker
router.post('/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if worker has related sales
    const worker = await prisma.worker.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        sales: true
      }
    });
    
    if (worker.sales.length > 0) {
      return res.redirect(`/workers/${id}?error=Cannot delete worker with related sales`);
    }
    
    await prisma.worker.delete({
      where: {
        id: parseInt(id)
      }
    });
    
    res.redirect('/workers?success=Worker deleted successfully');
  } catch (error) {
    console.error('Error deleting worker:', error);
    res.redirect(`/workers/${req.params.id}?error=Failed to delete worker`);
  }
});

module.exports = router; 