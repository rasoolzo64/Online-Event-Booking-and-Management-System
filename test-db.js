const mysql = require('mysql2/promise');

async function testDB() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '12345',  
        database: 'online_events'
    });

    console.log('Database connected successfully!');
    console.log('Checking tables...');
    
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('Tables:', tables);

    console.log('Checking events...');
    const [events] = await connection.execute('SELECT * FROM events');
    console.log('Events:', events);

    console.log('Checking users...');
    const [users] = await connection.execute('SELECT * FROM users');
    console.log('Users:', users);

    await connection.end();
}

testDB().catch(console.error);
