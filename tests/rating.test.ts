import request from 'supertest';

// Mock dependencies
jest.mock('axios');

jest.mock('../src/models/fruit', () => {
  const mockFruit = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Apple',
    price: 10,
    offerType: 'NONE',
    stockQuantity: 100,
    inStock: true
  };
  return {
    __esModule: true,
    default: {
      findById: jest.fn().mockResolvedValue(mockFruit),
      findByIdAndUpdate: jest.fn().mockResolvedValue(true)
    },
    OfferType: {
        NONE: 'NONE',
        BUY_1_GET_1_FREE: 'BUY_1_GET_1_FREE',
        BUY_2_GET_3_FREE: 'BUY_2_GET_3_FREE',
        BUY_3_GET_5_FREE: 'BUY_3_GET_5_FREE'
    }
  };
});

jest.mock('../src/models/transactionHistory', () => {
  const mockTransaction = {
    _id: '507f1f77bcf86cd799439014',
    userId: '507f1f77bcf86cd799439012',
    items: [{ fruitId: '507f1f77bcf86cd799439011' }],
    status: 'COMPLETED'
  };

  return {
    __esModule: true,
    default: {
      findOne: jest.fn().mockImplementation((query) => {
          // query contains userId and 'items.fruitId' as ObjectIds
          const userId = query.userId.toString();
          const fruitId = query['items.fruitId'].toString();

          // Condition matches mock user and fruit
          if (userId === '507f1f77bcf86cd799439012' && fruitId === '507f1f77bcf86cd799439011') {
              return Promise.resolve(mockTransaction);
          }
          return Promise.resolve(null);
      }),
      find: jest.fn().mockResolvedValue([mockTransaction])
    }
  };
});

jest.mock('../src/models/fruitRating', () => {
  const mockRating = {
    _id: '507f1f77bcf86cd799439015',
    userId: '507f1f77bcf86cd799439012',
    fruitId: '507f1f77bcf86cd799439011',
    rating: 5,
    review: 'Great!',
    createdAt: new Date()
  };
  
  const mockSave = jest.fn().mockResolvedValue(mockRating);
  const MockConstructor = jest.fn().mockImplementation(() => ({
    save: mockSave
  }));
  
  return {
    __esModule: true,
    default: Object.assign(MockConstructor, {
        findOne: jest.fn().mockResolvedValue(null), // Default no existing rating
        find: jest.fn().mockResolvedValue([]),
        findOneAndDelete: jest.fn().mockResolvedValue(mockRating),
        aggregate: jest.fn().mockResolvedValue([{ averageRating: 4.5, totalRatings: 2 }])
    })
  };
});

jest.mock('../src/middleware/authMiddleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'No authorization header provided' });
    }
    if (authHeader.startsWith('Bearer test-user-')) {
      req.user = { userId: authHeader.split('Bearer test-user-')[1] };
      return next();
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  },
  mockAuthMiddleware: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'No authorization header provided' });
    }
    if (authHeader.startsWith('Bearer test-user-')) {
      req.user = { userId: authHeader.split('Bearer test-user-')[1] };
      return next();
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}));

import app from '../src/app';

describe('Rating Service', () => {
  const validFruitId = '507f1f77bcf86cd799439011';
  const validUserId = '507f1f77bcf86cd799439012';
  const otherUserId = '507f1f77bcf86cd799439013';

  const testToken = `Bearer test-user-${validUserId}`; // User who HAS purchased
  const otherUserToken = `Bearer test-user-${otherUserId}`; // User who has NOT purchased

  describe('POST /api/ratings', () => {
    it('should allow user to rate a purchased fruit', async () => {
      const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', testToken)
        .send({
          fruitId: validFruitId,
          rating: 5,
          review: 'Great!'
        });



      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.rating.rating).toBe(5);
    });

    it('should NOT allow user to rate a fruit NOT purchased', async () => {
      const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', otherUserToken)
        .send({
          fruitId: validFruitId,
          rating: 5
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('purchased');
    });

    it('should reject unauthenticated request', async () => {
       const response = await request(app)
        .post('/api/ratings')
        .send({
          fruitId: validFruitId,
          rating: 5
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should validate rating range (1-5)', async () => {
       const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', testToken)
        .send({
          fruitId: validFruitId,
          rating: 6
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('between 1 and 5');
    });
    
    it('should validate missing fruitId', async () => {
       const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', testToken)
        .send({
          rating: 5
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });
  });
});
