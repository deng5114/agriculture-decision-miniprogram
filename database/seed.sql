USE agriculture_decision;

INSERT INTO users (id, openid, nickname, role, region)
VALUES
  (1, 'demo-farmer-openid', '演示农户', 'farmer', '示范区'),
  (2, 'demo-agronomist-openid', '演示农技员', 'agronomist', '示范区'),
  (3, 'demo-admin-openid', '演示管理员', 'admin', '示范区')
ON DUPLICATE KEY UPDATE
  nickname = VALUES(nickname),
  role = VALUES(role),
  region = VALUES(region);

INSERT INTO crops (name, suitable_soil, min_temperature, max_temperature, cost_level, experience_level)
VALUES
  ('番茄', '壤土,沙壤土', 15, 30, 3, '中等'),
  ('玉米', '壤土,黑土', 10, 32, 2, '初级'),
  ('辣椒', '壤土,沙壤土', 18, 30, 3, '中等'),
  ('小麦', '壤土,黑土', 3, 25, 2, '初级')
ON DUPLICATE KEY UPDATE
  suitable_soil = VALUES(suitable_soil),
  min_temperature = VALUES(min_temperature),
  max_temperature = VALUES(max_temperature),
  cost_level = VALUES(cost_level),
  experience_level = VALUES(experience_level);

INSERT INTO disaster_rules (disaster_type, trigger_condition, impact, measures, source)
VALUES
  ('rainstorm', '预报降水达到设定阈值', '可能造成积水、倒伏和根部缺氧', '及时排水、加固设施、避免积水', '课程演示规则'),
  ('drought', '连续多日有效降水不足且温度较高', '作物缺水，生长速度下降', '分时灌溉、覆盖保墒、节水提示', '课程演示规则'),
  ('frost', '最低温度低于作物耐受温度', '幼苗冻伤，生长受阻', '覆盖保温、检查幼苗、联系农技人员', '课程演示规则');

INSERT INTO market_data (crop_name, region, data_year, average_price, output_ton, planting_area_mu, source, is_mock)
VALUES
  ('番茄', '示范区', 2022, 4.20, 120, 80, '课程模拟数据', TRUE),
  ('番茄', '示范区', 2023, 4.50, 135, 85, '课程模拟数据', TRUE),
  ('番茄', '示范区', 2024, 4.30, 140, 88, '课程模拟数据', TRUE),
  ('玉米', '示范区', 2022, 2.40, 300, 220, '课程模拟数据', TRUE),
  ('玉米', '示范区', 2023, 2.45, 310, 225, '课程模拟数据', TRUE),
  ('玉米', '示范区', 2024, 2.50, 320, 230, '课程模拟数据', TRUE),
  ('辣椒', '示范区', 2022, 5.00, 60, 40, '课程模拟数据', TRUE),
  ('辣椒', '示范区', 2023, 6.80, 62, 42, '课程模拟数据', TRUE),
  ('辣椒', '示范区', 2024, 4.70, 65, 45, '课程模拟数据', TRUE),
  ('小麦', '示范区', 2022, 2.80, 280, 260, '课程模拟数据', TRUE),
  ('小麦', '示范区', 2023, 2.85, 290, 265, '课程模拟数据', TRUE),
  ('小麦', '示范区', 2024, 2.90, 300, 270, '课程模拟数据', TRUE);
