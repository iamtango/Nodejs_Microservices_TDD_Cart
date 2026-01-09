import { Router } from 'express';
import {
    rateFruitController,
    getMyRatingsController,
    getMyFruitRatingController,
    getFruitRatingSummaryController,
    deleteRatingController,
    getRatableFruitsController
} from '../controllers/ratingController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Public route - Get rating summary for a fruit
router.get('/fruit/:fruitId/summary', getFruitRatingSummaryController);

// Protected routes - Require authentication
router.use(authMiddleware);

// Get fruits that user can rate
router.get('/ratable', getRatableFruitsController);

// Get all user's ratings
router.get('/', getMyRatingsController);

// Get user's rating for a specific fruit
router.get('/:fruitId', getMyFruitRatingController);

// Submit a rating for a fruit
router.post('/', rateFruitController);

// Delete user's rating for a fruit
router.delete('/:fruitId', deleteRatingController);

export default router;
