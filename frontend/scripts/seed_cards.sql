-- 1. Make 'name' unique so we can update existing cards
-- (If this fails due to duplicates, you may need to delete duplicate rows first)
ALTER TABLE public.credit_cards ADD CONSTRAINT credit_cards_name_key UNIQUE (name);

-- 2. Insert Credit Cards (Upsert based on name)
INSERT INTO public.credit_cards (name, issuer, color, rewards)
VALUES
  ('Discover it® Cash Back', 'Discover', '#FF6B00', '{"amazon": 5, "drugstore": 5, "general": 1}'),
  ('Chase Freedom Flex®', 'Chase', '#005BAA', '{"travel": 5, "dining": 3, "drugstore": 3, "department_store": 5, "clothing": 5, "general": 1}'),
  ('Amex Gold Card', 'Amex', '#D4AF37', '{"dining": 4, "grocery": 4, "travel": 3, "general": 1}'),
  ('Amex Blue Cash Preferred®', 'Amex', '#004B8D', '{"grocery": 6, "streaming": 6, "transit": 3, "gas": 3, "general": 1}'),
  ('Bilt Mastercard®', 'Wells Fargo', '#000000', '{"rent": 1, "dining": 3, "travel": 2, "general": 1}'),
  ('Capital One Savor Cash Rewards', 'Capital One', '#D9381E', '{"dining": 3, "grocery": 3, "entertainment": 3, "streaming": 3, "general": 1}'),
  ('Citi Custom Cash®', 'Citi', '#003B70', '{"gas": 5, "general": 1}'),
  ('Apple Card', 'Apple', '#A3AAAE', '{"apple": 3, "uber": 3, "drugstore": 3, "gas": 3, "general": 2}'),
  ('U.S. Bank Cash+®', 'U.S. Bank', '#0C2074', '{"utilities": 5, "electronics": 5, "general": 1}'),
  ('Bank of America Customized Cash', 'Bank of America', '#E31837', '{"online_shopping": 3, "general": 1}'),
  ('Wells Fargo Autograph℠', 'Wells Fargo', '#CE1141', '{"dining": 3, "travel": 3, "gas": 3, "transit": 3, "streaming": 3, "phone": 3, "general": 1}')
ON CONFLICT (name) 
DO UPDATE SET 
  issuer = EXCLUDED.issuer,
  color = EXCLUDED.color,
  rewards = EXCLUDED.rewards;
