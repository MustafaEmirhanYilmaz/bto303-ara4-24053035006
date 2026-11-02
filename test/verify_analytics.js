// test/verify_analytics.js
// Automated verification suite for BTÖ-303 Ara Uygulama 4
const assert = require('node:assert');
const analytics = require('../server/analytics.js');
const { getDb } = require('../server/db.js');

console.log('--- BTÖ-303 Ara Uygulama 4 Doğrulama Testleri Başlıyor ---');

const db = getDb();

// 1. Tablo Sayısı Doğrulaması (11 Tablo)
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';").all();
console.log(`[TEST 1] Tablo Sayısı: ${tables.length} / 11`);
assert.strictEqual(tables.length, 11, 'Toplam 11 tablo bulunmalıdır.');

// 2. Sipariş Sayısı ve Durumları Doğrulaması (8044 Toplam, 7644 Teslim, 324 İptal)
const overview = analytics.getOverview();
console.log(`[TEST 2] Toplam Sipariş: ${overview.kpis.totalOrders} (Beklenen: 8044)`);
assert.strictEqual(overview.kpis.totalOrders, 8044);
console.log(`[TEST 2] Teslim Edilen Sipariş: ${overview.kpis.deliveredOrders} (Beklenen: 7644)`);
assert.strictEqual(overview.kpis.deliveredOrders, 7644);
console.log(`[TEST 2] İptal Edilen Sipariş: ${overview.kpis.cancelledOrders} (Beklenen: 324)`);
assert.strictEqual(overview.kpis.cancelledOrders, 324);

// 3. Rehber Örnek Sorgu 1: Ana Kategoriye Göre Ciro Doğrulaması
const catData = analytics.getCategories();
console.log(`[TEST 3] Ana Kategori Sayısı: ${catData.mainCategories.length} / 8`);
assert.strictEqual(catData.mainCategories.length, 8);
const topCategory = catData.mainCategories[0];
console.log(`[TEST 3] Lider Kategori: ${topCategory.kategori_adi} - Ciro: ${topCategory.ciro} TL`);
assert.strictEqual(topCategory.kategori_adi, 'Elektronik');
assert.strictEqual(topCategory.ciro, 13993686);

// 4. Rehber Örnek Sorgu 2: İl Bazlı Sipariş Sayısı Doğrulaması (25 İl)
const geoData = analytics.getCustomersAndGeo();
console.log(`[TEST 4] İl Sayısı: ${geoData.cityStats.length} / 25`);
assert.strictEqual(geoData.cityStats.length, 25);
assert.strictEqual(geoData.regionStats.length, 7);

// 5. Rehber Örnek Sorgu 3: Ürün Olayları ve Dönüşüm Hunisi
const funnelData = analytics.getFunnel();
console.log(`[TEST 5] Toplam Oturum: ${funnelData.totalSessions} (29382)`);
assert.strictEqual(funnelData.totalSessions, 29382);
assert.strictEqual(funnelData.productEvents.length > 0, true);

// 6. Lojistik ve İade Doğrulaması (4 Kargo Firması, 667 İade Talebi)
const logData = analytics.getLogistics();
console.log(`[TEST 6] Kargo Firması Sayısı: ${logData.couriers.length} / 4`);
assert.strictEqual(logData.couriers.length, 4);

// 7. Kupon Doğrulaması (15 Kupon)
const couponData = analytics.getCoupons();
console.log(`[TEST 7] Kupon Sayısı: ${couponData.couponList.length} / 15`);
assert.strictEqual(couponData.couponList.length, 15);

// 8. SQL Studio Güvenlik Doğrulaması (Yalnızca SELECT izni)
console.log(`[TEST 8] SQL Güvenlik Denetimi`);
const validQuery = analytics.runCustomQuery('SELECT count(*) as cnt FROM urunler');
assert.strictEqual(validQuery.rows[0].cnt, 131);

let blocked = false;
try {
  analytics.runCustomQuery('DROP TABLE urunler;');
} catch (e) {
  blocked = true;
}
assert.strictEqual(blocked, true, 'DROP/DELETE sorguları engellenmelidir.');

console.log('--- TÜM TESTLER BAŞARIYLA GEÇTİ (8/8) ---');
