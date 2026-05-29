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

INSERT INTO subcategories (id, category_id, type, name, keywords)
VALUES
  -- Food
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Food' AND type = 'expense'), 'expense', 'Groceries', ARRAY['grocery', 'groceries', 'supermarket', 'instacart', 'market', 'whole foods', 'trader joe']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Food' AND type = 'expense'), 'expense', 'Restaurants', ARRAY['restaurant', 'dining', 'sushi', 'pizza', 'burger', 'fast food', 'cafe', 'bakery']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Food' AND type = 'expense'), 'expense', 'Coffee', ARRAY['coffee', 'starbucks', 'dunkin', 'espresso', 'latte']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Food' AND type = 'expense'), 'expense', 'Food Delivery', ARRAY['doordash', 'uber eats', 'grubhub', 'delivery']::text[]),
  -- Transport
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Transport' AND type = 'expense'), 'expense', 'Fuel', ARRAY['fuel', 'gasoline', 'gas station', 'shell', 'bp', 'exxon', 'chevron']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Transport' AND type = 'expense'), 'expense', 'Rideshare', ARRAY['uber', 'lyft', 'taxi', 'cab']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Transport' AND type = 'expense'), 'expense', 'Public Transit', ARRAY['metro', 'subway', 'bus', 'train', 'transit', 'commuter']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Transport' AND type = 'expense'), 'expense', 'Flights', ARRAY['airline', 'airlines', 'flight', 'airfare', 'delta', 'united', 'american airlines']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Transport' AND type = 'expense'), 'expense', 'Parking', ARRAY['parking', 'toll', 'garage']::text[]),
  -- Housing
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Housing' AND type = 'expense'), 'expense', 'Rent', ARRAY['rent', 'landlord', 'lease', 'tenant']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Housing' AND type = 'expense'), 'expense', 'Mortgage', ARRAY['mortgage', 'home loan', 'hoa']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Housing' AND type = 'expense'), 'expense', 'Home Maintenance', ARRAY['home maintenance', 'repairs', 'plumber', 'electrician', 'handyman', 'home depot', 'ikea']::text[]),
  -- Shopping
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Shopping' AND type = 'expense'), 'expense', 'Clothing', ARRAY['clothes', 'clothing', 'apparel', 'zara', 'h&m', 'nike', 'adidas']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Shopping' AND type = 'expense'), 'expense', 'Electronics', ARRAY['electronics', 'best buy', 'apple', 'samsung', 'laptop', 'phone', 'computer']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Shopping' AND type = 'expense'), 'expense', 'Online Shopping', ARRAY['amazon', 'ebay', 'etsy', 'online shopping', 'walmart', 'target', 'costco']::text[]),
  -- Entertainment
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Entertainment' AND type = 'expense'), 'expense', 'Streaming', ARRAY['netflix', 'spotify', 'hulu', 'disney', 'apple tv', 'youtube', 'twitch', 'streaming']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Entertainment' AND type = 'expense'), 'expense', 'Sports & Fitness', ARRAY['gym', 'fitness', 'sport', 'crossfit', 'yoga', 'peloton']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Entertainment' AND type = 'expense'), 'expense', 'Going Out', ARRAY['cinema', 'theatre', 'concert', 'bar', 'nightclub', 'movies', 'games']::text[]),
  -- Healthcare
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Healthcare' AND type = 'expense'), 'expense', 'Pharmacy', ARRAY['pharmacy', 'cvs', 'walgreens', 'rite aid', 'prescription', 'medication']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Healthcare' AND type = 'expense'), 'expense', 'Doctor', ARRAY['doctor', 'physician', 'clinic', 'hospital', 'medical', 'copay']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Healthcare' AND type = 'expense'), 'expense', 'Dental & Vision', ARRAY['dental', 'dentist', 'vision', 'optometrist', 'glasses', 'contacts']::text[]),
  -- Utilities
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Utilities' AND type = 'expense'), 'expense', 'Internet & Phone', ARRAY['internet', 'phone bill', 'wireless', 'wifi', 'cable', 'telephone', 'verizon', 'at&t', 't-mobile']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Utilities' AND type = 'expense'), 'expense', 'Electricity & Gas', ARRAY['electricity', 'electric', 'gas', 'water', 'utility', 'pge', 'con edison']::text[]),
  -- Income
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Investments' AND type = 'income'), 'income', 'Capital Gains', ARRAY['capital gains', 'stock sale', 'equity']::text[]),
  (gen_random_uuid()::text, (SELECT id FROM categories WHERE name = 'Investments' AND type = 'income'), 'income', 'Crypto', ARRAY['crypto', 'bitcoin', 'ethereum', 'coinbase']::text[])
ON CONFLICT (category_id, name) DO NOTHING;
