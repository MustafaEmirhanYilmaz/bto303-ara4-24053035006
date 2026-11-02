// server/analytics.js
// Business analytics engine for BTÖ-303 Ara Uygulama 4
const { getDb } = require('./db.js');

function getOverview() {
  const db = getDb();

  // Basic KPIs
  const orderStats = db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN durum = 'iptal' THEN 1 ELSE 0 END) as cancelled_orders,
      SUM(CASE WHEN durum = 'teslim_edildi' THEN 1 ELSE 0 END) as delivered_orders,
      SUM(CASE WHEN durum = 'kargoda' THEN 1 ELSE 0 END) as in_shipping_orders,
      SUM(CASE WHEN durum = 'hazirlaniyor' THEN 1 ELSE 0 END) as preparing_orders,
      ROUND(SUM(CASE WHEN durum <> 'iptal' THEN toplam_tutar ELSE 0 END), 2) as gross_revenue,
      ROUND(SUM(CASE WHEN durum <> 'iptal' THEN ara_toplam ELSE 0 END), 2) as gross_subtotal,
      ROUND(SUM(CASE WHEN durum <> 'iptal' THEN kupon_indirimi ELSE 0 END), 2) as total_coupon_discounts,
      ROUND(SUM(CASE WHEN durum <> 'iptal' THEN kargo_ucreti ELSE 0 END), 2) as total_shipping_revenue,
      ROUND(AVG(CASE WHEN durum <> 'iptal' THEN toplam_tutar ELSE NULL END), 2) as average_order_value
    FROM siparisler;
  `).get();

  // Returns
  const returnStats = db.prepare(`
    SELECT 
      COUNT(*) as total_return_requests,
      SUM(iade_adedi) as total_returned_items,
      ROUND(SUM(iade_tutari), 2) as total_return_amount,
      SUM(CASE WHEN durum = 'tamamlandi' THEN 1 ELSE 0 END) as completed_returns,
      SUM(CASE WHEN durum = 'inceleniyor' THEN 1 ELSE 0 END) as pending_returns
    FROM iadeler;
  `).get();

  // Profit calculation according to guide formula:
  // KDV Haric Satis = kalem_tutari / (1 + kdv_orani / 100)
  // Maliyet = adet * birim_maliyet (birim_maliyet KDV harictir)
  // Brut Kar = KDV Haric Satis - Maliyet
  const profitStats = db.prepare(`
    SELECT 
      ROUND(SUM(k.kalem_tutari / (1.0 + k.kdv_orani / 100.0)), 2) as sales_ex_vat,
      ROUND(SUM(k.adet * k.birim_maliyet), 2) as total_cost_ex_vat,
      ROUND(SUM(k.kalem_tutari / (1.0 + k.kdv_orani / 100.0) - (k.adet * k.birim_maliyet)), 2) as gross_profit,
      SUM(k.adet) as total_sold_units
    FROM siparis_kalemleri k
    JOIN siparisler s ON s.siparis_id = k.siparis_id
    WHERE s.durum <> 'iptal';
  `).get();

  const netRevenue = Number((orderStats.gross_revenue - returnStats.total_return_amount).toFixed(2));
  const profitMargin = profitStats.sales_ex_vat > 0 
    ? Number(((profitStats.gross_profit / profitStats.sales_ex_vat) * 100).toFixed(2)) 
    : 0;

  // Monthly trend
  const monthlyTrend = db.prepare(`
    SELECT 
      strftime('%Y-%m', s.siparis_tarihi) as month,
      COUNT(DISTINCT s.siparis_id) as orders,
      SUM(CASE WHEN s.durum = 'iptal' THEN 1 ELSE 0 END) as cancellations,
      ROUND(SUM(CASE WHEN s.durum <> 'iptal' THEN s.toplam_tutar ELSE 0 END), 2) as revenue,
      ROUND(SUM(CASE WHEN s.durum <> 'iptal' THEN (k.kalem_tutari / (1.0 + k.kdv_orani / 100.0) - (k.adet * k.birim_maliyet)) ELSE 0 END), 2) as profit
    FROM siparisler s
    LEFT JOIN siparis_kalemleri k ON s.siparis_id = k.siparis_id
    GROUP BY strftime('%Y-%m', s.siparis_tarihi)
    ORDER BY month ASC;
  `).all();

  // Platform shares
  const platforms = db.prepare(`
    SELECT 
      platform,
      COUNT(*) as order_count,
      ROUND(SUM(CASE WHEN durum <> 'iptal' THEN toplam_tutar ELSE 0 END), 2) as total_revenue,
      ROUND(AVG(CASE WHEN durum <> 'iptal' THEN toplam_tutar ELSE NULL END), 2) as aov
    FROM siparisler
    GROUP BY platform
    ORDER BY total_revenue DESC;
  `).all();

  // Payment methods
  const paymentMethods = db.prepare(`
    SELECT 
      odeme_yontemi,
      COUNT(*) as count,
      ROUND(SUM(CASE WHEN durum <> 'iptal' THEN toplam_tutar ELSE 0 END), 2) as revenue
    FROM siparisler
    GROUP BY odeme_yontemi
    ORDER BY count DESC;
  `).all();

  // Customer metrics
  const customerCounts = db.prepare(`
    SELECT 
      COUNT(*) as total_customers,
      SUM(CASE WHEN premium_uye = 1 THEN 1 ELSE 0 END) as premium_customers,
      SUM(CASE WHEN eposta_izni = 1 THEN 1 ELSE 0 END) as email_subscribed_customers
    FROM musteriler;
  `).get();

  const orderingCustomers = db.prepare(`
    SELECT COUNT(DISTINCT musteri_id) as active_customers
    FROM siparisler;
  `).get().active_customers;

  return {
    kpis: {
      totalOrders: orderStats.total_orders,
      deliveredOrders: orderStats.delivered_orders,
      cancelledOrders: orderStats.cancelled_orders,
      cancellationRate: Number(((orderStats.cancelled_orders / orderStats.total_orders) * 100).toFixed(2)),
      grossRevenue: orderStats.gross_revenue,
      netRevenue: netRevenue,
      averageOrderValue: orderStats.average_order_value,
      totalReturns: returnStats.total_return_requests,
      returnAmount: returnStats.total_return_amount,
      returnRate: Number(((returnStats.total_return_requests / orderStats.delivered_orders) * 100).toFixed(2)),
      grossProfit: profitStats.gross_profit,
      profitMargin: profitMargin,
      totalSoldUnits: profitStats.total_sold_units,
      totalCustomers: customerCounts.total_customers,
      activeCustomers: orderingCustomers,
      premiumCustomers: customerCounts.premium_customers,
      totalCouponsDiscount: orderStats.total_coupon_discounts,
      totalShippingRevenue: orderStats.total_shipping_revenue
    },
    monthlyTrend,
    platforms,
    paymentMethods
  };
}

function getCategories() {
  const db = getDb();

  // Query 1 from guide extended with profit and margins:
  const mainCategories = db.prepare(`
    SELECT 
      ana.kategori_adi,
      ROUND(SUM(k.kalem_tutari), 2) AS ciro,
      COUNT(DISTINCT s.siparis_id) as siparis_sayisi,
      SUM(k.adet) as satilan_adet,
      ROUND(AVG(k.indirim_orani * 100), 2) as ortalama_indirim_yuzdesi,
      ROUND(SUM(k.kalem_tutari / (1.0 + k.kdv_orani / 100.0) - (k.adet * k.birim_maliyet)), 2) as brut_kar,
      ROUND((SUM(k.kalem_tutari / (1.0 + k.kdv_orani / 100.0) - (k.adet * k.birim_maliyet)) / SUM(k.kalem_tutari / (1.0 + k.kdv_orani / 100.0))) * 100, 2) as kar_marji_yuzde
    FROM siparis_kalemleri k
    JOIN siparisler s ON s.siparis_id = k.siparis_id
    JOIN urunler u ON u.urun_id = k.urun_id
    JOIN kategoriler alt ON alt.kategori_id = u.kategori_id
    JOIN kategoriler ana ON ana.kategori_id = alt.ust_kategori_id
    WHERE s.durum <> 'iptal'
    GROUP BY ana.kategori_adi
    ORDER BY ciro DESC;
  `).all();

  // Sub-categories breakdown
  const subCategories = db.prepare(`
    SELECT 
      ana.kategori_adi as ana_kategori,
      alt.kategori_adi as alt_kategori,
      ROUND(SUM(k.kalem_tutari), 2) AS ciro,
      SUM(k.adet) as satilan_adet,
      COUNT(DISTINCT u.urun_id) as urun_cesidi,
      ROUND(SUM(k.kalem_tutari / (1.0 + k.kdv_orani / 100.0) - (k.adet * k.birim_maliyet)), 2) as brut_kar
    FROM siparis_kalemleri k
    JOIN siparisler s ON s.siparis_id = k.siparis_id
    JOIN urunler u ON u.urun_id = k.urun_id
    JOIN kategoriler alt ON alt.kategori_id = u.kategori_id
    JOIN kategoriler ana ON ana.kategori_id = alt.ust_kategori_id
    WHERE s.durum <> 'iptal'
    GROUP BY ana.kategori_adi, alt.kategori_adi
    ORDER BY ana.kategori_adi ASC, ciro DESC;
  `).all();

  return {
    mainCategories,
    subCategories
  };
}

function getProducts() {
  const db = getDb();

  // Top 10 by revenue
  const topByRevenue = db.prepare(`
    SELECT 
      u.urun_id,
      u.urun_adi,
      u.marka,
      ana.kategori_adi as ana_kategori,
      alt.kategori_adi as alt_kategori,
      u.guncel_liste_fiyati,
      SUM(k.adet) as satilan_adet,
      ROUND(SUM(k.kalem_tutari), 2) as toplam_ciro,
      ROUND(SUM(k.kalem_tutari / (1.0 + k.kdv_orani / 100.0) - (k.adet * k.birim_maliyet)), 2) as toplam_kar
    FROM siparis_kalemleri k
    JOIN siparisler s ON s.siparis_id = k.siparis_id
    JOIN urunler u ON u.urun_id = k.urun_id
    JOIN kategoriler alt ON alt.kategori_id = u.kategori_id
    JOIN kategoriler ana ON ana.kategori_id = alt.ust_kategori_id
    WHERE s.durum <> 'iptal'
    GROUP BY u.urun_id
    ORDER BY toplam_ciro DESC
    LIMIT 10;
  `).all();

  // Top 10 by units sold
  const topByVolume = db.prepare(`
    SELECT 
      u.urun_id,
      u.urun_adi,
      u.marka,
      ana.kategori_adi as ana_kategori,
      SUM(k.adet) as satilan_adet,
      ROUND(SUM(k.kalem_tutari), 2) as toplam_ciro
    FROM siparis_kalemleri k
    JOIN siparisler s ON s.siparis_id = k.siparis_id
    JOIN urunler u ON u.urun_id = k.urun_id
    JOIN kategoriler alt ON alt.kategori_id = u.kategori_id
    JOIN kategoriler ana ON ana.kategori_id = alt.ust_kategori_id
    WHERE s.durum <> 'iptal'
    GROUP BY u.urun_id
    ORDER BY satilan_adet DESC
    LIMIT 10;
  `).all();

  // Top products by return volume and return rate
  const returnRisks = db.prepare(`
    SELECT 
      u.urun_id,
      u.urun_adi,
      u.marka,
      ana.kategori_adi as ana_kategori,
      COALESCE(sales.total_sold, 0) as satilan_adet,
      COALESCE(ret.total_returned, 0) as iade_adedi,
      ROUND(COALESCE(ret.total_return_amount, 0), 2) as iade_tutari,
      ROUND((CAST(COALESCE(ret.total_returned, 0) AS FLOAT) / NULLIF(sales.total_sold, 0)) * 100, 2) as iade_orani
    FROM urunler u
    JOIN kategoriler alt ON alt.kategori_id = u.kategori_id
    JOIN kategoriler ana ON ana.kategori_id = alt.ust_kategori_id
    JOIN (
      SELECT urun_id, SUM(adet) as total_sold
      FROM siparis_kalemleri k
      JOIN siparisler s ON s.siparis_id = k.siparis_id
      WHERE s.durum <> 'iptal'
      GROUP BY urun_id
    ) sales ON sales.urun_id = u.urun_id
    LEFT JOIN (
      SELECT k.urun_id, SUM(i.iade_adedi) as total_returned, SUM(i.iade_tutari) as total_return_amount
      FROM iadeler i
      JOIN siparis_kalemleri k ON k.kalem_id = i.kalem_id
      GROUP BY k.urun_id
    ) ret ON ret.urun_id = u.urun_id
    WHERE COALESCE(ret.total_returned, 0) > 0
    ORDER BY iade_orani DESC, iade_adedi DESC
    LIMIT 10;
  `).all();

  // Inventory analysis
  const inventoryStatus = db.prepare(`
    SELECT 
      u.urun_id,
      u.urun_adi,
      u.marka,
      ana.kategori_adi,
      u.stok_adedi,
      u.guncel_liste_fiyati,
      u.aktif
    FROM urunler u
    JOIN kategoriler alt ON alt.kategori_id = u.kategori_id
    JOIN kategoriler ana ON ana.kategori_id = alt.ust_kategori_id
    ORDER BY u.stok_adedi ASC
    LIMIT 10;
  `).all();

  return {
    topByRevenue,
    topByVolume,
    returnRisks,
    inventoryStatus
  };
}

function getCustomersAndGeo() {
  const db = getDb();

  // Query 2 from guide extended with coordinates and regions:
  const cityStats = db.prepare(`
    SELECT 
      il.il,
      il.bolge,
      il.enlem,
      il.boylam,
      COUNT(DISTINCT s.siparis_id) AS siparis_sayisi,
      ROUND(SUM(s.toplam_tutar), 2) AS toplam_ciro,
      ROUND(AVG(s.toplam_tutar), 2) AS ortalama_sepet,
      COUNT(DISTINCT s.musteri_id) AS musteri_sayisi
    FROM iller il
    LEFT JOIN siparisler s ON s.teslimat_il = il.il AND s.durum <> 'iptal'
    GROUP BY il.il, il.bolge, il.enlem, il.boylam
    ORDER BY siparis_sayisi DESC;
  `).all();

  // Regional summary (7 Regions of Turkey)
  const regionStats = db.prepare(`
    SELECT 
      il.bolge,
      COUNT(DISTINCT s.siparis_id) as siparis_sayisi,
      ROUND(SUM(s.toplam_tutar), 2) as toplam_ciro,
      ROUND(AVG(s.toplam_tutar), 2) as ortalama_sepet,
      COUNT(DISTINCT il.il) as il_sayisi
    FROM iller il
    LEFT JOIN siparisler s ON s.teslimat_il = il.il AND s.durum <> 'iptal'
    GROUP BY il.bolge
    ORDER BY toplam_ciro DESC;
  `).all();

  // Customer age distribution (using 2026 as current year)
  // 137 customers have NULL dogum_yili as noted in guide
  const ageDistribution = db.prepare(`
    SELECT 
      CASE 
        WHEN dogum_yili IS NULL THEN 'Bilinmiyor (137 Müşteri)'
        WHEN (2026 - dogum_yili) < 25 THEN '18-24 Yaş'
        WHEN (2026 - dogum_yili) BETWEEN 25 AND 34 THEN '25-34 Yaş'
        WHEN (2026 - dogum_yili) BETWEEN 35 AND 44 THEN '35-44 Yaş'
        WHEN (2026 - dogum_yili) BETWEEN 45 AND 54 THEN '45-54 Yaş'
        ELSE '55+ Yaş'
      END as age_group,
      COUNT(DISTINCT m.musteri_id) as customer_count,
      COUNT(DISTINCT s.siparis_id) as order_count,
      ROUND(SUM(CASE WHEN s.durum <> 'iptal' THEN s.toplam_tutar ELSE 0 END), 2) as revenue
    FROM musteriler m
    LEFT JOIN siparisler s ON s.musteri_id = m.musteri_id
    GROUP BY age_group
    ORDER BY customer_count DESC;
  `).all();

  // Gender breakdown
  const genderStats = db.prepare(`
    SELECT 
      m.cinsiyet,
      COUNT(DISTINCT m.musteri_id) as customer_count,
      COUNT(DISTINCT s.siparis_id) as order_count,
      ROUND(SUM(CASE WHEN s.durum <> 'iptal' THEN s.toplam_tutar ELSE 0 END), 2) as total_revenue,
      ROUND(AVG(CASE WHEN s.durum <> 'iptal' THEN s.toplam_tutar ELSE NULL END), 2) as aov
    FROM musteriler m
    LEFT JOIN siparisler s ON s.musteri_id = m.musteri_id
    GROUP BY m.cinsiyet;
  `).all();

  // Acquisition channels
  const channels = db.prepare(`
    SELECT 
      kayit_kanali,
      COUNT(DISTINCT m.musteri_id) as customer_count,
      COUNT(DISTINCT s.siparis_id) as order_count,
      ROUND(SUM(CASE WHEN s.durum <> 'iptal' THEN s.toplam_tutar ELSE 0 END), 2) as revenue,
      ROUND(AVG(CASE WHEN s.durum <> 'iptal' THEN s.toplam_tutar ELSE NULL END), 2) as aov
    FROM musteriler m
    LEFT JOIN siparisler s ON s.musteri_id = m.musteri_id
    GROUP BY kayit_kanali
    ORDER BY customer_count DESC;
  `).all();

  // Premium vs regular member comparison
  const membershipComparison = db.prepare(`
    SELECT 
      m.premium_uye,
      COUNT(DISTINCT m.musteri_id) as total_customers,
      COUNT(DISTINCT s.siparis_id) as total_orders,
      ROUND(SUM(CASE WHEN s.durum <> 'iptal' THEN s.toplam_tutar ELSE 0 END), 2) as total_revenue,
      ROUND(AVG(CASE WHEN s.durum <> 'iptal' THEN s.toplam_tutar ELSE NULL END), 2) as aov,
      ROUND(AVG(CASE WHEN s.durum <> 'iptal' THEN s.kargo_ucreti ELSE NULL END), 2) as avg_shipping_fee
    FROM musteriler m
    LEFT JOIN siparisler s ON s.musteri_id = m.musteri_id
    GROUP BY m.premium_uye;
  `).all();

  return {
    cityStats,
    regionStats,
    ageDistribution,
    genderStats,
    channels,
    membershipComparison
  };
}

function getFunnel() {
  const db = getDb();

  // Total sessions and events
  const totalSessions = db.prepare('SELECT COUNT(DISTINCT oturum_id) as count FROM olaylar').get().count;

  // Session funnel stages
  const sessionFunnel = db.prepare(`
    SELECT 
      COUNT(DISTINCT oturum_id) as total_sessions,
      COUNT(DISTINCT CASE WHEN olay_tipi = 'urun_goruntuleme' THEN oturum_id END) as viewed_sessions,
      COUNT(DISTINCT CASE WHEN olay_tipi = 'sepete_ekleme' THEN oturum_id END) as cart_sessions,
      COUNT(DISTINCT CASE WHEN olay_tipi = 'favoriye_ekleme' THEN oturum_id END) as favorite_sessions,
      COUNT(DISTINCT CASE WHEN olay_tipi = 'satin_alma' THEN oturum_id END) as purchase_sessions
    FROM olaylar;
  `).get();

  // Funnel by device
  const deviceFunnel = db.prepare(`
    SELECT 
      cihaz,
      COUNT(DISTINCT oturum_id) as total_sessions,
      COUNT(DISTINCT CASE WHEN olay_tipi = 'urun_goruntuleme' THEN oturum_id END) as viewed,
      COUNT(DISTINCT CASE WHEN olay_tipi = 'sepete_ekleme' THEN oturum_id END) as cart,
      COUNT(DISTINCT CASE WHEN olay_tipi = 'satin_alma' THEN oturum_id END) as purchases,
      ROUND((CAST(COUNT(DISTINCT CASE WHEN olay_tipi = 'satin_alma' THEN oturum_id END) AS FLOAT) / COUNT(DISTINCT oturum_id)) * 100, 2) as conversion_rate
    FROM olaylar
    GROUP BY cihaz
    ORDER BY total_sessions DESC;
  `).all();

  // Funnel by traffic source
  const sourceFunnel = db.prepare(`
    SELECT 
      trafik_kaynagi,
      COUNT(DISTINCT oturum_id) as total_sessions,
      COUNT(DISTINCT CASE WHEN olay_tipi = 'urun_goruntuleme' THEN oturum_id END) as viewed,
      COUNT(DISTINCT CASE WHEN olay_tipi = 'sepete_ekleme' THEN oturum_id END) as cart,
      COUNT(DISTINCT CASE WHEN olay_tipi = 'satin_alma' THEN oturum_id END) as purchases,
      ROUND((CAST(COUNT(DISTINCT CASE WHEN olay_tipi = 'satin_alma' THEN oturum_id END) AS FLOAT) / COUNT(DISTINCT oturum_id)) * 100, 2) as conversion_rate
    FROM olaylar
    GROUP BY trafik_kaynagi
    ORDER BY total_sessions DESC;
  `).all();

  // Query 3 from guide: Product events (views, carts, purchases)
  const productEvents = db.prepare(`
    SELECT 
      u.urun_adi,
      u.marka,
      SUM(CASE WHEN o.olay_tipi = 'urun_goruntuleme' THEN 1 ELSE 0 END) AS goruntuleme,
      SUM(CASE WHEN o.olay_tipi = 'sepete_ekleme' THEN 1 ELSE 0 END) AS sepete_ekleme,
      SUM(CASE WHEN o.olay_tipi = 'satin_alma' THEN 1 ELSE 0 END) AS satin_alma,
      ROUND((CAST(SUM(CASE WHEN o.olay_tipi = 'satin_alma' THEN 1 ELSE 0 END) AS FLOAT) / 
             NULLIF(SUM(CASE WHEN o.olay_tipi = 'urun_goruntuleme' THEN 1 ELSE 0 END), 0)) * 100, 2) as urun_donusum_orani
    FROM olaylar o
    JOIN urunler u ON u.urun_id = o.urun_id
    GROUP BY u.urun_id, u.urun_adi, u.marka
    ORDER BY goruntuleme DESC
    LIMIT 15;
  `).all();

  // Anonymous vs Logged-in visitors
  const visitorTypes = db.prepare(`
    SELECT 
      CASE WHEN musteri_id IS NULL THEN 'Anonim Ziyaretçi (%36)' ELSE 'Giriş Yapmış Müşteri' END as visitor_type,
      COUNT(*) as event_count,
      COUNT(DISTINCT oturum_id) as session_count
    FROM olaylar
    GROUP BY visitor_type;
  `).all();

  return {
    totalSessions,
    sessionFunnel,
    deviceFunnel,
    sourceFunnel,
    productEvents,
    visitorTypes
  };
}

function getLogistics() {
  const db = getDb();

  // Order status distribution
  const orderStatuses = db.prepare(`
    SELECT durum, COUNT(*) as count, ROUND(SUM(toplam_tutar), 2) as revenue
    FROM siparisler
    GROUP BY durum
    ORDER BY count DESC;
  `).all();

  // Cancellation reasons
  const cancellationReasons = db.prepare(`
    SELECT iptal_nedeni, COUNT(*) as count, ROUND(SUM(toplam_tutar), 2) as lost_revenue
    FROM siparisler
    WHERE durum = 'iptal' AND iptal_nedeni IS NOT NULL
    GROUP BY iptal_nedeni
    ORDER BY count DESC;
  `).all();

  // Return reasons
  const returnReasons = db.prepare(`
    SELECT iade_nedeni, COUNT(*) as count, SUM(iade_adedi) as units, ROUND(SUM(iade_tutari), 2) as return_amount
    FROM iadeler
    GROUP BY iade_nedeni
    ORDER BY count DESC;
  `).all();

  // Courier performance
  const couriers = db.prepare(`
    SELECT 
      s.kargo_firmasi,
      COUNT(*) as total_deliveries,
      ROUND(AVG(julianday(s.kargo_tarihi) - julianday(date(s.siparis_tarihi))), 2) as avg_dispatch_days,
      ROUND(AVG(julianday(s.teslim_tarihi) - julianday(s.kargo_tarihi)), 2) as avg_delivery_days,
      SUM(CASE WHEN s.durum = 'iptal' THEN 1 ELSE 0 END) as cancellations,
      COUNT(DISTINCT i.iade_id) as return_count
    FROM siparisler s
    LEFT JOIN iadeler i ON i.siparis_id = s.siparis_id
    WHERE s.kargo_firmasi IS NOT NULL AND s.kargo_firmasi <> ''
    GROUP BY s.kargo_firmasi
    ORDER BY total_deliveries DESC;
  `).all();

  // Installment count performance
  const installments = db.prepare(`
    SELECT 
      taksit_sayisi,
      COUNT(*) as order_count,
      ROUND(SUM(CASE WHEN durum <> 'iptal' THEN toplam_tutar ELSE 0 END), 2) as revenue,
      ROUND(AVG(CASE WHEN durum <> 'iptal' THEN toplam_tutar ELSE NULL END), 2) as aov
    FROM siparisler
    GROUP BY taksit_sayisi
    ORDER BY taksit_sayisi ASC;
  `).all();

  return {
    orderStatuses,
    cancellationReasons,
    returnReasons,
    couriers,
    installments
  };
}

function getCoupons() {
  const db = getDb();

  // 15 coupons performance
  const couponList = db.prepare(`
    SELECT 
      k.kupon_kodu,
      k.aciklama,
      k.indirim_tipi,
      k.indirim_degeri,
      k.min_sepet_tutari,
      k.baslangic_tarihi,
      k.bitis_tarihi,
      COUNT(s.siparis_id) as kullanim_sayisi,
      ROUND(COALESCE(SUM(s.kupon_indirimi), 0), 2) as toplam_indirim_tutari,
      ROUND(COALESCE(SUM(s.toplam_tutar), 0), 2) as olusan_ciro,
      ROUND(AVG(s.toplam_tutar), 2) as ortalama_sepet
    FROM kuponlar k
    LEFT JOIN siparisler s ON s.kupon_kodu = k.kupon_kodu AND s.durum <> 'iptal'
    GROUP BY k.kupon_kodu
    ORDER BY kullanim_sayisi DESC;
  `).all();

  // Coupon vs Non-coupon basket size comparison
  const couponComparison = db.prepare(`
    SELECT 
      CASE WHEN kupon_kodu IS NOT NULL AND kupon_kodu <> '' THEN 'Kupon Kullanılan' ELSE 'Kuponsuz' END as order_type,
      COUNT(*) as order_count,
      ROUND(SUM(toplam_tutar), 2) as total_revenue,
      ROUND(AVG(toplam_tutar), 2) as aov,
      ROUND(AVG(ara_toplam), 2) as avg_subtotal
    FROM siparisler
    WHERE durum <> 'iptal'
    GROUP BY order_type;
  `).all();

  return {
    couponList,
    couponComparison
  };
}

function runCustomQuery(sqlQuery) {
  const db = getDb();
  const trimmed = sqlQuery.trim();

  // Security check: only allow SELECT or WITH statements
  const isSelect = /^\s*(SELECT|WITH)\s+/i.test(trimmed);
  if (!isSelect) {
    throw new Error('Güvenlik kuralı: Yalnızca veri okuma (SELECT) sorgularına izin verilmektedir.');
  }

  // Prevent multiple statements
  if (trimmed.includes(';') && trimmed.indexOf(';') !== trimmed.length - 1) {
    throw new Error('Güvenlik kuralı: Tek seferde yalnızca tek bir SQL sorgusu çalıştırılabilir.');
  }

  const startTime = process.hrtime.bigint();
  const stmt = db.prepare(trimmed);
  const rows = stmt.all();
  const endTime = process.hrtime.bigint();
  const executionTimeMs = Number((Number(endTime - startTime) / 1000000).toFixed(2));

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    columns,
    rows: rows.slice(0, 500), // limit preview to 500 rows for smooth UI
    totalRows: rows.length,
    executionTimeMs
  };
}

module.exports = {
  getOverview,
  getCategories,
  getProducts,
  getCustomersAndGeo,
  getFunnel,
  getLogistics,
  getCoupons,
  runCustomQuery
};
