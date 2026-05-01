INSERT INTO roles (name) VALUES ('client')
	ON CONFLICT (name) DO NOTHING;
