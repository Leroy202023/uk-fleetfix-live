require('dotenv').config();
const express = require('express');
const gocardless = require('gocardless-nodejs');
const { webhooks, Environments } = require('gocardless-nodejs');

const app = express();
const port = process.env.PORT || 3000;
const LIVE_ACCESS_TOKEN = process.env.GC_ACCESS_TOKEN || 'live_iurGM-up92x3eYmgN19y51_R3y1s1zxRz6iUGvWk';
const WEBHOOK_SECRET = process.env.GC_WEBHOOK_SECRET || 'secret';
const gcClient = gocardless(LIVE_ACCESS_TOKEN, Environments.Live);

app.post('/api/webhooks/gocardless', express.raw({ type: 'application/json' }), (req, res) => {
  const signatureHeader = req.headers['webhook-signature'];
  try {
    const events = webhooks.parse(req.body.toString(), WEBHOOK_SECRET, signatureHeader);
    events.forEach((event) => {
      if (event.resource_type === 'mandates' && event.action === 'activated') {
        gcClient.subscriptions.create({ amount: '2500', currency: 'GBP', name: 'UK FleetFix Featured Listing', interval_unit: 'monthly', links: { mandate: event.links.mandate } });
      }
    });
    res.status(200).send({ received: true });
  } catch (err) { res.status(400).send(`Webhook Error: ${err.message}`); }
});

app.use(express.json());
app.use(express.static('.'));

app.post('/api/create-gocardless-flow', async (req, res) => {
  const { companyName, email } = req.body;
  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  try {
    const redirectFlow = await gcClient.redirectFlows.create({
      session_token: `session_${Date.now()}`,
      success_redirect_url: `${protocol}://${host}/api/complete-gocardless-flow`,
      description: 'UK FleetFix - £25/mo Featured Directory Listing',
      prefilled_customer: { company_name: companyName, email: email }
    });
    res.json({ authorisation_url: redirectFlow.authorisation_url });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/complete-gocardless-flow', async (req, res) => {
  const { redirect_flow_id } = req.query;
  try {
    const completedFlow = await gcClient.redirectFlows.complete(redirect_flow_id, { session_token: `session_token_used` });
    await gcClient.subscriptions.create({ amount: '2500', currency: 'GBP', name: 'UK FleetFix Featured Directory Listing', interval_unit: 'monthly', links: { mandate: completedFlow.links.mandate } });
    res.redirect('/redirect-success.html');
  } catch (error) { res.status(500).send(`Payment Setup Failed: ${error.message}`); }
});

app.listen(port, () => console.log(`Live Server active on port ${port}`));
