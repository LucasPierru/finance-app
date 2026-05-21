CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO categories (id, type, name, keywords)
VALUES
  (gen_random_uuid()::text, 'income', 'Salary', ARRAY['salary', 'wage', 'paycheck', 'pay', 'direct deposit', 'payroll', 'paystub']::text[]),
  (gen_random_uuid()::text, 'income', 'Freelance', ARRAY['freelance', 'gig', 'contract', 'consulting']::text[]),
  (gen_random_uuid()::text, 'income', 'Bonus', ARRAY['bonus', 'performance bonus', 'incentive', 'commission']::text[]),
  (gen_random_uuid()::text, 'income', 'Business', ARRAY['business', 'self-employed', 'self employment', 'company', 'revenue']::text[]),
  (gen_random_uuid()::text, 'income', 'Investments', ARRAY['investment', 'investments', 'capital gains', 'returns', 'brokerage', 'fidelity', 'vanguard', 'schwab', 'robinhood']::text[]),
  (gen_random_uuid()::text, 'income', 'Dividends', ARRAY['dividend', 'dividends']::text[]),
  (gen_random_uuid()::text, 'income', 'Interest', ARRAY['interest', 'savings interest', 'apy', 'yield']::text[]),
  (gen_random_uuid()::text, 'income', 'Rental Income', ARRAY['rent', 'rental', 'property income', 'tenant', 'lease']::text[]),
  (gen_random_uuid()::text, 'income', 'Benefits', ARRAY['benefit', 'refund', 'rebate', 'cashback', 'reward', 'tax refund', 'government']::text[]),
  (gen_random_uuid()::text, 'expense', 'Housing', ARRAY['housing', 'rent', 'mortgage', 'home', 'landlord', 'property management', 'hoa', 'home maintenance', 'repairs']::text[]),
  (gen_random_uuid()::text, 'expense', 'Utilities', ARRAY['utilities', 'electricity', 'water', 'gas', 'internet', 'electric', 'cable', 'wifi', 'telephone', 'wireless', 'phone bill', 'utility']::text[]),
  (gen_random_uuid()::text, 'expense', 'Food', ARRAY['food', 'groceries', 'grocery', 'restaurant', 'dining', 'fast food', 'coffee', 'cafe', 'bakery', 'sushi', 'pizza', 'burger', 'food and drink', 'restaurants', 'supermarkets', 'supermarket', 'doordash', 'uber eats', 'grubhub', 'instacart', 'market']::text[]),
  (gen_random_uuid()::text, 'expense', 'Transport', ARRAY['transport', 'transportation', 'fuel', 'gasoline', 'uber', 'taxi', 'lyft', 'transit', 'airline', 'airlines', 'travel', 'car rental', 'parking', 'toll', 'train', 'bus', 'subway', 'metro', 'gas station']::text[]),
  (gen_random_uuid()::text, 'expense', 'Healthcare', ARRAY['healthcare', 'medical', 'doctor', 'pharmacy', 'dental', 'vision', 'optometrist', 'hospital', 'clinic', 'health', 'cvs', 'walgreens', 'rite aid']::text[]),
  (gen_random_uuid()::text, 'expense', 'Insurance', ARRAY['insurance', 'health insurance', 'car insurance', 'geico', 'allstate', 'progressive', 'state farm', 'insure']::text[]),
  (gen_random_uuid()::text, 'expense', 'Debt Payments', ARRAY['debt', 'loan', 'credit card', 'repayment', 'student loan', 'auto loan', 'personal loan']::text[]),
  (gen_random_uuid()::text, 'expense', 'Education', ARRAY['education', 'school', 'tuition', 'course', 'udemy', 'coursera', 'university', 'college', 'textbook']::text[]),
  (gen_random_uuid()::text, 'expense', 'Shopping', ARRAY['shopping', 'clothes', 'electronics', 'retail', 'amazon', 'shops', 'walmart', 'target', 'costco', 'ebay', 'online shopping', 'merchandise', 'clothing', 'best buy', 'home depot', 'ikea']::text[]),
  (gen_random_uuid()::text, 'expense', 'Entertainment', ARRAY['entertainment', 'movies', 'games', 'subscriptions', 'netflix', 'spotify', 'hulu', 'disney', 'music', 'gym', 'fitness', 'recreation', 'apple tv', 'youtube', 'twitch', 'streaming', 'cinema', 'theatre']::text[])
ON CONFLICT (type, name) DO UPDATE
SET keywords = EXCLUDED.keywords;
