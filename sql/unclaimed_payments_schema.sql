-- Table to store payments that could not be matched to a user

CREATE TABLE public.t_unclaimed_payments (
    f_id BIGSERIAL PRIMARY KEY,
    f_cafe24_order_id VARCHAR(255) UNIQUE NOT NULL,
    f_buyer_email VARCHAR(255) NOT NULL,
    f_product_id VARCHAR(255) NOT NULL,
    f_product_name TEXT,
    f_amount_paid DECIMAL(10, 2),
    f_payment_data JSONB, -- Store the full webhook payload for later inspection
    f_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, CLAIMED, REFUNDED
    f_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    f_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments for clarity
COMMENT ON TABLE public.t_unclaimed_payments IS 'Cafe24 결제 후 유저를 찾지 못해 매칭되지 않은 결제 내역을 저장하는 테이블';
COMMENT ON COLUMN public.t_unclaimed_payments.f_id IS '고유 식별자 (PK)';
COMMENT ON COLUMN public.t_unclaimed_payments.f_cafe24_order_id IS 'Cafe24 주문 ID';
COMMENT ON COLUMN public.t_unclaimed_payments.f_buyer_email IS '구매자 이메일';
COMMENT ON COLUMN public.t_unclaimed_payments.f_product_id IS '구매한 상품 ID';
COMMENT ON COLUMN public.t_unclaimed_payments.f_product_name IS '구매한 상품명';
COMMENT ON COLUMN public.t_unclaimed_payments.f_amount_paid IS '결제 금액';
COMMENT ON COLUMN public.t_unclaimed_payments.f_payment_data IS 'Cafe24 Webhook 원본 데이터 (JSON)';
COMMENT ON COLUMN public.t_unclaimed_payments.f_status IS '상태 (처리 대기, 처리 완료, 환불)';
COMMENT ON COLUMN public.t_unclaimed_payments.f_created_at IS '생성일';
COMMENT ON COLUMN public.t_unclaimed_payments.f_updated_at IS '수정일';

-- Trigger to update f_updated_at timestamp on row update
CREATE TRIGGER set_timestamp_unclaimed
BEFORE UPDATE ON public.t_unclaimed_payments
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Enable RLS
ALTER TABLE public.t_unclaimed_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only service roles (backend) can access this sensitive data.
CREATE POLICY "Allow service_role full access" ON public.t_unclaimed_payments
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
