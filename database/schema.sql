CREATE DATABASE IF NOT EXISTS agriculture_decision
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE agriculture_decision;

CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(64) NOT NULL UNIQUE,
  nickname VARCHAR(50) NOT NULL,
  role ENUM('farmer', 'resource_provider', 'agronomist', 'admin') NOT NULL DEFAULT 'farmer',
  region VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE plots (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  area_mu DECIMAL(10,2) NOT NULL,
  soil_type VARCHAR(50) NOT NULL,
  region VARCHAR(100) NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE plant_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  plot_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  crop_name VARCHAR(50) NOT NULL,
  planting_date DATE NULL,
  budget DECIMAL(12,2) NOT NULL DEFAULT 0,
  experience_level VARCHAR(20) NULL,
  problem_description VARCHAR(500) NULL,
  status ENUM('draft', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
  review_comment VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (plot_id) REFERENCES plots(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE crops (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  suitable_soil VARCHAR(255) NOT NULL,
  min_temperature DECIMAL(5,2) NULL,
  max_temperature DECIMAL(5,2) NULL,
  cost_level TINYINT NOT NULL DEFAULT 3,
  experience_level VARCHAR(20) NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE market_data (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  crop_name VARCHAR(50) NOT NULL,
  region VARCHAR(100) NOT NULL,
  data_year YEAR NOT NULL,
  average_price DECIMAL(10,2) NOT NULL,
  output_ton DECIMAL(12,2) NOT NULL,
  planting_area_mu DECIMAL(12,2) NOT NULL,
  source VARCHAR(255) NOT NULL,
  is_mock BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE disaster_rules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  disaster_type ENUM('rainstorm', 'drought', 'frost') NOT NULL,
  trigger_condition VARCHAR(500) NOT NULL,
  impact VARCHAR(500) NOT NULL,
  measures VARCHAR(500) NOT NULL,
  source VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE audit_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  target_type VARCHAR(50) NOT NULL,
  target_id BIGINT NOT NULL,
  reviewer_id BIGINT NOT NULL,
  result ENUM('approved', 'rejected') NOT NULL,
  comment VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

CREATE TABLE operation_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  operator_id BIGINT NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id BIGINT NULL,
  detail VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE INDEX idx_plots_user_id ON plots(user_id);
CREATE INDEX idx_records_user_id ON plant_records(user_id);
CREATE INDEX idx_records_status ON plant_records(status);
CREATE INDEX idx_market_filter ON market_data(crop_name, region, data_year);
