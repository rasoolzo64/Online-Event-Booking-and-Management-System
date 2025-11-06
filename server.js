const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: 'event-booking-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '12345',
    database: 'online_events',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;

// Initialize database connection
async function initializeDatabase() {
    try {
        pool = mysql.createPool(dbConfig);
        
        // Test the connection
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        
        // Initialize tables if they don't exist
        await initializeDatabaseAndTables(connection);
        
        connection.release();
        return true;
        
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Initialize database and tables
async function initializeDatabaseAndTables(connection) {
    try {
        // Create users table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('user', 'organizer', 'admin') DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create events table
        await connection.execute(`
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
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                admin_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (organizer_id) REFERENCES users(id)
            )
        `);

        // Create bookings table
        await connection.execute(`
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
        `);

        console.log('✅ Database tables initialized successfully');

        // Insert sample data if tables are empty
        await insertSampleData(connection);

    } catch (error) {
        console.error('Error initializing database and tables:', error);
        throw error;
    }
}

// Insert sample data
async function insertSampleData(connection) {
    try {
        // Check if sample data already exists
        const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
        
        if (users[0].count === 0) {
            console.log('📥 Inserting sample data...');
            
            // Insert sample users
            const hashedPassword = await bcrypt.hash('password123', 10);
            
            // Insert admin user
            await connection.execute(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                ['Admin User', 'admin@eventhub.com', hashedPassword, 'admin']
            );
            
            // Insert organizer
            const [organizerResult] = await connection.execute(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                ['Event Organizer', 'organizer@eventhub.com', hashedPassword, 'organizer']
            );
            
            const organizerId = organizerResult.insertId;

            // Insert regular user
            await connection.execute(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                ['John Doe', 'user@eventhub.com', hashedPassword, 'user']
            );

            // Insert sample events
            const sampleEvents = [
                [
                    'Tech Conference 2024', 
                    'Annual technology conference featuring latest innovations in AI, Web Development, and Cloud Computing.', 
                    '2024-12-15 09:00:00', 
                    'Convention Center, New York', 
                    199.99, 200, 200, organizerId,
                    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=500&h=300&fit=crop',
                    'approved'
                ],
                [
                    'Music Festival', 
                    'Summer music festival with popular artists and bands. Food trucks, drinks, and amazing performances!', 
                    '2024-07-20 14:00:00', 
                    'Central Park, NYC', 
                    79.99, 5000, 5000, organizerId,
                    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=500&h=300&fit=crop',
                    'approved'
                ],
                [
                    'Business Workshop', 
                    'Leadership and management skills workshop for professionals. Learn from industry experts.', 
                    '2024-08-10 10:00:00', 
                    'Business Center, Chicago', 
                    149.99, 50, 50, organizerId,
                    'https://images.unsplash.com/photo-1515168833906-d2d02d7b2b14?w=500&h=300&fit=crop',
                    'approved'
                ]
            ];

            for (const event of sampleEvents) {
                await connection.execute(
                    'INSERT INTO events (title, description, date, location, price, total_seats, available_seats, organizer_id, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    event
                );
            }

            console.log('✅ Sample data inserted successfully');
            console.log('👤 Demo accounts created with password: password123');
        } else {
            console.log('✅ Database already contains data');
        }
    } catch (error) {
        console.error('Error inserting sample data:', error);
    }
}

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Please login to access this resource' });
    }
};

const requireOrganizer = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'organizer') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Organizer role required.' });
    }
};

const requireAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Admin role required.' });
    }
};

// Routes

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve other HTML pages
app.get('/events.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'events.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/booking.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'booking.html'));
});

app.get('/my-bookings.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'my-bookings.html'));
});

app.get('/organizer-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'organizer-dashboard.html'));
});

app.get('/admin-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// Get user info for all pages
app.get('/api/user-info', (req, res) => {
    if (req.session.user) {
        res.json({ 
            loggedIn: true, 
            user: req.session.user 
        });
    } else {
        res.json({ 
            loggedIn: false 
        });
    }
});

// Get all events (only approved ones for public)
app.get('/api/events', async (req, res) => {
    try {
        const [events] = await pool.execute(`
            SELECT e.*, u.name as organizer_name 
            FROM events e 
            LEFT JOIN users u ON e.organizer_id = u.id 
            WHERE e.status = 'approved'
            ORDER BY e.date ASC
        `);
        
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Get single event
app.get('/api/events/:id', async (req, res) => {
    try {
        const [events] = await pool.execute(`
            SELECT e.*, u.name as organizer_name 
            FROM events e 
            LEFT JOIN users u ON e.organizer_id = u.id 
            WHERE e.id = ?
        `, [req.params.id]);
        
        if (events.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        res.json(events[0]);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

// User registration
app.post('/api/register', async (req, res) => {
    const { name, email, password, role = 'user' } = req.body;
    
    // Validate role
    const validRoles = ['user', 'organizer'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    
    try {
        // Check if user already exists
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );
        
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'User already exists with this email' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert new user with role
        const [result] = await pool.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, role]
        );
        
        res.json({ 
            message: 'Registration successful', 
            userId: result.insertId,
            userRole: role,
            success: true 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// User login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // Find user by email
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        
        if (users.length === 0) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        
        const user = users[0];
        
        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        
        // Set session
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };
        
        res.json({ 
            message: 'Login successful', 
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            success: true
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// User logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logout successful' });
    });
});

// Get current user
app.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Create event (Organizer only)
app.post('/api/events', requireOrganizer, async (req, res) => {
    const { title, description, date, location, price, total_seats, image_url } = req.body;
    const organizerId = req.session.user.id;
    
    // Default image if none provided
    const eventImage = image_url || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=500&h=300&fit=crop';
    
    try {
        const [result] = await pool.execute(
            'INSERT INTO events (title, description, date, location, price, total_seats, available_seats, organizer_id, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "pending")',
            [title, description, date, location, price, total_seats, total_seats, organizerId, eventImage]
        );
        
        res.json({ 
            message: 'Event created successfully and sent for admin approval', 
            eventId: result.insertId,
            success: true 
        });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

// Book event - UPDATED TO REQUIRE LOGIN
app.post('/api/bookings', requireAuth, async (req, res) => {
    try {
        const { eventId, tickets, userName, userEmail } = req.body;
        
        // Start transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            // Check event availability - REMOVED TICKET LIMIT
            const [events] = await connection.execute(
                'SELECT * FROM events WHERE id = ? AND available_seats >= ? AND status = "approved"',
                [eventId, tickets]
            );
            
            if (events.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ error: 'Not enough seats available or event not approved' });
            }
            
            const event = events[0];
            const totalAmount = event.price * tickets;
            
            // Use logged-in user's ID
            const userId = req.session.user.id;
            
            // Create booking
            const [bookingResult] = await connection.execute(
                'INSERT INTO bookings (user_id, event_id, tickets, total_amount, guest_name, guest_email) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, eventId, tickets, totalAmount, userName, userEmail]
            );
            
            // Update available seats
            await connection.execute(
                'UPDATE events SET available_seats = available_seats - ? WHERE id = ?',
                [tickets, eventId]
            );
            
            await connection.commit();
            connection.release();
            
            res.json({ 
                message: 'Booking confirmed!', 
                totalAmount: totalAmount,
                eventTitle: event.title,
                success: true
            });
            
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
        
    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({ error: 'Booking failed: ' + error.message });
    }
});

// Get user bookings - UPDATED TO INCLUDE EVENT IMAGE
app.get('/api/my-bookings', async (req, res) => {
    try {
        let bookings = [];
        
        if (req.session.user) {
            // User is logged in - get their bookings with event image
            const userId = req.session.user.id;
            const [userBookings] = await pool.execute(`
                SELECT b.*, 
                       e.title as event_title, 
                       e.date as event_date, 
                       e.location, 
                       e.price,
                       e.image_url as event_image
                FROM bookings b 
                JOIN events e ON b.event_id = e.id 
                WHERE b.user_id = ? 
                ORDER BY b.booking_date DESC
            `, [userId]);
            bookings = userBookings;
        }
        
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// Get all bookings (for viewing)
app.get('/api/all-bookings', async (req, res) => {
    try {
        const [bookings] = await pool.execute(`
            SELECT b.*, e.title as event_title, e.date as event_date, e.location, e.image_url,
                   u.name as user_name, u.email as user_email
            FROM bookings b 
            JOIN events e ON b.event_id = e.id 
            LEFT JOIN users u ON b.user_id = u.id
            ORDER BY b.booking_date DESC
        `);
        
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching all bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// Organizer Dashboard Routes

// Get organizer dashboard data
app.get('/api/organizer/dashboard', requireOrganizer, async (req, res) => {
    const organizerId = req.session.user.id;
    
    try {
        // Get organizer stats
        const [stats] = await pool.execute(`
            SELECT 
                COUNT(e.id) as total_events,
                COALESCE(SUM(e.total_seats - e.available_seats), 0) as total_tickets_sold,
                COALESCE(SUM(b.total_amount), 0) as total_revenue,
                COALESCE(AVG(e.total_seats - e.available_seats), 0) as avg_attendance
            FROM events e 
            LEFT JOIN bookings b ON e.id = b.event_id 
            WHERE e.organizer_id = ?
        `, [organizerId]);

        // Get recent bookings
        const [recentBookings] = await pool.execute(`
            SELECT b.*, e.title as event_title, u.name as user_name, u.email as user_email
            FROM bookings b 
            JOIN events e ON b.event_id = e.id 
            LEFT JOIN users u ON b.user_id = u.id
            WHERE e.organizer_id = ?
            ORDER BY b.booking_date DESC 
            LIMIT 10
        `, [organizerId]);

        // Get upcoming events
        const [upcomingEvents] = await pool.execute(`
            SELECT * FROM events 
            WHERE organizer_id = ? AND date > NOW() 
            ORDER BY date ASC 
            LIMIT 5
        `, [organizerId]);

        res.json({
            stats: {
                total_events: parseInt(stats[0].total_events) || 0,
                total_tickets_sold: parseInt(stats[0].total_tickets_sold) || 0,
                total_revenue: parseFloat(stats[0].total_revenue) || 0,
                avg_attendance: parseFloat(stats[0].avg_attendance) || 0
            },
            recentBookings: recentBookings || [],
            upcomingEvents: upcomingEvents || []
        });
    } catch (error) {
        console.error('Error fetching organizer dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Get organizer events
app.get('/api/organizer/events', requireOrganizer, async (req, res) => {
    const organizerId = req.session.user.id;
    
    try {
        const [events] = await pool.execute(`
            SELECT e.*, 
                   COUNT(b.id) as total_bookings,
                   COALESCE(SUM(b.tickets), 0) as total_tickets_sold,
                   COALESCE(SUM(b.total_amount), 0) as total_revenue,
                   ROUND((COALESCE(SUM(b.tickets), 0) / e.total_seats) * 100, 2) as occupancy_rate
            FROM events e 
            LEFT JOIN bookings b ON e.id = b.event_id 
            WHERE e.organizer_id = ?
            GROUP BY e.id
            ORDER BY e.date DESC
        `, [organizerId]);
        
        // Ensure numeric values
        const processedEvents = events.map(event => ({
            ...event,
            total_bookings: parseInt(event.total_bookings) || 0,
            total_tickets_sold: parseInt(event.total_tickets_sold) || 0,
            total_revenue: parseFloat(event.total_revenue) || 0,
            occupancy_rate: parseFloat(event.occupancy_rate) || 0
        }));
        
        res.json(processedEvents);
    } catch (error) {
        console.error('Error fetching organizer events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Update event (Organizer only)
app.put('/api/events/:id', requireOrganizer, async (req, res) => {
    const { title, description, date, location, price, total_seats, image_url } = req.body;
    const eventId = req.params.id;
    const organizerId = req.session.user.id;
    
    try {
        // Verify the event belongs to the organizer
        const [events] = await pool.execute(
            'SELECT id FROM events WHERE id = ? AND organizer_id = ?',
            [eventId, organizerId]
        );
        
        if (events.length === 0) {
            return res.status(404).json({ error: 'Event not found or access denied' });
        }
        
        const [result] = await pool.execute(
            'UPDATE events SET title = ?, description = ?, date = ?, location = ?, price = ?, total_seats = ?, image_url = ? WHERE id = ?',
            [title, description, date, location, price, total_seats, image_url, eventId]
        );
        
        res.json({ 
            message: 'Event updated successfully',
            success: true 
        });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// Delete event (Organizer only)
app.delete('/api/events/:id', requireOrganizer, async (req, res) => {
    const eventId = req.params.id;
    const organizerId = req.session.user.id;
    
    try {
        // Verify the event belongs to the organizer
        const [events] = await pool.execute(
            'SELECT id FROM events WHERE id = ? AND organizer_id = ?',
            [eventId, organizerId]
        );
        
        if (events.length === 0) {
            return res.status(404).json({ error: 'Event not found or access denied' });
        }
        
        // Check if there are bookings for this event
        const [bookings] = await pool.execute(
            'SELECT id FROM bookings WHERE event_id = ?',
            [eventId]
        );
        
        if (bookings.length > 0) {
            return res.status(400).json({ error: 'Cannot delete event with existing bookings' });
        }
        
        await pool.execute('DELETE FROM events WHERE id = ?', [eventId]);
        
        res.json({ 
            message: 'Event deleted successfully',
            success: true 
        });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// Admin Routes
// Get all events for admin approval
app.get('/api/admin/events', requireAdmin, async (req, res) => {
    try {
        const [events] = await pool.execute(`
            SELECT e.*, u.name as organizer_name, u.email as organizer_email
            FROM events e 
            JOIN users u ON e.organizer_id = u.id 
            ORDER BY 
                CASE e.status 
                    WHEN 'pending' THEN 1
                    WHEN 'approved' THEN 2
                    WHEN 'rejected' THEN 3
                END,
                e.created_at DESC
        `);
        
        res.json(events);
    } catch (error) {
        console.error('Error fetching admin events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Approve event (Admin only)
app.put('/api/admin/events/:id/approve', requireAdmin, async (req, res) => {
    const eventId = req.params.id;
    const { admin_notes } = req.body;
    
    try {
        // Verify event exists
        const [events] = await pool.execute('SELECT id FROM events WHERE id = ?', [eventId]);
        if (events.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        await pool.execute(
            'UPDATE events SET status = "approved", admin_notes = ? WHERE id = ?',
            [admin_notes || 'Event approved by admin', eventId]
        );
        
        res.json({ 
            message: 'Event approved successfully',
            success: true 
        });
    } catch (error) {
        console.error('Error approving event:', error);
        res.status(500).json({ error: 'Failed to approve event' });
    }
});

// Reject event (Admin only)
app.put('/api/admin/events/:id/reject', requireAdmin, async (req, res) => {
    const eventId = req.params.id;
    const { admin_notes } = req.body;
    
    try {
        // Verify event exists
        const [events] = await pool.execute('SELECT id FROM events WHERE id = ?', [eventId]);
        if (events.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        await pool.execute(
            'UPDATE events SET status = "rejected", admin_notes = ? WHERE id = ?',
            [admin_notes || 'Event rejected by admin', eventId]
        );
        
        res.json({ 
            message: 'Event rejected successfully',
            success: true 
        });
    } catch (error) {
        console.error('Error rejecting event:', error);
        res.status(500).json({ error: 'Failed to reject event' });
    }
});

// Debug endpoint to check database
app.get('/api/debug', async (req, res) => {
    try {
        const [events] = await pool.execute('SELECT * FROM events');
        const [bookings] = await pool.execute('SELECT * FROM bookings');
        const [users] = await pool.execute('SELECT * FROM users');
        
        res.json({
            events: events,
            bookings: bookings,
            users: users,
            eventsCount: events.length,
            bookingsCount: bookings.length,
            usersCount: users.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const [result] = await pool.execute('SELECT 1 as healthy');
        res.json({ 
            status: 'healthy', 
            database: 'connected',
            session: req.session.user ? 'active' : 'inactive'
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'unhealthy', 
            database: 'disconnected',
            error: error.message 
        });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('📊 Testing database connection...');
    await initializeDatabase();
    console.log(`💡 Health check: http://localhost:${PORT}/api/health`);
    console.log(`💡 Debug info: http://localhost:${PORT}/api/debug`);
});