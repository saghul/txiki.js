import express from 'tjs:express-lite';

const app = express();

app.get('/', (req, res) => {
    res.json({ message: 'Hello World' });
});

app.get('/api/data', (req, res) => {
    res.json({ 
        data: Array.from({ length: 100 }, (_, i) => ({ id: i, value: 'item-' + i })) 
    });
});

app.listen(8080, () => {
    console.log('Benchmark server running on http://localhost:8080');
});
