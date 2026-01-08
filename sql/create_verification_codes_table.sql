CREATE TABLE IF NOT EXISTS t_verification_codes (
    f_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    f_email TEXT NOT NULL,
    f_code VARCHAR(6) NOT NULL,
    f_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    f_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    f_verified BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_verification_email ON t_verification_codes(f_email);
