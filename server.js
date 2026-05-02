const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Bienvenue sur FidelEasy API !', status: 'online' });
});

app.get('/shops', async (req, res) => {
  try {
    const { data, error } = await supabase.from('shops').select('*');
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/shops/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('shops').select('*').eq('id', id).single();
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/shops', async (req, res) => {
  try {
    const { name, email, plan } = req.body;
    const { data, error } = await supabase.from('shops').insert([{ name, email, plan }]).select();
    if (error) throw error;
    res.json({ message: 'Commerce créé !', data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/customers/:shop_id', async (req, res) => {
  try {
    const { shop_id } = req.params;
    const { data, error } = await supabase.from('customers').select('*').eq('shop_id', shop_id);
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/customers', async (req, res) => {
  try {
    const { name, email, phone, shop_id } = req.body;
    const { data, error } = await supabase.from('customers').insert([{ name, email, phone, shop_id }]).select();
    if (error) throw error;
    res.json({ message: 'Client créé !', data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/cards', async (req, res) => {
  try {
    const { customer_id, shop_id, wallet_type } = req.body;
    const { data, error } = await supabase.from('loyalty_cards').insert([{ customer_id, shop_id, wallet_type, stamps: 0, points: 0 }]).select();
    if (error) throw error;
    res.json({ message: 'Carte créée !', data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/cards/all', async (req, res) => {
  try {
    const { data, error } = await supabase.from('loyalty_cards').select('*');
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('loyalty_cards').select('*').eq('id', id).single();
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/cards/:id/stamp', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: card, error: fetchError } = await supabase.from('loyalty_cards').select('*').eq('id', id).single();
    if (fetchError) throw fetchError;
    const newStamps = card.stamps + 1;
    const { data, error } = await supabase.from('loyalty_cards').update({ stamps: newStamps }).eq('id', id).select();
    if (error) throw error;
    res.json({ message: `Tampon ajouté ! Total: ${newStamps}`, data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/notifications', async (req, res) => {
  try {
    const { shop_id, title, message, target } = req.body;
    const { data, error } = await supabase.from('notifications').insert([{ shop_id, title, message, target, sent_count: 0 }]).select();
    if (error) throw error;
    res.json({ message: 'Notification envoyée !', data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/notifications/:shop_id', async (req, res) => {
  try {
    const { shop_id } = req.params;
    const { data, error } = await supabase.from('notifications').select('*').eq('shop_id', shop_id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/qrcode/:shop_id', async (req, res) => {
  try {
    const { shop_id } = req.params;
    const url = `http://localhost:3001/join/${shop_id}`;
    const qrCode = await QRCode.toDataURL(url);
    res.json({ qrCode, url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`FidelEasy API démarrée sur le port ${PORT}`);
});