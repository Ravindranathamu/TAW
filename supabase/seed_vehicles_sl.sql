-- ============================================================================
-- TAW golden-master reference seed — Sri Lanka vehicle directory
-- 43 models used by the dispatch auto-spec lookup. NOT client data.
-- Run AFTER supabase/migrations/20261124000100_taw_schema.sql.
-- ============================================================================

insert into public.taw_vehicle_catalog
  (company_id, id, make, model, year_range, body_type, length_mm, min_weight_kg, max_weight_kg, custom)
values
  ('GLOBAL', 'cat_honda_vezel_ru1_ru3', 'Honda', 'Vezel (RU1/RU3)', '2014-2020', 'Compact SUV', 4295, 1499, 1608, false),
  ('GLOBAL', 'cat_honda_fit_gk3_gp5', 'Honda', 'Fit (GK3/GP5)', '2013-2019', 'Hatchback', 3955, 1080, 1190, false),
  ('GLOBAL', 'cat_honda_grace', 'Honda', 'Grace', '2014-2020', 'Hybrid Sedan', 4440, 1170, 1250, false),
  ('GLOBAL', 'cat_honda_civic_fc_fk', 'Honda', 'Civic (FC/FK)', '2016-2021', 'Sedan', 4648, 1280, 1370, false),
  ('GLOBAL', 'cat_honda_cr_v', 'Honda', 'CR-V', '2012-2025', 'Mid-Size SUV', 4600, 1520, 1730, false),
  ('GLOBAL', 'cat_toyota_aqua', 'Toyota', 'Aqua', '2012-2020', 'Hybrid Hatchback', 3995, 1050, 1130, false),
  ('GLOBAL', 'cat_toyota_vitz_ksp130', 'Toyota', 'Vitz (KSP130)', '2010-2019', 'Hatchback', 3885, 1000, 1100, false),
  ('GLOBAL', 'cat_toyota_prius_zvw30', 'Toyota', 'Prius (ZVW30)', '2009-2015', 'Hybrid Sedan', 4460, 1310, 1380, false),
  ('GLOBAL', 'cat_toyota_prius_zvw50', 'Toyota', 'Prius (ZVW50)', '2016-2022', 'Hybrid Sedan', 4540, 1360, 1460, false),
  ('GLOBAL', 'cat_toyota_corolla_axio', 'Toyota', 'Corolla Axio', '2012-2021', 'Sedan', 4400, 1090, 1180, false),
  ('GLOBAL', 'cat_toyota_premio_allion', 'Toyota', 'Premio / Allion', '2007-2021', 'Sedan', 4595, 1210, 1280, false),
  ('GLOBAL', 'cat_toyota_camry', 'Toyota', 'Camry', '2012-2025', 'Executive Sedan', 4885, 1520, 1660, false),
  ('GLOBAL', 'cat_toyota_raize', 'Toyota', 'Raize', '2019-2026', 'Compact SUV', 3995, 980, 1070, false),
  ('GLOBAL', 'cat_toyota_corolla_cross', 'Toyota', 'Corolla Cross', '2020-2026', 'SUV', 4460, 1385, 1565, false),
  ('GLOBAL', 'cat_toyota_rav4', 'Toyota', 'RAV4', '2013-2025', 'Mid-Size SUV', 4600, 1540, 1740, false),
  ('GLOBAL', 'cat_toyota_harrier', 'Toyota', 'Harrier', '2014-2025', 'Luxury SUV', 4740, 1620, 1790, false),
  ('GLOBAL', 'cat_toyota_land_cruiser_prado_150', 'Toyota', 'Land Cruiser Prado 150', '2010-2023', 'Full-Size 4x4', 4825, 2110, 2430, false),
  ('GLOBAL', 'cat_toyota_hilux_double_cab', 'Toyota', 'Hilux Double Cab', '2015-2026', 'Pickup', 5325, 1980, 2180, false),
  ('GLOBAL', 'cat_toyota_hiace_kdh_high_roof', 'Toyota', 'HiAce KDH High Roof', '2005-2020', 'Van', 4840, 1890, 2210, false),
  ('GLOBAL', 'cat_toyota_dyna_toyoace_14ft', 'Toyota', 'Dyna / ToyoAce 14ft', '2005-2022', 'Light Lorry', 4690, 2100, 2650, false),
  ('GLOBAL', 'cat_suzuki_alto_800', 'Suzuki', 'Alto 800', '2012-2023', 'Mini Hatchback', 3430, 695, 730, false),
  ('GLOBAL', 'cat_suzuki_wagon_r', 'Suzuki', 'Wagon R', '2014-2024', 'Kei Wagon', 3395, 790, 860, false),
  ('GLOBAL', 'cat_suzuki_swift', 'Suzuki', 'Swift', '2011-2025', 'Hatchback', 3840, 890, 980, false),
  ('GLOBAL', 'cat_suzuki_every_da17v', 'Suzuki', 'Every DA17V', '2015-2025', 'Mini Van', 3395, 880, 1010, false),
  ('GLOBAL', 'cat_suzuki_jimny_jb64', 'Suzuki', 'Jimny JB64', '2018-2026', 'Mini 4x4', 3480, 1040, 1110, false),
  ('GLOBAL', 'cat_nissan_leaf_ze1', 'Nissan', 'Leaf ZE1', '2011-2023', 'Electric Hatchback', 4480, 1520, 1640, false),
  ('GLOBAL', 'cat_nissan_x_trail_t32', 'Nissan', 'X-Trail T32', '2014-2021', 'Mid-Size SUV', 4640, 1510, 1680, false),
  ('GLOBAL', 'cat_nissan_navara_np300', 'Nissan', 'Navara NP300', '2015-2025', 'Double Cab Pickup', 5260, 1920, 2120, false),
  ('GLOBAL', 'cat_nissan_caravan_nv350', 'Nissan', 'Caravan NV350', '2012-2024', 'Van', 4695, 1820, 2120, false),
  ('GLOBAL', 'cat_mitsubishi_montero_pajero', 'Mitsubishi', 'Montero / Pajero', '2007-2021', 'Full-Size 4x4', 4900, 2150, 2380, false),
  ('GLOBAL', 'cat_mitsubishi_l200_triton', 'Mitsubishi', 'L200 / Triton', '2015-2025', 'Double Cab Pickup', 5280, 1890, 2080, false),
  ('GLOBAL', 'cat_mitsubishi_canter_14ft', 'Mitsubishi', 'Canter 14ft', '2005-2023', 'Light Lorry', 4720, 2150, 2750, false),
  ('GLOBAL', 'cat_byd_atto_3', 'BYD', 'Atto 3', '2023-2026', 'Electric SUV', 4455, 1680, 1750, false),
  ('GLOBAL', 'cat_byd_dolphin', 'BYD', 'Dolphin', '2023-2026', 'Electric Hatchback', 4125, 1405, 1658, false),
  ('GLOBAL', 'cat_byd_seal', 'BYD', 'Seal', '2023-2026', 'Electric Sedan', 4800, 1885, 2185, false),
  ('GLOBAL', 'cat_mg_zs_ev', 'MG', 'ZS EV', '2019-2025', 'Compact SUV', 4323, 1258, 1620, false),
  ('GLOBAL', 'cat_kia_sportage', 'Kia', 'Sportage', '2016-2025', 'Mid-Size SUV', 4515, 1520, 1740, false),
  ('GLOBAL', 'cat_hyundai_tucson', 'Hyundai', 'Tucson', '2016-2025', 'Mid-Size SUV', 4500, 1480, 1690, false),
  ('GLOBAL', 'cat_mazda_cx_5', 'Mazda', 'CX-5', '2013-2025', 'Mid-Size SUV', 4550, 1510, 1680, false),
  ('GLOBAL', 'cat_mercedes_benz_c_class_w205', 'Mercedes-Benz', 'C-Class W205', '2015-2025', 'Luxury Sedan', 4751, 1505, 1765, false),
  ('GLOBAL', 'cat_bmw_3_series_g20', 'BMW', '3 Series G20', '2013-2025', 'Luxury Sedan', 4709, 1495, 1740, false),
  ('GLOBAL', 'cat_isuzu_elf_npr_14ft', 'Isuzu', 'Elf / NPR 14ft', '2005-2024', 'Light Lorry', 4750, 2150, 2750, false),
  ('GLOBAL', 'cat_mahindra_bolero_maxi_truck', 'Mahindra', 'Bolero Maxi Truck', '2012-2024', 'Utility Pickup', 4107, 1615, 1750, false)
on conflict (company_id, id) do nothing;
