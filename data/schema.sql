-- BTÖ-303 Ara Uygulama 4 · Kurgusal e-ticaret veri seti (SQLite ve PostgreSQL uyumlu)
CREATE TABLE iller (
  il VARCHAR(40) PRIMARY KEY,
  bolge VARCHAR(40) NOT NULL,
  enlem NUMERIC(8,4) NOT NULL,
  boylam NUMERIC(8,4) NOT NULL
);
CREATE TABLE kategoriler (
  kategori_id INTEGER PRIMARY KEY,
  kategori_adi VARCHAR(60) NOT NULL,
  ust_kategori_id INTEGER REFERENCES kategoriler(kategori_id)
);
CREATE TABLE saticilar (
  satici_id INTEGER PRIMARY KEY,
  satici_adi VARCHAR(80) NOT NULL,
  il VARCHAR(40) NOT NULL REFERENCES iller(il),
  katilim_tarihi DATE NOT NULL,
  resmi_magaza SMALLINT NOT NULL
);
CREATE TABLE urunler (
  urun_id INTEGER PRIMARY KEY,
  urun_adi VARCHAR(120) NOT NULL,
  marka VARCHAR(60) NOT NULL,
  kategori_id INTEGER NOT NULL REFERENCES kategoriler(kategori_id),
  satici_id INTEGER NOT NULL REFERENCES saticilar(satici_id),
  guncel_liste_fiyati NUMERIC(12,2) NOT NULL,
  kdv_orani SMALLINT NOT NULL,
  stok_adedi INTEGER NOT NULL,
  eklenme_tarihi DATE NOT NULL,
  aktif SMALLINT NOT NULL
);
CREATE TABLE musteriler (
  musteri_id INTEGER PRIMARY KEY,
  ad VARCHAR(40) NOT NULL,
  soyad VARCHAR(40) NOT NULL,
  cinsiyet CHAR(1) NOT NULL,
  dogum_yili INTEGER,
  e_posta VARCHAR(120) NOT NULL UNIQUE,
  il VARCHAR(40) NOT NULL REFERENCES iller(il),
  ilce VARCHAR(60) NOT NULL,
  kayit_tarihi DATE NOT NULL,
  kayit_kanali VARCHAR(30) NOT NULL,
  premium_uye SMALLINT NOT NULL,
  eposta_izni SMALLINT NOT NULL
);
CREATE TABLE kuponlar (
  kupon_kodu VARCHAR(30) PRIMARY KEY,
  aciklama VARCHAR(120) NOT NULL,
  indirim_tipi VARCHAR(10) NOT NULL,
  indirim_degeri NUMERIC(10,2) NOT NULL,
  min_sepet_tutari NUMERIC(10,2) NOT NULL,
  baslangic_tarihi DATE NOT NULL,
  bitis_tarihi DATE NOT NULL
);
CREATE TABLE siparisler (
  siparis_id INTEGER PRIMARY KEY,
  musteri_id INTEGER NOT NULL REFERENCES musteriler(musteri_id),
  siparis_tarihi TIMESTAMP NOT NULL,
  durum VARCHAR(20) NOT NULL,
  iptal_nedeni VARCHAR(30),
  platform VARCHAR(20) NOT NULL,
  odeme_yontemi VARCHAR(20) NOT NULL,
  taksit_sayisi SMALLINT NOT NULL,
  kupon_kodu VARCHAR(30) REFERENCES kuponlar(kupon_kodu),
  ara_toplam NUMERIC(12,2) NOT NULL,
  kupon_indirimi NUMERIC(12,2) NOT NULL,
  kargo_ucreti NUMERIC(8,2) NOT NULL,
  toplam_tutar NUMERIC(12,2) NOT NULL,
  teslimat_il VARCHAR(40) NOT NULL REFERENCES iller(il),
  teslimat_ilce VARCHAR(60) NOT NULL,
  kargo_firmasi VARCHAR(40) NOT NULL,
  kargo_tarihi DATE,
  teslim_tarihi DATE
);
CREATE TABLE siparis_kalemleri (
  kalem_id INTEGER PRIMARY KEY,
  siparis_id INTEGER NOT NULL REFERENCES siparisler(siparis_id),
  urun_id INTEGER NOT NULL REFERENCES urunler(urun_id),
  adet INTEGER NOT NULL,
  birim_liste_fiyati NUMERIC(12,2) NOT NULL,
  indirim_orani NUMERIC(4,2) NOT NULL,
  birim_satis_fiyati NUMERIC(12,2) NOT NULL,
  kalem_tutari NUMERIC(12,2) NOT NULL,
  kdv_orani SMALLINT NOT NULL,
  birim_maliyet NUMERIC(12,2) NOT NULL
);
CREATE TABLE iadeler (
  iade_id INTEGER PRIMARY KEY,
  kalem_id INTEGER NOT NULL REFERENCES siparis_kalemleri(kalem_id),
  siparis_id INTEGER NOT NULL REFERENCES siparisler(siparis_id),
  talep_tarihi DATE NOT NULL,
  iade_nedeni VARCHAR(40) NOT NULL,
  iade_adedi INTEGER NOT NULL,
  iade_tutari NUMERIC(12,2) NOT NULL,
  durum VARCHAR(20) NOT NULL
);
CREATE TABLE yorumlar (
  yorum_id INTEGER PRIMARY KEY,
  urun_id INTEGER NOT NULL REFERENCES urunler(urun_id),
  musteri_id INTEGER NOT NULL REFERENCES musteriler(musteri_id),
  kalem_id INTEGER NOT NULL REFERENCES siparis_kalemleri(kalem_id),
  puan SMALLINT NOT NULL,
  yorum_metni VARCHAR(400) NOT NULL,
  yorum_tarihi DATE NOT NULL,
  faydali_oy_sayisi INTEGER NOT NULL
);
CREATE TABLE olaylar (
  olay_id INTEGER PRIMARY KEY,
  oturum_id VARCHAR(12) NOT NULL,
  musteri_id INTEGER REFERENCES musteriler(musteri_id),
  urun_id INTEGER NOT NULL REFERENCES urunler(urun_id),
  olay_tipi VARCHAR(30) NOT NULL,
  olay_zamani TIMESTAMP NOT NULL,
  cihaz VARCHAR(12) NOT NULL,
  trafik_kaynagi VARCHAR(30) NOT NULL,
  siparis_id INTEGER REFERENCES siparisler(siparis_id)
);
CREATE INDEX ix_siparis_musteri ON siparisler(musteri_id);
CREATE INDEX ix_siparis_tarih ON siparisler(siparis_tarihi);
CREATE INDEX ix_kalem_siparis ON siparis_kalemleri(siparis_id);
CREATE INDEX ix_kalem_urun ON siparis_kalemleri(urun_id);
CREATE INDEX ix_olay_urun ON olaylar(urun_id);
CREATE INDEX ix_olay_oturum ON olaylar(oturum_id);
CREATE INDEX ix_yorum_urun ON yorumlar(urun_id);
