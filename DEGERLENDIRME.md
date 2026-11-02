# BTÖ-303 Ara Uygulama 4 - Öz Değerlendirme ve Doğrulama Raporu

**Öğrenci No:** 24053035006  
**Öğrenci Adı:** Mustafa Emirhan Yılmaz  
**Değerlendirme Tarihi:** 02.11.2026  
**Proje Adı:** E-Ticaret Veri Analitiği ve Karar Destek Paneli (Ara Uygulama 4)  

---

## 1. Veri Seti ve Kapsam Doğrulaması (Tam Puan)
- **Veri Seti Entegrasyonu:** 11 Tablo (`musteriler`, `siparisler`, `siparis_kalemleri`, `urunler`, `kategoriler`, `saticilar`, `iadeler`, `yorumlar`, `olaylar`, `kuponlar`, `iller`) ve 134 bin satırlık SQLite veritabanı eksiksiz entegre edildi.
  - *Kanıt:* `node test/verify_analytics.js` çıktısı: `Tablo Sayısı: 11 / 11`.
- **Zaman Aralığı Uyumu:** 1 Ocak 2025 – 31 Ekim 2026 tarih aralığı doğrulanmış, son günlerdeki teslim edilmemiş (`hazirlaniyor`, `kargoda`) siparişler doğru biçimde filtrelenmiştir.

---

## 2. Rehberdeki Hesaplama Kuralları ve Formüller (Tam Puan)
- **Tutar ve İndirim Formülü:** `birim_satis_fiyati = birim_liste_fiyati * (1 - indirim_orani)` ve `kalem_tutari = adet * birim_satis_fiyati` uygulandı.
- **KDV ve Maliyet Ayrımı:**
  - Satış tutarları KDV dahil olduğundan, KDV hariç satış `kalem_tutari / (1 + kdv_orani / 100)` olarak dönüştürüldü.
  - `birim_maliyet` KDV hariç olduğundan brüt kâr bu tutar üzerinden hatasız hesaplandı.
  - *Kanıt:* `server/analytics.js` satır 37-49.
- **Çift Sayım Engeli:** `siparisler` ile `siparis_kalemleri` birleştirmelerinde sipariş düzeyi tutarlar (`toplam_tutar`, `kupon_indirimi`, `kargo_ucreti`) tekilleştirilerek hesaplandı.
- **İade ve İptal Koşulları:**
  - 324 iptal sipariş cirodan hariç tutuldu (`WHERE s.durum <> 'iptal'`).
  - İadelerin yalnızca teslim edilmiş siparişlerde var olduğu gözetildi ve net ciro buna göre hesaplandı.

---

## 3. Rehberdeki Örnek Sorguların Uygulanması (Tam Puan)
- **Örnek Sorgu 1 (Ana Kategori Ciro):** Lider kategori `Elektronik` (13.993.686,00 TL) olarak birebir doğrulandı.
- **Örnek Sorgu 2 (İl Bazlı Sipariş Sayısı ve Ortalama Sepet):** 25 il üzerinden sorgu çalıştırıldı, en çok sipariş alan 5 il ve ortalama sepetler listelendi.
- **Örnek Sorgu 3 (Ürün Başına Olay Sayıları):** 105 bin olay üzerinden görüntüleme, sepete ekleme ve satın alma koşullu sayımları yapıldı.
  - *Kanıt:* Canlı SQL Stüdyosu tek tıkla çalıştırma butonları ve `test/verify_analytics.js` testleri.

---

## 4. Kullanıcı Arayüzü ve Analitik Görselleştirme (Tam Puan)
- **Executive Dashboard (Genel Bakış):** 4 büyük KPI kartı, 22 aylık ciro ve kâr trendi grafiği, platform ve ödeme yöntemi dağılımları.
- **Kategori & Ürünler:** 8 ana kategori tablosu, ciro payı pasta grafiği, en çok satan 10 ürün ve iade riski yüksek ürünler listesi.
- **Coğrafi Analiz & Harita:** Leaflet.js Türkiye haritası üzerinde 25 ilin koordinatlarına göre ölçekli gösterimi ve detay popup kartları; 7 bölge grafiği ve müşteri demografisi.
- **Dönüşüm Hunisi:** 29.382 oturumun 4 aşamalı hunisi, cihaz ve trafik kaynağı dönüşüm oranları.
- **Lojistik & İade:** 4 kargo firmasının teslim süreleri, sipariş durumları ve iptal/iade nedenleri.
- **Kupon Analizi:** 15 kuponun sepet büyüklüğüne net etkisi.
- **Canlı SQL Stüdyosu:** SELECT sorgularını çalıştıran, hata denetimi yapan, çalışma süresi ölçen ve CSV dışa aktaran interaktif SQL laboratuvarı.

---

## 5. Test ve Kod Kalitesi (Tam Puan)
- **Otomatik Testler:** `node test/verify_analytics.js` ile 8 ana test senaryosu çalıştırıldı, tümü yeşil olarak geçti (8/8).
- **Hafif ve Bağımsız Mimari:** Ek bir harici bağımlılık (`npm install`) derleme sıkıntısı yaşamadan Node.js yerel modülleriyle doğrudan çalıştırılabilir durumdadır.
