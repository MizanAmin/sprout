-- Invoice customisation settings (the only columns the remaining settings panel
-- needs; auto-invoice/fee/reminder/gocardless columns already exist on nurseries).
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV';
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS invoice_footer TEXT DEFAULT '';
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER DEFAULT 7;
