# BTÖ-303 Ara Uygulama 4: E-Ticaret Veri Analitiği ve Karar Destek Paneli

**Öğrenci No:** 24053035006  
**Öğrenci Adı:** Mustafa Emirhan Yılmaz  
**Ders Sorumlusu:** Dr. Mertcan Ünal  
**Veri Kapsamı:** 1 Ocak 2025 – 31 Ekim 2026 (11 Tablo, ~134.000 Satır)  
**Teknoloji Yığını:** Node.js (v24), Native `node:sqlite`, HTML5/SPA, Tailwind CSS, Chart.js, Leaflet.js, OpenStreetMap

---

## 1. Proje Konsepti ve Amacı
Bu proje, BTÖ-303 Ara Uygulama 4 kapsamında Dr. Mertcan Ünal tarafından sağlanan **11 tablolu ve yaklaşık 134 bin satırlık kurgusal e-ticaret veri setini** (`eticaret.sqlite`) derinlemesine analiz eden, iş kuralları ve resmî hesaplama formüllerini uygulayan, karar vericilere yönelik **etkileşimli bir Web Analitik ve Yönetim Paneli**dir.

Sistem, işletme yöneticilerine, pazarlama ekiplerine ve ürün sorumlularına şu temel karar destek işlevlerini sunar:
- Ciro, kâr marjı, iptal ve iade risklerini tek merkezden gerçek zamanlı izleme.
- 8 ana kategori ve 20 alt kategoride kârlılık ve satış hacmi analizi.
- 25 il ve 7 coğrafi bölgenin sipariş ve sepet yoğunluğunu interaktif harita üzerinde görselleştirme.
- 105 bin site olayı üzerinden kullanıcıların dönüşüm hunisini (Görüntüleme &rarr; Sepet &rarr; Satın Alma) ve cihaz bazlı kayıpları tespit etme.
- Kargo firmalarının teslimat hızlarını ve iade/iptal oranlarını kıyaslama.
- 15 kampanya kuponunun sepet büyüklüğü üzerindeki net etkisini ölçümleme.
- Canlı SQL Sorgu Stüdyosu ile doğrudan veritabanı üzerinde anlık sorgulama ve CSV formatında rapor dışa aktarma.

---

## 2. Veri Tabanı Mimarisi ve Tablolar (11 Tablo)

| Tablo | Satır Sayısı | İçerik ve İlişkiler |
|---|:---:|---|
| **`musteriler`** | 2.100 | Müşteri profili, il/ilçe, kayıt kanalı, üyelik tipi, doğum yılı (137 eksik kayıt). |
| **`siparisler`** | 8.044 | Sipariş başlıkları, ödeme, platform, kargo firması, teslimat ili, durumlar (7644 teslim, 324 iptal). |
| **`siparis_kalemleri`** | 13.858 | Siparişteki satırlar: liste fiyatı, indirim oranı, satış fiyatı, maliyet ve KDV. |
| **`urunler`** | 131 | Ürün kataloğu, marka, kategori, stok adedi, KDV oranı. |
| **`kategoriler`** | 28 | 8 ana kategori ve 20 alt kategori hiyerarşisi (`ust_kategori_id`). |
| **`saticilar`** | 24 | Ürün tedarikçileri, resmi mağaza bayrakları, illeri. |
| **`iadeler`** | 667 | İade talepleri, iade nedenleri, iade adedi ve tutarı (Sadece teslim edilmiş siparişler). |
| **`yorumlar`** | 4.305 | Müşteri puanları (1-5 yıldız), yorum metinleri ve faydalı oy sayıları. |
| **`olaylar`** | 105.136 | Ziyaret olayları (`urun_goruntuleme`, `sepete_ekleme`, `favoriye_ekleme`, `satin_alma`), cihaz, kaynak. |
| **`kuponlar`** | 15 | İndirim kuponları, yüzde/sabit tip, minimum sepet koşulu ve geçerlilik tarihleri. |
| **`iller`** | 25 | İl adı, coğrafi bölge, enlem ve boylam koordinatları. |

---

## 3. Rehberdeki Resmî Hesaplama Kuralları ve Formüller

Veri seti rehberinde belirtilen formüller sistemin `server/analytics.js` motorunda birebir uygulanmıştır:

1. **Birim Satış Fiyatı:**  
   $$\text{birim\_satis\_fiyati} = \text{birim\_liste\_fiyati} \times (1 - \text{indirim\_orani})$$
2. **Kalem Tutarı (KDV Dahil):**  
   $$\text{kalem\_tutari} = \text{adet} \times \text{birim\_satis\_fiyati}$$
3. **Sipariş Ara Toplamı:**  
   $$\text{ara\_toplam} = \sum \text{kalem\_tutari}$$
4. **Toplam Tutar (Müşterinin Ödediği):**  
   $$\text{toplam\_tutar} = \text{ara\_toplam} - \text{kupon\_indirimi} + \text{kargo\_ucreti}$$
5. **KDV Hariç Tutar ve Brüt Kâr:**  
   - $\text{KDV Hariç Tutar} = \frac{\text{tutar}}{1 + (\text{kdv\_orani} / 100)}$
   - $\text{Toplam Maliyet} = \text{adet} \times \text{birim\_maliyet}$  *(birim_maliyet KDV hariçtir)*
   - $\text{Brüt Kâr} = \text{KDV Hariç Tutar} - \text{Toplam Maliyet}$
6. **Çift Sayım Önlemi:**  
   `siparisler` ile `siparis_kalemleri` birleştirilirken sipariş düzeyindeki `toplam_tutar` ve `kupon_indirimi` alanları tekilleştirilerek hesaplanmıştır.
7. **İptal ve İade Kuralları:**  
   - İptal edilen 324 sipariş ciro ve kâr hesaplamalarına dahil edilmemiştir (`WHERE s.durum <> 'iptal'`).
   - İadeler yalnızca teslim edilmiş siparişlerde aranmış ve iade tutarları brüt cirodan düşülerek **Net Ciro** bulunmuştur.

---

## 4. Rehberdeki Örnek SQL Sorguları ve Doğrulama

Uygulamanın **Canlı SQL Stüdyosu** rehberin 12. sayfasındaki 3 örnek sorguyu hazır şablon olarak sunar:

### Sorgu 1: Ana Kategoriye Göre Ciro (İptaller Hariç)
```sql
SELECT ana.kategori_adi, ROUND(SUM(k.kalem_tutari), 2) AS ciro
FROM siparis_kalemleri k
JOIN siparisler s ON s.siparis_id = k.siparis_id
JOIN urunler u ON u.urun_id = k.urun_id
JOIN kategoriler alt ON alt.kategori_id = u.kategori_id
JOIN kategoriler ana ON ana.kategori_id = alt.ust_kategori_id
WHERE s.durum <> 'iptal'
GROUP BY ana.kategori_adi
ORDER BY ciro DESC;
```
*Doğrulanan Lider Kategori:* **Elektronik** (13.993.686,00 TL).

### Sorgu 2: İl Bazlı Sipariş Sayısı ve Ortalama Sepet
```sql
SELECT m.il, COUNT(*) AS siparis_sayisi, ROUND(AVG(s.toplam_tutar), 2) AS ortalama_sepet
FROM siparisler s
JOIN musteriler m ON m.musteri_id = s.musteri_id
WHERE s.durum <> 'iptal'
GROUP BY m.il
ORDER BY siparis_sayisi DESC
LIMIT 5;
```

### Sorgu 3: Ürün Başına Olay Sayıları ve Koşullu Sayma
```sql
SELECT u.urun_adi,
  SUM(CASE WHEN o.olay_tipi = 'urun_goruntuleme' THEN 1 ELSE 0 END) AS goruntuleme,
  SUM(CASE WHEN o.olay_tipi = 'sepete_ekleme' THEN 1 ELSE 0 END) AS sepete_ekleme,
  SUM(CASE WHEN o.olay_tipi = 'satin_alma' THEN 1 ELSE 0 END) AS satin_alma
FROM olaylar o
JOIN urunler u ON u.urun_id = o.urun_id
GROUP BY u.urun_adi
ORDER BY u.urun_adi
LIMIT 5;
```

---

## 5. Web Analitik Paneli Modülleri

1. **📊 Genel Bakış (Executive Dashboard):**
   - Brüt Ciro, Net Ciro, Toplam Sipariş, Teslimat/İptal Oranı, Brüt Kâr, Kâr Marjı, Ortalama Sepet (AOV).
   - Aylık Ciro ve Brüt Kâr Zaman Serisi Grafiği (2025-2026).
   - Platform (Web, Android, iOS, Mobil Web) ve Ödeme Yöntemi Dağılım Grafikleri.
2. **📦 Kategori & Ürünler:**
   - 8 Ana Kategori ve 20 Alt Kategori ciro, kâr marjı, satılan adet tablosu ve pasta grafiği.
   - En Çok Ciro Getiren 10 Ürün ve En Çok İade Alan Riskli Ürünler analizi.
3. **👥 Müşteri & Coğrafya:**
   - 25 İli kapsayan Leaflet.js Türkiye İnteraktif Haritası (Ciro büyüklüğüne göre ölçekli göstergeler ve tıklandığında açılan detay kartları).
   - 7 Coğrafi Bölgenin ciro sıralaması, müşteri yaş grupları (137 bilinmeyen yaş dahil), cinsiyet ve kayıt kanalları dağılımı.
   - Premium üyelik avantajı (ücretsiz kargo ve sepet büyüme kıyası).
4. **🔄 Dönüşüm Hunisi (Funnel Analytics):**
   - 105 bin olay ve 29.382 oturum üzerinden Huni: Tüm Oturumlar &rarr; İnceleyen &rarr; Sepete Ekleyen &rarr; Satın Alan.
   - Mobil, Masaüstü ve Tablet cihazların satın alma dönüşüm oranları.
   - Ürün bazında görüntülemeden satışa dönüşüm yüzdeleri.
5. **🚚 Lojistik, İptal ve İade Analizi:**
   - Sipariş durumları (Teslim edildi, İptal, Kargoda, Hazırlanıyor).
   - İptal nedenleri (Müşteri vazgeçti, Ödeme başarısız, Stok yetersiz, Adres hatalı) ve iade nedenleri dağılımı.
   - 4 Kargo Firması (Yıldız Kargo, Anadolu Kargo, Ekspres Kargo, Marmara Lojistik) teslim ve kargoya verme günleri kıyası.
6. **🎟️ Kupon & Kampanya Etkisi:**
   - 15 Kuponun sağladığı indirim toplamı, kullanım sıklığı ve yarattığı ciro.
   - Kuponlu siparişler vs Kuponsuz siparişler ortalama sepet farkı.
7. **⚡ Canlı SQL Laboratuvarı:**
   - Hazır rehber sorgularını tek tıkla yükleme veya kullanıcının kendi SELECT sorgularını anlık çalıştırma.
   - Sorgu çalışma süresi (ms) ölçümü, dinamik sütun ve satır tablolama, CSV dışa aktarım desteği.

---

## 6. Kurulum ve Çalıştırma

Proje harici hiçbir npm paketine ihtiyaç duymaksızın doğrudan Node.js'in yerel modülleriyle (`node:sqlite`, `node:http`) çalışacak şekilde optimize edilmiştir:

```bash
# Proje dizinine geçiş
cd /Users/emiryilmaz/.gemini/antigravity/scratch/bto303-ara4-dashboard

# Otomatik test ve doğrulama paketini çalıştırma
npm test

# Web uygulamasını başlatma
npm start
```

Uygulama başlatıldığında tarayıcınızdan **`http://localhost:3000`** adresine giderek paneli kullanabilirsiniz.
