import { Request, Response } from 'express';
import {
    rateFruit,
    getUserRatings,
    getUserRatingForFruit,
    getFruitRatingSummary,
    deleteRating,
    getRatableFruits,
    CreateRatingDto
} from '../services/ratingService';

// Interface for authenticated request
interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        email: string;
    };
}

/**
 * Rate a fruit (POST /api/cart/ratings)
 */
export const rateFruitController = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }

        const { fruitId, rating, review } = req.body;

        // Validate rating
        if (!fruitId) {
            res.status(400).json({
                success: false,
                message: 'Fruit ID is required'
            });
            return;
        }

        if (rating === undefined || rating < 1 || rating > 5) {
            res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
            return;
        }

        const ratingData: CreateRatingDto = { fruitId, rating, review };
        const result = await rateFruit(userId, ratingData);

        res.status(201).json({
            success: true,
            message: 'Rating submitted successfully',
            rating: {
                id: result.rating._id,
                fruitId: result.rating.fruitId,
                rating: result.rating.rating,
                review: result.rating.review,
                createdAt: result.rating.createdAt
            },
            fruitStats: {
                averageRating: result.averageRating,
                totalRatings: result.totalRatings
            }
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage === 'FRUIT_NOT_FOUND') {
            res.status(404).json({
                success: false,
                message: 'Fruit not found'
            });
            return;
        }

        if (errorMessage === 'NOT_PURCHASED') {
            res.status(403).json({
                success: false,
                message: 'You can only rate fruits you have purchased'
            });
            return;
        }

        console.error('Error rating fruit:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit rating'
        });
    }
};

/**
 * Get user's own ratings (GET /api/cart/ratings)
 */
export const getMyRatingsController = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }

        const ratings = await getUserRatings(userId);

        res.status(200).json({
            success: true,
            message: 'Ratings retrieved successfully',
            ratings: ratings.map(r => ({
                id: r._id,
                fruitId: r.fruitId,
                rating: r.rating,
                review: r.review,
                createdAt: r.createdAt
            })),
            total: ratings.length
        });
    } catch (error) {
        console.error('Error fetching ratings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve ratings'
        });
    }
};

/**
 * Get user's rating for a specific fruit (GET /api/cart/ratings/:fruitId)
 */
export const getMyFruitRatingController = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const { fruitId } = req.params;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }

        const rating = await getUserRatingForFruit(userId, fruitId);

        if (!rating) {
            res.status(404).json({
                success: false,
                message: 'You have not rated this fruit'
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Rating retrieved successfully',
            rating: {
                id: rating._id,
                fruitId: rating.fruitId,
                rating: rating.rating,
                review: rating.review,
                createdAt: rating.createdAt
            }
        });
    } catch (error) {
        console.error('Error fetching rating:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve rating'
        });
    }
};

/**
 * Get rating summary for a fruit (GET /api/cart/ratings/fruit/:fruitId/summary)
 * This is a public endpoint
 */
export const getFruitRatingSummaryController = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { fruitId } = req.params;

        const summary = await getFruitRatingSummary(fruitId);

        if (!summary) {
            res.status(404).json({
                success: false,
                message: 'Fruit not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Rating summary retrieved successfully',
            summary
        });
    } catch (error) {
        console.error('Error fetching rating summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve rating summary'
        });
    }
};

/**
 * Delete user's rating for a fruit (DELETE /api/cart/ratings/:fruitId)
 */
export const deleteRatingController = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const { fruitId } = req.params;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }

        const deleted = await deleteRating(userId, fruitId);

        if (!deleted) {
            res.status(404).json({
                success: false,
                message: 'Rating not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Rating deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting rating:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete rating'
        });
    }
};

/**
 * Get fruits that user can rate (purchased but not yet rated)
 * GET /api/cart/ratings/ratable
 */
export const getRatableFruitsController = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }

        const ratableFruits = await getRatableFruits(userId);

        res.status(200).json({
            success: true,
            message: 'Ratable fruits retrieved successfully',
            fruits: ratableFruits,
            total: ratableFruits.length
        });
    } catch (error) {
        console.error('Error fetching ratable fruits:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve ratable fruits'
        });
    }
};
