export const extensionColumns = {
  orders: {
    gross_amount: "INTEGER DEFAULT 0",
    discount_amount: "INTEGER DEFAULT 0",
    coupon_claim: "TEXT DEFAULT ''",
    campaign_code: "TEXT DEFAULT ''",
    payment_method: "TEXT DEFAULT 'mock'",
    session_time: "TEXT DEFAULT '全天'",
    seat_labels: "TEXT DEFAULT '[]'",
    start_time: "TEXT DEFAULT '00:00'",
    end_time: "TEXT DEFAULT '24:00'",
  },
};
export const recommendationPolicies = {
  H5: { interest: 20, view: 3, favorite: 6, purchase: 8, city: 8 },
  电脑网页: { interest: 16, view: 1, favorite: 4, purchase: 10, city: 4 },
};
export const extensionSchema = `
CREATE TABLE IF NOT EXISTS demo_wallets(user_id INTEGER NOT NULL REFERENCES users(id),balance INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id));
CREATE TABLE IF NOT EXISTS demo_wallet_entries(code TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),amount INTEGER NOT NULL,kind TEXT NOT NULL,order_id INTEGER REFERENCES orders(id),created_at TEXT NOT NULL,UNIQUE(user_id,kind,order_id));
CREATE TABLE IF NOT EXISTS demo_campaigns(code TEXT PRIMARY KEY,name TEXT NOT NULL,budget INTEGER NOT NULL,impressions INTEGER NOT NULL DEFAULT 0,clicks INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS demo_coupons(code TEXT PRIMARY KEY,name TEXT NOT NULL,amount INTEGER NOT NULL,min_spend INTEGER NOT NULL DEFAULT 0,valid_days INTEGER NOT NULL DEFAULT 7,status TEXT NOT NULL DEFAULT 'active',campaign_code TEXT DEFAULT '',created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS demo_coupon_claims(code TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),coupon_code TEXT REFERENCES demo_coupons(code),status TEXT NOT NULL DEFAULT 'available',order_id INTEGER REFERENCES orders(id),claimed_at TEXT NOT NULL,expires_at TEXT NOT NULL,UNIQUE(user_id,coupon_code));
CREATE TABLE IF NOT EXISTS demo_tickets(code TEXT PRIMARY KEY,order_id INTEGER REFERENCES orders(id),ordinal INTEGER NOT NULL,seat_label TEXT DEFAULT '',status TEXT NOT NULL DEFAULT 'active',issued_at TEXT NOT NULL,verified_at TEXT,verified_by INTEGER REFERENCES users(id),UNIQUE(order_id,ordinal));
CREATE TABLE IF NOT EXISTS demo_print_requests(code TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),tickets TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_demo_ticket_order ON demo_tickets(order_id,status);
CREATE INDEX IF NOT EXISTS idx_demo_claim_user ON demo_coupon_claims(user_id,status);
`;
export async function upgradeExtensions(db) {
  const get = (s, ...p) => db.prepare(s).get(...p),
    run = (s, ...p) => db.prepare(s).run(...p);
  if (await get("SELECT value FROM settings WHERE key=?", "demo-extensions-v5"))
    return;
  const now = new Date().toISOString();
  await run("UPDATE orders SET gross_amount=amount WHERE gross_amount=0");
  await run(
    "INSERT INTO demo_campaigns(code,name,budget,impressions,clicks,created_at) VALUES(?,?,?,?,?,?)",
    "weekend",
    "周末文化体验（模拟）",
    20000,
    1200,
    120,
    now,
  );
  await run(
    "INSERT INTO demo_coupons(code,name,amount,min_spend,valid_days,campaign_code,created_at) VALUES(?,?,?,?,?,?,?)",
    "WELCOME20",
    "文化体验满100减20",
    2000,
    10000,
    14,
    "weekend",
    now,
  );
  await run(
    "INSERT INTO demo_coupons(code,name,amount,min_spend,valid_days,campaign_code,created_at) VALUES(?,?,?,?,?,?,?)",
    "WEEKEND50",
    "周末演出满300减50",
    5000,
    30000,
    7,
    "weekend",
    now,
  );
  await run(
    "INSERT INTO settings(key,value) VALUES(?,?)",
    "recommendationPolicies",
    JSON.stringify(recommendationPolicies),
  );
  await run(
    "INSERT INTO settings(key,value) VALUES(?,?)",
    "demo-extensions-v5",
    "true",
  );
}
