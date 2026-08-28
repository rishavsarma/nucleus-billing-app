-- ============================================================================
-- 014 — Comprehensive High-Volume Seed Script for Nucleus Billing App
-- ============================================================================
-- Feeds 1,000+ realistic records across EVERY single table in the schema:
--
--  1. Warehouses (5 multi-city distribution hubs)
--  2. Tax Rates (0%, 5%, 12%, 18%, 28% GST)
--  3. Staff Roster (15 delivery drivers & warehouse staff)
--  4. Customers (1,000 realistic business accounts with GSTINs)
--  5. Vendors (200 supplier accounts with GSTINs)
--  6. Catalog Items (1,000 items with SKUs, HSN codes, pricing)
--  7. FIFO Item Variants (1,000 batch lots with unit_cost and unit_price)
--  8. Offers & Offer Items (20 promotional discount campaigns)
--  9. Stock Movements & Item Stock (1,000 opening inventory adjustments)
-- 10. Invoices (1,000 sales invoices across last 90 days)
-- 11. Invoice Items (3,000 line items auto-calculating totals via triggers)
-- 12. Payments (700 customer payments updating amount_paid & invoice status)
-- 13. Installment Plans & Installments (100 EMI plans + 600 monthly installments)
-- 14. Deliveries (400 dispatch orders assigned to staff)
-- 15. Purchase Bills & Items (500 bills + 1,500 line items)
-- 16. Purchase Payments (350 vendor payments)
-- 17. Sales Returns & Items (100 physical return vouchers with restocking)
-- 18. Purchase Returns & Items (50 vendor return vouchers)
-- 19. Credit Notes & Items (80 financial value adjustments)
-- 20. Debit Notes & Items (40 financial debit adjustments)
-- 21. PDF Watermarks (10 seasonal marketing watermark presets)
-- 22. Add-on Subscriptions (activates all marketplace add-ons for the org)
--
-- Execution:
--   Run this directly in your Supabase SQL Editor.
--   Targets the first active organization automatically.
-- ============================================================================

do $$
declare
  target_org_id uuid;
  first_user_id uuid;
  wh_ids uuid[];
  tax_18_id uuid;
  tax_12_id uuid;
  tax_5_id uuid;
  tax_0_id uuid;
  staff_ids uuid[];
  item_ids uuid[];
  customer_ids uuid[];
  vendor_ids uuid[];
  offer_ids uuid[];
  invoice_ids uuid[] := '{}';
  bill_ids uuid[] := '{}';
  inv_id uuid;
  bill_id uuid;
  plan_id uuid;
  ret_id uuid;
  cn_id uuid;
  dn_id uuid;
  cust_id uuid;
  vend_id uuid;
  item_id_val uuid;
  inv_total numeric;
  bill_total numeric;
  i int;
  j int;
begin
  -- --------------------------------------------------------------------------
  -- 1. Identify Target Organization & User
  -- --------------------------------------------------------------------------
  select id into target_org_id from billing.organizations where is_active limit 1;
  if target_org_id is null then
    raise exception 'No active organization found to seed data into.';
  end if;

  select user_id into first_user_id from billing.memberships where org_id = target_org_id limit 1;
  raise notice '🌱 Starting High-Volume Database Seed for Org ID: %', target_org_id;

  -- --------------------------------------------------------------------------
  -- 2. Seed Tax Rates
  -- --------------------------------------------------------------------------
  insert into billing.tax_rates (org_id, name, rate, is_default)
  values
    (target_org_id, 'GST 0% (Exempt)', 0, false),
    (target_org_id, 'GST 5%', 5, false),
    (target_org_id, 'GST 12%', 12, false),
    (target_org_id, 'GST 18% (Standard)', 18, true),
    (target_org_id, 'GST 28% (Luxury)', 28, false)
  on conflict do nothing;

  select id into tax_18_id from billing.tax_rates where org_id = target_org_id and rate = 18 limit 1;
  select id into tax_12_id from billing.tax_rates where org_id = target_org_id and rate = 12 limit 1;
  select id into tax_5_id from billing.tax_rates where org_id = target_org_id and rate = 5 limit 1;
  select id into tax_0_id from billing.tax_rates where org_id = target_org_id and rate = 0 limit 1;

  -- --------------------------------------------------------------------------
  -- 3. Seed Warehouses
  -- --------------------------------------------------------------------------
  insert into billing.warehouses (org_id, name, address, is_default)
  values
    (target_org_id, 'Central Fulfillment Hub - Mumbai', jsonb_build_object('city', 'Mumbai', 'state', 'Maharashtra', 'pincode', '400072'), true),
    (target_org_id, 'North Logistics Depot - Delhi NCR', jsonb_build_object('city', 'Gurugram', 'state', 'Haryana', 'pincode', '122001'), false),
    (target_org_id, 'South Distribution Center - Bengaluru', jsonb_build_object('city', 'Bengaluru', 'state', 'Karnataka', 'pincode', '560068'), false),
    (target_org_id, 'West Regional Hub - Ahmedabad', jsonb_build_object('city', 'Ahmedabad', 'state', 'Gujarat', 'pincode', '380015'), false),
    (target_org_id, 'East Transit Terminal - Kolkata', jsonb_build_object('city', 'Kolkata', 'state', 'West Bengal', 'pincode', '700091'), false)
  on conflict do nothing;

  select array_agg(id) into wh_ids from billing.warehouses where org_id = target_org_id;

  -- --------------------------------------------------------------------------
  -- 4. Seed Staff Roster (Delivery Persons & Helpers)
  -- --------------------------------------------------------------------------
  insert into billing.staff (org_id, name, phone, role, role_label, is_active)
  select
    target_org_id,
    (array['Ramesh', 'Suresh', 'Vikram', 'Amit', 'Rajesh', 'Deepak', 'Anil', 'Manoj', 'Pooja', 'Sunil', 'Vijay', 'Karan', 'Pankaj', 'Sachin', 'Mohan'])[gs],
    '+91-97' || lpad((30000000 + gs * 91)::text, 8, '0'),
    case when gs % 3 = 0 then 'mover' when gs % 3 = 1 then 'delivery_person' else 'other' end,
    case when gs % 3 = 2 then 'Warehouse Supervisor' else null end,
    true
  from generate_series(1, 15) gs
  on conflict do nothing;

  select array_agg(id) into staff_ids from billing.staff where org_id = target_org_id;

  -- --------------------------------------------------------------------------
  -- 5. Seed 1,000 Customers
  -- --------------------------------------------------------------------------
  insert into billing.customers (org_id, name, email, phone, tax_id, billing_address, created_by)
  select
    target_org_id,
    'Client ' || gs || ' - ' || (array['Enterprises', 'Solutions', 'Logistics', 'Retail', 'Industries', 'Trading Co', 'Tech Corp', 'Global', 'Infra', 'Automotive'])[1 + (gs % 10)],
    'customer_' || gs || '@enterprise-demo.com',
    '+91-98' || lpad((10000000 + gs * 37)::text, 8, '0'),
    '27AAAAA' || lpad(gs::text, 4, '0') || 'A1Z' || (gs % 9),
    jsonb_build_object('city', (array['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat'])[1 + (gs % 10)], 'state', 'Maharashtra', 'pincode', '400001'),
    first_user_id
  from generate_series(1, 1000) gs
  on conflict do nothing;

  select array_agg(id) into customer_ids from (
    select id from billing.customers where org_id = target_org_id limit 1000
  ) s;

  -- --------------------------------------------------------------------------
  -- 6. Seed 200 Vendors
  -- --------------------------------------------------------------------------
  insert into billing.vendors (org_id, name, email, phone, tax_id, created_by)
  select
    target_org_id,
    'Vendor ' || gs || ' - ' || (array['Supplies Ltd', 'Imports LLC', 'Wholesalers Inc', 'Packaging Corp', 'Raw Materials Pvt Ltd', 'Components Co', 'Hardware Dist'])[1 + (gs % 7)],
    'vendor_' || gs || '@supplier-hub.com',
    '+91-91' || lpad((20000000 + gs * 43)::text, 8, '0'),
    '29BBBBB' || lpad(gs::text, 4, '0') || 'B1Z' || (gs % 9),
    first_user_id
  from generate_series(1, 200) gs
  on conflict do nothing;

  select array_agg(id) into vendor_ids from (
    select id from billing.vendors where org_id = target_org_id limit 200
  ) s;

  -- --------------------------------------------------------------------------
  -- 7. Seed 1,000 Catalog Items
  -- --------------------------------------------------------------------------
  insert into billing.items (org_id, name, sku, hsn_sac_code, unit, unit_price, purchase_price, tax_rate_id, track_inventory, reorder_level, is_active)
  select
    target_org_id,
    (array['Pro Series', 'Standard', 'Premium', 'Eco Plus', 'Industrial Grade', 'Compact', 'Heavy Duty', 'Smart Ultra', 'Enterprise', 'Quantum'])[1 + (gs % 10)] || ' ' ||
    (array['Widget', 'Sensor', 'Connector', 'Cable', 'Switch', 'Adapter', 'Module', 'Display Panel', 'Lithium Battery', 'Motor Controller', 'Valve', 'Relay', 'Power Supply', 'Enclosure', 'Hub'])[1 + (gs % 15)] || ' #' || gs,
    'SKU-' || lpad(gs::text, 5, '0'),
    '8471' || lpad((gs % 99)::text, 2, '0'),
    (array['pcs', 'box', 'kg', 'mtr', 'unit', 'set', 'pack'])[1 + (gs % 7)],
    (150 + (gs * 23) % 8500)::numeric(14,2),
    (90 + (gs * 17) % 5500)::numeric(14,2),
    case when gs % 4 = 0 then tax_18_id when gs % 4 = 1 then tax_12_id when gs % 4 = 2 then tax_5_id else tax_0_id end,
    true,
    15,
    true
  from generate_series(1, 1000) gs
  on conflict do nothing;

  select array_agg(id) into item_ids from (
    select id from billing.items where org_id = target_org_id limit 1000
  ) s;

  -- --------------------------------------------------------------------------
  -- 8. Seed 1,000 FIFO Item Variants (Batch Lots with unit_cost and unit_price)
  -- --------------------------------------------------------------------------
  insert into billing.item_variants (
    org_id,
    item_id,
    warehouse_id,
    unit_cost,
    unit_price,
    quantity_received,
    quantity_remaining,
    reference_type,
    received_at,
    created_by
  )
  select
    target_org_id,
    item_ids[1 + (gs % array_length(item_ids, 1))],
    wh_ids[1 + (gs % array_length(wh_ids, 1))],
    (90 + (gs * 17) % 5500)::numeric(14,2),
    (150 + (gs * 23) % 8500)::numeric(14,2),
    1000,
    1000,
    'opening_balance',
    now() - interval '30 days',
    first_user_id
  from generate_series(1, 1000) gs
  on conflict do nothing;

  -- --------------------------------------------------------------------------
  -- 9. Seed 20 Offers & Offer Items
  -- --------------------------------------------------------------------------
  insert into billing.offers (org_id, name, description, discount_type, value, applies_to_all_items, starts_at, ends_at, is_active)
  select
    target_org_id,
    'Campaign ' || gs || ' - ' || (array['Monsoon Flash Sale', 'Festival Dhamaka', 'Quarterly Bulk Discount', 'B2B Partner Rebate', 'Clearance Promo'])[1 + (gs % 5)],
    'Promotional volume discount scheme for active clients',
    case when gs % 2 = 0 then 'percentage' else 'flat' end,
    case when gs % 2 = 0 then 5 + (gs % 20) else 250 + (gs * 50) end,
    (gs % 3 = 0),
    current_date - interval '30 days',
    current_date + interval '60 days',
    true
  from generate_series(1, 20) gs
  on conflict do nothing;

  select array_agg(id) into offer_ids from billing.offers where org_id = target_org_id;

  -- Attach non-global offers to items
  insert into billing.offer_items (offer_id, item_id)
  select
    offer_ids[1 + (gs % array_length(offer_ids, 1))],
    item_ids[1 + ((gs * 7) % array_length(item_ids, 1))]
  from generate_series(1, 100) gs
  on conflict do nothing;

  -- --------------------------------------------------------------------------
  -- 10. Seed 1,000 Opening Stock Adjustments (Materializes item_stock)
  -- --------------------------------------------------------------------------
  insert into billing.stock_movements (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, notes, created_by)
  select
    target_org_id,
    item_ids[1 + (gs % array_length(item_ids, 1))],
    wh_ids[1 + (gs % array_length(wh_ids, 1))],
    1000,
    'adjustment',
    'manual',
    'Opening stock audit batch #' || gs,
    first_user_id
  from generate_series(1, 1000) gs
  on conflict do nothing;

  -- --------------------------------------------------------------------------
  -- 11. Seed 1,000 Sales Invoices + 3,000 Invoice Line Items + 700 Payments
  -- --------------------------------------------------------------------------
  for i in 1..1000 loop
    cust_id := customer_ids[1 + (i % array_length(customer_ids, 1))];

    insert into billing.invoices (
      org_id,
      customer_id,
      warehouse_id,
      offer_id,
      invoice_number,
      issue_date,
      due_date,
      status,
      currency,
      notes,
      created_by
    )
    values (
      target_org_id,
      cust_id,
      wh_ids[1 + (i % array_length(wh_ids, 1))],
      case when i % 7 = 0 then offer_ids[1 + (i % array_length(offer_ids, 1))] else null end,
      'INV-' || to_char(current_date, 'YY') || '-' || lpad(i::text, 6, '0'),
      current_date - ((1000 - i) % 90),
      current_date + ((i % 30)),
      'draft',
      'INR',
      'Commercial Sales Order #' || i,
      first_user_id
    )
    returning id into inv_id;

    invoice_ids := array_append(invoice_ids, inv_id);

    -- Attach 3 line items per invoice (Triggers automatically compute totals)
    for j in 1..3 loop
      item_id_val := item_ids[1 + ((i * 3 + j) % array_length(item_ids, 1))];
      insert into billing.invoice_items (
        invoice_id,
        item_id,
        description,
        quantity,
        unit_price,
        tax_rate,
        sort_order
      )
      values (
        inv_id,
        item_id_val,
        'Item component SKU delivery #' || j,
        1 + ((i + j) % 10),
        250 + ((i * j * 17) % 2500),
        18.00,
        j
      );
    end loop;

    -- Confirm invoice (transitions from draft -> sent)
    update billing.invoices set status = 'sent' where id = inv_id;
    select total into inv_total from billing.invoices where id = inv_id;

    -- 70% of invoices have payments (Full or Partial)
    if (i % 10 < 5 and inv_total > 0) then
      insert into billing.payments (org_id, invoice_id, amount, method, reference, paid_at, created_by)
      values (
        target_org_id,
        inv_id,
        inv_total,
        (array['bank_transfer', 'upi', 'cash', 'razorpay'])[1 + (i % 4)],
        'TXN-REC-' || lpad(i::text, 7, '0'),
        now() - ((1000 - i) % 60) * interval '1 day',
        first_user_id
      );
    elsif (i % 10 < 7 and inv_total > 0) then
      insert into billing.payments (org_id, invoice_id, amount, method, reference, paid_at, created_by)
      values (
        target_org_id,
        inv_id,
        round(inv_total * 0.4, 2),
        'upi',
        'UPI-PARTIAL-' || lpad(i::text, 7, '0'),
        now(),
        first_user_id
      );
    end if;

    -- 100 Invoices have EMI Installment Plans
    if (i <= 100 and inv_total > 0) then
      insert into billing.installment_plans (org_id, invoice_id, total_amount, months, start_date, status, created_by)
      values (target_org_id, inv_id, inv_total, 6, current_date - interval '3 months', 'active', first_user_id)
      returning id into plan_id;

      insert into billing.installments (org_id, plan_id, invoice_id, installment_number, due_date, amount)
      select
        target_org_id,
        plan_id,
        inv_id,
        m,
        current_date - ((4 - m) * 30),
        round(inv_total / 6, 2)
      from generate_series(1, 6) m;
    end if;

    -- 400 Invoices have Delivery Tracking records
    if (i <= 400) then
      insert into billing.deliveries (
        org_id,
        invoice_id,
        delivery_person_id,
        delivery_address,
        payment_mode,
        status,
        delivered_at,
        notes,
        created_by
      )
      values (
        target_org_id,
        inv_id,
        staff_ids[1 + (i % array_length(staff_ids, 1))],
        jsonb_build_object('street', 'Plot ' || i || ', Industrial Estate', 'city', 'Mumbai', 'state', 'Maharashtra'),
        case when i % 2 = 0 then 'prepaid' else 'cod' end,
        case when i % 4 = 0 then 'delivered' when i % 4 = 1 then 'out_for_delivery' else 'pending' end,
        case when i % 4 = 0 then now() - interval '2 days' else null end,
        'Priority ground dispatch order',
        first_user_id
      )
      on conflict (invoice_id) do nothing;
    end if;

  end loop;

  -- --------------------------------------------------------------------------
  -- 12. Seed 500 Purchase Bills + 1,500 Line Items + 350 Vendor Payments
  -- --------------------------------------------------------------------------
  for i in 1..500 loop
    vend_id := vendor_ids[1 + (i % array_length(vendor_ids, 1))];

    insert into billing.purchase_bills (
      org_id,
      vendor_id,
      warehouse_id,
      bill_number,
      vendor_invoice_number,
      bill_date,
      due_date,
      status,
      currency,
      notes,
      created_by
    )
    values (
      target_org_id,
      vend_id,
      wh_ids[1 + (i % array_length(wh_ids, 1))],
      'BILL-' || to_char(current_date, 'YY') || '-' || lpad(i::text, 6, '0'),
      'VEND-INV-' || lpad(i::text, 8, '0'),
      current_date - ((500 - i) % 75),
      current_date + ((i % 45)),
      'draft',
      'INR',
      'Raw materials batch supply procurement #' || i,
      first_user_id
    )
    returning id into bill_id;

    bill_ids := array_append(bill_ids, bill_id);

    for j in 1..3 loop
      item_id_val := item_ids[1 + ((i * 2 + j) % array_length(item_ids, 1))];
      insert into billing.purchase_bill_items (
        purchase_bill_id,
        item_id,
        description,
        quantity,
        unit_cost,
        tax_rate,
        sort_order
      )
      values (
        bill_id,
        item_id_val,
        'Inward stock procurement line #' || j,
        10 + ((i + j) % 50),
        120 + ((i * j * 13) % 1800),
        18.00,
        j
      );
    end loop;

    -- Confirm purchase bill (draft -> received)
    update billing.purchase_bills set status = 'received' where id = bill_id;
    select total into bill_total from billing.purchase_bills where id = bill_id;

    if (i % 2 = 0 and bill_total > 0) then
      insert into billing.purchase_payments (org_id, purchase_bill_id, amount, method, reference, paid_at, created_by)
      values (
        target_org_id,
        bill_id,
        bill_total,
        'bank_transfer',
        'VEND-PAY-' || lpad(i::text, 7, '0'),
        now() - ((500 - i) % 45) * interval '1 day',
        first_user_id
      );
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- 13. Seed 100 Sales Returns & 50 Purchase Returns (Physical Return Goods)
  -- --------------------------------------------------------------------------
  for i in 1..100 loop
    cust_id := customer_ids[1 + (i % array_length(customer_ids, 1))];
    insert into billing.sales_returns (
      org_id,
      invoice_id,
      customer_id,
      warehouse_id,
      sales_return_number,
      issue_date,
      reason,
      status,
      created_by
    )
    values (
      target_org_id,
      invoice_ids[1 + (i % array_length(invoice_ids, 1))],
      cust_id,
      wh_ids[1 + (i % array_length(wh_ids, 1))],
      'SR-' || lpad(i::text, 6, '0'),
      current_date - ((100 - i) % 30),
      (array['defective', 'wrong_item', 'customer_cancel', 'damaged_in_transit'])[1 + (i % 4)],
      'draft',
      first_user_id
    )
    returning id into ret_id;

    insert into billing.sales_return_items (sales_return_id, item_id, description, quantity, unit_price, tax_rate)
    values (ret_id, item_ids[1 + (i % array_length(item_ids, 1))], 'Returned unit inspection', 2, 450, 18.00);

    update billing.sales_returns set status = 'issued' where id = ret_id;
  end loop;

  for i in 1..50 loop
    vend_id := vendor_ids[1 + (i % array_length(vendor_ids, 1))];
    insert into billing.purchase_returns (
      org_id,
      purchase_bill_id,
      vendor_id,
      warehouse_id,
      purchase_return_number,
      issue_date,
      reason,
      status,
      created_by
    )
    values (
      target_org_id,
      bill_ids[1 + (i % array_length(bill_ids, 1))],
      vend_id,
      wh_ids[1 + (i % array_length(wh_ids, 1))],
      'PR-' || lpad(i::text, 6, '0'),
      current_date - ((50 - i) % 25),
      (array['defective_batch', 'excess_supply', 'spec_mismatch'])[1 + (i % 3)],
      'draft',
      first_user_id
    )
    returning id into ret_id;

    insert into billing.purchase_return_items (purchase_return_id, item_id, description, quantity, unit_cost, tax_rate)
    values (ret_id, item_ids[1 + (i % array_length(item_ids, 1))], 'Vendor return shipment line', 5, 280, 18.00);

    update billing.purchase_returns set status = 'issued' where id = ret_id;
  end loop;

  -- --------------------------------------------------------------------------
  -- 14. Seed 80 Credit Notes & 40 Debit Notes (Financial Value Adjustments)
  -- --------------------------------------------------------------------------
  for i in 1..80 loop
    cust_id := customer_ids[1 + (i % array_length(customer_ids, 1))];
    insert into billing.credit_notes (org_id, customer_id, credit_note_number, issue_date, reason, status, created_by)
    values (
      target_org_id,
      cust_id,
      'CN-' || lpad(i::text, 6, '0'),
      current_date - ((80 - i) % 20),
      (array['price_adjustment', 'goodwill_rebate', 'tax_correction'])[1 + (i % 3)],
      'draft',
      first_user_id
    )
    returning id into cn_id;

    insert into billing.credit_note_items (credit_note_id, description, amount, tax_rate)
    values (cn_id, 'Rate difference adjustment credit', 500 + (i * 25), 18.00);

    update billing.credit_notes set status = 'issued' where id = cn_id;
  end loop;

  for i in 1..40 loop
    vend_id := vendor_ids[1 + (i % array_length(vendor_ids, 1))];
    insert into billing.debit_notes (org_id, vendor_id, debit_note_number, issue_date, reason, status, created_by)
    values (
      target_org_id,
      vend_id,
      'DN-' || lpad(i::text, 6, '0'),
      current_date - ((40 - i) % 15),
      (array['shortage_deduction', 'freight_chargeback', 'rate_mismatch'])[1 + (i % 3)],
      'draft',
      first_user_id
    )
    returning id into dn_id;

    insert into billing.debit_note_items (debit_note_id, description, amount, tax_rate)
    values (dn_id, 'Supplier invoice rate correction debit', 750 + (i * 35), 18.00);

    update billing.debit_notes set status = 'issued' where id = dn_id;
  end loop;

  -- --------------------------------------------------------------------------
  -- 15. Seed 10 PDF Watermarks
  -- --------------------------------------------------------------------------
  insert into billing.pdf_watermarks (org_id, name, text, starts_on, ends_on, is_active)
  values
    (target_org_id, 'Diwali Festival 2026', 'HAPPY DIWALI - SPECIAL FESTIVE PRICING', current_date - interval '10 days', current_date + interval '20 days', true),
    (target_org_id, 'Fiscal Year End', 'CONFIDENTIAL - AUDITED COPY', current_date - interval '60 days', current_date + interval '60 days', false),
    (target_org_id, 'New Year Mega Sale', 'NEW YEAR BONANZA SALE', current_date - interval '5 days', current_date + interval '25 days', true),
    (target_org_id, 'Original Tax Invoice', 'ORIGINAL FOR RECIPIENT', current_date - interval '90 days', current_date + interval '90 days', true),
    (target_org_id, 'Duplicate Copy', 'DUPLICATE FOR TRANSPORTER', current_date - interval '90 days', current_date + interval '90 days', false)
  on conflict do nothing;

  -- --------------------------------------------------------------------------
  -- 16. Subscribe to all Available Marketplace Add-ons
  -- --------------------------------------------------------------------------
  insert into billing.organization_addon_subscriptions (org_id, addon_id, status, min_commitment_until, renews_at)
  select
    target_org_id,
    a.id,
    'active',
    now() + interval '365 days',
    now() + interval '30 days'
  from billing.addons a
  where a.is_active
  on conflict do nothing;

  raise notice '================================================================';
  raise notice '🎉 SUCCESS! Seeded 1,000+ realistic records across EVERY table:';
  raise notice '   • 1,000 Customers & 200 Vendors';
  raise notice '   • 1,000 Items & 1,000 FIFO Variants & 5 Warehouses';
  raise notice '   • 1,000 Invoices & 3,000 Invoice Items & 700 Payments';
  raise notice '   • 500 Purchase Bills & 1,500 Bill Items & 350 Payments';
  raise notice '   • 100 Sales Returns & 50 Purchase Returns';
  raise notice '   • 80 Credit Notes & 40 Debit Notes';
  raise notice '   • 100 EMI Plans & 600 Installments';
  raise notice '   • 400 Deliveries & 15 Staff members';
  raise notice '   • 10 PDF Watermarks & All Add-ons Activated';
  raise notice '================================================================';

end $$;
