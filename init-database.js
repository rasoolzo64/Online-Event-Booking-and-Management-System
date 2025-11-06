const mysql = require('mysql2');

async function fixedSetup() {
    let connection;
    
    try {
        console.log('🔧 Starting fixed database setup...');
        
        // Step 1: Connect without database first (using regular mysql2, not promise)
        connection = mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '12345'
        });

        // Connect using callback style
        connection.connect((err) => {
            if (err) {
                console.error('❌ Connection failed:', err.message);
                return;
            }
            
            console.log('✅ Connected to MySQL server');
            
            // Step 2: Create database
            connection.query('CREATE DATABASE IF NOT EXISTS online_events', (err) => {
                if (err) {
                    console.error('❌ Database creation failed:', err.message);
                    return;
                }
                
                console.log('✅ Database created: online_events');
                
                // Step 3: Switch to database
                connection.query('USE online_events', (err) => {
                    if (err) {
                        console.error('❌ USE database failed:', err.message);
                        return;
                    }
                    
                    console.log('✅ Using database: online_events');
                    createTables();
                });
            });
        });

        function createTables() {
            console.log('📊 Creating tables...');
            
            // Users table
            connection.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    role ENUM('user', 'organizer', 'admin') DEFAULT 'user',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('❌ Users table failed:', err.message);
                    return;
                }
                console.log('✅ Users table created');
                createEventsTable();
            });
        }

        function createEventsTable() {
            // Events table
            connection.query(`
                CREATE TABLE IF NOT EXISTS events (
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (organizer_id) REFERENCES users(id)
                )
            `, (err) => {
                if (err) {
                    console.error('❌ Events table failed:', err.message);
                    return;
                }
                console.log('✅ Events table created');
                createBookingsTable();
            });
        }

        function createBookingsTable() {
            // Bookings table
            connection.query(`
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
                )
            `, (err) => {
                if (err) {
                    console.error('❌ Bookings table failed:', err.message);
                    return;
                }
                console.log('✅ Bookings table created');
                console.log('🎉 All tables created successfully!');
                insertSampleData();
            });
        }

        function insertSampleData() {
            console.log('📥 Checking for sample data...');
            
            // Check if users already exist
            connection.query('SELECT COUNT(*) as count FROM users', (err, results) => {
                if (err) {
                    console.error('❌ Check users failed:', err.message);
                    connection.end();
                    return;
                }
                
                if (results[0].count === 0) {
                    console.log('📥 Inserting sample data...');
                    
                    // Insert sample users (using bcryptjs synchronously for simplicity)
                    const bcrypt = require('bcryptjs');
                    const hashedPassword = bcrypt.hashSync('password123', 10);
                    
                    // Insert users
                    const users = [
                        ['John Doe', 'john@example.com', hashedPassword, 'user'],
                        ['Event Organizer', 'organizer@example.com', hashedPassword, 'organizer']
                    ];
                    
                    let usersInserted = 0;
                    
                    users.forEach((user, index) => {
                        connection.query(
                            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                            user,
                            (err, result) => {
                                if (err) {
                                    console.error('❌ User insert failed:', err.message);
                                    return;
                                }
                                
                                usersInserted++;
                                
                                // If this is the organizer, store the ID for events
                                if (index === 1) {
                                    const organizerId = result.insertId;
                                    insertSampleEvents(organizerId);
                                }
                                
                                if (usersInserted === users.length) {
                                    console.log('✅ Sample users inserted');
                                }
                            }
                        );
                    });
                    
                } else {
                    console.log('✅ Database already contains data');
                    connection.end();
                }
            });
        }

        function insertSampleEvents(organizerId) {
            const sampleEvents = [
                [
                    'Tech Conference 2024', 
                    'Annual technology conference featuring latest innovations in AI, Web Development, and Cloud Computing.', 
                    '2024-12-15 09:00:00', 
                    'Convention Center, New York', 
                    199.99, 200, 200, organizerId,
                    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=500&h=300&fit=crop'
                ],
                [
                    'Music Festival', 
                    'Summer music festival with popular artists and bands. Food trucks, drinks, and amazing performances!', 
                    '2024-07-20 14:00:00', 
                    'Central Park, NYC', 
                    79.99, 5000, 5000, organizerId,
                    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=500&h=300&fit=crop'
                ],
                [
                    'Business Workshop', 
                    'Leadership and management skills workshop for professionals. Learn from industry experts.', 
                    '2024-08-10 10:00:00', 
                    'Business Center, Chicago', 
                    149.99, 50, 50, organizerId,
                    'https://images.unsplash.com/photo-1515168833906-d2d02d7b2b14?w=500&h=300&fit=crop'
                ]
            ];

            let eventsInserted = 0;
            
            sampleEvents.forEach(event => {
                connection.query(
                    'INSERT INTO events (title, description, date, location, price, total_seats, available_seats, organizer_id, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    event,
                    (err) => {
                        if (err) {
                            console.error('❌ Event insert failed:', err.message);
                            return;
                        }
                        
                        eventsInserted++;
                        if (eventsInserted === sampleEvents.length) {
                            console.log('✅ Sample events inserted');
                            console.log('🎉 Database setup completed successfully!');
                            console.log('\n📋 Demo Accounts:');
                            console.log('👤 User: john@example.com / password123');
                            console.log('👤 Organizer: organizer@example.com / password123');
                            connection.end();
                        }
                    }
                );
            });
        }
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        if (connection) connection.end();
    }
}

// Run the fixed setup
fixedSetup();