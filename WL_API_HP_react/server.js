const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json());

const vapidKeys = webpush.generateVAPIDKeys();

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

let subscriptions = [];

app.post('/subscribe', (req, res) => {
  const subscription = req.body;
  subscriptions.push(subscription);
  res.status(201).json({});
});

app.post('/unsubscribe', (req, res) => {
  const subscription = req.body;
  subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
  res.status(200).json({});
});

const checkDepartures = async () => {
  // Replace with your actual API endpoint
  const response = await fetch('https://your-api-endpoint.com/departures');
  const departures = await response.json();

  // Logic to determine if a notification should be sent
  const shouldNotify = departures.some(dep => dep.timeUntilDeparture <= 10); // 10 minutes

  if (shouldNotify) {
    subscriptions.forEach(subscription => {
      webpush.sendNotification(subscription, JSON.stringify({
        title: 'Bus Arriving Soon',
        body: 'Your bus will arrive in 10 minutes or less!'
      }))
        .catch(error => {
          console.error('Error sending notification:', error);
        });
    });
  }
};

// Check departures every hour
setInterval(checkDepartures, 60 * 60 * 1000);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});