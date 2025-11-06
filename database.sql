-- Create database
CREATE DATABASE IF NOT EXISTS Online_Events;
USE Online_Events;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'organizer', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table with approval system
CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    date DATETIME NOT NULL,
    location VARCHAR(200) NOT NULL,
    price DECIMAL(10,2) DEFAULT 0,
    total_seats INT NOT NULL,
    available_seats INT NOT NULL,
    organizer_id INT,
    image_url VARCHAR(500),
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_id) REFERENCES users(id)
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    event_id INT NOT NULL,
    tickets INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    guest_name VARCHAR(100),
    guest_email VARCHAR(100),
    status ENUM('confirmed', 'cancelled') DEFAULT 'confirmed',
    booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id)
);

-- Insert sample data with admin user
INSERT INTO users (name, email, password, role) VALUES 
('Admin User', 'admin@eventhub.com', '$2b$10$exampleHash', 'admin'),
('John Organizer', 'organizer@eventhub.com', '$2b$10$exampleHash', 'organizer'),
('Test User', 'user@eventhub.com', '$2b$10$exampleHash', 'user');

-- Insert sample events with approved status
INSERT INTO events (title, description, date, location, price, total_seats, available_seats, organizer_id, status) VALUES 
('Tech Conference 2025', 'Join leading tech innovators for insights and networking', '2025-06-15 09:00:00', 'New York', 99.00, 200, 150, 2, 'approved'),
('Music Festival', 'Experience live performances from top artists', '2025-07-22 18:00:00', 'Chicago', 75.00, 500, 450, 2, 'approved'),
('Business Workshop', 'Learn essential business strategies from experts', '2025-08-05 10:00:00', 'Online', 49.00, 100, 95, 2, 'approved');

CREATE USER IF NOT EXISTS 'eventuser'@'localhost' IDENTIFIED BY 'eventpass123';
GRANT ALL PRIVILEGES ON online_events.* TO 'eventuser'@'localhost';
FLUSH PRIVILEGES;