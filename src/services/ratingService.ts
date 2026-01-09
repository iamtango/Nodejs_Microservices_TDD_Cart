import FruitRating, { IFruitRating } from '../models/fruitRating';
import TransactionHistory from '../models/transactionHistory';
import Fruit from '../models/fruit';
import { Types } from 'mongoose';

export interface CreateRatingDto {
    fruitId: string;
    rating: number;
    review?: string;
}

export interface RatingResult {
    rating: IFruitRating;
    averageRating: number;
    totalRatings: number;
}

export interface FruitRatingSummary {
    fruitId: string;
    fruitName: string;
    averageRating: number;
    totalRatings: number;
    ratings: {
        rating: number;
        review?: string;
        createdAt: Date;
    }[];
}

/**
 * Check if user has purchased a specific fruit
 * Returns the transaction ID if purchased, null otherwise
 */
export const hasUserPurchasedFruit = async (
    userId: string,
    fruitId: string
): Promise<Types.ObjectId | null> => {
    const transaction = await TransactionHistory.findOne({
        userId: new Types.ObjectId(userId),
        'items.fruitId': new Types.ObjectId(fruitId),
        status: 'COMPLETED'
    });

    return transaction ? transaction._id as Types.ObjectId : null;
};

/**
 * Check if user has already rated a fruit
 */
export const hasUserRatedFruit = async (
    userId: string,
    fruitId: string
): Promise<boolean> => {
    const existingRating = await FruitRating.findOne({
        userId: new Types.ObjectId(userId),
        fruitId: new Types.ObjectId(fruitId)
    });

    return !!existingRating;
};

/**
 * Create or update a rating for a fruit
 */
export const rateFruit = async (
    userId: string,
    ratingData: CreateRatingDto
): Promise<RatingResult> => {
    const { fruitId, rating, review } = ratingData;

    // Check if fruit exists
    const fruit = await Fruit.findById(fruitId);
    if (!fruit) {
        throw new Error('FRUIT_NOT_FOUND');
    }

    // Check if user has purchased this fruit
    const transactionId = await hasUserPurchasedFruit(userId, fruitId);
    if (!transactionId) {
        throw new Error('NOT_PURCHASED');
    }

    // Create or update the rating
    const existingRating = await FruitRating.findOne({
        userId: new Types.ObjectId(userId),
        fruitId: new Types.ObjectId(fruitId)
    });

    let savedRating: IFruitRating;

    if (existingRating) {
        // Update existing rating
        existingRating.rating = rating;
        if (review !== undefined) {
            existingRating.review = review;
        }
        savedRating = await existingRating.save();
    } else {
        // Create new rating
        const newRating = new FruitRating({
            userId: new Types.ObjectId(userId),
            fruitId: new Types.ObjectId(fruitId),
            rating,
            review,
            transactionId
        });
        savedRating = await newRating.save();
    }

    // Calculate and update average rating on fruit
    const { averageRating, totalRatings } = await updateFruitAverageRating(fruitId);

    return {
        rating: savedRating,
        averageRating,
        totalRatings
    };
};

/**
 * Calculate and update the average rating for a fruit
 */
export const updateFruitAverageRating = async (
    fruitId: string
): Promise<{ averageRating: number; totalRatings: number }> => {
    const ratingStats = await FruitRating.aggregate([
        { $match: { fruitId: new Types.ObjectId(fruitId) } },
        {
            $group: {
                _id: '$fruitId',
                averageRating: { $avg: '$rating' },
                totalRatings: { $sum: 1 }
            }
        }
    ]);

    const stats = ratingStats[0] || { averageRating: 0, totalRatings: 0 };
    const averageRating = Math.round(stats.averageRating * 10) / 10; // Round to 1 decimal

    // Update the fruit's average rating
    await Fruit.findByIdAndUpdate(fruitId, { rating: averageRating });

    return {
        averageRating,
        totalRatings: stats.totalRatings
    };
};

/**
 * Get user's rating for a specific fruit
 */
export const getUserRatingForFruit = async (
    userId: string,
    fruitId: string
): Promise<IFruitRating | null> => {
    return await FruitRating.findOne({
        userId: new Types.ObjectId(userId),
        fruitId: new Types.ObjectId(fruitId)
    });
};

/**
 * Get all ratings by a user
 */
export const getUserRatings = async (
    userId: string
): Promise<IFruitRating[]> => {
    return await FruitRating.find({
        userId: new Types.ObjectId(userId)
    }).populate('fruitId', 'name imageUrl');
};

/**
 * Get rating summary for a fruit
 */
export const getFruitRatingSummary = async (
    fruitId: string
): Promise<FruitRatingSummary | null> => {
    const fruit = await Fruit.findById(fruitId);
    if (!fruit) {
        return null;
    }

    const ratings = await FruitRating.find({
        fruitId: new Types.ObjectId(fruitId)
    }).select('rating review createdAt');

    const { averageRating, totalRatings } = await updateFruitAverageRating(fruitId);

    return {
        fruitId,
        fruitName: fruit.name,
        averageRating,
        totalRatings,
        ratings: ratings.map((r) => ({
            rating: r.rating,
            review: r.review,
            createdAt: r.createdAt
        }))
    };
};

/**
 * Delete a user's rating for a fruit
 */
export const deleteRating = async (
    userId: string,
    fruitId: string
): Promise<boolean> => {
    const result = await FruitRating.findOneAndDelete({
        userId: new Types.ObjectId(userId),
        fruitId: new Types.ObjectId(fruitId)
    });

    if (result) {
        // Recalculate average rating
        await updateFruitAverageRating(fruitId);
        return true;
    }

    return false;
};

/**
 * Get all fruits a user can rate (purchased but not yet rated)
 */
export const getRatableFruits = async (
    userId: string
): Promise<{ fruitId: string; fruitName: string; purchasedAt: Date }[]> => {
    // Get all completed transactions for the user
    const transactions = await TransactionHistory.find({
        userId: new Types.ObjectId(userId),
        status: 'COMPLETED'
    }).select('items createdAt');

    // Extract unique fruit IDs from transactions
    const purchasedFruits = new Map<string, { fruitName: string; purchasedAt: Date }>();
    
    for (const transaction of transactions) {
        for (const item of transaction.items) {
            const fruitIdStr = item.fruitId.toString();
            if (!purchasedFruits.has(fruitIdStr)) {
                purchasedFruits.set(fruitIdStr, {
                    fruitName: item.fruitName,
                    purchasedAt: transaction.createdAt
                });
            }
        }
    }

    // Get fruits already rated by user
    const ratedFruits = await FruitRating.find({
        userId: new Types.ObjectId(userId)
    }).select('fruitId');

    const ratedFruitIds = new Set(ratedFruits.map((r) => r.fruitId.toString()));

    // Filter out already rated fruits
    const ratableFruits: { fruitId: string; fruitName: string; purchasedAt: Date }[] = [];
    
    for (const [fruitId, details] of purchasedFruits.entries()) {
        if (!ratedFruitIds.has(fruitId)) {
            ratableFruits.push({
                fruitId,
                fruitName: details.fruitName,
                purchasedAt: details.purchasedAt
            });
        }
    }

    return ratableFruits;
};
