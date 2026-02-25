-- ============================================================================
-- Fix Claim Links for All Vendors
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- Step 1: Update vendors WITH phone numbers -> proper claim link with name + phone
-- Uses compact JSON format to match the JS encoding exactly
UPDATE vendors
SET claim_link = 
  'https://www.cartevent.com/claim/' ||
  replace(
    replace(
      rtrim(
        encode(
          convert_to(
            concat(
              '{"b":',  to_json(COALESCE(full_name, username, 'there')::text)::text,
              ',"m":', to_json(phone::text)::text,
              ',"e":', to_json(COALESCE(email, '')::text)::text,
              '}'
            ),
            'UTF8'
          ),
          'base64'
        ),
        '='
      ),
      '+', '-'
    ),
    '/', '_'
  )
WHERE phone IS NOT NULL AND phone != '';

-- Step 2: Update vendors WITHOUT phone numbers -> signup page fallback
UPDATE vendors
SET claim_link = 'https://www.cartevent.com/signup'
WHERE phone IS NULL OR phone = '';

-- Step 3: Verify the results
SELECT 
  full_name, 
  phone, 
  LEFT(claim_link, 80) || '...' as claim_link_preview,
  CASE 
    WHEN phone IS NOT NULL AND phone != '' THEN 'Claim Link'
    ELSE 'Signup Fallback'
  END as link_type
FROM vendors
ORDER BY full_name
LIMIT 20;
