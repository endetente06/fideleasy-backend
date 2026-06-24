const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const QRCode = require('qrcode');
const { PKPass } = require('passkit-generator');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(cors());
app.use(express.json());
const { createCanvas, loadImage } = require('canvas');

async function generateStripImage(shop) {
  const { createCanvas, loadImage } = require('canvas');
  const width = 1125;
  const height = 432;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const { PKPass } = require('passkit-generator');
  const fs = require('fs');
  const path = require('path');
  ctx.fillStyle = '#0a0a18';
  ctx.fillRect(0, 0, width, height);
  if (shop?.card_image_url) {
    try {
      const img = await loadImage(shop.card_image_url);
      ctx.drawImage(img, 0, 0, width, height);
    } catch(e) {
      console.log('Erreur chargement image:', e.message);
    }
  }
  const grad1 = ctx.createLinearGradient(0, 0, 0, height);
  grad1.addColorStop(0, 'rgba(0,0,0,0.3)');
  grad1.addColorStop(0.5, 'rgba(0,0,0,0.1)');
  grad1.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = grad1;
  ctx.fillRect(0, 0, width, height);
  const stampsRequired = shop?.card_stamps_required || 10;
  const remaining = stampsRequired;
  const message = remaining > 0 ? `Encore ${remaining} visite${remaining > 1 ? 's' : ''} !` : '🎉 Récompense disponible !';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = 'bold 28px Arial';
  ctx.fillText('CARTE DE FIDÉLITÉ', 60, height - 110);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 72px Arial';
  ctx.fillText(message, 60, height - 40);
  return canvas.toBuffer('image/png');
}

// PassKit - Long-lived token
async function createPassKitMember(programId, memberData) {
  const externalId = memberData.email || `${Date.now()}@fideleasy.app`;
  const response = await fetch(`https://api.pub1.passkit.io/members/member`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PASSKIT_LONG_TOKEN}`
    },
    body: JSON.stringify({
      programId,
      tierId: 'base',
      externalId,
      person: {
        displayName: memberData.name,
        emailAddress: externalId
      }
    })
  });
  const data = await response.json();
  console.log('PassKit response:', JSON.stringify(data));

  // Construire les liens Wallet directement avec l'ID membre
  if (data.id) {
    data.appleWalletUrl = `https://pub1.pskt.io/${data.id}.pkpass`;
    data.googleWalletUrl = `https://pub1.pskt.io/${data.id}.gpay`;
    console.log('PassKit wallet URL:', `https://pub1.pskt.io/${data.id}`);
  }

  return data;
}

async function updatePassKitMember(memberId, points) {
  const response = await fetch(`https://api.pub1.passkit.io/members/member/points/earn`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PASSKIT_LONG_TOKEN}`
    },
    body: JSON.stringify({
      memberId,
      points: {
        type: 'BALANCE_TYPE_POINTS',
        value: points
      }
    })
  });
  return response.json();
}

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
    const { data: customer } = await supabase.from('customers').select('*').eq('id', customer_id).single();
    const { data: shop } = await supabase.from('shops').select('*').eq('id', shop_id).single();
    const { data, error } = await supabase.from('loyalty_cards').insert([{ customer_id, shop_id, wallet_type, stamps: 0, points: 0 }]).select();
    if (error) throw error;
    const card = data[0];
    let passkit_member_id = null;
    let wallet_url = null;
    if (shop?.passkit_program_id) {
      try {
        const pkMember = await createPassKitMember(shop.passkit_program_id, {
          name: customer?.name || 'Client',
          email: customer?.email || '',
          phone: customer?.phone || ''
        });
        passkit_member_id = pkMember.id || pkMember.memberId;
        wallet_url = pkMember.appleWalletUrl || pkMember.googleWalletUrl || null;
        if (passkit_member_id) {
          await supabase.from('loyalty_cards').update({ passkit_member_id }).eq('id', card.id);
        }
      } catch(e) {
        console.log('Erreur PassKit:', e.message);
      }
    }
    res.json({ message: 'Carte créée !', data, passkit_member_id, wallet_url });
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
    if (card.last_stamp_at) {
      const lastStamp = new Date(card.last_stamp_at);
      const now = new Date();
      const diffMinutes = (now - lastStamp) / 1000 / 60;
      if (diffMinutes < 60) {
        return res.status(429).json({
          error: `Tampon refusé ! Dernier tampon il y a ${Math.floor(diffMinutes)} minutes. Attendez ${Math.floor(60 - diffMinutes)} minutes.`
        });
      }
    }
    const newStamps = card.stamps + 1;
    const { data, error } = await supabase
      .from('loyalty_cards')
      .update({ stamps: newStamps, last_stamp_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) throw error;
    await supabase.from('stamp_events').insert([{
      shop_id: card.shop_id,
      customer_id: card.customer_id,
      card_id: id
    }]);
    if (card.passkit_member_id) {
      try {
        await updatePassKitMember(card.passkit_member_id, 1);
      } catch(e) {
        console.log('Erreur update PassKit:', e.message);
      }
    }
    if (card.push_token) {
      try {
        const notification = new apn.Notification();
        notification.topic = 'pass.com.fideleasy';
        notification.payload = {};
        await apnProvider.send(notification, card.push_token);
      } catch(e) {
        console.log('Erreur push Apple Wallet:', e.message);
      }
    }
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
    await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${process.env.ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        included_segments: ['All'],
        headings: { en: title },
        contents: { en: message }
      })
    });
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
    const url = `https://fideleasy.app/join/${shop_id}`;
    const qrCode = await QRCode.toDataURL(url);
    res.json({ qrCode, url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/stats/:shop_id', async (req, res) => {
  try {
    const { shop_id } = req.params;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const lastWeekStart = new Date();
    lastWeekStart.setDate(lastWeekStart.getDate() - 14);
    const lastWeekEnd = new Date();
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
    const { data: events } = await supabase.from('stamp_events').select('*').eq('shop_id', shop_id).gte('created_at', sevenDaysAgo.toISOString());
    const { data: lastWeekEvents } = await supabase.from('stamp_events').select('*').eq('shop_id', shop_id).gte('created_at', lastWeekStart.toISOString()).lte('created_at', lastWeekEnd.toISOString());
    const { data: monthEvents } = await supabase.from('stamp_events').select('*').eq('shop_id', shop_id).gte('created_at', thirtyDaysAgo.toISOString());
    const { data: allEvents } = await supabase.from('stamp_events').select('*').eq('shop_id', shop_id);
    const { data: cards } = await supabase.from('loyalty_cards').select('*').eq('shop_id', shop_id);
    const { data: shop } = await supabase.from('shops').select('*').eq('id', shop_id).single();
    const topClients = [...(cards || [])].sort((a, b) => (b.stamps || 0) - (a.stamps || 0)).slice(0, 5);
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const stampsByDay = [0, 0, 0, 0, 0, 0, 0];
    events?.forEach(e => { const day = new Date(e.created_at).getDay(); stampsByDay[day]++; });
    const inactiveClients = (cards || []).filter(c => { if (!c.last_stamp_at) return true; return new Date(c.last_stamp_at) < thirtyDaysAgo; });
    const activeClients = (cards || []).filter(c => c.last_stamp_at && new Date(c.last_stamp_at) >= thirtyDaysAgo);
    const retentionRate = cards?.length > 0 ? Math.round((activeClients.length / cards.length) * 100) : 0;
    const completedCards = (cards || []).filter(c => c.stamps >= (shop?.card_stamps_required || 10));
    const avgTicket = 15;
    const estimatedRevenue = Math.round(allEvents?.length * avgTicket);
    const weekGrowth = lastWeekEvents?.length > 0
      ? Math.round(((events?.length - lastWeekEvents?.length) / lastWeekEvents?.length) * 100)
      : events?.length > 0 ? 100 : 0;
    res.json({
      stampsByDay: days.map((d, i) => ({ day: d, count: stampsByDay[i] })),
      topClients,
      totalStamps: allEvents?.length || 0,
      inactiveCount: inactiveClients?.length || 0,
      weekStamps: events?.length || 0,
      monthStamps: monthEvents?.length || 0,
      retentionRate,
      completedCards: completedCards?.length || 0,
      estimatedRevenue,
      weekGrowth,
      activeClients: activeClients?.length || 0,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Apple Wallet Push Updates
app.post('/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber', async (req, res) => {
  try {
    const { serialNumber } = req.params;
    const pushToken = req.body.pushToken;
    const card_id = serialNumber.split('_')[0];
    await supabase.from('loyalty_cards').update({ push_token: pushToken }).eq('id', card_id);
    res.status(201).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber', async (req, res) => {
  res.status(200).send();
});

app.get('/v1/passes/:passTypeId/:serialNumber', async (req, res) => {
  const { serialNumber } = req.params;
  const card_id = serialNumber.split('_')[0];
  res.redirect(`https://fideleasy-backend-production.up.railway.app/pass/apple/${card_id}`);
});

// Générer une vraie carte Apple Wallet
app.get('/pass/apple/:card_id', async (req, res) => {
  try {
    const { card_id } = req.params;
    const { data: card } = await supabase.from('loyalty_cards').select('*').eq('id', card_id).single();
    const { data: customer } = await supabase.from('customers').select('*').eq('id', card.customer_id).single();
    const { data: shop } = await supabase.from('shops').select('*').eq('id', card.shop_id).single();
    const stripImageBuffer = await generateStripImage(shop);
    const logoCanvas = createCanvas(160, 160);
    const lCtx = logoCanvas.getContext('2d');
    lCtx.clearRect(0, 0, 160, 160);
    lCtx.fillStyle = '#d4af37';
    lCtx.beginPath();
    lCtx.arc(80, 80, 76, 0, Math.PI * 2);
    lCtx.fill();
    const shopInitial = (shop?.card_logo_text || shop?.name || 'F')[0].toUpperCase();
    lCtx.fillStyle = '#0a0a18';
    lCtx.font = 'bold 80px Arial';
    lCtx.textAlign = 'center';
    lCtx.textBaseline = 'middle';
    lCtx.fillText(shopInitial, 80, 80);
    const logoBuffer = logoCanvas.toBuffer('image/png');
    const isPoints = shop?.loyalty_type === 'points';
    const primaryValue = isPoints ? card.points.toString() : `${card.stamps}/${shop?.card_stamps_required || 10}`;
    const primaryLabel = isPoints ? 'Points' : 'Tampons';
    const pass = new PKPass({
      'pass.json': Buffer.from(JSON.stringify({
        formatVersion: 1,
        passTypeIdentifier: 'pass.com.fideleasy',
        serialNumber: `${card_id}_${Date.now()}`,
        teamIdentifier: 'Q7XBK68TWG',
        webServiceURL: 'https://fideleasy-backend-production.up.railway.app',
        authenticationToken: card_id,
        backgroundColor: shop?.card_color || 'rgb(10, 10, 24)',
        foregroundColor: 'rgb(255, 255, 255)',
        labelColor: 'rgb(212, 175, 55)',
        logoText: shop?.card_logo_text || shop?.name || 'FidelEasy',
        organizationName: shop?.name || 'FidelEasy',
        description: `Carte de fidélité ${shop?.name || 'FidelEasy'}`,
        storeCard: {
          primaryFields: [{ key: 'balance', label: primaryLabel, value: primaryValue }],
          secondaryFields: [{ key: 'member', label: 'Membre', value: customer ? customer.name : 'Client' }],
        }
      })),
      'logo.png': logoBuffer,
      'logo@2x.png': logoBuffer,
      'icon.png': fs.readFileSync('/app/passes/FidelEasy.pass/icon.png'),
      'icon@2x.png': fs.readFileSync('/app/passes/FidelEasy.pass/icon@2x.png'),
    }, {
      wwdr: fs.readFileSync('/app/certs/wwdr_clean.pem'),
      signerCert: fs.readFileSync('/app/certs/pass_clean.pem'),
      signerKey: fs.readFileSync('/app/certs/pass_clean.key'),
      signerKeyPassphrase: '123456'
    });
    const buffer = pass.getAsBuffer();
    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="fideleasy.pkpass"`,
      'Content-Transfer-Encoding': 'binary'
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
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;
    const { data: shop, error: shopError } = await supabase.from('shops').insert([{ name: shop_name, email, plan: 'starter', user_id: authData.user.id }]).select();
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data: shop } = await supabase.from('shops').select('*').eq('user_id', data.user.id).single();
    res.json({ message: 'Connecté !', token: data.session.access_token, user: data.user, shop });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Google Wallet
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
});

// Stripe
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const PLANS = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  business: process.env.STRIPE_PRICE_BUSINESS
};

app.post('/stripe/checkout', async (req, res) => {
  try {
    const { plan, shop_id } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: PLANS[plan], quantity: 1 }],
      success_url: 'https://fideleasy.app/dashboard?success=true',
      cancel_url: 'https://fideleasy.app/dashboard?cancelled=true',
      metadata: { shop_id, plan }
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Notifications Push APNs
const apn = require('@parse/node-apn');
const apnProvider = new apn.Provider({
  token: {
    key: '/app/certs/AuthKey_JW6GJSYM9L.p8',
    keyId: 'JW6GJSYM9L',
    teamId: 'Q7XBK68TWG'
  },
  production: true
});

app.post('/push/send', async (req, res) => {
  try {
    const { device_token, title, body } = req.body;
    const notification = new apn.Notification();
    notification.alert = { title, body };
    notification.badge = 1;
    notification.sound = 'default';
    notification.topic = 'com.fideleasy.app';
    const result = await apnProvider.send(notification, device_token);
    res.json({ message: 'Notification envoyée !', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mettre à jour un commerce
app.patch('/shops/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const { data, error } = await supabase.from('shops').update(updates).eq('id', id).select();
    if (error) throw error;
    res.json({ message: 'Commerce mis à jour !', data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`FidelEasy API démarrée sur le port ${PORT}`);
});