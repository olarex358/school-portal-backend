const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

// public hello route (place before any auth middleware)
app.get('/api/hello', (req, res) => res.json({ message: 'Hello from backend' }));

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'password') {
        res.json({ message: 'Login successful', user: { username } });
    } else {
        res.json({ message: 'Login failed' });
    }
});

app.get('/api/profile', (req, res) => {
    res.json({ message: 'Hello, World!' });
});

app.listen(3000, () => console.log('Server running on port 3000'));