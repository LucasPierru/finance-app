-- Migration 002: Expand category keyword lists for better Plaid transaction matching
-- Run this once against your existing database to update the seeded categories.

UPDATE categories SET keywords = ARRAY['salary','wage','paycheck','pay','direct deposit','payroll','paystub']::text[]
WHERE type = 'income' AND name = 'Salary';

UPDATE categories SET keywords = ARRAY['freelance','gig','contract','consulting']::text[]
WHERE type = 'income' AND name = 'Freelance';

UPDATE categories SET keywords = ARRAY['bonus','performance bonus','incentive','commission']::text[]
WHERE type = 'income' AND name = 'Bonus';

UPDATE categories SET keywords = ARRAY['business','self-employed','self employment','company','revenue']::text[]
WHERE type = 'income' AND name = 'Business';

UPDATE categories SET keywords = ARRAY['investment','investments','capital gains','returns','brokerage','fidelity','vanguard','schwab','robinhood']::text[]
WHERE type = 'income' AND name = 'Investments';

UPDATE categories SET keywords = ARRAY['interest','savings interest','apy','yield']::text[]
WHERE type = 'income' AND name = 'Interest';

UPDATE categories SET keywords = ARRAY['rent','rental','property income','tenant','lease']::text[]
WHERE type = 'income' AND name = 'Rental Income';

-- Add Benefits income category if it doesn't exist yet
INSERT INTO categories (id, type, name, keywords)
VALUES (gen_random_uuid()::text, 'income', 'Benefits', ARRAY['benefit','refund','rebate','cashback','reward','tax refund','government']::text[])
ON CONFLICT (type, name) DO UPDATE SET keywords = EXCLUDED.keywords;

UPDATE categories SET keywords = ARRAY['housing','rent','mortgage','home','landlord','property management','hoa','home maintenance','repairs']::text[]
WHERE type = 'expense' AND name = 'Housing';

UPDATE categories SET keywords = ARRAY['utilities','electricity','water','gas','internet','electric','cable','wifi','telephone','wireless','phone bill','utility']::text[]
WHERE type = 'expense' AND name = 'Utilities';

UPDATE categories SET keywords = ARRAY['food','groceries','grocery','restaurant','dining','fast food','coffee','cafe','bakery','sushi','pizza','burger','food and drink','restaurants','supermarkets','supermarket','doordash','uber eats','grubhub','instacart','market']::text[]
WHERE type = 'expense' AND name = 'Food';

UPDATE categories SET keywords = ARRAY['transport','transportation','fuel','gasoline','uber','taxi','lyft','transit','airline','airlines','travel','car rental','parking','toll','train','bus','subway','metro','gas station']::text[]
WHERE type = 'expense' AND name = 'Transport';

UPDATE categories SET keywords = ARRAY['healthcare','medical','doctor','pharmacy','dental','vision','optometrist','hospital','clinic','health','cvs','walgreens','rite aid']::text[]
WHERE type = 'expense' AND name = 'Healthcare';

UPDATE categories SET keywords = ARRAY['insurance','health insurance','car insurance','geico','allstate','progressive','state farm','insure']::text[]
WHERE type = 'expense' AND name = 'Insurance';

UPDATE categories SET keywords = ARRAY['debt','loan','credit card','repayment','student loan','auto loan','personal loan']::text[]
WHERE type = 'expense' AND name = 'Debt Payments';

UPDATE categories SET keywords = ARRAY['education','school','tuition','course','udemy','coursera','university','college','textbook']::text[]
WHERE type = 'expense' AND name = 'Education';

UPDATE categories SET keywords = ARRAY['shopping','clothes','electronics','retail','amazon','shops','walmart','target','costco','ebay','online shopping','merchandise','clothing','best buy','home depot','ikea']::text[]
WHERE type = 'expense' AND name = 'Shopping';

UPDATE categories SET keywords = ARRAY['entertainment','movies','games','subscriptions','netflix','spotify','hulu','disney','music','gym','fitness','recreation','apple tv','youtube','twitch','streaming','cinema','theatre']::text[]
WHERE type = 'expense' AND name = 'Entertainment';
