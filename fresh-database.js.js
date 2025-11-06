const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

async function freshDatabase() {
    return new Promise((resolve, reject) => {
        console.log('🔄 Starting fresh database setup...');
        
        // Use regular mysql2 (not promise) for database operations
        const connection = mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '12345'
        });

        connection.connect(async (err) => {
            if (err) {
                console.error('❌ Connection failed:', err);
                reject(err);
                return;
            }

            console.log('✅ Connected to MySQL');

            try {
                // Drop and recreate database
                await executeQuery(connection, 'DROP DATABASE IF EXISTS online_events');
                await executeQuery(connection, 'CREATE DATABASE online_events');
                console.log('✅ Database recreated');

                // Switch to database
                await executeQuery(connection, 'USE online_events');
                console.log('✅ Using database: online_events');

                // Create tables
                await executeQuery(connection, `
                    CREATE TABLE users (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(100) NOT NULL,
                        email VARCHAR(100) UNIQUE NOT NULL,
                        password VARCHAR(255) NOT NULL,
                        role ENUM('user', 'organizer', 'admin') DEFAULT 'user',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('✅ Users table created');

                await executeQuery(connection, `
                    CREATE TABLE events (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        title VARCHAR(200) NOT NULL,
                        description TEXT,
                        date DATETIME NOT NULL,
                        location VARCHAR(200) NOT NULL,
                        price DECIMAL(10,2) NOT NULL DEFAULT 0,
                        total_seats INT NOT NULL,
                        available_seats INT NOT NULL,
                        organizer_id INT,
                        image_url VARCHAR(500),
                        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                        admin_notes TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (organizer_id) REFERENCES users(id)
                    )
                `);
                console.log('✅ Events table created');

                await executeQuery(connection, `
                    CREATE TABLE bookings (
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
                    )
                `);
                console.log('✅ Bookings table created');

                // Create users
                const hashedPassword = await bcrypt.hash('password123', 10);
                
                const users = [
                    ['Admin User', 'admin@eventhub.com', hashedPassword, 'admin'],
                    ['Event Organizer', 'organizer@eventhub.com', hashedPassword, 'organizer'], 
                    ['John Doe', 'user@eventhub.com', hashedPassword, 'user'],
                    ['Rasool User', 'rasool@gmail.com', hashedPassword, 'user']
                ];

                for (const user of users) {
                    await executeQuery(connection,
                        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                        user
                    );
                }
                console.log('✅ Users created with password: password123');
                
                // Create sample events
                const organizerResult = await executeQuery(connection, 'SELECT id FROM users WHERE email = "organizer@eventhub.com"');
                const organizerId = organizerResult[0].id;

                const events = [
                    [
                        'Tech Conference 2024', 
                        'Annual technology conference featuring latest innovations', 
                        '2024-12-15 09:00:00', 
                        'Convention Center, New York', 
                        199.99, 200, 200, organizerId,
                        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=500&h=300&fit=crop',
                        'approved'
                    ],
                    [
                        'Music Festival', 
                        'Summer music festival with popular artists', 
                        '2024-07-20 14:00:00', 
                        'Central Park, NYC', 
                        79.99, 5000, 5000, organizerId,
                        'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=500&h=300&fit=crop',
                        'approved'
                    ],
                    [
                        'Business Workshop', 
                        'Leadership and management skills workshop', 
                        '2024-08-10 10:00:00', 
                        'Business Center, Chicago', 
                        149.99, 50, 50, organizerId,
                        'https://images.unsplash.com/photo-1515168833906-d2d02d7b2b14?w=500&h=300&fit=crop',
                        'approved'
                    ]
                ];

                for (const event of events) {
                    await executeQuery(connection,
                        'INSERT INTO events (title, description, date, location, price, total_seats, available_seats, organizer_id, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        event
                    );
                }
                console.log('✅ Sample events created');

                // Create sample bookings
                const userResult = await executeQuery(connection, 'SELECT id FROM users WHERE email = "user@eventhub.com"');
                const userId = userResult[0].id;

                const bookings = [
                    [userId, 1, 2, 399.98],
                    [userId, 2, 4, 319.96],
                    [userId, 3, 1, 149.99]
                ];

                for (const booking of bookings) {
                    await executeQuery(connection,
                        'INSERT INTO bookings (user_id, event_id, tickets, total_amount) VALUES (?, ?, ?, ?)',
                        booking
                    );
                    
                    await executeQuery(connection,
                        'UPDATE events SET available_seats = available_seats - ? WHERE id = ?',
                        [booking[2], booking[1]]
                    );
                }
                console.log('✅ Sample bookings created');
                
                console.log('');
                console.log('🎉 FRESH DATABASE READY!');
                console.log('');
                console.log('🔐 LOGIN CREDENTIALS:');
                console.log('👑 Admin:      admin@eventhub.com / password123');
                console.log('🎪 Organizer:  organizer@eventhub.com / password123'); 
                console.log('👤 User:       user@eventhub.com / password123');
                console.log('👤 Rasool:     rasool@gmail.com / password123');
                
                connection.end();
                resolve();
                
            } catch (error) {
                console.error('❌ Error:', error);
                connection.end();
                reject(error);
            }
        });
    });
}

// Helper function to execute queries with promises
function executeQuery(connection, sql, params = []) {
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (error, results) => {
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
}

// Run the reset
freshDatabase().catch(console.error);