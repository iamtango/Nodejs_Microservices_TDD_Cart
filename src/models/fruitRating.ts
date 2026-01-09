import { Schema, model, Document, Types } from "mongoose";

// Interface for FruitRating document
export interface IFruitRating extends Document {
    userId: Types.ObjectId;
    fruitId: Types.ObjectId;
    rating: number;
    review?: string;
    transactionId: Types.ObjectId; // Reference to the transaction where fruit was purchased
    createdAt: Date;
    updatedAt: Date;
}

const fruitRatingSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    fruitId: {
        type: Schema.Types.ObjectId,
        ref: "Fruit",
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    review: {
        type: String,
        trim: true,
        maxlength: 500
    },
    transactionId: {
        type: Schema.Types.ObjectId,
        ref: "TransactionHistory",
        required: true
    }
}, {
    timestamps: true
});

// Unique constraint: One user can rate each fruit only once
fruitRatingSchema.index({ userId: 1, fruitId: 1 }, { unique: true });

// Index for faster queries
fruitRatingSchema.index({ fruitId: 1 });
fruitRatingSchema.index({ userId: 1 });

export default model<IFruitRating>("FruitRating", fruitRatingSchema);
