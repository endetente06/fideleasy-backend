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
    const url = `https://fideleasy-dashboard.vercel.app/join/${shop_id}`;
    const qrCode = await QRCode.toDataURL(url);
    res.json({ qrCode, url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// Générer une vraie carte Apple Wallet
app.get('/pass/apple/:card_id', async (req, res) => {
  try {
    const { PKPass } = require('passkit-generator');
    const fs = require('fs');
    const { card_id } = req.params;
    
    const { data: card } = await supabase.from('loyalty_cards').select('*').eq('id', card_id).single();
    const { data: customer } = await supabase.from('customers').select('*').eq('id', card.customer_id).single();
    const { data: shop } = await supabase.from('shops').select('*').eq('id', card.shop_id).single();

    const pass = await PKPass.from({
      model: '/app/passes/FidelEasy.pass',
      certificates: {
    wwdr: fs.readFileSync('/app/certs/wwdr_clean.pem'),
signerCert: fs.readFileSync('/app/certs/pass_clean.pem'),
signerKey: fs.readFileSync('/app/certs/pass_clean.key'),
        signerKeyPassphrase: '123456'
      }
    }, {
      serialNumber: card_id, 
      'storeCard.primaryFields[0].value': card.points.toString(),
      'storeCard.secondaryFields[0].value': `${card.stamps}/10`,
      'storeCard.auxiliaryFields[0].value': customer ? customer.name : 'Client'
    });

    const buffer = pass.getAsBuffer();
    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="fideLeasy.pkpass"`
    });
    res.send(buffer);
  } catch (err) {
    res.status(400).json({ error: err.message, stack: err.stack });
  }
});
// Inscription commerçant
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, shop_name } = req.body;
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });
    
    if (authError) throw authError;
    
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .insert([{ 
        name: shop_name, 
        email, 
        plan: 'starter',
        user_id: authData.user.id 
      }])
      .select();
    
    if (shopError) throw shopError;
    
    res.json({ message: 'Compte créé !', user: authData.user, shop });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Connexion commerçant
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    const { data: shop } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', data.user.id)
      .single();
    
    res.json({ 
      message: 'Connecté !', 
      token: data.session.access_token,
      user: data.user,
      shop 
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});// Google Wallet
const { GoogleAuth } = require('google-auth-library');

const GOOGLE_ISSUER_ID = 'BCR2DN7T7C24DWR7';
const GOOGLE_CLASS_ID = `${GOOGLE_ISSUER_ID}.fideleasy_loyalty`;

async function getGoogleAuthClient() {
  const auth = new GoogleAuth({
 credentials: JSON.parse(Buffer.from(process.env.GOOGLE_WALLET_KEY, 'base64').toString()),
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
  });
  return auth.getClient();
}

app.get('/pass/google/:card_id', async (req, res) => {
  try {
    const { card_id } = req.params;
    
    const { data: card } = await supabase.from('loyalty_cards').select('*').eq('id', card_id).single();
    const { data: customer } = await supabase.from('customers').select('*').eq('id', card.customer_id).single();
    const { data: shop } = await supabase.from('shops').select('*').eq('id', card.shop_id).single();

    const authClient = await getGoogleAuthClient();
    const token = await authClient.getAccessToken();

    // Créer la classe si elle n'existe pas
    try {
      await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${GOOGLE_CLASS_ID}`, {
        headers: { 'Authorization': `Bearer ${token.token}` }
      }).then(async r => {
        if (r.status === 404) {
          await fetch('https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: GOOGLE_CLASS_ID,
              issuerName: 'FidelEasy',
              programName: shop ? shop.name : 'FidelEasy',
              programLogo: { sourceUri: { uri: 'https://via.placeholder.com/150x150.png' }, contentDescription: { defaultValue: { language: 'fr', value: 'Logo FidelEasy' } } },
              reviewStatus: 'UNDER_REVIEW'
            })
          });
        }
      });
    } catch(e) {}

    // Créer l'objet pass
    const objectId = `${GOOGLE_ISSUER_ID}.${card_id}`;
    const passObject = {
      id: objectId,
      classId: GOOGLE_CLASS_ID,
      state: 'ACTIVE',
      accountId: customer ? customer.id : card_id,
      accountName: customer ? customer.name : 'Client',
      loyaltyPoints: { label: 'Points', balance: { int: card.points || 0 } },
      secondaryLoyaltyPoints: { label: 'Tampons', balance: { string: `${card.stamps || 0}/10` } }
    };

    // Créer ou mettre à jour l'objet
    const objRes = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${objectId}`, {
      headers: { 'Authorization': `Bearer ${token.token}` }
    });
    
    if (objRes.status === 404) {
      await fetch('https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(passObject)
      });
    }

    // Générer le lien JWT
    const jwt = require('jsonwebtoken');
     const key = JSON.parse(Buffer.from(process.env.GOOGLE_WALLET_KEY, 'base64').toString());
    
    const claims = {
      iss: key.client_email,
      aud: 'google',
      typ: 'savetowallet',
      payload: { loyaltyObjects: [{ id: objectId }] }
    };
    
    const token_jwt = jwt.sign(claims, key.private_key, { algorithm: 'RS256' });
    const saveUrl = `https://pay.google.com/gp/v/save/${token_jwt}`;
    
    res.json({ saveUrl });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});// Stripe
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  business: process.env.STRIPE_PRICE_BUSINESS
};

// Créer une session de paiement
app.post('/stripe/checkout', async (req, res) => {
  try {
    const { plan, shop_id } = req.body;
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: PLANS[plan], quantity: 1 }],
      success_url: 'https://fideleasy-dashboard.vercel.app/dashboard?success=true',
      cancel_url: 'https://fideleasy-dashboard.vercel.app/dashboard?cancelled=true',
      metadata: { shop_id, plan }
    });
    
    res.json({ url: session.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.listen(PORT, () => {
  console.log(`FidelEasy API démarrée sur le port ${PORT}`);
});