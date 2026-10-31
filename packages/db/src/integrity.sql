DO $test$
DECLARE
  fixture text := 'phase2-' || gen_random_uuid()::text;
  n integer;
BEGIN
 BEGIN
  INSERT INTO customer(id,name,email) VALUES(fixture,'Integrity fixture',fixture || '@example.com');
  INSERT INTO product(id,name,product_type,sales_price_minor,cost_price_minor,currency_code)
    VALUES(fixture,'Snapshot fixture','SERVICE',10000,5000,'INR');
  INSERT INTO product_variant(id,product_id,attribute_name,value_name,price_delta_minor)
    VALUES(fixture,fixture,'size','small',-500);
  INSERT INTO subscription_plan(id,name,billing_frequency,minimum_quantity)
    VALUES(fixture,'Plan','MONTHLY',1);
  INSERT INTO subscription(id,subscription_number,customer_id,subscription_plan_id,status,start_date,payment_term_days)
    VALUES(fixture,fixture,fixture,fixture,'ACTIVE','2026-01-01',30),
    (fixture || '-2',fixture || '-2',fixture,fixture,'DRAFT','2026-01-01',0);
  INSERT INTO subscription_line(id,subscription_id,product_id,product_variant_id,description,quantity,unit_price_minor)
    VALUES(fixture,fixture,fixture,fixture,'Contract',1,9500);
  FOR n IN -1..0 LOOP
    BEGIN
      UPDATE subscription_line SET quantity=n WHERE id=fixture;
      RAISE EXCEPTION 'invalid quantity accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO payment(id,invoice_id,payment_method,amount_minor,paid_at)
      VALUES(fixture,fixture,'CASH',n,now());
      RAISE EXCEPTION 'invalid payment accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  BEGIN
    INSERT INTO tax_rule(id,name,rate_bps) VALUES(fixture,'Invalid',10001);
    RAISE EXCEPTION 'invalid tax rate accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO discount_rule(id,name,discount_type,percentage_bps,discount_scope)
      VALUES(fixture,'Invalid','PERCENTAGE',-1,'PRODUCT');
    RAISE EXCEPTION 'invalid discount accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE subscription SET customer_id=fixture || '-missing' WHERE id=fixture;
    RAISE EXCEPTION 'broken FK accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  INSERT INTO invoice(id,invoice_number,subscription_id,customer_id,billing_period_start,billing_period_end,issue_date,due_date,invoice_status,subtotal_minor,discount_total_minor,tax_total_minor,total_minor)
  VALUES(fixture,fixture,fixture,fixture,'2026-01-01','2026-01-31','2026-01-01','2026-01-31','CONFIRMED',9500,0,0,9500),
  (fixture || '-2',fixture || '-2',fixture || '-2',fixture,'2026-01-01','2026-01-31','2026-01-01','2026-01-31','DRAFT',9500,0,0,9500);
  BEGIN
    INSERT INTO invoice SELECT fixture || '-duplicate',fixture || '-duplicate',subscription_id,customer_id,billing_period_start,billing_period_end,issue_date,due_date,invoice_status,subtotal_minor,discount_total_minor,tax_total_minor,total_minor,confirmed_at,paid_at,cancelled_at,created_at,updated_at FROM invoice WHERE id=fixture;
    RAISE EXCEPTION 'duplicate billing period accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  INSERT INTO invoice_line(id,invoice_id,product_id,description,quantity,unit_price_minor,subtotal_minor,discount_minor,tax_rate_bps,tax_minor,total_minor)
    VALUES(fixture,fixture,fixture,'Historical description',1,9500,9500,0,0,0,9500);
  UPDATE product SET sales_price_minor=20000 WHERE id=fixture;
  IF NOT EXISTS(SELECT 1 FROM invoice_line WHERE id=fixture AND unit_price_minor=9500 AND description='Historical description') THEN
    RAISE EXCEPTION 'historical snapshot changed';
  END IF;
  INSERT INTO payment(id,invoice_id,payment_method,amount_minor,paid_at)
    VALUES(fixture,fixture,'UPI',1000,now()),(fixture || '-2',fixture,'BANK_TRANSFER',2000,now());
  IF (SELECT sum(amount_minor) FROM payment WHERE invoice_id=fixture) <> 3000 THEN
    RAISE EXCEPTION 'partial payment persistence failed';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM subscription WHERE id=fixture AND status='ACTIVE') OR
     NOT EXISTS(SELECT 1 FROM invoice WHERE id=fixture AND invoice_status='CONFIRMED') THEN
    RAISE EXCEPTION 'enum persistence failed';
  END IF;
  RAISE SQLSTATE 'ZX001' USING MESSAGE = 'rollback successful fixtures';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM customer WHERE id=fixture) THEN
   RAISE EXCEPTION 'fixture rollback failed';
 END IF;
END
$test$;
