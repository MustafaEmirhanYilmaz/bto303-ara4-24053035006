// public/js/app.js
// Client-side application controller for BTÖ-303 Ara Uygulama 4 Dashboard

let currentView = 'overview';
const chartInstances = {};
let mapInstance = null;
let markersLayer = null;

// Currency & Number Formatters
const formatCurrency = (val) => {
  if (val === null || val === undefined) return '0,00 ₺';
  return Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
};

const formatNumber = (val) => {
  if (val === null || val === undefined) return '0';
  return Number(val).toLocaleString('tr-TR');
};

// Guide Preset Queries
const SAMPLE_QUERIES = {
  1: `-- Rehber Örnek Sorgu 1: Ana kategoriye göre ciro (iptaller hariç, KDV dahil)
SELECT ana.kategori_adi, ROUND(SUM(k.kalem_tutari), 2) AS ciro
FROM siparis_kalemleri k
JOIN siparisler s ON s.siparis_id = k.siparis_id
JOIN urunler u ON u.urun_id = k.urun_id
JOIN kategoriler alt ON alt.kategori_id = u.kategori_id
JOIN kategoriler ana ON ana.kategori_id = alt.ust_kategori_id
WHERE s.durum <> 'iptal'
GROUP BY ana.kategori_adi
ORDER BY ciro DESC;`,

  2: `-- Rehber Örnek Sorgu 2: İl bazlı sipariş sayısı ve ortalama sepet
SELECT m.il, COUNT(*) AS siparis_sayisi, ROUND(AVG(s.toplam_tutar), 2) AS ortalama_sepet
FROM siparisler s
JOIN musteriler m ON m.musteri_id = s.musteri_id
WHERE s.durum <> 'iptal'
GROUP BY m.il
ORDER BY siparis_sayisi DESC
LIMIT 5;`,

  3: `-- Rehber Örnek Sorgu 3: Ürün başına olay sayıları ve koşullu sayma
SELECT u.urun_adi,
  SUM(CASE WHEN o.olay_tipi = 'urun_goruntuleme' THEN 1 ELSE 0 END) AS goruntuleme,
  SUM(CASE WHEN o.olay_tipi = 'sepete_ekleme' THEN 1 ELSE 0 END) AS sepete_ekleme,
  SUM(CASE WHEN o.olay_tipi = 'satin_alma' THEN 1 ELSE 0 END) AS satin_alma
FROM olaylar o
JOIN urunler u ON u.urun_id = o.urun_id
GROUP BY u.urun_adi
ORDER BY u.urun_adi
LIMIT 5;`
};

// Navigation
function navigateTo(view) {
  currentView = view;

  // Hide all views
  document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
  const targetView = document.getElementById(`view-${view}`);
  if (targetView) targetView.classList.remove('hidden');

  // Update navigation button styles
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.className = 'nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-slate-300 hover:text-white hover:bg-slate-800';
  });
  const activeBtn = document.getElementById(`nav-${view}`);
  if (activeBtn) {
    activeBtn.className = 'nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-white bg-brand-600 shadow-sm shadow-brand-600/30';
  }

  // Update page title
  const titles = {
    overview: 'Yönetim ve Genel Bakış',
    categories: 'Kategori ve Ürün Performansı',
    customers: 'Müşteri ve Coğrafi Analiz (25 İl)',
    funnel: 'Dönüşüm Hunisi ve Site Olayları (105k Olay)',
    logistics: 'Lojistik, İptal ve İade Analizi',
    coupons: 'Kupon ve Kampanya Etkisi',
    sql: 'Canlı SQL Sorgu Stüdyosu'
  };
  document.getElementById('page-title').textContent = titles[view] || 'Analitik Paneli';

  // Load view-specific data
  if (view === 'overview') loadOverview();
  else if (view === 'categories') loadCategories();
  else if (view === 'customers') loadCustomers();
  else if (view === 'funnel') loadFunnel();
  else if (view === 'logistics') loadLogistics();
  else if (view === 'coupons') loadCoupons();
  else if (view === 'sql') {
    if (!document.getElementById('sql-input').value) {
      loadSampleQuery(1);
    }
  }
}

// 1. OVERVIEW MODULE
async function loadOverview() {
  try {
    const res = await fetch('/api/overview');
    const data = await res.json();
    const k = data.kpis;

    document.getElementById('kpi-gross-revenue').textContent = formatCurrency(k.grossRevenue);
    document.getElementById('kpi-net-revenue').textContent = formatCurrency(k.netRevenue);
    document.getElementById('kpi-total-orders').textContent = formatNumber(k.totalOrders);
    document.getElementById('kpi-delivered-orders').textContent = formatNumber(k.deliveredOrders);
    document.getElementById('kpi-cancelled-orders').textContent = formatNumber(k.cancelledOrders);
    document.getElementById('kpi-cancellation-rate').textContent = k.cancellationRate;
    document.getElementById('kpi-gross-profit').textContent = formatCurrency(k.grossProfit);
    document.getElementById('kpi-profit-margin').textContent = k.profitMargin + '%';
    document.getElementById('kpi-aov').textContent = formatCurrency(k.averageOrderValue);
    document.getElementById('kpi-return-rate').textContent = k.returnRate + '%';
    document.getElementById('kpi-return-amount').textContent = formatCurrency(k.returnAmount);

    // Monthly Trend Chart
    renderChart('chart-monthly-trend', {
      type: 'bar',
      data: {
        labels: data.monthlyTrend.map(m => m.month),
        datasets: [
          {
            label: 'Ciro (TL)',
            data: data.monthlyTrend.map(m => m.revenue),
            backgroundColor: 'rgba(99, 102, 241, 0.85)',
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            label: 'Brüt Kâr (TL)',
            data: data.monthlyTrend.map(m => m.profit),
            type: 'line',
            borderColor: '#10b981',
            backgroundColor: '#10b981',
            borderWidth: 2.5,
            pointRadius: 3,
            tension: 0.25,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => (v / 1e6).toFixed(1) + 'M ₺'
            }
          }
        }
      }
    });

    // Platforms Doughnut Chart
    renderChart('chart-platforms', {
      type: 'doughnut',
      data: {
        labels: data.platforms.map(p => p.platform),
        datasets: [{
          data: data.platforms.map(p => p.total_revenue),
          backgroundColor: ['#6366f1', '#3b82f6', '#10b981', '#f59e0b']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}`
            }
          }
        }
      }
    });

    // Payment Methods Chart
    renderChart('chart-payments', {
      type: 'doughnut',
      data: {
        labels: data.paymentMethods.map(p => p.odeme_yontemi),
        datasets: [{
          data: data.paymentMethods.map(p => p.count),
          backgroundColor: ['#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899', '#f97316']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  } catch (err) {
    console.error('Overview error:', err);
  }
}

// 2. CATEGORIES & PRODUCTS MODULE
async function loadCategories() {
  try {
    const [catRes, prodRes] = await Promise.all([
      fetch('/api/categories'),
      fetch('/api/products')
    ]);
    const catData = await catRes.json();
    const prodData = await prodRes.json();

    // Main Categories Table
    const tbody = document.getElementById('table-main-categories');
    tbody.innerHTML = catData.mainCategories.map(c => `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="py-3 px-4 font-semibold text-slate-800">${c.kategori_adi}</td>
        <td class="py-3 px-3 text-right font-medium text-indigo-700">${formatCurrency(c.ciro)}</td>
        <td class="py-3 px-3 text-right text-slate-600">${formatNumber(c.satilan_adet)}</td>
        <td class="py-3 px-3 text-right text-slate-600">%${c.ortalama_indirim_yuzdesi}</td>
        <td class="py-3 px-3 text-right text-emerald-600 font-medium">${formatCurrency(c.brut_kar)}</td>
        <td class="py-3 px-3 text-right"><span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">%${c.kar_marji_yuzde}</span></td>
      </tr>
    `).join('');

    // Main Category Pie Chart
    renderChart('chart-category-pie', {
      type: 'pie',
      data: {
        labels: catData.mainCategories.map(c => c.kategori_adi),
        datasets: [{
          data: catData.mainCategories.map(c => c.ciro),
          backgroundColor: [
            '#4f46e5', '#3b82f6', '#06b6d4', '#10b981',
            '#84cc16', '#eab308', '#f97316', '#ef4444'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' }
        }
      }
    });

    // Top Products by Revenue
    document.getElementById('table-top-products-rev').innerHTML = prodData.topByRevenue.map(p => `
      <tr class="hover:bg-slate-50">
        <td class="py-2.5 px-3">
          <div class="font-semibold text-slate-800 text-[11px]">${p.urun_adi}</div>
          <div class="text-[10px] text-slate-400">${p.marka}</div>
        </td>
        <td class="py-2.5 px-2 text-slate-500">${p.ana_kategori}</td>
        <td class="py-2.5 px-2 text-right text-slate-600">${formatNumber(p.satilan_adet)}</td>
        <td class="py-2.5 px-3 text-right font-semibold text-indigo-700">${formatCurrency(p.toplam_ciro)}</td>
      </tr>
    `).join('');

    // Return Risk Products
    document.getElementById('table-return-risks').innerHTML = prodData.returnRisks.map(p => `
      <tr class="hover:bg-slate-50">
        <td class="py-2.5 px-3 font-semibold text-slate-800 text-[11px]">${p.urun_adi}</td>
        <td class="py-2.5 px-2 text-right text-slate-600">${p.satilan_adet}</td>
        <td class="py-2.5 px-2 text-right text-rose-600 font-semibold">${p.iade_adedi}</td>
        <td class="py-2.5 px-2 text-right"><span class="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold text-[10px]">%${p.iade_orani}</span></td>
        <td class="py-2.5 px-3 text-right text-slate-600">${formatCurrency(p.iade_tutari)}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Categories load error:', err);
  }
}

// 3. CUSTOMERS & GEOGRAPHICS MODULE
async function loadCustomers() {
  try {
    const res = await fetch('/api/customers');
    const data = await res.json();

    // Leaflet Turkey Map
    setTimeout(() => {
      if (!mapInstance) {
        mapInstance = L.map('turkey-map').setView([39.0, 35.0], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '&copy; OpenStreetMap'
        }).addTo(mapInstance);
        markersLayer = L.layerGroup().addTo(mapInstance);
      } else {
        markersLayer.clearLayers();
        mapInstance.invalidateSize();
      }

      data.cityStats.forEach(c => {
        if (c.enlem && c.boylam) {
          const radius = Math.max(6, Math.min(24, Math.sqrt(c.siparis_sayisi) * 0.45));
          const circle = L.circleMarker([c.enlem, c.boylam], {
            radius: radius,
            fillColor: '#4f46e5',
            color: '#312e81',
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.7
          });

          circle.bindPopup(`
            <div class="text-xs">
              <strong class="text-sm font-bold text-slate-800">${c.il}</strong> (${c.bolge})<br/>
              <div class="mt-1 space-y-0.5">
                <div>Sipariş Sayısı: <strong>${formatNumber(c.siparis_sayisi)}</strong></div>
                <div>Toplam Ciro: <strong class="text-indigo-600">${formatCurrency(c.toplam_ciro)}</strong></div>
                <div>Ort. Sepet: <strong>${formatCurrency(c.ortalama_sepet)}</strong></div>
                <div>Müşteri Sayısı: <strong>${formatNumber(c.musteri_sayisi)}</strong></div>
              </div>
            </div>
          `);

          markersLayer.addLayer(circle);
        }
      });
    }, 100);

    // Top 5 Cities (Guide Query 2)
    const top5 = data.cityStats.slice(0, 5);
    document.getElementById('table-top5-cities').innerHTML = top5.map(c => `
      <tr class="hover:bg-slate-50">
        <td class="py-2.5 px-3 font-semibold text-slate-800">${c.il}</td>
        <td class="py-2.5 px-2 text-right font-medium text-slate-700">${formatNumber(c.siparis_sayisi)}</td>
        <td class="py-2.5 px-3 text-right text-indigo-700 font-semibold">${formatCurrency(c.ortalama_sepet)}</td>
      </tr>
    `).join('');

    // Regions Chart
    renderChart('chart-regions', {
      type: 'bar',
      data: {
        labels: data.regionStats.map(r => r.bolge),
        datasets: [{
          label: 'Toplam Ciro (TL)',
          data: data.regionStats.map(r => r.toplam_ciro),
          backgroundColor: '#6366f1',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { callback: (v) => (v / 1e6).toFixed(1) + 'M ₺' } }
        }
      }
    });

    // Age Chart
    renderChart('chart-age', {
      type: 'bar',
      data: {
        labels: data.ageDistribution.map(a => a.age_group),
        datasets: [{
          label: 'Müşteri',
          data: data.ageDistribution.map(a => a.customer_count),
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    // Gender Chart
    renderChart('chart-gender', {
      type: 'doughnut',
      data: {
        labels: data.genderStats.map(g => g.cinsiyet === 'K' ? 'Kadın (K)' : 'Erkek (E)'),
        datasets: [{
          data: data.genderStats.map(g => g.total_revenue),
          backgroundColor: ['#ec4899', '#3b82f6']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Acquisition Channels Chart
    renderChart('chart-channels', {
      type: 'bar',
      data: {
        labels: data.channels.map(c => c.kayit_kanali),
        datasets: [{
          label: 'Kayıt',
          data: data.channels.map(c => c.customer_count),
          backgroundColor: '#10b981',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    // Premium Membership comparison box
    const prem = data.membershipComparison.find(m => m.premium_uye === 1) || {};
    const norm = data.membershipComparison.find(m => m.premium_uye === 0) || {};
    document.getElementById('premium-stats-box').innerHTML = `
      <div class="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs">
        <div class="font-bold text-amber-900 mb-1">Premium Üyeler (${prem.total_customers || 0} Kişi)</div>
        <div class="text-amber-800">Ort. Sepet: <strong>${formatCurrency(prem.aov)}</strong></div>
        <div class="text-amber-800">Kargo Ücreti: <strong>0,00 ₺ (Ücretsiz)</strong></div>
      </div>
      <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
        <div class="font-bold text-slate-800 mb-1">Standart Üyeler (${norm.total_customers || 0} Kişi)</div>
        <div class="text-slate-700">Ort. Sepet: <strong>${formatCurrency(norm.aov)}</strong></div>
        <div class="text-slate-700">Ort. Kargo: <strong>${formatCurrency(norm.avg_shipping_fee)}</strong></div>
      </div>
    `;

  } catch (err) {
    console.error('Customers load error:', err);
  }
}

// 4. CONVERSION FUNNEL MODULE
async function loadFunnel() {
  try {
    const res = await fetch('/api/funnel');
    const data = await res.json();
    const f = data.sessionFunnel;

    const stages = [
      { name: '1. Tüm Ziyaret Oturumları', count: f.total_sessions, pct: 100, color: 'bg-indigo-600' },
      { name: '2. Ürün İnceleyen Oturumlar', count: f.viewed_sessions, pct: ((f.viewed_sessions / f.total_sessions) * 100).toFixed(1), color: 'bg-blue-600' },
      { name: '3. Sepete Ürün Ekleyenler', count: f.cart_sessions, pct: ((f.cart_sessions / f.total_sessions) * 100).toFixed(1), color: 'bg-cyan-600' },
      { name: '4. Satın Alma Tamamlayanlar', count: f.purchase_sessions, pct: ((f.purchase_sessions / f.total_sessions) * 100).toFixed(1), color: 'bg-emerald-600' }
    ];

    document.getElementById('funnel-bars-container').innerHTML = stages.map(s => `
      <div class="funnel-bar-wrapper p-3.5 bg-slate-50 rounded-xl border border-slate-200">
        <div class="flex items-center justify-between text-xs mb-1.5">
          <span class="font-semibold text-slate-800">${s.name}</span>
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-900">${formatNumber(s.count)} Oturum</span>
            <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-white text-slate-700 border border-slate-200">%${s.pct}</span>
          </div>
        </div>
        <div class="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
          <div class="${s.color} h-full rounded-full transition-all duration-500" style="width: ${s.pct}%"></div>
        </div>
      </div>
    `).join('');

    // Device conversion chart
    renderChart('chart-device-funnel', {
      type: 'bar',
      data: {
        labels: data.deviceFunnel.map(d => d.cihaz),
        datasets: [{
          label: 'Dönüşüm Oranı (%)',
          data: data.deviceFunnel.map(d => d.conversion_rate),
          backgroundColor: ['#6366f1', '#10b981', '#f59e0b'],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { callback: v => '%' + v } } }
      }
    });

    // Visitor Types
    document.getElementById('visitor-types-box').innerHTML = data.visitorTypes.map(v => `
      <div class="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
        <span class="font-medium text-slate-700">${v.visitor_type}</span>
        <span class="font-semibold text-slate-900">${formatNumber(v.session_count)} Oturum</span>
      </div>
    `).join('');

    // Product Events (Guide Query 3)
    document.getElementById('table-product-events').innerHTML = data.productEvents.map(p => `
      <tr class="hover:bg-slate-50">
        <td class="py-2.5 px-3 font-semibold text-slate-800">${p.urun_adi}</td>
        <td class="py-2.5 px-2 text-slate-500">${p.marka}</td>
        <td class="py-2.5 px-2 text-right text-slate-700 font-medium">${formatNumber(p.goruntuleme)}</td>
        <td class="py-2.5 px-2 text-right text-slate-700 font-medium">${formatNumber(p.sepete_ekleme)}</td>
        <td class="py-2.5 px-2 text-right text-emerald-600 font-bold">${formatNumber(p.satin_alma)}</td>
        <td class="py-2.5 px-3 text-right"><span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">%${p.urun_donusum_orani}</span></td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Funnel load error:', err);
  }
}

// 5. LOGISTICS MODULE
async function loadLogistics() {
  try {
    const res = await fetch('/api/logistics');
    const data = await res.json();

    // Order statuses doughnut
    renderChart('chart-order-statuses', {
      type: 'doughnut',
      data: {
        labels: data.orderStatuses.map(s => s.durum),
        datasets: [{
          data: data.orderStatuses.map(s => s.count),
          backgroundColor: ['#10b981', '#ef4444', '#3b82f6', '#f59e0b']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Cancellation reasons chart
    renderChart('chart-cancellation-reasons', {
      type: 'pie',
      data: {
        labels: data.cancellationReasons.map(r => r.iptal_nedeni),
        datasets: [{
          data: data.cancellationReasons.map(r => r.count),
          backgroundColor: ['#ef4444', '#f97316', '#eab308', '#64748b']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Return reasons chart
    renderChart('chart-return-reasons', {
      type: 'bar',
      data: {
        labels: data.returnReasons.map(r => r.iade_nedeni),
        datasets: [{
          label: 'İade Adedi',
          data: data.returnReasons.map(r => r.units),
          backgroundColor: '#ec4899',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    // Couriers Table
    document.getElementById('table-couriers').innerHTML = data.couriers.map(c => `
      <tr class="hover:bg-slate-50">
        <td class="py-3 px-3 font-semibold text-slate-800">${c.kargo_firmasi}</td>
        <td class="py-3 px-2 text-right text-slate-700 font-medium">${formatNumber(c.total_deliveries)}</td>
        <td class="py-3 px-2 text-right text-slate-600">${c.avg_dispatch_days} Gün</td>
        <td class="py-3 px-2 text-right font-semibold text-indigo-700">${c.avg_delivery_days} Gün</td>
        <td class="py-3 px-2 text-right text-rose-600 font-medium">${c.cancellations}</td>
        <td class="py-3 px-3 text-right text-amber-600 font-medium">${c.return_count}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Logistics load error:', err);
  }
}

// 6. COUPONS MODULE
async function loadCoupons() {
  try {
    const res = await fetch('/api/coupons');
    const data = await res.json();

    // Coupons Table
    document.getElementById('table-coupons-list').innerHTML = data.couponList.map(c => `
      <tr class="hover:bg-slate-50">
        <td class="py-2.5 px-3 font-mono font-bold text-brand-700 text-[11px]">${c.kupon_kodu}</td>
        <td class="py-2.5 px-2 text-slate-600 text-[11px]">${c.aciklama}</td>
        <td class="py-2.5 px-2 text-slate-600"><span class="px-1.5 py-0.5 rounded bg-slate-100 font-medium text-[10px]">${c.indirim_tipi === 'yuzde' ? '%' + c.indirim_degeri : c.indirim_degeri + ' ₺'}</span></td>
        <td class="py-2.5 px-2 text-right font-medium text-slate-800">${formatNumber(c.kullanim_sayisi)}</td>
        <td class="py-2.5 px-2 text-right text-rose-600 font-medium">${formatCurrency(c.toplam_indirim_tutari)}</td>
        <td class="py-2.5 px-3 text-right text-emerald-600 font-semibold">${formatCurrency(c.olusan_ciro)}</td>
      </tr>
    `).join('');

    // Comparison Box
    const withCoupon = data.couponComparison.find(c => c.order_type === 'Kupon Kullanılan') || {};
    const noCoupon = data.couponComparison.find(c => c.order_type === 'Kuponsuz') || {};
    document.getElementById('coupon-comparison-box').innerHTML = `
      <div class="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
        <div class="text-xs font-bold text-emerald-900 mb-1">Kupon Kullanılan Siparişler</div>
        <div class="text-xl font-bold text-emerald-700">${formatCurrency(withCoupon.aov)}</div>
        <div class="text-[11px] text-emerald-600 mt-1">${formatNumber(withCoupon.order_count)} siparişte uygulandı</div>
      </div>
      <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
        <div class="text-xs font-bold text-slate-800 mb-1">Kuponsuz Siparişler</div>
        <div class="text-xl font-bold text-slate-700">${formatCurrency(noCoupon.aov)}</div>
        <div class="text-[11px] text-slate-500 mt-1">${formatNumber(noCoupon.order_count)} standart sipariş</div>
      </div>
    `;

  } catch (err) {
    console.error('Coupons load error:', err);
  }
}

// 7. SQL QUERY STUDIO
function loadSampleQuery(queryIndex) {
  const sql = SAMPLE_QUERIES[queryIndex];
  if (sql) {
    document.getElementById('sql-input').value = sql;
    executeSqlQuery();
  }
}

async function executeSqlQuery() {
  const sql = document.getElementById('sql-input').value.trim();
  const errorBox = document.getElementById('query-error');
  const metaInfo = document.getElementById('query-meta-info');
  const thead = document.getElementById('query-table-head');
  const tbody = document.getElementById('query-table-body');
  const countBadge = document.getElementById('results-count-badge');

  errorBox.classList.add('hidden');
  errorBox.textContent = '';
  metaInfo.textContent = 'Sorgu çalıştırılıyor...';

  try {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
    const result = await res.json();

    if (result.error) {
      errorBox.textContent = result.message;
      errorBox.classList.remove('hidden');
      metaInfo.textContent = 'Hata oluştu.';
      return;
    }

    metaInfo.innerHTML = `Sorgu tamamlandı: <strong>${result.totalRows}</strong> satır döndü (<span class="text-emerald-600 font-semibold">${result.executionTimeMs} ms</span>)`;
    countBadge.textContent = `${result.totalRows} satır`;

    if (result.columns.length === 0) {
      thead.innerHTML = '<tr><th class="py-2.5 px-3">Sonuç yok</th></tr>';
      tbody.innerHTML = '<tr><td class="py-3 px-3 text-slate-400">0 kayıt bulundu.</td></tr>';
      return;
    }

    thead.innerHTML = `<tr>${result.columns.map(c => `<th class="py-2.5 px-3 font-semibold">${c}</th>`).join('')}</tr>`;
    tbody.innerHTML = result.rows.map(r => `
      <tr class="hover:bg-slate-50">
        ${result.columns.map(c => `<td class="py-2 px-3 text-slate-700">${r[c] !== null ? r[c] : '<span class="text-slate-300 italic">NULL</span>'}</td>`).join('')}
      </tr>
    `).join('');

  } catch (err) {
    errorBox.textContent = 'Bağlantı veya sunucu hatası: ' + err.message;
    errorBox.classList.remove('hidden');
    metaInfo.textContent = 'Başarısız.';
  }
}

// Chart rendering helper (destroys previous instance if exists)
function renderChart(canvasId, config) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }
  const ctx = document.getElementById(canvasId);
  if (ctx) {
    chartInstances[canvasId] = new Chart(ctx, config);
  }
}

// Modal controls
function openGuideModal() {
  document.getElementById('guide-modal').classList.remove('hidden');
}

function closeGuideModal() {
  document.getElementById('guide-modal').classList.add('hidden');
}

function toggleExportMenu() {
  const menu = document.getElementById('export-menu');
  menu.classList.toggle('hidden');
}

// Keyboard shortcuts (F5 runs query on SQL tab)
document.addEventListener('keydown', (e) => {
  if (e.key === 'F5' && currentView === 'sql') {
    e.preventDefault();
    executeSqlQuery();
  }
});

// Initial boot
window.addEventListener('DOMContentLoaded', () => {
  navigateTo('overview');
});
