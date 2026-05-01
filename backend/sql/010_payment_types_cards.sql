-- Add basic card payment types

INSERT INTO payment_types (name) VALUES ('card_credit')
	ON CONFLICT (name) DO NOTHING;

INSERT INTO payment_types (name) VALUES ('card_debit')
	ON CONFLICT (name) DO NOTHING;
